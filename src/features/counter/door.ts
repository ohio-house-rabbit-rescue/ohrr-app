// The door: checking advance tickets and selling at the door, with or without
// signal.
//
// Each door phone keeps the whole ticket list and every entry so far (the
// "pack"). A receipt is checked against that copy, so it answers instantly
// with no signal. New entries go into a queue on the phone first; door_sync()
// sends the queue and hands back everyone's entries, every few seconds while
// there is signal. A receipt used at one door is then refused at the others.
//
// If two phones are both offline and take the same receipt, both entries are
// kept; `duplicates()` lists it with the times and phones so it can be
// looked at afterwards.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import { readLocal, writeLocal } from './local'

export interface DoorTicket {
  code: string
  name: string | null
  adults: number
  children: number
  under5: number
}

export type DoorKind = 'ticket' | 'walkup' | 'void'
export type DoorMethod = 'cash' | 'card' | 'free'

export interface DoorEntry {
  id: string
  kind: DoorKind
  ticket_code: string | null
  adults: number
  children: number
  under5: number
  method: DoorMethod | null
  amount_cents: number
  override_reason: string | null
  voids: string | null
  device: string | null
  at: string
}

export interface DoorPack {
  tickets: DoorTicket[]
  entries: DoorEntry[]
  server_time?: string
}

export interface DoorPrices {
  adult: number
  child: number
  under5: number
}

export interface DoorSettings {
  event_key: string
  event_name: string
  prices: DoorPrices
}

/** OHRR's published BunFest 2026 admission, used until the setting loads. */
export const DEFAULT_DOOR: DoorSettings = {
  event_key: 'bunfest-2026',
  event_name: 'Midwest BunFest 2026',
  prices: { adult: 1000, child: 500, under5: 0 },
}

/** "#1043", "1043 ", "ab-12" → "1043", "AB12": how receipts are compared. */
export const normalizeReceipt = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

export const heads = (e: { adults: number; children: number; under5: number }) => e.adults + e.children + e.under5

export function partyText(e: { adults: number; children: number; under5: number }): string {
  const bits: string[] = []
  if (e.adults) bits.push(`${e.adults} ${e.adults === 1 ? 'adult' : 'adults'}`)
  if (e.children) bits.push(`${e.children} ${e.children === 1 ? 'child' : 'children'} 5–12`)
  if (e.under5) bits.push(`${e.under5} under 5`)
  return bits.length ? bits.join(', ') : 'nobody'
}

/** Entries that still count: everything not taken back by a later "void". */
export function liveEntries(entries: DoorEntry[]): DoorEntry[] {
  const voided = new Set(entries.filter((e) => e.kind === 'void' && e.voids).map((e) => e.voids as string))
  return entries.filter((e) => e.kind !== 'void' && !voided.has(e.id))
}

export type CheckResult =
  | { status: 'ok'; ticket: DoorTicket }
  | { status: 'used'; ticket: DoorTicket; uses: DoorEntry[] }
  | { status: 'unknown'; code: string }

export function checkReceipt(raw: string, tickets: DoorTicket[], entries: DoorEntry[]): CheckResult {
  const code = normalizeReceipt(raw)
  const ticket = tickets.find((t) => t.code === code)
  if (!ticket) return { status: 'unknown', code }
  const uses = liveEntries(entries).filter((e) => e.kind === 'ticket' && e.ticket_code === code)
  return uses.length ? { status: 'used', ticket, uses } : { status: 'ok', ticket }
}

export function findByName(q: string, tickets: DoorTicket[]): DoorTicket[] {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  return tickets.filter((x) => (x.name ?? '').toLowerCase().includes(t)).slice(0, 8)
}

export interface DoorTotals {
  advance: number
  atDoor: number
  cashCents: number
  cardCents: number
  ticketsUsed: number
  ticketsTotal: number
}

export function totals(tickets: DoorTicket[], entries: DoorEntry[]): DoorTotals {
  const live = liveEntries(entries)
  const used = new Set(live.filter((e) => e.kind === 'ticket' && e.ticket_code).map((e) => e.ticket_code))
  return {
    advance: live.filter((e) => e.kind === 'ticket').reduce((n, e) => n + heads(e), 0),
    atDoor: live.filter((e) => e.kind === 'walkup').reduce((n, e) => n + heads(e), 0),
    cashCents: live.filter((e) => e.method === 'cash').reduce((n, e) => n + e.amount_cents, 0),
    cardCents: live.filter((e) => e.method === 'card').reduce((n, e) => n + e.amount_cents, 0),
    ticketsUsed: used.size,
    ticketsTotal: tickets.length,
  }
}

/** Receipts let in more than once (two phones offline at once, or an override). */
export function duplicates(entries: DoorEntry[]): { code: string; uses: DoorEntry[] }[] {
  const by = new Map<string, DoorEntry[]>()
  for (const e of liveEntries(entries)) {
    if (e.kind !== 'ticket' || !e.ticket_code) continue
    by.set(e.ticket_code, [...(by.get(e.ticket_code) ?? []), e])
  }
  return [...by.entries()].filter(([, u]) => u.length > 1).map(([code, uses]) => ({ code, uses }))
}

export const walkupCents = (p: DoorPrices, n: { adults: number; children: number; under5: number }) =>
  n.adults * p.adult + n.children * p.child + n.under5 * p.under5

/* ================================================= settings */

export function useDoorSettings(orgId: string | null): DoorSettings {
  const key = 'ohrr.door.settings.v1'
  const [s, setS] = useState<DoorSettings>(() => readLocal(key, DEFAULT_DOOR))
  useEffect(() => {
    if (!orgId) return
    let active = true
    supabase
      .from('app_settings')
      .select('value')
      .eq('org_id', orgId)
      .eq('key', 'door')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error || !data?.value) return
        const v = data.value as Partial<DoorSettings>
        const next: DoorSettings = {
          event_key: v.event_key || DEFAULT_DOOR.event_key,
          event_name: v.event_name || DEFAULT_DOOR.event_name,
          prices: { ...DEFAULT_DOOR.prices, ...(v.prices ?? {}) },
        }
        setS(next)
        writeLocal(key, next)
      })
    return () => {
      active = false
    }
  }, [orgId])
  return s
}

export async function saveDoorSettings(orgId: string, s: DoorSettings): Promise<void> {
  const { error } = await supabase.rpc('save_door_settings', { p_org: orgId, p_value: s as unknown as Json })
  if (error) throw error
}

/* ================================================= the phone's copy, and syncing */

export interface DoorSync {
  tickets: DoorTicket[]
  /** Everyone's entries plus this phone's not yet sent — what the screen counts. */
  entries: DoorEntry[]
  waiting: number
  online: boolean
  lastSync: string | null
  error: string | null
  record: (e: DoorEntry) => void
  syncNow: () => Promise<void>
}

const packKey = (event: string) => `ohrr.door.pack.${event}`
const queueKey = (event: string) => `ohrr.door.queue.${event}`

export function useDoorSync(orgId: string | null, event: string): DoorSync {
  const [pack, setPack] = useState<DoorPack & { pulledAt?: string }>(() => readLocal(packKey(event), { tickets: [], entries: [] }))
  const [queue, setQueue] = useState<DoorEntry[]>(() => readLocal(queueKey(event), []))
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const queueRef = useRef(queue)
  queueRef.current = queue

  // A different event (settings changed): start from that event's copy.
  useEffect(() => {
    setPack(readLocal(packKey(event), { tickets: [], entries: [] }))
    setQueue(readLocal(queueKey(event), []))
  }, [event])

  const syncNow = useCallback(async () => {
    if (!orgId || busy.current) return
    busy.current = true
    const sending = queueRef.current
    try {
      const { data, error: err } = await supabase.rpc('door_sync', { p_org: orgId, p_event: event, p_entries: sending as unknown as Json })
      if (err) throw err
      if (!data) throw new Error('Not allowed to use the door on this account')
      const next = { ...(data as unknown as DoorPack), pulledAt: new Date().toISOString() }
      writeLocal(packKey(event), next)
      setPack(next)
      // Keep only what was added while this was in flight.
      const sent = new Set(sending.map((e) => e.id))
      const left = queueRef.current.filter((e) => !sent.has(e.id))
      writeLocal(queueKey(event), left)
      setQueue(left)
      setOnline(true)
      setError(null)
    } catch (e) {
      const msg = errMessage(e)
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      setOnline(!offline && !/fetch|network|Failed|load/i.test(msg))
      setError(offline || /fetch|network|Failed|load/i.test(msg) ? null : msg)
    } finally {
      busy.current = false
    }
  }, [orgId, event])

  // Every 15 seconds, when the signal comes back, and when the phone wakes.
  useEffect(() => {
    void syncNow()
    const t = setInterval(() => void syncNow(), 15_000)
    const on = () => {
      setOnline(true)
      void syncNow()
    }
    const off = () => setOnline(false)
    const vis = () => document.visibilityState === 'visible' && void syncNow()
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [syncNow])

  const record = useCallback(
    (e: DoorEntry) => {
      const next = [...queueRef.current, e]
      queueRef.current = next
      writeLocal(queueKey(event), next)
      setQueue(next)
      void syncNow()
    },
    [event, syncNow],
  )

  const entries = useMemo(() => {
    const seen = new Set(pack.entries.map((e) => e.id))
    return [...pack.entries, ...queue.filter((e) => !seen.has(e.id))]
  }, [pack.entries, queue])

  return {
    tickets: pack.tickets,
    entries,
    waiting: queue.length,
    online,
    lastSync: pack.pulledAt ?? null,
    error,
    record,
    syncNow,
  }
}

/* ================================================= loading advance tickets */

export interface ImportRow {
  code: string
  name: string
  adults: number
  children: number
  under5: number
}

export async function importTickets(orgId: string, event: string, rows: ImportRow[], source = 'import') {
  const { data, error } = await supabase.rpc('door_import', { p_org: orgId, p_event: event, p_rows: rows as unknown as Json, p_source: source })
  if (error) throw error
  return data as { new: number; updated: number }
}

export async function removeTicket(orgId: string, event: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('door_remove_ticket', { p_org: orgId, p_event: event, p_code: code })
  if (error) throw error
}

/* ------------------------------------------------ reading the ticket shop's export */

/** A small CSV reader: quoted fields, commas and new lines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

export type TicketType = 'adult' | 'child' | 'under5' | 'skip'

export interface CsvColumns {
  code: number
  name: number
  item: number
  qty: number
}

/** A best guess at which column is which, from the header names. */
export function guessColumns(header: string[]): CsvColumns {
  const h = header.map((x) => x.toLowerCase().trim())
  const find = (...tests: ((s: string) => boolean)[]) => {
    for (const t of tests) {
      const i = h.findIndex(t)
      if (i >= 0) return i
    }
    return -1
  }
  return {
    code: find(
      (s) => /order\s*(number|no|#)/.test(s),
      (s) => /receipt\s*(number|no|#)/.test(s),
      (s) => s === 'order' || s === 'order id' || s === 'order_id',
      (s) => /order/.test(s) && /id/.test(s),
      (s) => /receipt|transaction/.test(s),
    ),
    name: find(
      (s) => /(customer|buyer|recipient|billing|purchaser)\s*name/.test(s),
      (s) => s === 'name' || s === 'full name',
      (s) => /name/.test(s) && !/item|product/.test(s),
    ),
    item: find(
      (s) => /item\s*name|product\s*name|line\s*item/.test(s),
      (s) => s === 'item' || s === 'product' || s === 'description',
      (s) => /item|product|ticket/.test(s),
    ),
    qty: find((s) => /^(qty|quantity)$/.test(s), (s) => /quantity|qty|count/.test(s)),
  }
}

/** What an item on the order is, from its name. */
export function guessType(item: string): TicketType {
  const s = item.toLowerCase()
  // Shirts, raffle tickets, spa or photo bookings are on the same orders but aren't admission.
  if (/shirt|\btee\b|hoodie|merch|raffle|auction|spa\b|glamou?r|photo|donat|workshop|sticker|mug|tote|lanyard/.test(s)) return 'skip'
  if (!/admission|ticket|entry|entrance/.test(s)) return 'skip'
  if (/under\s*5|under five|0\s*-\s*4|infant|toddler/.test(s)) return 'under5'
  if (/child|kid|youth|5\s*-\s*12|5\s*to\s*12|ages?\s*5/.test(s)) return 'child'
  return 'adult'
}

/** Rows of the export → one ticket per receipt, with its party added up. */
export function rowsToTickets(rows: string[][], cols: CsvColumns, types: Record<string, TicketType>): ImportRow[] {
  const by = new Map<string, ImportRow>()
  for (const r of rows) {
    const code = normalizeReceipt(r[cols.code] ?? '')
    if (!code) continue
    const item = cols.item >= 0 ? (r[cols.item] ?? '').trim() : 'Admission'
    const type = types[item] ?? guessType(item)
    if (type === 'skip') continue
    const qty = cols.qty >= 0 ? Math.max(0, parseInt((r[cols.qty] ?? '1').replace(/[^0-9]/g, ''), 10) || 0) : 1
    const t = by.get(code) ?? { code, name: cols.name >= 0 ? (r[cols.name] ?? '').trim() : '', adults: 0, children: 0, under5: 0 }
    if (!t.name && cols.name >= 0) t.name = (r[cols.name] ?? '').trim()
    if (type === 'adult') t.adults += qty
    else if (type === 'child') t.children += qty
    else t.under5 += qty
    by.set(code, t)
  }
  return [...by.values()]
}
