// The till: the item list the phone keeps, and sales that wait on the phone
// until there is signal. Each sale carries an id made on the phone, so sending
// it twice (a retry after the signal dropped mid-send) still records it once.
// The money itself goes through the cash box or the card reader, as it
// always has; a sale records which. A sale can be undone (update 57): off the
// record, stock back, left out of Today's sales; the app still moves no money.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import { normalizeCode, skuParts } from '../scan/codes'
import { readLocal, writeLocal } from './local'

export interface CounterProduct {
  id: string
  name: string
  price_cents: number
  photo_url: string | null
  quantity: number
  sku: string | null
  category: string | null
  codes: string[]
}

export type PayMethod = 'cash' | 'card' | 'other'

export interface SaleLine {
  product_id: string | null
  name: string
  /** The label price for one. */
  price_cents: number
  qty: number
  /** Update 47: what was charged for the whole line when the price was changed ("3 for $30"). */
  line_cents?: number
}

export interface Sale {
  id: string
  sold_at: string
  method: PayMethod
  device: string
  note?: string
  lines: SaleLine[]
}

/** The sale this phone rang up last, kept so it can be undone, even after leaving the screen. */
export interface LastSale {
  id: string
  sold_at: string
  method: PayMethod
  total_cents: number
  lines: { product_id: string | null; name: string; qty: number }[]
}

/** An undo waiting to go out. `optional`: the sale may never have reached the database, so a failure is not worth showing. */
interface PendingVoid {
  id: string
  lines: { product_id: string | null; qty: number }[]
  optional?: boolean
}

/** 'undone': done now. 'waiting': it will go through when the phone has signal. */
export type VoidResult = 'undone' | 'waiting'

/** What a line comes to: the changed price if there is one, else the label price times how many. */
export const lineTotal = (l: SaleLine) => (typeof l.line_cents === 'number' ? l.line_cents : l.price_cents * l.qty)

export const saleTotal = (lines: SaleLine[]) => lines.reduce((n, l) => n + lineTotal(l), 0)

/**
 * May this line's price be changed at the counter? OHRR (2026-10-27): "on
 * items that we sell that are not a vendor item we need to be able to adjust
 * the price". Anything typed in ("Something else"), an item with no SKU, or
 * one from vendor 000 (donated, or OHRR's own) may; a vendor's item keeps its
 * label price.
 */
export function canChangePrice(productId: string | null, products: CounterProduct[]): boolean {
  if (!productId) return true
  const sku = products.find((p) => p.id === productId)?.sku
  if (!sku) return true
  const parts = skuParts(sku)
  return !parts || parts.vendor === '000'
}

const PRODUCTS_KEY = 'ohrr.counter.products.v1'
const QUEUE_KEY = 'ohrr.counter.sales.v1'
const VOIDS_KEY = 'ohrr.counter.voids.v1'
const LAST_KEY = 'ohrr.counter.last.v1'

const isNetworkMessage = (msg: string) => /fetch|network|Failed|load/i.test(msg)

/** Which item a scanned or typed code belongs to (OHRR label or maker's barcode). */
export function findByCode(raw: string, products: CounterProduct[]): CounterProduct | null {
  const code = normalizeCode(raw)
  if (!code) return null
  return products.find((p) => p.codes.some((c) => c === code) || (p.sku ?? '') === code) ?? null
}

export interface Till {
  products: CounterProduct[]
  loaded: boolean
  waiting: number
  online: boolean
  error: string | null
  refresh: () => Promise<void>
  recordSale: (s: Sale) => void
  /** The sale rung up last on this phone, until it is undone or the next one is rung up. */
  last: LastSale | null
  /** Undo that sale. Throws a plain-words message if it can't be undone. */
  undoSale: (id: string) => Promise<VoidResult>
  syncNow: () => Promise<void>
}

export function useTill(orgId: string | null): Till {
  const [products, setProducts] = useState<CounterProduct[]>(() => readLocal(PRODUCTS_KEY, []))
  const [loaded, setLoaded] = useState(() => readLocal<CounterProduct[] | null>(PRODUCTS_KEY, null) !== null)
  const [queue, setQueue] = useState<Sale[]>(() => readLocal(QUEUE_KEY, []))
  const [last, setLastState] = useState<LastSale | null>(() => readLocal<LastSale | null>(LAST_KEY, null))
  const voidsRef = useRef<PendingVoid[]>(readLocal(VOIDS_KEY, []))
  const lastRef = useRef(last)
  lastRef.current = last
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const queueRef = useRef(queue)
  queueRef.current = queue

  const refresh = useCallback(async () => {
    if (!orgId) return
    const { data, error: err } = await supabase.rpc('counter_products', { p_org: orgId })
    if (err) {
      setOnline(!/fetch|network|Failed|load/i.test(err.message))
      return
    }
    // Stock as the database has it, less anything sold here and not yet sent.
    const list = ((data ?? []) as unknown as CounterProduct[]).map((p) => {
      const pending = queueRef.current.flatMap((s) => s.lines).filter((l) => l.product_id === p.id).reduce((n, l) => n + l.qty, 0)
      const back = voidsRef.current.flatMap((v) => v.lines).filter((l) => l.product_id === p.id).reduce((n, l) => n + l.qty, 0)
      return { ...p, quantity: Math.max(0, p.quantity - pending + back) }
    })
    writeLocal(PRODUCTS_KEY, list)
    setProducts(list)
    setLoaded(true)
  }, [orgId])

  const syncNow = useCallback(async () => {
    if (!orgId || busy.current) return
    busy.current = true
    try {
      // In order; stop at the first one that can't go, and try again later.
      for (const sale of [...queueRef.current]) {
        const { error: err } = await supabase.rpc('record_counter_sale', { p_org: orgId, p_sale: sale as unknown as Json })
        if (err) throw err
        const left = queueRef.current.filter((s) => s.id !== sale.id)
        queueRef.current = left
        writeLocal(QUEUE_KEY, left)
        setQueue(left)
      }
      // Then the undos, so each one finds its sale in the database.
      let failed: string | null = null
      for (const v of [...voidsRef.current]) {
        const { error: err } = await supabase.rpc('void_counter_sale', { p_org: orgId, p_sale: v.id })
        if (err && isNetworkMessage(err.message)) throw err
        // Anything else won't get better by trying again: drop it.
        voidsRef.current = voidsRef.current.filter((x) => x.id !== v.id)
        writeLocal(VOIDS_KEY, voidsRef.current)
        if (err && !v.optional) failed = `An undo couldn’t go through: ${err.message}`
      }
      setOnline(true)
      setError(failed)
      await refresh()
    } catch (e) {
      const msg = errMessage(e)
      const net = (typeof navigator !== 'undefined' && !navigator.onLine) || isNetworkMessage(msg)
      setOnline(!net)
      setError(net ? null : msg)
    } finally {
      busy.current = false
    }
  }, [orgId, refresh])

  useEffect(() => {
    void syncNow()
    const t = setInterval(() => void syncNow(), 20_000)
    const on = () => void syncNow()
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [syncNow])

  const recordSale = useCallback(
    (s: Sale) => {
      const next = [...queueRef.current, s]
      queueRef.current = next
      writeLocal(QUEUE_KEY, next)
      setQueue(next)
      const kept: LastSale = {
        id: s.id,
        sold_at: s.sold_at,
        method: s.method,
        total_cents: saleTotal(s.lines),
        lines: s.lines.map((l) => ({ product_id: l.product_id, name: l.name, qty: l.qty })),
      }
      writeLocal(LAST_KEY, kept)
      setLastState(kept)
      // Show the stock going down straight away, signal or not.
      setProducts((list) => {
        const out = list.map((p) => {
          const sold = s.lines.filter((l) => l.product_id === p.id).reduce((n, l) => n + l.qty, 0)
          return sold ? { ...p, quantity: Math.max(0, p.quantity - sold) } : p
        })
        writeLocal(PRODUCTS_KEY, out)
        return out
      })
      void syncNow()
    },
    [syncNow],
  )

  /** Put the items back in the phone's own stock count. */
  const addBack = useCallback((lines: { product_id: string | null; qty: number }[]) => {
    setProducts((list) => {
      const out = list.map((p) => {
        const back = lines.filter((l) => l.product_id === p.id).reduce((n, l) => n + l.qty, 0)
        return back ? { ...p, quantity: p.quantity + back } : p
      })
      writeLocal(PRODUCTS_KEY, out)
      return out
    })
  }, [])

  const undoSale = useCallback(
    async (id: string): Promise<VoidResult> => {
      const sale = lastRef.current?.id === id ? lastRef.current : null
      if (!sale) throw new Error('That sale can’t be undone from this phone.')
      const forget = () => {
        writeLocal(LAST_KEY, null)
        setLastState(null)
      }
      const waitFor = (v: PendingVoid) => {
        voidsRef.current = [...voidsRef.current.filter((x) => x.id !== v.id), v]
        writeLocal(VOIDS_KEY, voidsRef.current)
        addBack(v.lines)
        forget()
        void syncNow()
        return 'waiting' as const
      }
      const lines = sale.lines.map((l) => ({ product_id: l.product_id, qty: l.qty }))

      if (queueRef.current.some((s) => s.id === id)) {
        if (busy.current) return waitFor({ id, lines }) // being sent right now: it goes out first, then the undo
        // Never sent: take it out of the queue. The undo is also queued, in case an earlier send got through and the reply was lost.
        const left = queueRef.current.filter((s) => s.id !== id)
        queueRef.current = left
        writeLocal(QUEUE_KEY, left)
        setQueue(left)
        voidsRef.current = [...voidsRef.current, { id, lines: [], optional: true }]
        writeLocal(VOIDS_KEY, voidsRef.current)
        addBack(lines)
        forget()
        void syncNow()
        return 'undone'
      }

      // Already sent: the database undoes it.
      if (!orgId) throw new Error('Not signed in yet. Try again in a moment.')
      try {
        const { error: err } = await supabase.rpc('void_counter_sale', { p_org: orgId, p_sale: id })
        if (err) throw err
        forget()
        await refresh()
        return 'undone'
      } catch (e) {
        const msg = errMessage(e)
        if ((typeof navigator !== 'undefined' && !navigator.onLine) || isNetworkMessage(msg)) return waitFor({ id, lines })
        if (/could not find the function|schema cache|does not exist/i.test(msg)) {
          throw new Error('Undo isn’t switched on yet, so nothing was changed. Ask a team lead.')
        }
        throw new Error(msg)
      }
    },
    [orgId, refresh, syncNow, addBack],
  )

  return { products, loaded, waiting: queue.length, online, error, refresh, recordSale, last, undoSale, syncNow }
}

/* ------------------------------------------------ codes */

export async function linkCode(orgId: string, productId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('counter_link_code', { p_org: orgId, p_product: productId, p_code: code })
  if (error) throw error
}

export interface CounterDay {
  sales: number
  /** Sales that were undone: left out of every total here. */
  voided?: number
  cash_cents: number
  card_cents: number
  other_cents: number
  items: { name: string; qty: number; cents: number }[]
}

export async function counterDay(orgId: string, day: string): Promise<CounterDay | null> {
  const { data, error } = await supabase.rpc('counter_day', { p_org: orgId, p_day: day })
  if (error) throw error
  return (data as unknown as CounterDay | null) ?? null
}
