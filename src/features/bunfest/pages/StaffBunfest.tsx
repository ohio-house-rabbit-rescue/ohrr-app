// Staff → BunFest: the festival's own content, editable from a phone.
//
// Until now the education schedule, the vendor list and the rescue directory
// were bundled 2025 data — publishing this year's meant a code change. Three
// tabs here replace that: Schedule (per year, with "copy last year's"),
// Vendors (the BunFest side of a company in the Hop Shop supplier list: public
// blurb, category, room and booth) and Rescue partners.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { listSuppliers, saveSupplier, type Supplier } from '../../hopshop/api'
import {
  copySessions,
  deletePartner,
  deleteSession,
  fromTime,
  listPartners,
  listSessions,
  savePartner,
  saveSession,
  saveVendorDetails,
  sessionYears,
  toTime,
  SESSION_KINDS,
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

type Tab = 'schedule' | 'vendors' | 'partners' | 'year'
const TABS: [Tab, string][] = [
  ['year', 'This year'],
  ['schedule', 'Schedule'],
  ['vendors', 'Vendors'],
  ['partners', 'Rescues'],
]

const REGIONS = ['Midwest', 'Northeast', 'South', 'West'] as const
const ROOMS: { value: 'burgundy' | 'emerald' | ''; label: string }[] = [
  { value: '', label: 'Not placed yet' },
  { value: 'burgundy', label: 'Burgundy Room' },
  { value: 'emerald', label: 'Emerald Room' },
]

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
        : 'year'

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Midwest BunFest</h1>
        <p className="mt-1 text-sm text-slate-600">
          The programme, the vendor tables and the rescue directory — what visitors see in the app and on the website.
        </p>
      </div>
      <div className="flex gap-2">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => navigate(t === 'year' ? '/staff/bunfest' : `/staff/bunfest/${t}`)}
            className={`min-h-[44px] flex-1 rounded-full px-2 text-[13px] font-bold ${
              tab === t ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'year' && <ThisYearTab orgId={orgId} />}
      {tab === 'schedule' && <ScheduleTab orgId={orgId} />}
      {tab === 'vendors' && <VendorsTab orgId={orgId} />}
      {tab === 'partners' && <PartnersTab orgId={orgId} />}
    </Screen>
  )
}

/* ============================================================== schedule */

function ScheduleTab({ orgId }: { orgId: string }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [years, setYears] = useState<number[]>([])
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [list, ys] = await Promise.all([listSessions(orgId, year), sessionYears(orgId)])
      setRows(list)
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
                {r.room && <span className="block text-xs text-slate-400">{r.room}</span>}
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
  onDone,
}: {
  orgId: string
  year: number
  initial: SessionRow | null
  onDone: () => Promise<void>
}) {
  const [d, setD] = useState({
    start_time: fromTime(initial?.start_time ?? '10:45:00'),
    end_time: fromTime(initial?.end_time ?? null),
    title: initial?.title ?? '',
    presenter: initial?.presenter ?? '',
    description: initial?.description ?? '',
    room: initial?.room ?? '',
    kind: initial?.kind ?? ('session' as SessionRow['kind']),
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
      await saveSession({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        start_time: toTime(d.start_time),
        end_time: d.end_time ? toTime(d.end_time) : null,
        title: d.title.trim(),
        presenter: d.presenter.trim() || null,
        description: d.description.trim() || null,
        room: d.room.trim() || null,
        kind: d.kind,
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
      <label className="block text-sm font-semibold text-slate-700">
        What it covers
        <textarea className={staffInput} rows={2} value={d.description} onChange={txt('description')} />
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

  const published = (rows ?? []).filter((r) => r.vendor_published).length

  return (
    <div className="space-y-3">
      <Card className="text-sm text-slate-600">
        A vendor is a company in the Hop Shop <strong>Suppliers</strong> list with “Vendor” ticked. Add their booth
        here; what you write under <strong>About them</strong> is what visitors read.{' '}
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
            <VendorForm
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
                  {r.vendor_published ? <Badge tone="blue">Published</Badge> : <Badge tone="orange">Hidden</Badge>}
                  {r.is_supplier && <Badge tone="slate">Supplier too</Badge>}
                </span>
                <span className="block text-xs text-slate-500">
                  {[r.vendor_category, r.vendor_room ? (r.vendor_room === 'burgundy' ? 'Burgundy Room' : 'Emerald Room') : null, r.vendor_booth ? `Booth ${r.vendor_booth}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No booth details yet'}
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
          <VendorForm
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
          <Icon name="plus" size={16} /> Add a vendor
        </button>
      )}
    </div>
  )
}

function VendorForm({ orgId, initial, onDone }: { orgId: string; initial: Supplier | null; onDone: () => Promise<void> }) {
  const [d, setD] = useState({
    name: initial?.name ?? '',
    website: initial?.website ?? '',
    category: initial?.vendor_category ?? '',
    blurb: initial?.vendor_blurb ?? '',
    booth: initial?.vendor_booth ?? '',
    room: (initial?.vendor_room ?? '') as 'burgundy' | 'emerald' | '',
    tables: String(initial?.vendor_tables ?? 1),
    published: initial?.vendor_published ?? false,
    sort: String(initial?.vendor_sort ?? 0),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let website = d.website.trim() || null
      if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
      // A new vendor is a new company in the shared list, marked vendor-only.
      const saved = await saveSupplier({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        name: d.name.trim(),
        is_vendor: true,
        is_supplier: initial?.is_supplier ?? false,
        website,
      })
      await saveVendorDetails(saved.id, {
        category: d.category.trim() || null,
        blurb: d.blurb.trim() || null,
        booth: d.booth.trim() || null,
        room: d.room || null,
        tables: Math.max(1, Math.min(4, Number(d.tables) || 1)),
        published: d.published,
        sort: Number(d.sort) || 0,
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
        Company
        <input className={staffInput} required value={d.name} onChange={txt('name')} placeholder="Bunny Brook Designs" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Their website / shop
        <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} placeholder="bunnybrookdesigns.com" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Category
        <input className={staffInput} value={d.category} onChange={txt('category')} placeholder="Jewelry & Gifts" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        About them (visitors read this)
        <textarea className={staffInput} rows={2} value={d.blurb} onChange={txt('blurb')} placeholder="Handmade bunny-themed jewelry, home decor and ornaments." />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Room
          <select className={staffInput} value={d.room} onChange={txt('room')}>
            {ROOMS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Booth
          <input className={staffInput} value={d.booth} onChange={txt('booth')} placeholder="B7" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Tables
          <input inputMode="numeric" className={staffInput} value={d.tables} onChange={(e) => setD({ ...d, tables: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Order in the list
          <input inputMode="numeric" className={staffInput} value={d.sort} onChange={(e) => setD({ ...d, sort: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 text-brand-blue"
          checked={d.published}
          onChange={(e) => setD({ ...d, published: e.target.checked })}
        />
        Show this vendor to visitors
      </label>
      <FormError>{error}</FormError>
      <button type="submit" disabled={busy || !d.name.trim()} className={`${btn.primary} w-full disabled:opacity-60`}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
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
    at_bunfest: initial?.at_bunfest ?? true,
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
        at_bunfest: d.at_bunfest,
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
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-orange" checked={d.at_bunfest} onChange={(e) => setD({ ...d, at_bunfest: e.target.checked })} />
          A rescue partner at this year’s BunFest
        </label>
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
    </div>
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
