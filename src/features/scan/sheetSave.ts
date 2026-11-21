// Items spreadsheet: what a changed row turns into.
//
// Pure (no network, no React): the page hands in the calls, so the rules can be tested with stubs.
// The same file lives in the app (src/features/scan/sheetSave.ts) and the website (src/lib/sheetSave.ts)
// — keep the two the same.
//
// The rules (they came from losing work to a stale screen):
//   - Only donations are edited here. Shop stock is a live count and auction lots / raffle prizes have
//     their own screens.
//   - Only the cells you changed are written. The row is read again just before saving and the other
//     fields are sent as they are NOW, so a phone that changed a row while this list was open is not undone.
//   - A step that fails does not undo the steps before it. The result says which cells did save.
//   - A label that was printed and now says something else goes back on the "to print" list.

/** The parts of an item this file reads (both repos' TaggedItem fit). */
export interface SheetItem {
  code: string
  kind: string
  title: string
  description?: string | null
  donated_by?: string | null
  value_cents?: number | null
  value_basis?: 'each' | 'all' | null
  quantity?: number | null
  size?: string | null
  use_by?: string | null
  condition?: string | null
  category?: string | null
  location?: string | null
  source?: 'donation' | 'purchase' | null
  label_printed_at?: string | null
}

/** Every editable cell of a row, as the text in the box. */
export interface SheetCells {
  title: string
  quantity: string
  value: string
  valueBasis: 'each' | 'all'
  size: string
  condition: string
  category: string
  location: string
  donatedBy: string
  useBy: string
  description: string
}
export type CellKey = keyof SheetCells

export const CELL_LABELS: Record<CellKey, string> = {
  title: 'name',
  quantity: 'how many',
  value: 'worth',
  valueBasis: 'worth for each or in all',
  size: 'size',
  condition: 'condition',
  category: 'sort of thing',
  location: 'where it’s kept',
  donatedBy: 'donated by',
  useBy: 'use by',
  description: 'notes',
}

export const CONDITION_VALUES = ['', 'new', 'like_new', 'good', 'fair']

const dollars = (c: number): string => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2))

/** "12", "$12.50", "1,200" → cents; "" → null; anything else → 'bad'. */
export function parseDollars(s: string): number | null | 'bad' {
  const t = s.replace(/[$,\s]/g, '')
  if (!t) return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'bad'
  const c = Math.round(Number(t) * 100)
  return Number.isFinite(c) && c <= 2_000_000_000 ? c : 'bad'
}

export function cellsFromItem(i: SheetItem): SheetCells {
  return {
    title: i.title ?? '',
    quantity: String(i.quantity ?? 1),
    value: i.value_cents == null ? '' : dollars(i.value_cents),
    valueBasis: i.value_basis ?? 'each',
    size: i.size ?? '',
    condition: i.condition ?? '',
    category: i.category ?? '',
    location: i.location ?? '',
    donatedBy: i.donated_by ?? '',
    useBy: (i.use_by ?? '').slice(0, 10),
    description: i.description ?? '',
  }
}

/** What a row shows: the saved item with this person's unsaved edits on top. */
export const withEdits = (base: SheetCells, edits: Partial<SheetCells> | undefined): SheetCells => ({ ...base, ...edits })

const norm = (s: string) => s.trim()

/** Which cells differ from the saved item. A bought item's worth is not edited here. */
export function changedKeys(base: SheetCells, now: SheetCells, bought = false): CellKey[] {
  const keys = (Object.keys(base) as CellKey[]).filter((k) => norm(String(base[k])) !== norm(String(now[k])))
  return bought ? keys.filter((k) => k !== 'value' && k !== 'valueBasis') : keys
}

/** Why a cell can't be saved as typed, or null. */
export function cellProblem(key: CellKey, cells: SheetCells): string | null {
  const v = cells[key]
  if (key === 'title' && !norm(v)) return 'The name can’t be empty.'
  if (key === 'quantity') {
    const n = Number(norm(v))
    if (!Number.isInteger(n) || n < 1 || n > 9999) return 'How many must be a whole number from 1 to 9999.'
  }
  if (key === 'value' && parseDollars(v) === 'bad') return 'Worth must be dollars, like 12 or 12.50.'
  if (key === 'useBy' && norm(v) && !/^\d{4}-\d{2}-\d{2}$/.test(norm(v))) return 'Use by must be a date.'
  if (key === 'condition' && !CONDITION_VALUES.includes(v)) return 'Pick a condition from the list.'
  return null
}

/** The first problem among the cells that changed, or null. */
export const firstProblem = (keys: CellKey[], cells: SheetCells): string | null => {
  for (const k of keys) {
    const p = cellProblem(k, cells)
    if (p) return p
  }
  return null
}

/** The calls a page makes. Each returns the item as the database now has it. */
export interface SheetDeps<T extends SheetItem> {
  find(code: string): Promise<T | null>
  /** `fresh` is the row as the database has it now: the fields not being changed (price, photos) come from it. */
  core(code: string, v: { title: string; description: string; donatedBy: string; valueCents: number | null; quantity: number }, fresh: T): Promise<T>
  extras(code: string, v: { condition: string | null; category: string | null; location: string | null }): Promise<T | null>
  plan(code: string, v: { value_basis?: 'each' | 'all'; size?: string | null; use_by?: string | null }): Promise<T | null>
  unprint(code: string): Promise<void>
}

export interface RowResult<T> {
  /** Every step worked. */
  ok: boolean
  /** The item as it is now (also when only some steps worked). */
  item?: T
  /** Cells that were written, so the page can clear those edits and keep the rest. */
  saved: CellKey[]
  error?: string
  warnings: string[]
}

const say = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e))

const list = (keys: CellKey[]): string => keys.map((k) => CELL_LABELS[k]).join(', ')

export async function saveRow<T extends SheetItem>(deps: SheetDeps<T>, orig: T, now: SheetCells): Promise<RowResult<T>> {
  const base = cellsFromItem(orig)
  const keys = changedKeys(base, now, orig.source === 'purchase')
  if (keys.length === 0) return { ok: true, item: orig, saved: [], warnings: [] }
  const bad = firstProblem(keys, now)
  if (bad) return { ok: false, saved: [], error: bad, warnings: [] }

  let fresh: T | null
  try {
    fresh = await deps.find(orig.code)
  } catch (e) {
    return { ok: false, saved: [], error: `Couldn’t check it before saving: ${say(e)}`, warnings: [] }
  }
  if (!fresh) return { ok: false, saved: [], error: 'It isn’t there any more. Reload the list.', warnings: [] }
  if (fresh.kind !== 'donation') return { ok: false, saved: [], error: 'It was moved out of the donations. Reload the list.', warnings: [] }

  const warnings: string[] = []
  const freshCells = cellsFromItem(fresh)
  const wasPrinted = Boolean(fresh.label_printed_at)
  const overwritten = keys.filter((k) => norm(freshCells[k]) !== norm(base[k]) && norm(freshCells[k]) !== norm(now[k]))
  if (overwritten.length) warnings.push(`Someone else had changed ${list(overwritten)} since you opened this list. Yours replaced it.`)

  let cur: T = fresh
  const saved: CellKey[] = []
  const has = (...ks: CellKey[]) => keys.some((k) => ks.includes(k))
  const fail = (error: string): RowResult<T> => ({ ok: false, item: merge(orig, fresh!, cur), saved, error, warnings })

  // 1. name, how many, worth, donor, notes
  const coreKeys = keys.filter((k) => ['title', 'quantity', 'value', 'donatedBy', 'description'].includes(k))
  if (coreKeys.length) {
    const parsed = parseDollars(now.value)
    try {
      cur = await deps.core(orig.code, {
        title: has('title') ? norm(now.title) : fresh.title,
        description: has('description') ? norm(now.description) : (fresh.description ?? ''),
        donatedBy: has('donatedBy') ? norm(now.donatedBy) : (fresh.donated_by ?? ''),
        valueCents: has('value') ? (parsed === 'bad' ? null : parsed) : (fresh.value_cents ?? null),
        quantity: has('quantity') ? Number(norm(now.quantity)) : Math.max(1, fresh.quantity ?? 1),
      }, fresh)
      saved.push(...coreKeys)
    } catch (e) {
      return fail(`It didn’t save: ${say(e)}`)
    }
  }

  // 2. condition, sort of thing, where it's kept (they travel together; blank clears)
  const extraKeys = keys.filter((k) => ['condition', 'category', 'location'].includes(k))
  if (extraKeys.length) {
    try {
      cur =
        (await deps.extras(orig.code, {
          condition: has('condition') ? norm(now.condition) || null : (cur.condition ?? null),
          category: has('category') ? norm(now.category) || null : (cur.category ?? null),
          location: has('location') ? norm(now.location) || null : (cur.location ?? null),
        })) ?? cur
      saved.push(...extraKeys)
    } catch (e) {
      return fail(`Saved ${coreKeys.length ? list(coreKeys) : 'nothing'}, but not ${list(extraKeys)}: ${say(e)}`)
    }
  }

  // 3. worth for each or in all, size, use by (only the keys that changed are sent)
  const planKeys = keys.filter((k) => ['valueBasis', 'size', 'useBy'].includes(k))
  if (planKeys.length) {
    const plan: { value_basis?: 'each' | 'all'; size?: string | null; use_by?: string | null } = {}
    if (has('valueBasis')) plan.value_basis = now.valueBasis
    if (has('size')) plan.size = norm(now.size) || null
    if (has('useBy')) plan.use_by = norm(now.useBy) || null
    try {
      cur = (await deps.plan(orig.code, plan)) ?? cur
      saved.push(...planKeys)
    } catch (e) {
      return fail(`Saved ${saved.length ? list(saved) : 'nothing'}, but not ${list(planKeys)}: ${say(e)}`)
    }
  }

  let item = merge(orig, fresh, cur)
  // 4. Its label shows the name and the donor: one printed before this is now out of date.
  // Judged from the snapshot taken before any save (freshCells, wasPrinted) and what was typed, never from
  // the answers' fields or the re-read row itself, which a store may have changed in place by now.
  const labelChanged = (has('title') && norm(now.title) !== norm(freshCells.title)) || (has('donatedBy') && norm(now.donatedBy) !== norm(freshCells.donatedBy))
  if (labelChanged && wasPrinted) {
    try {
      await deps.unprint(orig.code)
      item = { ...item, label_printed_at: null }
    } catch {
      /* Print labels can still be told by hand */
    }
    warnings.push('You changed what its label says after it was printed. Print the label again.')
  }
  return { ok: true, item, saved, warnings }
}

/** The saved row with everything the list had that the answers may leave out (the box, the basket). */
function merge<T extends SheetItem>(orig: T, fresh: T, cur: T): T {
  const o = orig as unknown as Record<string, unknown>
  const f = fresh as unknown as Record<string, unknown>
  const c = cur as unknown as Record<string, unknown>
  return { ...o, ...f, ...c, box: c.box ?? f.box ?? o.box } as unknown as T
}
