// The till: the item list the phone keeps, and sales that wait on the phone
// until there is signal. Each sale carries an id made on the phone, so sending
// it twice (a retry after the signal dropped mid-send) still records it once.
// The money itself goes through the cash box or the card reader, as it
// always has; a sale records which.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import { newTagCode, normalizeCode } from '../scan/codes'
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
  price_cents: number
  qty: number
}

export interface Sale {
  id: string
  sold_at: string
  method: PayMethod
  device: string
  note?: string
  lines: SaleLine[]
}

export const saleTotal = (lines: SaleLine[]) => lines.reduce((n, l) => n + l.price_cents * l.qty, 0)

const PRODUCTS_KEY = 'ohrr.counter.products.v1'
const QUEUE_KEY = 'ohrr.counter.sales.v1'

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
  syncNow: () => Promise<void>
}

export function useTill(orgId: string | null): Till {
  const [products, setProducts] = useState<CounterProduct[]>(() => readLocal(PRODUCTS_KEY, []))
  const [loaded, setLoaded] = useState(() => readLocal<CounterProduct[] | null>(PRODUCTS_KEY, null) !== null)
  const [queue, setQueue] = useState<Sale[]>(() => readLocal(QUEUE_KEY, []))
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
      return { ...p, quantity: Math.max(0, p.quantity - pending) }
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
      setOnline(true)
      setError(null)
      await refresh()
    } catch (e) {
      const msg = errMessage(e)
      const net = (typeof navigator !== 'undefined' && !navigator.onLine) || /fetch|network|Failed|load/i.test(msg)
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

  return { products, loaded, waiting: queue.length, online, error, refresh, recordSale, syncNow }
}

/* ------------------------------------------------ adding items */

export async function addItem(
  orgId: string,
  i: { name: string; priceCents: number; quantity: number; photoUrl: string | null; description?: string },
): Promise<{ id: string; code: string }> {
  // A fresh OHRR number; on the rare clash, try another.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newTagCode()
    const { data, error } = await supabase.rpc('counter_add_item', {
      p_org: orgId,
      p_name: i.name,
      p_price_cents: i.priceCents,
      p_quantity: i.quantity,
      p_photo_url: i.photoUrl,
      p_code: code,
      p_description: i.description ?? null,
    })
    if (!error) return data as { id: string; code: string }
    if (!/already on another item/i.test(error.message)) throw error
  }
  throw new Error('Couldn’t make a new item number — please try again')
}

export async function linkCode(orgId: string, productId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('counter_link_code', { p_org: orgId, p_product: productId, p_code: code })
  if (error) throw error
}

export interface CounterDay {
  sales: number
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
