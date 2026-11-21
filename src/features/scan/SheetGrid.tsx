// The spreadsheet itself: one row per donation, every cell a box you can type in.
//
// Plain Tailwind and no app-specific imports, so the same file lives in the app
// (src/features/scan/SheetGrid.tsx) and the website (src/components/SheetGrid.tsx) — keep the two the same.
// The page around it (ItemsSheet) loads the items, keeps the edits and does the saving.
import { memo, type KeyboardEvent } from 'react'
import { cellProblem, cellsFromItem, changedKeys, withEdits, type CellKey, type SheetCells, type SheetItem } from './sheetSave'

/** What the grid shows of an item besides its editable cells. */
export interface GridItem extends SheetItem {
  tag_id: string
  photo_url?: string | null
  photo_urls?: string[] | null
  outcome?: string | null
}

export interface RowStatus {
  state: 'saving' | 'saved' | 'error'
  message?: string
  warnings?: string[]
}

interface Column {
  key: CellKey | 'photo' | 'code' | 'status'
  label: string
  width: string
}

const COLUMNS: Column[] = [
  { key: 'photo', label: '', width: '56px' },
  { key: 'code', label: 'Number', width: '112px' },
  { key: 'title', label: 'Name', width: '260px' },
  { key: 'quantity', label: 'How many', width: '84px' },
  { key: 'value', label: 'Worth ($)', width: '96px' },
  { key: 'valueBasis', label: 'Worth is', width: '104px' },
  { key: 'size', label: 'Size', width: '110px' },
  { key: 'condition', label: 'Condition', width: '116px' },
  { key: 'category', label: 'Sort of thing', width: '150px' },
  { key: 'location', label: 'Where it’s kept', width: '170px' },
  { key: 'donatedBy', label: 'Donated by', width: '170px' },
  { key: 'useBy', label: 'Use by', width: '140px' },
  { key: 'description', label: 'Notes', width: '300px' },
  { key: 'status', label: 'Status', width: '260px' },
]

const CONDITIONS = [
  { value: '', label: '' },
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
]

const cell = 'w-full min-w-0 border-0 bg-transparent px-2 py-2 text-[15px] text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-blue disabled:text-slate-500'

interface RowProps {
  item: GridItem
  index: number
  edit: Partial<SheetCells> | undefined
  status: RowStatus | undefined
  editable: boolean
  statusText: string
  onEdit: (code: string, key: CellKey, value: string) => void
  onUndo: (code: string) => void
}

const Row = memo(function Row({ item, index, edit, status, editable, statusText, onEdit, onUndo }: RowProps) {
  const base = cellsFromItem(item)
  const now = withEdits(base, edit)
  const bought = item.source === 'purchase'
  const changed = new Set(changedKeys(base, now, bought))
  const dirty = changed.size > 0
  const photo = item.photo_urls?.[0] || item.photo_url || ''

  const box = (key: CellKey) => {
    const bad = changed.has(key) ? cellProblem(key, now) : null
    const locked = !editable || (bought && (key === 'value' || key === 'valueBasis'))
    const tone = bad ? 'bg-red-100' : changed.has(key) ? 'bg-amber-100' : ''
    return { bad, locked, tone }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, key: CellKey) => {
    // Enter moves down the column, like a spreadsheet.
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()
    const table = e.currentTarget.closest('table')
    const next = table?.querySelector<HTMLElement>(`[data-col="${key}"][data-r="${index + 1}"]`)
    if (next) {
      next.focus()
      if (next instanceof HTMLInputElement) next.select()
    }
  }

  const text = (key: CellKey, extra?: { list?: string; type?: string; inputMode?: 'numeric' | 'decimal'; label: string }) => {
    const b = box(key)
    return (
      <input
        type={extra?.type ?? 'text'}
        inputMode={extra?.inputMode}
        list={extra?.list}
        value={now[key]}
        readOnly={b.locked}
        disabled={b.locked && (key === 'value' || key === 'valueBasis')}
        onChange={(e) => onEdit(item.code, key, e.target.value)}
        onKeyDown={(e) => onKey(e, key)}
        aria-label={`${extra?.label ?? key}: ${item.title}`}
        aria-invalid={b.bad ? true : undefined}
        title={b.bad ?? undefined}
        data-col={key}
        data-r={index}
        className={`${cell} ${b.tone}`}
      />
    )
  }

  const bg = dirty ? 'bg-amber-50' : status?.state === 'saved' ? 'bg-green-50' : 'bg-white'
  return (
    <tr className={`border-b border-slate-200 align-middle ${bg}`}>
      <td className="px-2 py-1">
        {photo ? <img src={photo} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover" /> : <span className="block h-10 w-10 rounded-md bg-slate-100" />}
      </td>
      <td className="px-2 py-1 font-mono text-xs font-bold tracking-wider text-slate-500">{item.code}</td>
      <td className="p-0">{text('title', { label: 'Name' })}</td>
      <td className="p-0">{text('quantity', { label: 'How many', inputMode: 'numeric' })}</td>
      <td className="p-0">{text('value', { label: 'Worth in dollars', inputMode: 'decimal' })}</td>
      <td className="p-0">
        {(() => {
          const b = box('valueBasis')
          return (
            <select
              value={now.valueBasis}
              disabled={b.locked}
              onChange={(e) => onEdit(item.code, 'valueBasis', e.target.value)}
              onKeyDown={(e) => onKey(e, 'valueBasis')}
              aria-label={`Worth is for each or in all: ${item.title}`}
              data-col="valueBasis"
              data-r={index}
              className={`${cell} ${b.tone}`}
            >
              <option value="each">each</option>
              <option value="all">in all</option>
            </select>
          )
        })()}
      </td>
      <td className="p-0">{text('size', { label: 'Size' })}</td>
      <td className="p-0">
        {(() => {
          const b = box('condition')
          return (
            <select
              value={now.condition}
              disabled={b.locked}
              onChange={(e) => onEdit(item.code, 'condition', e.target.value)}
              onKeyDown={(e) => onKey(e, 'condition')}
              aria-label={`Condition: ${item.title}`}
              data-col="condition"
              data-r={index}
              className={`${cell} ${b.tone}`}
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )
        })()}
      </td>
      <td className="p-0">{text('category', { label: 'Sort of thing', list: 'sheet-categories' })}</td>
      <td className="p-0">{text('location', { label: 'Where it’s kept', list: 'sheet-locations' })}</td>
      <td className="p-0">{text('donatedBy', { label: 'Donated by' })}</td>
      <td className="p-0">{text('useBy', { label: 'Use by', type: 'date' })}</td>
      <td className="p-0">{text('description', { label: 'Notes' })}</td>
      <td className="px-2 py-1 text-sm leading-snug">
        {status?.state === 'saving' && <span className="font-bold text-slate-600">Saving…</span>}
        {status?.state === 'error' && <span className="font-bold text-red-700">{status.message}</span>}
        {status?.state === 'saved' && <span className="font-bold text-green-800">Saved</span>}
        {status?.warnings?.map((w) => (
          <span key={w} className="mt-0.5 block font-semibold text-amber-900">
            {w}
          </span>
        ))}
        {!status && !dirty && <span className="text-slate-500">{statusText}</span>}
        {dirty && status?.state !== 'saving' && (
          <span className="mt-0.5 flex items-center gap-2">
            <span className="font-bold text-amber-900">Changed</span>
            <button type="button" onClick={() => onUndo(item.code)} className="font-bold text-brand-blue underline underline-offset-2">
              Undo
            </button>
          </span>
        )}
      </td>
    </tr>
  )
})

export default function SheetGrid({
  rows,
  edits,
  results,
  editable,
  locations,
  categories,
  statusOf,
  onEdit,
  onUndo,
}: {
  rows: GridItem[]
  edits: Record<string, Partial<SheetCells>>
  results: Record<string, RowStatus>
  editable: boolean
  locations: string[]
  categories: string[]
  statusOf: (item: GridItem) => string
  onEdit: (code: string, key: CellKey, value: string) => void
  onUndo: (code: string) => void
}) {
  return (
    <div className="max-h-[68vh] overflow-auto rounded-2xl border border-slate-300 bg-white">
      <table className="w-max min-w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_0_rgb(203,213,225)]">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" style={{ minWidth: c.width, width: c.width }} className="px-2 py-2.5 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <Row
              key={item.tag_id}
              item={item}
              index={i}
              edit={edits[item.code]}
              status={results[item.code]}
              editable={editable}
              statusText={statusOf(item)}
              onEdit={onEdit}
              onUndo={onUndo}
            />
          ))}
        </tbody>
      </table>
      <datalist id="sheet-locations">
        {locations.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <datalist id="sheet-categories">
        {categories.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </div>
  )
}
