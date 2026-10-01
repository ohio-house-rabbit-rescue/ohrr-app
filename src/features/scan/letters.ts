// Donation drop-offs (update 40): the words shared by the drop-off screens,
// the thank-you letter, the monthly report and its spreadsheet — so "where it
// is now" reads the same everywhere. Plain functions, no React.
import { ohrr } from '../../data/ohrr'
import { toCsv } from '../../lib/exportFile'
import type { DonationLine } from './api'
import { KIND_META, formatMoney, headedLabel, usDate } from './types'

const blank = (s: string | null | undefined) => (s ?? '').trim()

/** "50 × Fabric remnants (24×36)" — how many, the name, the size. */
export function lineLabel(l: Pick<DonationLine, 'quantity' | 'title' | 'size'>): string {
  const size = blank(l.size)
  return `${Math.max(1, l.quantity ?? 1)} × ${blank(l.title) || 'Untitled'}${size ? ` (${size})` : ''}`
}

/** "$10 each · $500 in all", or "$25" for one; '' when no value was given. */
export function worthLine(l: Pick<DonationLine, 'quantity' | 'value_each_cents' | 'value_total_cents'>): string {
  if (l.value_total_cents == null) return ''
  if ((l.quantity ?? 1) > 1 && l.value_each_cents != null) return `${formatMoney(l.value_each_cents)} each · ${formatMoney(l.value_total_cents)} in all`
  return formatMoney(l.value_total_cents)
}

/** The code to open a line by: its own label, or (once sorted) the item it became, which carries the same label. */
export function lineCode(l: Pick<DonationLine, 'code' | 'went_to'>): string | null {
  return l.code || l.went_to?.code || null
}

/**
 * Where a donation is now, in plain words. `detail` adds the code it was
 * sorted into or the basket's name (per line); without it the wording is the
 * same for every line in that place (for counting).
 */
export function whereNow(l: Pick<DonationLine, 'outcome' | 'headed_for' | 'sorted_kind' | 'went_to'>, detail = false): string {
  switch (l.outcome) {
    case 'sorted': {
      const kind = l.sorted_kind ?? l.went_to?.kind ?? null
      const label = kind ? KIND_META[kind].label : 'Sorted'
      return detail && l.went_to?.code ? `${label} (${l.went_to.code})` : label
    }
    case 'basket': {
      const title = blank(l.went_to?.title)
      return detail && title ? `In a basket (${title})` : 'In a basket'
    }
    case 'rabbits':
      return 'Used for the rabbits'
    case 'passed_on':
      return 'Passed on / not usable'
    default: {
      // "For the rabbits" → "(for: the rabbits)", not "(for: For the rabbits)".
      const head = headedLabel(l.headed_for).replace(/^For /, '')
      return head ? `Waiting to be sorted (for: ${head})` : 'Waiting to be sorted'
    }
  }
}

/** For listing places in a steady order: waiting, sorted, basket, rabbits, passed on. */
export function whereRank(l: Pick<DonationLine, 'outcome' | 'headed_for'>): number {
  if (!l.outcome) return l.headed_for ? 1 : 0
  return { sorted: 2, basket: 3, rabbits: 4, passed_on: 5 }[l.outcome] ?? 6
}

/* ------------------------------------------------------------- the letter */

/** id → the id of the original it was split from (itself when it wasn't split off). */
function rootFinder(lines: Pick<DonationLine, 'id' | 'split_from'>[]): (id: string) => string {
  const byId = new Map(lines.map((l) => [l.id, l]))
  return (id) => {
    let cur = byId.get(id)
    const seen = new Set<string>()
    while (cur?.split_from && byId.has(cur.split_from) && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = byId.get(cur.split_from)
    }
    return cur?.id ?? id
  }
}

/** The lines in the order they were given, each split-off part right under the line it came from. */
export function inGivenOrder<T extends Pick<DonationLine, 'id' | 'split_from' | 'created_at'>>(lines: T[]): T[] {
  const root = rootFinder(lines)
  const byId = new Map(lines.map((l) => [l.id, l]))
  const at = (l: T) => l.created_at ?? ''
  return [...lines].sort((a, b) => {
    if (a.id === b.id) return 0
    const ra = byId.get(root(a.id))!
    const rb = byId.get(root(b.id))!
    if (ra.id !== rb.id) return at(ra).localeCompare(at(rb)) || ra.id.localeCompare(rb.id)
    if (a.id === ra.id) return -1
    if (b.id === rb.id) return 1
    return at(a).localeCompare(at(b))
  })
}

export interface LetterLine {
  /** The original line's id (split parts are folded into it). */
  id: string
  label: string
  quantity: number
  /** All the parts together; null when no value was given. */
  value_total_cents: number | null
}

/**
 * One line per thing the donor gave: a split part (split_from set) is added
 * back into the line it was split from, so 50 remnants stay "50 ×" even when
 * 10 of them went to the raffle.
 */
export function letterLines(lines: Pick<DonationLine, 'id' | 'title' | 'size' | 'quantity' | 'value_total_cents' | 'split_from' | 'created_at'>[]): LetterLine[] {
  const byId = new Map(lines.map((l) => [l.id, l]))
  const root = rootFinder(lines)
  const out = new Map<string, { quantity: number; value: number | null }>()
  const order: string[] = []
  const sorted = [...lines].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  for (const l of sorted) {
    const r = root(l.id)
    let acc = out.get(r)
    if (!acc) {
      acc = { quantity: 0, value: null }
      out.set(r, acc)
      order.push(r)
    }
    acc.quantity += Math.max(1, l.quantity ?? 1)
    if (l.value_total_cents != null) acc.value = (acc.value ?? 0) + l.value_total_cents
  }
  return order.map((id) => {
    const first = byId.get(id)!
    const acc = out.get(id)!
    return { id, label: lineLabel({ quantity: acc.quantity, title: first.title, size: first.size }), quantity: acc.quantity, value_total_cents: acc.value }
  })
}

/** "- 50 × Fabric remnants (24×36)", with " — worth $500" when values are shown and known. */
export function letterBullet(l: LetterLine, withValues: boolean): string {
  const worth = withValues && l.value_total_cents != null ? ` — worth ${formatMoney(l.value_total_cents)}` : ''
  return `- ${l.label}${worth}`
}

/** The thank-you letter, ready to print, copy or email. */
export function thankYouLetter(
  d: { donor_name: string | null; received_on: string },
  lines: Parameters<typeof letterLines>[0],
  withValues = false,
): string {
  const name = blank(d.donor_name) || 'friend'
  const given = letterLines(lines)
  const day = usDate(d.received_on)
  const parts = [`Dear ${name},`]
  if (given.length) {
    parts.push(`Thank you for your donation to ${ohrr.name} on ${day}. You gave:`)
    parts.push(given.map((l) => letterBullet(l, withValues)).join('\n'))
  } else {
    parts.push(`Thank you for your donation to ${ohrr.name} on ${day}.`)
  }
  parts.push('Thank you for helping the rabbits in our care.')
  parts.push(`With thanks,\n${ohrr.name}\n${ohrr.email}`)
  return parts.join('\n\n')
}

/**
 * Turn the values on or off in a letter someone may have edited: each list
 * line that still reads exactly as made is swapped for its other version;
 * anything they changed is left alone.
 */
export function toggleLetterValues(text: string, lines: Parameters<typeof letterLines>[0], withValues: boolean): string {
  const swap = new Map<string, string>()
  for (const l of letterLines(lines)) {
    const from = letterBullet(l, !withValues)
    const to = letterBullet(l, withValues)
    if (from !== to) swap.set(from, to)
  }
  if (!swap.size) return text
  return text
    .split('\n')
    .map((row) => swap.get(row) ?? row)
    .join('\n')
}

export const THANK_YOU_SUBJECT = `Thank you from ${ohrr.name}`

/** mailto: to the donor with the letter as the body (line breaks as CRLF, spaces as %20 — not "+"). */
export function thankYouMailto(email: string, body: string): string {
  const to = encodeURIComponent(email.trim()).replace(/%40/g, '@')
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'))
  return `mailto:${to}?subject=${enc(THANK_YOU_SUBJECT)}&body=${enc(body)}`
}

/* ------------------------------------------------------------- the report */

/** Who gave a line: the name on the item, else the drop-off's. '' = not named. */
export function donorOf(l: Pick<DonationLine, 'donated_by' | 'dropoff_donor'>): string {
  return blank(l.donated_by) || blank(l.dropoff_donor)
}

export interface DonorRow {
  /** '' = not named */
  name: string
  items: number
  pieces: number
  value_cents: number
}

export interface PlaceRow {
  label: string
  lines: number
  pieces: number
}

export interface ReportTotals {
  /** Things given: lines that aren't split-off parts. */
  items: number
  pieces: number
  /** Different donor names (case doesn't matter). */
  donors: number
  /** Items with no donor name. */
  notNamed: number
  value_cents: number
  /** Items with no value. */
  noValue: number
  places: PlaceRow[]
  byDonor: DonorRow[]
}

export function reportTotals(lines: DonationLine[]): ReportTotals {
  const roots = lines.filter((l) => !l.split_from)
  const donors = new Map<string, DonorRow>()
  const places = new Map<string, PlaceRow & { rank: number }>()
  let value = 0
  let pieces = 0
  for (const l of lines) {
    const q = Math.max(1, l.quantity ?? 1)
    pieces += q
    value += l.value_total_cents ?? 0
    const name = donorOf(l)
    const key = name.toLowerCase()
    let d = donors.get(key)
    if (!d) {
      d = { name, items: 0, pieces: 0, value_cents: 0 }
      donors.set(key, d)
    }
    if (!l.split_from) d.items++
    d.pieces += q
    d.value_cents += l.value_total_cents ?? 0
    const where = whereNow(l)
    let p = places.get(where)
    if (!p) {
      p = { label: where, lines: 0, pieces: 0, rank: whereRank(l) }
      places.set(where, p)
    }
    p.lines++
    p.pieces += q
  }
  const named = [...donors.values()].filter((d) => d.name)
  const unnamed = donors.get('')
  return {
    items: roots.length,
    pieces,
    donors: named.length,
    notNamed: roots.filter((l) => !donorOf(l)).length,
    value_cents: value,
    noValue: roots.filter((l) => l.value_total_cents == null).length,
    places: [...places.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).map(({ label, lines: n, pieces: pc }) => ({ label, lines: n, pieces: pc })),
    byDonor: [...named.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })), ...(unnamed ? [unnamed] : [])],
  }
}

/** Money for a spreadsheet cell: 12.5 → "12.50" (a number, so the column adds up). */
function csvMoney(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2)
}

export const DONATIONS_CSV_HEADERS = ['Date received', 'Donor', 'Item', 'Size', 'How many', 'Value each', 'Value in all', 'Where it is now', 'Code']

/** Every donation as spreadsheet rows (quoted for commas, quotes and line breaks). */
export function donationsCsv(lines: DonationLine[]): string {
  return toCsv(
    DONATIONS_CSV_HEADERS,
    lines.map((l) => [
      usDate(l.received_on),
      donorOf(l),
      blank(l.title),
      blank(l.size),
      Math.max(1, l.quantity ?? 1),
      csvMoney(l.value_each_cents),
      csvMoney(l.value_total_cents),
      whereNow(l, true),
      lineCode(l) ?? '',
    ]),
  )
}

/* ------------------------------------------------------------- months */

/** "2026-10-01" and "2026-10-31" for a month (m = 0–11). */
export function monthRange(y: number, m: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(y, m + 1, 0).getDate()
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` }
}

/** "October 2026" */
export function monthName(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
