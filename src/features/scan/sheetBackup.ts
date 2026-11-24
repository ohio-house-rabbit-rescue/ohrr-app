// Daily backups of the donations list: what a backup holds, how it differs from now, and its CSV.
//
// Pure (no network, no React). The same file lives in the app (src/features/scan/sheetBackup.ts) and the
// website (src/lib/sheetBackup.ts) — keep the two the same. The database side is update 58.
import { CELL_LABELS, cellsFromItem, changedKeys, parseDollars, type CellKey, type SheetItem } from './sheetSave'

/** One day that has a backup. */
export interface BackupDay {
  id: string
  backup_day: string // YYYY-MM-DD, Ohio's day
  taken_at: string
  item_count: number
}

/** One donation as the backup kept it: its number tag and its whole record. */
export interface BackupRow {
  tag: { code: string; label_printed_at?: string | null; box_id?: string | null }
  item: Record<string, unknown>
}

export interface BackupFull extends BackupDay {
  items: BackupRow[]
}

export interface RestoreResult {
  restored: number
  recreated: number
  skipped: { code: string; why: string }[]
}

/** What the backup's record says, in the same shape the spreadsheet uses for an item. */
export function backupAsItem(r: BackupRow): SheetItem {
  const i = r.item
  const s = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : null)
  const n = (k: string) => (typeof i[k] === 'number' ? (i[k] as number) : null)
  return {
    code: r.tag.code,
    kind: 'donation',
    title: s('title') ?? '',
    description: s('description'),
    donated_by: s('donated_by'),
    value_cents: n('value_cents'),
    value_basis: i.value_basis === 'all' ? 'all' : 'each',
    quantity: n('quantity'),
    size: s('size'),
    use_by: s('use_by'),
    condition: s('condition'),
    category: s('category'),
    location: s('location'),
    source: i.source === 'purchase' ? 'purchase' : 'donation',
    label_printed_at: r.tag.label_printed_at ?? null,
  }
}

export interface FieldChange {
  key: CellKey
  label: string
  then: string
  now: string
}

export interface BackupDiff {
  code: string
  /** The name the backup has. */
  title: string
  /** changed: still a donation with other words in it. deleted: not anywhere now. moved: sorted into the raffle, auction or shop since. */
  state: 'changed' | 'deleted' | 'moved'
  movedTo?: string
  changes: FieldChange[]
}

const show = (key: CellKey, v: string): string => {
  if (v === '') return 'empty'
  if (key === 'value') return `$${v}`
  if (key === 'valueBasis') return v === 'all' ? 'in all' : 'each'
  if (key === 'condition') return { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' }[v] ?? v
  return v
}

/**
 * How the backup differs from the list now. `current` is every item as it is now (any kind), by code.
 * Items that are the same are left out. Bought items are compared without their worth, as in the spreadsheet.
 */
export function diffBackup(rows: BackupRow[], current: Map<string, SheetItem>): BackupDiff[] {
  const out: BackupDiff[] = []
  for (const r of rows) {
    const then = backupAsItem(r)
    const nowItem = current.get(then.code)
    if (!nowItem) {
      out.push({ code: then.code, title: then.title, state: 'deleted', changes: [] })
      continue
    }
    if (nowItem.kind !== 'donation') {
      out.push({ code: then.code, title: then.title, state: 'moved', movedTo: nowItem.kind, changes: [] })
      continue
    }
    // A backup holds the item's own words, so compare with the item's own place, not its box's
    // (the spreadsheet shows a packed item at its box's place; bringing a backup back never moves a box).
    const nowCells = cellsFromItem({ ...nowItem, box: null })
    const thenCells = cellsFromItem(then)
    const keys = changedKeys(nowCells, thenCells, nowItem.source === 'purchase' ? ['value', 'valueBasis'] : [])
    if (keys.length) {
      out.push({
        code: then.code,
        title: then.title,
        state: 'changed',
        changes: keys.map((key) => ({ key, label: CELL_LABELS[key], then: show(key, thenCells[key]), now: show(key, nowCells[key]) })),
      })
    }
  }
  return out
}

const quote = (v: unknown): string => {
  const t = v == null ? '' : String(v)
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** The whole backup as a CSV (opens in Excel), so it can be read without bringing anything back. */
export function backupCsv(rows: BackupRow[]): string {
  const head = ['Number', 'Name', 'Donated by', 'How many', 'Worth', 'Worth is', 'Size', 'Condition', 'Sort of thing', 'Where it’s kept', 'Use by', 'Notes', 'Received']
  const lines = [head.map(quote).join(',')]
  for (const r of rows) {
    const it = backupAsItem(r)
    const c = cellsFromItem(it)
    const worth = parseDollars(c.value)
    lines.push(
      [it.code, c.title, c.donatedBy, c.quantity, worth === 'bad' || worth == null ? '' : (worth / 100).toFixed(2), c.valueBasis === 'all' ? 'in all' : 'each', c.size, c.condition, c.category, c.location, c.useBy, c.description, String(r.item.received_on ?? '')]
        .map(quote)
        .join(','),
    )
  }
  return `﻿${lines.join('\r\n')}\r\n`
}
