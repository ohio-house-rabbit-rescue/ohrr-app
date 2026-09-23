// Staff → BunFest → Floor plan.
//
// Two jobs, one tab:
//
//   Who sits where   this year's vendors and rescues, a box beside each for
//                    its table numbers ("7" or "7, 8" or "7-9"), and the map
//                    drawn live underneath — type a number, the name appears.
//                    Side-by-side tables of one stand show as one block.
//   Design the venue the building itself, which may be different next year:
//                    rooms, rows of tables, the stage and spa, the doors
//                    (StaffVenue.tsx).
//
// Tables are numbered from the SAVED venue, because that's what the database
// checks a table number against. So the design is saved first, then the
// tables are given out.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errMessage } from '../../../lib/supabase'
import { Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { listSuppliers, type Supplier } from '../../hopshop/api'
import { listPartners, listTables, loadVenue, setTables, venueYears, type PartnerRow, type TableHolderRef, type TableRecord } from '../api'
import {
  MAKOY_2026,
  blankVenue,
  buildBlocks,
  formatNumbers,
  parseNumbers,
  parseVenue,
  placeTables,
  roomRanges,
  totalTables,
  type TableAssignment,
  type Venue,
} from '../floor'
import { VenuePlan, ZoomBox } from '../VenuePlan'
import StaffVenue from './StaffVenue'

const clone = (v: Venue): Venue => JSON.parse(JSON.stringify(v))

export default function StaffFloor({ orgId }: { orgId: string }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [view, setView] = useState<'assign' | 'design'>('assign')
  const [saved, setSaved] = useState<Venue | null>(null)
  const [editing, setEditing] = useState<Venue | null>(null)
  const [otherYears, setOtherYears] = useState<number[]>([])
  const [tables, setTablesState] = useState<TableRecord[]>([])
  const [vendors, setVendors] = useState<Supplier[]>([])
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<number | undefined>()

  const load = useCallback(
    async (keepEdits = false) => {
      if (!orgId) return
      try {
        const [v, t, sup, par, ys] = await Promise.all([
          loadVenue(orgId, year),
          listTables(orgId, year),
          listSuppliers(orgId),
          listPartners(orgId),
          venueYears(orgId),
        ])
        const s = v ? parseVenue(v.layout) : null
        if (s && v) s.name = v.name || s.name
        setSaved(s)
        // 2026 starts from the bundled design until it's saved; other years
        // choose a starting point.
        if (!keepEdits) setEditing(s ? clone(s) : year === 2026 ? clone(MAKOY_2026) : null)
        setOtherYears(ys.filter((y) => y !== year))
        setTablesState(t)
        setVendors(sup.filter((x) => x.is_vendor))
        setPartners(par)
        setError(null)
      } catch (e) {
        setError(errMessage(e))
      }
      setLoaded(true)
    },
    [orgId, year],
  )

  useEffect(() => {
    setLoaded(false)
    void load()
  }, [load])

  // This year's roster — tagged for the year, or not tagged by year at all.
  const roster = useMemo(() => {
    const inYear = (years: number[], fallback: boolean) => (years.length > 0 ? years.includes(year) : fallback)
    return {
      vendors: vendors.filter((v) => inYear(v.vendor_years, v.vendor_published)).sort((a, b) => a.name.localeCompare(b.name)),
      partners: partners.filter((p) => inYear(p.bunfest_years, p.at_bunfest)).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [vendors, partners, year])

  // The preview shows every name, published or not — staff need to see them.
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

  const blocks = useMemo(() => (saved ? buildBlocks(placeTables(saved), assignments) : []), [saved, assignments])
  const total = saved ? totalTables(saved) : 0
  const used = new Set(tables.map((t) => t.table_no)).size
  const ranges = saved ? roomRanges(saved) : new Map()

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

  const labels = useMemo(() => [...new Set(tables.filter((t) => t.label).map((t) => t.label as string))].sort(), [tables])
  const q = filter.trim().toLowerCase()
  const match = (name: string) => !q || name.toLowerCase().includes(q)

  const startOptions = [
    ...otherYears.map((y) => ({
      label: `Copy the ${y} venue`,
      hint: 'Same building? Start from it and change what’s different.',
      venue: async () => {
        const v = await loadVenue(orgId, y)
        const p = v ? parseVenue(v.layout) : null
        if (!p) throw new Error(`The ${y} venue couldn’t be read.`)
        if (v) p.name = v.name || p.name
        return p
      },
    })),
    { label: 'Start from The Makoy, 2026', hint: 'The Burgundy and Emerald Rooms.', venue: () => clone(MAKOY_2026) },
    { label: 'Start with an empty room', hint: 'A new venue — add its rooms, then the tables.', venue: () => blankVenue() },
  ]

  if (!loaded) return <Spinner />

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
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
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['assign', 'Who sits where'],
              ['design', 'Design the venue'],
            ] as const
          ).map(([v, text]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`min-h-[44px] rounded-full text-sm font-bold ${view === v ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
            >
              {text}
            </button>
          ))}
        </div>
        {saved && view === 'assign' && (
          <p className="text-sm text-slate-600">
            <strong className="text-ink">{used}</strong> of {total} tables given out ·{' '}
            <strong className="text-ink">{Math.max(0, total - used)}</strong> free
          </p>
        )}
      </Card>

      <FormError>{error}</FormError>

      {view === 'design' && (
        <StaffVenue
          key={year}
          orgId={orgId}
          year={year}
          venue={editing}
          saved={saved}
          hasAssignments={tables.length > 0}
          startOptions={startOptions}
          onChange={setEditing}
          onSaved={() => load()}
        />
      )}

      {view === 'assign' && !saved && (
        <Card className="space-y-3 text-center">
          <p className="font-display text-base font-extrabold text-ink">Design the {year} venue first</p>
          <p className="text-sm leading-relaxed text-slate-600">
            Table numbers come from the saved design — once it’s saved, give out the tables here.
            {year === 2026 && ' This year’s starting design is ready to check and save.'}
          </p>
          <button type="button" onClick={() => setView('design')} className={`${btn.primary} mx-auto`}>
            Design the venue
          </button>
        </Card>
      )}

      {view === 'assign' && saved && (
        <>
          <Card className="space-y-3">
            <div>
              <h2 className="font-display text-[15px] font-extrabold text-ink">Who sits where</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Type a stand’s table numbers — <strong>7</strong>, or <strong>7, 8</strong>, or <strong>7-9</strong> —
                and press Save. The map below fills in straight away. Tables side by side show as one
                stand, with the name once.
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Icon name="search" size={16} className="shrink-0 text-slate-400" />
              <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Find a vendor or rescue" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </label>

            <Section title={`Vendors · ${roster.vendors.length}`}>
              {roster.vendors.filter((v) => match(v.name)).map((v) => (
                <AssignRow
                  key={v.id}
                  name={v.name}
                  hint={v.vendor_category ?? undefined}
                  hidden={!v.vendor_published}
                  current={numbersFor({ kind: 'vendor', id: v.id })}
                  onSave={(n) => setTables(orgId, year, { kind: 'vendor', id: v.id }, n)}
                  onSaved={() => load(true)}
                  onFocusTable={setSelected}
                />
              ))}
              {roster.vendors.length === 0 && <Empty>No vendors are tagged for {year}. Tick the year on each one under Vendors.</Empty>}
            </Section>

            <Section title={`Rescue partners · ${roster.partners.length}`}>
              {roster.partners.filter((p) => match(p.name)).map((p) => (
                <AssignRow
                  key={p.id}
                  name={p.name}
                  hint={p.is_host ? 'Host' : (p.location ?? undefined)}
                  hidden={!p.is_published}
                  current={numbersFor({ kind: 'rescue', id: p.id })}
                  onSave={(n) => setTables(orgId, year, { kind: 'rescue', id: p.id }, n)}
                  onSaved={() => load(true)}
                  onFocusTable={setSelected}
                />
              ))}
              {roster.partners.length === 0 && <Empty>No rescues are tagged for {year}. Tick the year on each one under Rescues.</Empty>}
            </Section>

            <Section title="Anything else">
              <p className="px-3 pt-2.5 text-xs leading-relaxed text-slate-500">
                A sponsor’s table, the OHRR info table — anything that isn’t a vendor or a rescue.
              </p>
              {labels.filter(match).map((label) => (
                <AssignRow
                  key={label}
                  name={label}
                  current={numbersFor({ kind: 'other', label })}
                  onSave={(n) => setTables(orgId, year, { kind: 'other', label }, n)}
                  onSaved={() => load(true)}
                  onFocusTable={setSelected}
                />
              ))}
              <NewOther orgId={orgId} year={year} onSaved={() => load(true)} />
            </Section>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-[15px] font-extrabold text-ink">The map, as visitors will see it</h2>
            {saved.rooms.map((room) => {
              const r = ranges.get(room.id)
              return (
                <div key={room.id} className="space-y-1">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    {room.name}
                    {r ? ` · tables ${r[0]}–${r[1]}` : ''}
                  </p>
                  <ZoomBox>
                    <VenuePlan room={room} blocks={blocks} selectedTable={selected} onSelectBlock={(b) => setSelected(b.numbers[0])} label={`${room.name} tables`} />
                  </ZoomBox>
                </div>
              )
            })}
          </Card>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{children}</div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
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

  // Keep the box in step when the list reloads after a save.
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
