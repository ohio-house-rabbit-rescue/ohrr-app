// The list on the labels pages, made to work with hundreds of items
// (2026-10-27, sponsor: "this will become a problem when you have 500
// donations"). Show, Added, Kind and Sort narrow it down; newest-first lists
// come in groups by the day they were added, each with its own "Tick these";
// and the page shows 50 at a time. The choices are kept on the device.
//
// The website has a copy in src/lib/labelList.ts — keep the two the same.

export type ShowWhich = 'unprinted' | 'printed' | 'all' | 'ticked'
export type AddedWhen = 'today' | 'week' | 'month' | 'any'
export type SortBy = 'newest' | 'oldest' | 'name' | 'code'

export interface ListView {
  show: ShowWhich
  when: AddedWhen
  /** An item kind ('donation', 'auction', …) or a Hop Shop type; 'all' for every one. */
  kind: string
  sort: SortBy
}

export const DEFAULT_VIEW: ListView = { show: 'unprinted', when: 'any', kind: 'all', sort: 'newest' }

export const SHOW_OPTIONS: { value: ShowWhich; label: string }[] = [
  { value: 'unprinted', label: 'Not printed yet' },
  { value: 'printed', label: 'Printed' },
  { value: 'all', label: 'Everything' },
  { value: 'ticked', label: 'Ticked to print' },
]
export const WHEN_OPTIONS: { value: AddedWhen; label: string }[] = [
  { value: 'today', label: 'Added today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'any', label: 'Any time' },
]
export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'code', label: 'Code' },
]

/** How many lines the page shows before "Show more". */
export const PAGE_SIZE = 50

export interface ListRow {
  code: string
  title: string
  sub: string
  label_printed_at: string | null
  /** When it was added (ISO), for Added and the day groups. */
  added: string | null
  kind: string
}

const VIEW_KEY = 'ohrr.labels.view'

export function loadView(): ListView {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<ListView>
    return {
      show: SHOW_OPTIONS.some((o) => o.value === v.show) ? v.show! : DEFAULT_VIEW.show,
      when: WHEN_OPTIONS.some((o) => o.value === v.when) ? v.when! : DEFAULT_VIEW.when,
      kind: typeof v.kind === 'string' && v.kind ? v.kind : DEFAULT_VIEW.kind,
      sort: SORT_OPTIONS.some((o) => o.value === v.sort) ? v.sort! : DEFAULT_VIEW.sort,
    }
  } catch {
    return DEFAULT_VIEW
  }
}

export function saveView(v: ListView): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v))
  } catch {
    /* private mode */
  }
}

const DAY = 86_400_000

function startOfToday(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

/** The rows that match the view and the search, in the chosen order. */
export function filterRows<R extends ListRow>(rows: R[], view: ListView, q: string, picked: Set<string>, now = new Date()): R[] {
  const needle = q.trim().toLowerCase()
  const today = startOfToday(now)
  const since = view.when === 'today' ? today : view.when === 'week' ? today - 6 * DAY : view.when === 'month' ? today - 29 * DAY : null
  const out = rows.filter((r) => {
    if (view.show === 'unprinted' && r.label_printed_at) return false
    if (view.show === 'printed' && !r.label_printed_at) return false
    if (view.show === 'ticked' && !picked.has(r.code)) return false
    if (view.kind !== 'all' && r.kind !== view.kind) return false
    if (since != null && (!r.added || Date.parse(r.added) < since)) return false
    return !needle || r.title.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle) || r.sub.toLowerCase().includes(needle)
  })
  const at = (r: R) => (r.added ? Date.parse(r.added) : 0)
  const byName = (a: R, b: R) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
  const byCode = (a: R, b: R) => a.code.localeCompare(b.code, undefined, { numeric: true })
  out.sort(
    view.sort === 'newest'
      ? (a, b) => at(b) - at(a) || byCode(b, a)
      : view.sort === 'oldest'
        ? (a, b) => at(a) - at(b) || byCode(a, b)
        : view.sort === 'name'
          ? (a, b) => byName(a, b) || byCode(a, b)
          : byCode,
  )
  return out
}

/** "Today", "Yesterday", "Mon, Oct 26" (or with the year when it isn't this year). */
export function dayHeading(iso: string | null, now = new Date()): string {
  if (!iso) return 'Date not known'
  const d = new Date(iso)
  const days = Math.round((startOfToday(now) - startOfToday(d)) / DAY)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export interface DayGroup<R> {
  heading: string
  rows: R[]
}

/** Rows in groups by the day they were added — only for the newest/oldest orders. */
export function groupByDay<R extends ListRow>(rows: R[], sort: SortBy, now = new Date()): DayGroup<R>[] {
  if (sort !== 'newest' && sort !== 'oldest') return [{ heading: '', rows }]
  const groups: DayGroup<R>[] = []
  for (const r of rows) {
    const heading = dayHeading(r.added, now)
    const last = groups[groups.length - 1]
    if (last && last.heading === heading) last.rows.push(r)
    else groups.push({ heading, rows: [r] })
  }
  return groups
}
