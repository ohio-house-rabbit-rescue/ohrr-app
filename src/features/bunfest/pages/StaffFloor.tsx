// Staff → BunFest → Floor plan.
//
// The list of this year's vendors and rescues, a box beside each for its table
// numbers ("7" or "7, 8" or "7-8"), and the map drawn live underneath — so
// typing a number puts the name on the map at once. Side-by-side tables that
// belong to one stand show as one block with the name once.
//
// Above that, the layout itself: how many tables in each row of each room.
// Tables are numbered 1, 2, 3 … through the Burgundy Room and on into the
// Emerald Room, so changing a row renumbers everything after it — which is
// why the layout comes first and saving it refuses to strand anyone's table.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { errMessage } from '../../../lib/supabase'
import { Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { listSuppliers, type Supplier } from '../../hopshop/api'
import {
  listFloorRows,
  listPartners,
  listTables,
  saveFloor,
  setTables,
  type PartnerRow,
  type TableHolderRef,
  type TableRecord,
} from '../api'
import {
  DEFAULT_ROWS,
  ROOM_NAMES,
  ROOM_ORDER,
  buildBlocks,
  formatNumbers,
  numberRows,
  parseNumbers,
  totalTables,
  type RoomId,
  type TableAssignment,
} from '../floor'
import { TablesPanel } from '../TablesPanel'

type Layout = Record<RoomId, number[]>

function layoutFromRows(rows: { room: RoomId; sort: number; tables: number }[]): Layout {
  const out: Layout = { burgundy: [], emerald: [] }
  for (const room of ROOM_ORDER) {
    out[room] = rows
      .filter((r) => r.room === room)
      .sort((a, b) => a.sort - b.sort)
      .map((r) => r.tables)
  }
  return out
}

function rowsFromLayout(l: Layout) {
  return ROOM_ORDER.flatMap((room) => l[room].map((tables, i) => ({ room, sort: (i + 1) * 10, tables })))
}

export default function StaffFloor({ orgId }: { orgId: string }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [saved, setSaved] = useState<Layout | null>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  const [tables, setTablesState] = useState<TableRecord[]>([])
  const [vendors, setVendors] = useState<Supplier[]>([])
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [layoutError, setLayoutError] = useState<string | null>(null)
  const [savingLayout, setSavingLayout] = useState(false)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<number | undefined>()

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [rows, t, sup, par] = await Promise.all([
        listFloorRows(orgId, year),
        listTables(orgId, year),
        listSuppliers(orgId),
        listPartners(orgId),
      ])
      const l = rows.length > 0 ? layoutFromRows(rows.map((r) => ({ room: r.room, sort: r.sort_order, tables: r.tables }))) : layoutFromRows(DEFAULT_ROWS)
      setSaved(rows.length > 0 ? l : null)
      setLayout((cur) => cur ?? l)
      setIsDefault(rows.length === 0)
      setTablesState(t)
      setVendors(sup.filter((s) => s.is_vendor))
      setPartners(par)
      setError(null)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year])

  useEffect(() => {
    setLayout(null)
    void load()
  }, [load])

  // This year's roster — tagged for the year, or not tagged by year at all.
  const thisYears = useMemo(() => {
    const inYear = (years: number[], fallback: boolean) => (years.length > 0 ? years.includes(year) : fallback)
    return {
      vendors: vendors.filter((v) => inYear(v.vendor_years, v.vendor_published)).sort((a, b) => a.name.localeCompare(b.name)),
      partners: partners.filter((p) => inYear(p.bunfest_years, p.at_bunfest)).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [vendors, partners, year])

  // What the preview draws: staff see every name, published or not.
  const assignments: TableAssignment[] = useMemo(
    () =>
      tables.map((t) => {
        if (t.supplier_id) {
          const v = vendors.find((x) => x.id === t.supplier_id)
          return { table: t.table_no, kind: 'vendor', id: t.supplier_id, name: v?.name ?? null, category: v?.vendor_category ?? null }
        }
        if (t.partner_id) {
          const p = partners.find((x) => x.id === t.partner_id)
          return { table: t.table_no, kind: 'rescue', id: t.partner_id, name: p?.name ?? null, category: null }
        }
        return { table: t.table_no, kind: 'other', id: null, name: t.label, category: null }
      }),
    [tables, vendors, partners],
  )

  const numbered = useMemo(() => numberRows(layout ? rowsFromLayout(layout) : DEFAULT_ROWS), [layout])
  const blocks = useMemo(() => buildBlocks(numbered, assignments), [numbered, assignments])
  const total = totalTables(numbered)
  const used = new Set(tables.map((t) => t.table_no)).size
  const layoutChanged = !!layout && JSON.stringify(layout) !== JSON.stringify(saved)

  const numbersFor = (who: TableHolderRef) =>
    tables
      .filter((t) =>
        who.kind === 'vendor'
          ? t.supplier_id === who.id
          : who.kind === 'rescue'
            ? t.partner_id === who.id
            : (t.label ?? '').trim().toLowerCase() === who.label.trim().toLowerCase(),
      )
      .map((t) => t.table_no)

  const labels = useMemo(
    () => [...new Set(tables.filter((t) => t.label).map((t) => t.label as string))].sort(),
    [tables],
  )

  const setRow = (room: RoomId, i: number, n: number) =>
    layout && setLayout({ ...layout, [room]: layout[room].map((v, j) => (j === i ? Math.max(1, Math.min(20, n)) : v)) })

  const saveLayout = async () => {
    if (!layout) return
    setSavingLayout(true)
    setLayoutError(null)
    try {
      await saveFloor(orgId, year, layout.burgundy, layout.emerald)
      setSaved(layout)
      setIsDefault(false)
      await load()
    } catch (e) {
      setLayoutError(errMessage(e))
    }
    setSavingLayout(false)
  }

  const q = filter.trim().toLowerCase()
  const match = (name: string) => !q || name.toLowerCase().includes(q)

  if (!layout) return error ? <FormError>{error}</FormError> : <Spinner />

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          Which year
          <select className={staffInput} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear + 1, thisYear, thisYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-600">
          <strong className="text-ink">{used}</strong> of {total} tables given out ·{' '}
          <strong className="text-ink">{Math.max(0, total - used)}</strong> free
        </p>
      </Card>

      <FormError>{error}</FormError>

      {/* ------------------------------------------------ who sits where */}
      <Card className="space-y-3">
        <div>
          <h2 className="font-display text-[15px] font-extrabold text-ink">Who sits where</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Type a stand’s table numbers — <strong>7</strong>, or <strong>7, 8</strong>, or{' '}
            <strong>7-9</strong> — and press Save. The map below fills in straight away. Tables side by
            side show as one stand, with the name once.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Icon name="search" size={16} className="shrink-0 text-slate-400" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Find a vendor or rescue"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>

        <Section title={`Vendors · ${thisYears.vendors.length}`}>
          {thisYears.vendors.filter((v) => match(v.name)).map((v) => (
            <AssignRow
              key={v.id}
              name={v.name}
              hint={v.vendor_category ?? undefined}
              hidden={!v.vendor_published}
              current={numbersFor({ kind: 'vendor', id: v.id })}
              onSave={(n) => setTables(orgId, year, { kind: 'vendor', id: v.id }, n)}
              onSaved={load}
              onFocusTable={setSelected}
            />
          ))}
          {thisYears.vendors.length === 0 && <Empty>No vendors are tagged for {year}. Tick the year on each one under Vendors.</Empty>}
        </Section>

        <Section title={`Rescue partners · ${thisYears.partners.length}`}>
          {thisYears.partners.filter((p) => match(p.name)).map((p) => (
            <AssignRow
              key={p.id}
              name={p.name}
              hint={p.is_host ? 'Host' : (p.location ?? undefined)}
              hidden={!p.is_published}
              current={numbersFor({ kind: 'rescue', id: p.id })}
              onSave={(n) => setTables(orgId, year, { kind: 'rescue', id: p.id }, n)}
              onSaved={load}
              onFocusTable={setSelected}
            />
          ))}
          {thisYears.partners.length === 0 && <Empty>No rescues are tagged for {year}. Tick the year on each one under Rescues.</Empty>}
        </Section>

        <Section title="Anything else">
          <p className="text-xs leading-relaxed text-slate-500">
            A sponsor’s table, the OHRR info table — anything that isn’t a vendor or a rescue.
          </p>
          {labels.filter(match).map((label) => (
            <AssignRow
              key={label}
              name={label}
              current={numbersFor({ kind: 'other', label })}
              onSave={(n) => setTables(orgId, year, { kind: 'other', label }, n)}
              onSaved={load}
              onFocusTable={setSelected}
            />
          ))}
          <NewOther orgId={orgId} year={year} onSaved={load} />
        </Section>
      </Card>

      {/* ------------------------------------------------ the live map */}
      <Card className="space-y-3">
        <h2 className="font-display text-[15px] font-extrabold text-ink">The map, as visitors will see it</h2>
        {ROOM_ORDER.map((room) => {
          const rr = numbered.filter((r) => r.room === room)
          return (
            <div key={room} className="space-y-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                {ROOM_NAMES[room]}
                {rr.length > 0 && ` · tables ${rr[0].first}–${rr[rr.length - 1].last}`}
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
                <TablesPanel
                  room={room}
                  rows={numbered}
                  blocks={blocks}
                  selected={selected}
                  onSelect={(b) => setSelected(b.numbers[0])}
                  label={`${ROOM_NAMES[room]} tables`}
                />
              </div>
            </div>
          )
        })}
      </Card>

      {/* ------------------------------------------------ the layout */}
      <Card className="space-y-3">
        <div>
          <h2 className="font-display text-[15px] font-extrabold text-ink">How the tables are laid out</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            How many tables in each row, top to bottom. Numbers run through the Burgundy Room, row by row,
            then on into the Emerald Room.
          </p>
          {isDefault && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              This is a starting layout sized to this year’s roster — the published map doesn’t number the
              tables. Change the rows to match the room, then save.
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Set this before giving out tables: changing a row renumbers every table after it.
          </p>
        </div>

        {ROOM_ORDER.map((room) => {
          const rr = numberRows(rowsFromLayout(layout)).filter((r) => r.room === room)
          return (
            <div key={room} className="space-y-2">
              <p className="text-sm font-extrabold text-ink">{ROOM_NAMES[room]}</p>
              {layout[room].map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs font-bold text-slate-500">Row {i + 1}</span>
                  <button
                    type="button"
                    aria-label={`One fewer table in row ${i + 1}`}
                    onClick={() => setRow(room, i, n - 1)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-display text-lg font-black text-ink">{n}</span>
                  <button
                    type="button"
                    aria-label={`One more table in row ${i + 1}`}
                    onClick={() => setRow(room, i, n + 1)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600"
                  >
                    +
                  </button>
                  <span className="min-w-0 flex-1 text-xs text-slate-500">
                    {rr[i] ? `tables ${rr[i].first}–${rr[i].last}` : ''}
                  </span>
                  {layout[room].length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLayout({ ...layout, [room]: layout[room].filter((_, j) => j !== i) })}
                      className="shrink-0 text-xs font-bold text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLayout({ ...layout, [room]: [...layout[room], layout[room].at(-1) ?? 6] })}
                className="text-sm font-bold text-brand-blue"
              >
                + Add a row
              </button>
            </div>
          )
        })}

        <FormError>{layoutError}</FormError>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveLayout}
            disabled={savingLayout || (!layoutChanged && !isDefault)}
            className={`${btn.primary} flex-1 disabled:opacity-60`}
          >
            {savingLayout ? 'Saving…' : isDefault && !layoutChanged ? 'Use this layout' : 'Save layout'}
          </button>
          {layoutChanged && saved && (
            <button type="button" onClick={() => setLayout(saved)} className={`${btn.outline} shrink-0`}>
              Undo
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{children}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-3 text-sm text-slate-500">{children}</p>
}

/** One stand: its name, its table numbers, and Save. */
function AssignRow({
  name,
  hint,
  hidden,
  current,
  onSave,
  onSaved,
  onFocusTable,
}: {
  name: string
  hint?: string
  hidden?: boolean
  current: number[]
  onSave: (numbers: number[]) => Promise<void>
  onSaved: () => Promise<void>
  onFocusTable: (n: number | undefined) => void
}) {
  const shown = formatNumbers(current)
  const [text, setText] = useState(shown)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Keep the box in step when the list reloads after someone else's save.
  useEffect(() => setText(shown), [shown])

  const dirty = text.trim() !== shown

  const save = async () => {
    const parsed = parseNumbers(text)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(parsed.numbers)
      await onSaved()
      setDone(true)
      onFocusTable(parsed.numbers[0])
      setTimeout(() => setDone(false), 1800)
    } catch (e) {
      setError(errMessage(e))
    }
    setBusy(false)
  }

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink">{name}</span>
            {hidden && <Badge tone="orange">Hidden</Badge>}
          </span>
          {hint && <span className="block truncate text-xs text-slate-500">{hint}</span>}
        </span>
        <input
          className="h-11 w-24 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-center font-display text-base font-extrabold text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          inputMode="numeric"
          placeholder="—"
          aria-label={`Table numbers for ${name}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onFocus={() => onFocusTable(current[0])}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (dirty) void save()
            }
          }}
        />
        {dirty ? (
          <button type="button" onClick={save} disabled={busy} className={`${btn.primary} h-11 shrink-0 !px-4 disabled:opacity-60`}>
            {busy ? '…' : 'Save'}
          </button>
        ) : done ? (
          <span className="inline-flex h-11 w-[4.25rem] shrink-0 items-center justify-center text-green-600">
            <Icon name="check" size={20} />
          </span>
        ) : (
          <span className="w-[4.25rem] shrink-0" />
        )}
      </div>
      {error && <p className="mt-1.5 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  )
}

/** A table for something that isn't a vendor or a rescue. */
function NewOther({ orgId, year, onSaved }: { orgId: string; year: number; onSaved: () => Promise<void> }) {
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const parsed = parseNumbers(text)
    if ('error' in parsed) return setError(parsed.error)
    if (!label.trim() || parsed.numbers.length === 0) return setError('Give it a name and at least one table number.')
    setBusy(true)
    setError(null)
    try {
      await setTables(orgId, year, { kind: 'other', label: label.trim() }, parsed.numbers)
      setLabel('')
      setText('')
      await onSaved()
    } catch (e) {
      setError(errMessage(e))
    }
    setBusy(false)
  }

  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input className={`${staffInput} !mt-0 min-w-0 flex-1`} placeholder="Name, e.g. OHRR info" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input
          className="h-11 w-24 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-center font-display text-base font-extrabold outline-none"
          inputMode="numeric"
          placeholder="Tables"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button type="button" onClick={save} disabled={busy} className={`${btn.outline} w-full disabled:opacity-60`}>
        <Icon name="plus" size={15} /> {busy ? 'Adding…' : 'Add'}
      </button>
    </div>
  )
}
