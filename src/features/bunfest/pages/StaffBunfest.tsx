// Staff → BunFest: the festival's own content, editable from a phone.
//
// Until now the education schedule, the vendor list, the rescue directory and
// every activity page were bundled data — publishing this year's meant a code
// change. The tabs here replace that, all keyed by year:
//
//   This year  the "at the festival" cards, the facts on Plan your visit, and
//              "start next year" — which copies a whole year forward in one tap
//   Schedule   the programme, including which track a talk belongs to
//   Pages      Bunny Spa, Glamour Shots, the raffle, the host hotel … — their
//              prices, times and copy, which change every year
//   Vendors    the BunFest side of a company in the Hop Shop supplier list
//   Rescues    the rescue directory, and which years each one came
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { listSuppliers, type Supplier } from '../../hopshop/api'
import { giftTotals, type GiftTotals } from '../../hopshop/companies'
import { CompanyForm, CompanySummary, CompanyThumb, useVendorRecordsReady } from '../../hopshop/CompanyForm'
import StaffFloor from './StaffFloor'
import StaffSpeakers from './StaffSpeakers'
import {
  copySessions,
  deletePartner,
  deleteSession,
  fromTime,
  listPartners,
  listSessions,
  listPresenters,
  type PresenterRow,
  savePartner,
  saveSession,
  sessionYears,
  toTime,
  SESSION_KINDS,
  deletePage,
  listPages,
  pageYears,
  savePage,
  sectionsFromForm,
  sectionsToForm,
  startBunfestYear,
  type PageRow,
  type PageSection,
  type PartnerRow,
  type SessionRow,
  deleteFeature,
  type EventFacts,
  FEATURE_ICONS,
  listFeatures,
  loadEventFacts,
  saveEventFacts,
  saveFeature,
  type FeatureRow,
} from '../api'

type Tab = 'schedule' | 'vendors' | 'partners' | 'year' | 'pages' | 'floor'
const TABS: [Tab, string][] = [
  ['year', 'This year'],
  ['schedule', 'Schedule'],
  ['pages', 'Pages'],
  ['vendors', 'Vendors'],
  ['partners', 'Rescues'],
  ['floor', 'Floor plan'],
]

// The two tracks the festival runs. Free text, so a third one next year needs
// no change here — these are only the suggestions.
const TRACKS = ['Education Sessions', 'Special Interest Sessions']

const REGIONS = ['Midwest', 'Northeast', 'South', 'West'] as const

/**
 * Which years a vendor or rescue came. This used to be a single yes/no, so
 * putting this year's roster up meant deleting the record of last year's.
 */
function YearChips({ value, onChange }: { value: number[]; onChange: (years: number[]) => void }) {
  const now = new Date().getFullYear()
  const options = [...new Set([now + 1, now, now - 1, ...value])].sort((a, b) => b - a)
  const toggle = (y: number) =>
    onChange(value.includes(y) ? value.filter((v) => v !== y) : [...value, y].sort((a, b) => a - b))

  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">Years at BunFest</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => toggle(y)}
            aria-pressed={value.includes(y)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${
              value.includes(y)
                ? 'bg-brand-orange text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <span className="mt-1 block text-xs text-slate-500">
        {value.length === 0
          ? 'No years ticked — they show on every year’s list until you tick one.'
          : 'They appear on the list for the years ticked here.'}
      </span>
    </div>
  )
}
export default function StaffBunfest() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab: Tab = pathname.endsWith('/vendors')
    ? 'vendors'
    : pathname.endsWith('/partners')
      ? 'partners'
      : pathname.endsWith('/schedule')
        ? 'schedule'
        : pathname.endsWith('/floor')
          ? 'floor'
          : pathname.endsWith('/pages')
          ? 'pages'
          : 'year'

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Midwest BunFest</h1>
        <p className="mt-1 text-sm text-slate-600">
          The programme, the vendor tables and the rescue directory — what visitors see in the app and on the website.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => navigate(t === 'year' ? '/staff/bunfest' : `/staff/bunfest/${t}`)}
            className={`min-h-[44px] rounded-full px-2 text-[13px] font-bold ${
              tab === t ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'year' && <ThisYearTab orgId={orgId} />}
      {tab === 'schedule' && <ScheduleTab orgId={orgId} />}
      {tab === 'pages' && <PagesTab orgId={orgId} />}
      {tab === 'vendors' && <VendorsTab orgId={orgId} />}
      {tab === 'partners' && <PartnersTab orgId={orgId} />}
      {tab === 'floor' && <StaffFloor orgId={orgId} />}
    </Screen>
  )
}

/* ============================================================== schedule */

function ScheduleTab({ orgId }: { orgId: string }) {
  const [view, setView] = useState<'sessions' | 'speakers'>('sessions')
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(
          [
            ['sessions', 'Sessions'],
            ['speakers', 'Speakers'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`min-h-[40px] flex-1 rounded-full text-sm font-bold ${
              view === v ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'sessions' ? <SessionsList orgId={orgId} /> : <StaffSpeakers orgId={orgId} />}
    </div>
  )
}

function SessionsList({ orgId }: { orgId: string }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [years, setYears] = useState<number[]>([])
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [presenters, setPresenters] = useState<PresenterRow[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [list, ys, ps] = await Promise.all([listSessions(orgId, year), sessionYears(orgId), listPresenters(orgId)])
      setRows(list)
      setPresenters(ps)
      setYears([...new Set([thisYear, ...ys])].sort((a, b) => b - a))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year, thisYear])
  useEffect(() => {
    void load()
  }, [load])

  const copyFrom = async (from: number) => {
    setError(null)
    try {
      const n = await copySessions(orgId, from, year)
      setNote(n === 0 ? `Nothing to copy from ${from}.` : `Copied ${n} sessions from ${from} — they start hidden, so edit then tick “People can see this”.`)
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const older = years.filter((y) => y !== year)

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          Which year
          <select className={staffInput} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[...new Set([thisYear, thisYear + 1, ...years])]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </label>
        {rows && rows.length === 0 && older.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">Start from a previous year:</span>
            {older.map((y) => (
              <button key={y} type="button" onClick={() => copyFrom(y)} className={`${btn.outline} !px-3 !py-1.5 text-xs`}>
                Copy {y}
              </button>
            ))}
          </div>
        )}
      </Card>

      <FormError>{error}</FormError>
      {note && <p className="text-sm font-bold text-green-700">{note}</p>}
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-sm text-slate-600">
          No sessions for {year} yet. Until one is published, visitors see the 2025 programme with a note that this
          year’s is coming.
        </Card>
      )}

      {rows?.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <SessionForm
              orgId={orgId}
              year={year}
              presenters={presenters}
              initial={r}
              onDone={async () => {
                setEditing(null)
                await load()
              }}
            />
          </Card>
        ) : (
          <Card key={r.id} className="space-y-1.5">
            <div className="flex items-start gap-3">
              <span className="w-[86px] shrink-0 font-display text-sm font-black text-brand-blue">
                {fromTime(r.start_time)}
                {r.end_time ? <span className="block text-xs font-bold text-slate-400">to {fromTime(r.end_time)}</span> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.title}</span>
                  {r.kind !== 'session' && <Badge tone="slate">{r.kind === 'break' ? 'Break' : 'Activity'}</Badge>}
                  {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                </span>
                {r.presenter && <span className="block text-xs text-slate-500">{r.presenter}</span>}
                <span className="block text-xs text-slate-400">{[r.track, r.room].filter(Boolean).join(' · ')}</span>
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <SessionForm
            orgId={orgId}
            year={year}
            presenters={presenters}
            initial={null}
            onDone={async () => {
              setEditing(null)
              await load()
            }}
          />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add a session
        </button>
      )}
    </div>
  )
}

function SessionForm({
  orgId,
  year,
  initial,
  presenters,
  onDone,
}: {
  orgId: string
  year: number
  initial: SessionRow | null
  presenters: PresenterRow[]
  onDone: () => Promise<void>
}) {
  const [d, setD] = useState({
    start_time: fromTime(initial?.start_time ?? '10:45:00'),
    end_time: fromTime(initial?.end_time ?? null),
    title: initial?.title ?? '',
    presenter: initial?.presenter ?? '',
    description: initial?.description ?? '',
    room: initial?.room ?? '',
    track: initial?.track ?? TRACKS[0],
    kind: initial?.kind ?? ('session' as SessionRow['kind']),
    is_published: initial?.is_published ?? true,
    presenter_ids: initial?.presenter_ids ?? ([] as string[]),
  })
  const togglePresenter = (id: string) =>
    setD((cur) => ({
      ...cur,
      presenter_ids: cur.presenter_ids.includes(id) ? cur.presenter_ids.filter((x) => x !== id) : [...cur.presenter_ids, id],
    }))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveSession({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        start_time: toTime(d.start_time),
        end_time: d.end_time ? toTime(d.end_time) : null,
        title: d.title.trim(),
        // Picked the speakers but left the line blank? Write it from them.
        presenter:
          d.presenter.trim() ||
          d.presenter_ids
            .map((id) => presenters.find((p) => p.id === id))
            .filter((p): p is PresenterRow => !!p)
            .map((p) => (p.credentials ? `${p.name}, ${p.credentials}` : p.name))
            .join(' and ') ||
          null,
        description: d.description.trim() || null,
        room: d.room.trim() || null,
        track: d.track.trim() || TRACKS[0],
        kind: d.kind,
        is_published: d.is_published,
        presenter_ids: d.presenter_ids,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Starts
          <input type="time" className={staffInput} required value={d.start_time} onChange={txt('start_time')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Ends
          <input type="time" className={staffInput} value={d.end_time} onChange={txt('end_time')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Title
        <input className={staffInput} required value={d.title} onChange={txt('title')} placeholder="Administering Meds at Home" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Who’s presenting
        <input className={staffInput} value={d.presenter} onChange={txt('presenter')} placeholder="Emily Fagundo, DVM · MedVet Hilliard" />
      </label>
      {presenters.length > 0 && (
        <div>
          <span className="block text-sm font-semibold text-slate-700">Link to their bios</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {presenters.map((p) => {
              const on = d.presenter_ids.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePresenter(p.id)}
                  aria-pressed={on}
                  className={`min-h-[40px] rounded-full px-3 text-sm font-bold ${
                    on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            Their names on the schedule then open the Speakers page. Add people under Speakers.
          </span>
        </div>
      )}
      <label className="block text-sm font-semibold text-slate-700">
        What it covers
        <textarea className={staffInput} rows={2} value={d.description} onChange={txt('description')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Track
        <input className={staffInput} list="bunfest-tracks" value={d.track} onChange={txt('track')} placeholder="Education Sessions" />
        <datalist id="bunfest-tracks">
          {TRACKS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Talks in different tracks run at the same time, and visitors pick a track at the top of the
          schedule. Type a new name to start another one.
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Where
          <input className={staffInput} value={d.room} onChange={txt('room')} placeholder="Upstairs · Education Room" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Kind
          <select className={staffInput} value={d.kind} onChange={txt('kind')}>
            {SESSION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 text-brand-blue"
          checked={d.is_published}
          onChange={(e) => setD({ ...d, is_published: e.target.checked })}
        />
        People can see this
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.title.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deleteSession(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}

/* =============================================================== vendors */

function VendorsTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Supplier[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows((await listSuppliers(orgId)).filter((s) => s.is_vendor))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  // Gift counts and totals for the summary on each row (update 27).
  const ready = useVendorRecordsReady()
  const [gifts, setGifts] = useState<Map<string, GiftTotals> | null>(null)
  const loadGifts = useCallback(async () => {
    if (!ready || !orgId) return
    try {
      setGifts(await giftTotals(orgId))
    } catch {
      setGifts(null)
    }
  }, [ready, orgId])
  useEffect(() => {
    void loadGifts()
  }, [loadGifts])

  const done = async () => {
    setEditing(null)
    await load()
  }
  const yearPicker = (years: number[], onChange: (years: number[]) => void) => <YearChips value={years} onChange={onChange} />
  const published = (rows ?? []).filter((r) => r.vendor_published).length

  return (
    <div className="space-y-3">
      <Card className="text-sm text-slate-600">
        A vendor is a company in the Hop Shop <strong>Suppliers</strong> list with “Vendor” ticked. Visitors see the name,
        category, <strong>About them</strong> and website; everything else on the card — contact, photo, paperwork, fees,
        what they’ve given — is for the team only.{' '}
        {rows && rows.length > 0 && (
          <span className="font-semibold text-ink">
            {published} of {rows.length} published.
          </span>
        )}
      </Card>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-sm text-slate-600">
          No vendors yet. Add one below, or tick “Vendor” on a company in Hop Shop → Suppliers.
        </Card>
      )}

      {rows?.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <p className="mb-3 font-display text-[15px] font-extrabold text-ink">{r.name}</p>
            <CompanyForm
              orgId={orgId}
              initial={r}
              mode="bunfest"
              onSaved={done}
              onCancel={() => setEditing(null)}
              onGiftsChanged={() => void loadGifts()}
              yearPicker={yearPicker}
            />
          </Card>
        ) : (
          <Card key={r.id} className="space-y-1">
            <div className="flex items-start gap-3">
              <CompanyThumb c={r} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.name}</span>
                  {r.vendor_published ? <Badge tone="blue">Published</Badge> : <Badge tone="orange">Hidden</Badge>}
                  {r.is_supplier && <Badge tone="slate">Supplier too</Badge>}
                </span>
                <span className="block text-xs text-slate-500">
                  {[r.vendor_category, r.vendor_room ? (r.vendor_room === 'burgundy' ? 'Burgundy Room' : 'Emerald Room') : null, r.vendor_booth ? `Booth ${r.vendor_booth}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No booth details yet'}
                </span>
                <CompanySummary c={r} gifts={gifts?.get(r.id)} />
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-brand-blue">
                Open
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New vendor</p>
          <CompanyForm orgId={orgId} initial={null} mode="bunfest" onSaved={done} onCancel={() => setEditing(null)} yearPicker={yearPicker} />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} min-h-[44px] w-full`}>
          <Icon name="plus" size={16} /> Add a vendor
        </button>
      )}
    </div>
  )
}

/* ============================================================== partners */

function PartnersTab({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<PartnerRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listPartners(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows ?? []
    return (rows ?? []).filter((r) => `${r.name} ${r.city ?? ''} ${r.state ?? ''} ${r.region ?? ''}`.toLowerCase().includes(t))
  }, [rows, q])

  return (
    <div className="space-y-3">
      <Card className="text-sm text-slate-600">
        The rescue directory — BunFest’s rescue partners and “find a rescue near you”. Leave it empty and the app keeps
        showing the researched 2026 list.
      </Card>
      <div className="relative">
        <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find by name or state"
          className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none focus:border-brand-blue"
        />
      </div>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}

      {shown.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <PartnerForm
              orgId={orgId}
              initial={r}
              onDone={async () => {
                setEditing(null)
                await load()
              }}
            />
          </Card>
        ) : (
          <Card key={r.id} className="space-y-1">
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.name}</span>
                  {r.is_host && <Badge tone="blue">Host</Badge>}
                  {r.at_bunfest && <Badge tone="orange">At BunFest</Badge>}
                  {!r.is_published && <Badge tone="slate">Hidden</Badge>}
                </span>
                <span className="block text-xs text-slate-500">
                  {r.location || [r.city, r.state].filter(Boolean).join(', ')}
                  {r.region ? ` · ${r.region}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <PartnerForm
            orgId={orgId}
            initial={null}
            onDone={async () => {
              setEditing(null)
              await load()
            }}
          />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add a rescue
        </button>
      )}
    </div>
  )
}

function PartnerForm({ orgId, initial, onDone }: { orgId: string; initial: PartnerRow | null; onDone: () => Promise<void> }) {
  const [d, setD] = useState({
    name: initial?.name ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    region: (initial?.region ?? 'Midwest') as (typeof REGIONS)[number],
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    website: initial?.website ?? '',
    blurb: initial?.blurb ?? '',
    is_host: initial?.is_host ?? false,
    years: initial?.bunfest_years ?? [new Date().getFullYear()],
    is_published: initial?.is_published ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let website = d.website.trim() || null
      if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
      await savePartner({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        name: d.name.trim(),
        city: d.city.trim() || null,
        state: d.state.trim().toUpperCase() || null,
        region: d.region,
        location: [d.city.trim(), d.state.trim().toUpperCase()].filter(Boolean).join(', ') || null,
        phone: d.phone.trim() || null,
        email: d.email.trim() || null,
        address: d.address.trim() || null,
        website,
        blurb: d.blurb.trim() || null,
        is_host: d.is_host,
        bunfest_years: d.years,
        at_bunfest: d.years.length > 0,
        is_published: d.is_published,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Rescue
        <input className={staffInput} required value={d.name} onChange={txt('name')} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="col-span-2 block text-sm font-semibold text-slate-700">
          City
          <input className={staffInput} value={d.city} onChange={txt('city')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          State
          <input className={staffInput} maxLength={2} value={d.state} onChange={txt('state')} placeholder="OH" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Region
        <select className={staffInput} value={d.region} onChange={txt('region')}>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Phone
          <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input className={staffInput} type="email" value={d.email} onChange={txt('email')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Website
        <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Address
        <input className={staffInput} value={d.address} onChange={txt('address')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        About them
        <textarea className={staffInput} rows={2} value={d.blurb} onChange={txt('blurb')} />
      </label>
      <YearChips value={d.years} onChange={(years) => setD({ ...d, years })} />
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.name.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deletePartner(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}

/* ============================================================= this year */

// The "at the festival" cards and the facts on Plan your visit. Both used to
// be written into the app, so a new year needed a new build.
function ThisYearTab({ orgId }: { orgId: string }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [rows, setRows] = useState<FeatureRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listFeatures(orgId, year))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year])
  useEffect(() => {
    void load()
  }, [load])

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
        <p className="text-xs text-slate-600">
          These are the cards under “At the festival” on the BunFest home screen. Leave a year empty and the app shows
          the built-in list.
        </p>
      </Card>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}

      {rows?.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <FeatureForm
              orgId={orgId}
              year={year}
              initial={r}
              onDone={async () => {
                setEditing(null)
                await load()
              }}
            />
          </Card>
        ) : (
          <Card key={r.id}>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.title}</span>
                  {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                </span>
                {r.blurb && <span className="block text-xs text-slate-500">{r.blurb}</span>}
                <span className="block text-xs text-slate-400">
                  {[r.icon ? `icon: ${r.icon}` : null, r.link_url].filter(Boolean).join(' · ') || 'No link'}
                </span>
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <FeatureForm
            orgId={orgId}
            year={year}
            initial={null}
            onDone={async () => {
              setEditing(null)
              await load()
            }}
          />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add a card
        </button>
      )}

      <EventFactsCard orgId={orgId} />
      <StartNextYearCard orgId={orgId} />
    </div>
  )
}

/**
 * Setting a new year up used to mean retyping everything. This copies the
 * programme, the festival cards, every activity page and both rosters into the
 * new year in one tap, leaving anything already entered there untouched.
 */
function StartNextYearCard({ orgId }: { orgId: string }) {
  const now = new Date().getFullYear()
  const [from, setFrom] = useState(now)
  const [to, setTo] = useState(now + 1)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const years = [now + 2, now + 1, now, now - 1, now - 2]

  const run = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const r = await startBunfestYear(orgId, from, to)
      const parts = [
        r.sessions ? `${r.sessions} sessions` : null,
        r.pages ? `${r.pages} pages` : null,
        r.features ? `${r.features} cards` : null,
        r.vendors ? `${r.vendors} vendors` : null,
        r.partners ? `${r.partners} rescues` : null,
        r.venue ? 'the venue design' : null,
        r.tables ? `${r.tables} table places` : null,
      ].filter(Boolean)
      setDone(
        parts.length === 0
          ? `Nothing to copy — ${to} already has everything ${from} does.`
          : `Copied into ${to}: ${parts.join(', ')}. Go through them and change what has moved on.`,
      )
    } catch (e) {
      setError(errMessage(e))
    }
    setBusy(false)
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-[15px] font-extrabold text-ink">Start next year</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Copies the programme, the festival cards, every page, both rosters and the floor plan into a
          new year, so you edit last year’s instead of starting from a blank screen. Nothing already in
          the new year is touched — and a new venue can be designed from scratch on the Floor plan tab.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Copy from
          <select className={staffInput} value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Into
          <select className={staffInput} value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormError>{error}</FormError>
      {done && <p className="text-sm font-bold text-green-700">{done}</p>}
      <button
        type="button"
        onClick={run}
        disabled={busy || from === to}
        className={`${btn.outline} w-full disabled:opacity-60`}
      >
        {busy ? 'Copying…' : `Copy ${from} into ${to}`}
      </button>
    </Card>
  )
}

function FeatureForm({
  orgId,
  year,
  initial,
  onDone,
}: {
  orgId: string
  year: number
  initial: FeatureRow | null
  onDone: () => Promise<void>
}) {
  const [d, setD] = useState({
    title: initial?.title ?? '',
    blurb: initial?.blurb ?? '',
    icon: initial?.icon ?? 'star',
    link_url: initial?.link_url ?? '',
    is_published: initial?.is_published ?? true,
    sort_order: String(initial?.sort_order ?? 0),
  })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveFeature({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        title: d.title.trim(),
        blurb: d.blurb.trim() || null,
        icon: d.icon.trim() || null,
        link_url: d.link_url.trim() || null,
        is_published: d.is_published,
        sort_order: Number(d.sort_order) || 0,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        What it is
        <input className={staffInput} required value={d.title} onChange={txt('title')} placeholder="Bunny Spa" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        One line about it
        <input className={staffInput} value={d.blurb} onChange={txt('blurb')} placeholder="Nail trims and grooming for your rabbit." />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Picture on the card
          <select className={staffInput} value={d.icon} onChange={txt('icon')}>
            {FEATURE_ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Order
          <input inputMode="numeric" className={staffInput} value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Where it goes <span className="font-normal text-slate-400">(optional)</span>
        <input className={staffInput} value={d.link_url} onChange={txt('link_url')} placeholder="/bunfest/schedule or https://…" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
        People can see this
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.title.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deleteFeature(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}

/** Admission, parking, the rabbit rule and this year's links. */
function EventFactsCard({ orgId }: { orgId: string }) {
  const [d, setD] = useState<EventFacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    loadEventFacts(orgId)
      .then(setD)
      .catch((e) => setError(errMessage(e)))
  }, [orgId])

  if (error && !d) return <FormError>{error}</FormError>
  if (!d) return null
  const txt = (k: keyof EventFacts) => (e: { target: { value: string } }) => {
    setSaved(false)
    setD({ ...d, [k]: e.target.value })
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-display text-[15px] font-extrabold text-ink">Plan your visit</p>
        <p className="text-xs text-slate-600">What the app tells visitors about getting in and getting there.</p>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Admission — one per line, “who = price”
        <textarea
          className={staffInput}
          rows={3}
          value={d.admission}
          onChange={txt('admission')}
          placeholder={'Adults = $10.00\nAges 5–12 = $5.00\nUnder 5 = Free'}
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Note under the prices
        <input className={staffInput} value={d.admission_note} onChange={txt('admission_note')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Parking
        <input className={staffInput} value={d.parking} onChange={txt('parking')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        The rabbit rule
        <textarea className={staffInput} rows={2} value={d.rabbit_rule} onChange={txt('rabbit_rule')} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Tickets link
          <input className={staffInput} value={d.tickets_url} onChange={txt('tickets_url')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Hotel link
          <input className={staffInput} value={d.hotel_url} onChange={txt('hotel_url')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          BunFest volunteer link
          <input className={staffInput} value={d.volunteer_url} onChange={txt('volunteer_url')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Merch link
          <input className={staffInput} value={d.merch_url} onChange={txt('merch_url')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Credit line
        <input className={staffInput} value={d.logo_credit} onChange={txt('logo_credit')} placeholder="Logo design by …" />
      </label>
      <FormError>{error}</FormError>
      {saved && <p className="text-sm font-bold text-green-700">Saved.</p>}
      <button
        type="button"
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await saveEventFacts(orgId, d)
            setSaved(true)
          } catch (e) {
            setError(errMessage(e))
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy}
        className={`${btn.primary} w-full disabled:opacity-60`}
      >
        {busy ? 'Saving…' : 'Save these facts'}
      </button>
    </Card>
  )
}

/* ================================================================= pages */

// Bunny Spa prices, whether advance booking is open, the raffle's drawing
// time, the hotel's group code — this year's version of each activity page.
// It used to be src/data/bunfestPages.ts, so a change meant a new build.
function PagesTab({ orgId }: { orgId: string }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [years, setYears] = useState<number[]>([])
  const [rows, setRows] = useState<PageRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [list, ys] = await Promise.all([listPages(orgId, year), pageYears(orgId)])
      setRows(list)
      setYears(ys)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year])
  useEffect(() => {
    void load()
  }, [load])

  const done = async () => {
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          Which year
          <select className={staffInput} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[...new Set([thisYear + 1, thisYear, thisYear - 1, ...years])]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-slate-600">
          These are the pages behind the cards on the BunFest home screen — the Bunny Spa, Glamour
          Shots, the raffle, the host hotel and so on. Leave a year empty and the app falls back to
          the built-in copy. Use <strong>This year → Start next year</strong> to copy a whole set
          forward.
        </p>
      </Card>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-sm text-slate-600">
          No pages for {year} yet. Copy them forward from another year, or add one below.
        </Card>
      )}

      {rows?.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <PageForm orgId={orgId} year={year} initial={r} onDone={done} />
          </Card>
        ) : (
          <Card key={r.id}>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.title}</span>
                  {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                  {r.feature && <Badge tone="blue">{r.feature === 'reserve' ? 'Takes requests' : 'Raffle'}</Badge>}
                </span>
                {r.subtitle && <span className="block text-xs text-slate-500">{r.subtitle}</span>}
                <span className="block text-xs text-slate-400">/bunfest/p/{r.slug}</span>
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <PageForm orgId={orgId} year={year} initial={null} onDone={done} />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add a page
        </button>
      )}
    </div>
  )
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const asString = (v: unknown): string => (typeof v === 'string' ? v : '')

/** "Label | /bunfest/p/spa" per line — readable, and easy to type on a phone. */
function relatedToForm(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return v
    .map((r) => asRecord(r))
    .filter((r) => asString(r.label) && asString(r.to))
    .map((r) => `${asString(r.label)} | ${asString(r.to)}`)
    .join('\n')
}

function relatedFromForm(text: string): { label: string; to: string }[] {
  return text
    .split('\n')
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ label: parts[0].trim(), to: parts.slice(1).join('|').trim() }))
    .filter((r) => r.label && r.to)
}

function PageForm({
  orgId,
  year,
  initial,
  onDone,
}: {
  orgId: string
  year: number
  initial: PageRow | null
  onDone: () => Promise<void>
}) {
  const contact = asRecord(initial?.contact)
  const reserve = asRecord(initial?.reserve)
  const [d, setD] = useState({
    slug: initial?.slug ?? '',
    title: initial?.title ?? '',
    subtitle: initial?.subtitle ?? '',
    icon: initial?.icon ?? 'star',
    sponsor_note: initial?.sponsor_note ?? '',
    chips: (initial?.chips ?? []).join(', '),
    note: initial?.note ?? '',
    feature: (initial?.feature ?? '') as '' | 'reserve' | 'raffle',
    reserve_form: asString(reserve.formName),
    reserve_services: Array.isArray(reserve.services)
      ? reserve.services.filter((x): x is string => typeof x === 'string').join(', ')
      : '',
    reserve_slots: Array.isArray(reserve.slots)
      ? reserve.slots.filter((x): x is string => typeof x === 'string').join(', ')
      : '',
    reserve_opens: asString(reserve.opensOn),
    reserve_closes: asString(reserve.closesOn),
    reserve_closed_note: asString(reserve.closedNote),
    email_signup: initial?.email_signup ?? '',
    address: asString(contact.address),
    phone: asString(contact.phone),
    url: asString(contact.url),
    url_label: asString(contact.urlLabel),
    related_label: initial?.related_label ?? '',
    related: relatedToForm(initial?.related),
    is_published: initial?.is_published ?? true,
    sort: String(initial?.sort_order ?? 0),
  })
  const [sections, setSections] = useState<PageSection[]>(
    sectionsToForm(initial?.sections).length > 0
      ? sectionsToForm(initial?.sections)
      : [{ heading: '', body: '', list: '' }],
  )
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const setSection = (i: number, patch: Partial<PageSection>) =>
    setSections(sections.map((s, j) => (i === j ? { ...s, ...patch } : s)))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const hasContact = [d.address, d.phone, d.url].some((v) => v.trim())
      await savePage({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        slug: d.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''),
        title: d.title.trim(),
        subtitle: d.subtitle.trim() || null,
        icon: d.icon || null,
        sponsor_note: d.sponsor_note.trim() || null,
        chips: d.chips.split(',').map((c) => c.trim()).filter(Boolean),
        note: d.note.trim() || null,
        sections: sectionsFromForm(sections, initial?.sections),
        feature: d.feature || null,
        // Kept even when the form is switched off, so turning it back on next
        // year doesn't mean retyping the services and the times.
        reserve: {
          formName: d.reserve_form.trim() || `${d.slug.trim()}-reservation`,
          services: d.reserve_services.split(',').map((x) => x.trim()).filter(Boolean),
          slots: d.reserve_slots.split(',').map((x) => x.trim()).filter(Boolean),
          opensOn: d.reserve_opens || null,
          closesOn: d.reserve_closes || null,
          closedNote: d.reserve_closed_note.trim() || null,
        },
        email_signup: d.email_signup.trim() || null,
        contact: hasContact
          ? {
              address: d.address.trim(),
              phone: d.phone.trim(),
              url: d.url.trim(),
              urlLabel: d.url_label.trim(),
            }
          : null,
        related_label: d.related_label.trim() || null,
        related: relatedFromForm(d.related),
        is_published: d.is_published,
        sort_order: Number(d.sort) || 0,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Title
        <input className={staffInput} required value={d.title} onChange={txt('title')} placeholder="Bunny Spa" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        One line under the title
        <input className={staffInput} value={d.subtitle} onChange={txt('subtitle')} placeholder="Grooming and hygiene for your rabbit." />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Web address
          <input className={staffInput} required value={d.slug} onChange={txt('slug')} placeholder="spa" />
          <span className="mt-1 block text-xs font-normal text-slate-500">/bunfest/p/{d.slug || '…'}</span>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Icon
          <select className={staffInput} value={d.icon} onChange={txt('icon')}>
            {FEATURE_ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Sponsor line
        <input className={staffInput} value={d.sponsor_note} onChange={txt('sponsor_note')} placeholder="Sponsored by Oxbow" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Quick facts, separated by commas
        <input className={staffInput} value={d.chips} onChange={txt('chips')} placeholder="$12 per service, $20 full spa package" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Highlighted rule at the top
        <textarea className={staffInput} rows={2} value={d.note} onChange={txt('note')} placeholder="Any rabbit attending must be vaccinated against RHDV2…" />
      </label>

      <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
        <p className="font-display text-[15px] font-extrabold text-ink">What the page says</p>
        {sections.map((sec, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Part {i + 1}</span>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSections(sections.filter((_, j) => j !== i))}
                  className="text-xs font-bold text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Heading
              <input className={staffInput} value={sec.heading} onChange={(e) => setSection(i, { heading: e.target.value })} placeholder="Services" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Paragraph
              <textarea className={staffInput} rows={3} value={sec.body} onChange={(e) => setSection(i, { body: e.target.value })} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Bullet points — one per line
              <textarea className={staffInput} rows={3} value={sec.list} onChange={(e) => setSection(i, { list: e.target.value })} placeholder={'Nail trims\nLight grooming'} />
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSections([...sections, { heading: '', body: '', list: '' }])}
          className={`${btn.outline} w-full !py-2 text-sm`}
        >
          <Icon name="plus" size={15} /> Add a part
        </button>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Anything extra on the page
        <select className={staffInput} value={d.feature} onChange={txt('feature')}>
          <option value="">Nothing extra</option>
          <option value="reserve">A form to request a time</option>
          <option value="raffle">The raffle prizes and tickets</option>
        </select>
      </label>
      {d.feature === 'reserve' && (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          <p className="text-xs leading-relaxed text-slate-600">
            Requests arrive in the staff Inbox, and nobody pays until they turn up. Set the last day
            you want to take them and the form takes itself down — you don’t have to remember.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Open requests from
              <input type="date" className={staffInput} value={d.reserve_opens} onChange={txt('reserve_opens')} />
              <span className="mt-1 block text-xs font-normal text-slate-500">Leave empty to open now.</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Take them until
              <input type="date" className={staffInput} value={d.reserve_closes} onChange={txt('reserve_closes')} />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Leave empty to keep taking them.
              </span>
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Times people can ask for, separated by commas
            <input className={staffInput} value={d.reserve_slots} onChange={txt('reserve_slots')} placeholder="10:00 AM, 10:30 AM, 11:00 AM" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Choices offered, separated by commas
            <input className={staffInput} value={d.reserve_services} onChange={txt('reserve_services')} placeholder="Nail trims, Light grooming, Full spa package" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            What the page says once requests have closed
            <textarea className={staffInput} rows={2} value={d.reserve_closed_note} onChange={txt('reserve_closed_note')} placeholder="Advance scheduling has closed. Hop by as soon as you arrive to sign up in person." />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Name for the requests
            <input className={staffInput} value={d.reserve_form} onChange={txt('reserve_form')} placeholder="spa-reservation" />
          </label>
        </div>
      )}

      <label className="block text-sm font-semibold text-slate-700">
        Email address to sign up with
        <input className={staffInput} type="email" value={d.email_signup} onChange={txt('email_signup')} />
      </label>

      <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
        <p className="font-display text-[15px] font-extrabold text-ink">Contact on the page</p>
        <label className="block text-sm font-semibold text-slate-700">
          Address
          <input className={staffInput} value={d.address} onChange={txt('address')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">
            Phone
            <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Button label
            <input className={staffInput} value={d.url_label} onChange={txt('url_label')} placeholder="Book the group rate" />
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Link
          <input className={staffInput} inputMode="url" value={d.url} onChange={txt('url')} />
        </label>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Heading over the links at the bottom
        <input className={staffInput} value={d.related_label} onChange={txt('related_label')} placeholder="Pairs well with" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Links at the bottom — one per line, “Label | /where/it/goes”
        <textarea className={staffInput} rows={2} value={d.related} onChange={txt('related')} placeholder={'Glamour Shots | /bunfest/p/glamour'} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Order in the list
          <input inputMode="numeric" className={staffInput} value={d.sort} onChange={(e) => setD({ ...d, sort: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 text-brand-blue"
          checked={d.is_published}
          onChange={(e) => setD({ ...d, is_published: e.target.checked })}
        />
        People can see this
      </label>

      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.title.trim() || !d.slug.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deletePage(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}
