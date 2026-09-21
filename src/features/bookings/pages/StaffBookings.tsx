// Staff → Bookings: who's coming (roster + confirm/check-in), make times in
// bulk ("Saturdays and Sundays, noon–4, one hour each"), and set up what can
// be booked. Everything the public /book pages show comes from here.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import {
  deleteSlot,
  generateSlots,
  listBookingTypes,
  listSlots,
  roster as loadRoster,
  saveBookingType,
  setBookingStatus,
  setSlotOpen,
  type SlotRow,
} from '../api'
import { dayKey, durationLabel, fmtDay, fmtDayShort, fmtRange, type BookingStatus, type BookingType, type RosterRow } from '../types'

type Tab = 'roster' | 'times' | 'setup'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function StaffBookings() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('roster')
  const [types, setTypes] = useState<BookingType[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reloadTypes = useCallback(async () => {
    try {
      setTypes(await listBookingTypes(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    if (orgId) void reloadTypes()
  }, [orgId, reloadTypes])

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Bookings</h1>
        <p className="mt-1 text-sm text-slate-600">Shifts and appointments people book in the app and on the website.</p>
      </div>
      <div className="flex gap-2">
        {(
          [
            ['roster', 'Who’s coming'],
            ['times', 'Make times'],
            ['setup', 'Set up'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[44px] flex-1 rounded-full px-3 text-sm font-bold ${tab === t ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <FormError>{error}</FormError>
      {types === null && !error && <Spinner />}
      {types && tab === 'roster' && <Roster orgId={orgId} />}
      {types && tab === 'times' && <MakeTimes types={types} />}
      {types && tab === 'setup' && <Setup orgId={orgId} types={types} onChanged={reloadTypes} />}
    </Screen>
  )
}

/* ================================================================ roster */

function Roster({ orgId }: { orgId: string }) {
  const [days, setDays] = useState(7)
  const [rows, setRows] = useState<RosterRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from.getTime() + days * 86_400_000)
    try {
      setRows(await loadRoster(orgId, from, to))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, days])
  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const byDay = new Map<string, Map<string, RosterRow[]>>()
    for (const r of rows ?? []) {
      if (r.status === 'cancelled') continue
      const d = dayKey(r.starts_at)
      const slotKey = `${r.slot_id}`
      const m = byDay.get(d) ?? new Map<string, RosterRow[]>()
      m.set(slotKey, [...(m.get(slotKey) ?? []), r])
      byDay.set(d, m)
    }
    return [...byDay.entries()]
  }, [rows])

  const pending = (rows ?? []).filter((r) => r.status === 'requested').length

  const act = async (r: RosterRow, status: BookingStatus) => {
    setError(null)
    try {
      await setBookingStatus(r.booking_id, status)
      setRows((list) => (list ?? []).map((x) => (x.booking_id === r.booking_id ? { ...x, status } : x)))
    } catch (e) {
      setError(errMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {[1, 7, 30].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setDays(n)}
            className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${days === n ? 'bg-brand-orange text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {n === 1 ? 'Today' : `Next ${n} days`}
          </button>
        ))}
        {pending > 0 && <Badge tone="orange">{pending} to confirm</Badge>}
      </div>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && grouped.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No bookings in this range.</p>
      )}
      {grouped.map(([day, slots]) => (
        <section key={day} className="space-y-2">
          <p className="font-display text-[15px] font-extrabold text-ink">{fmtDay([...slots.values()][0][0].starts_at)}</p>
          {[...slots.values()].map((list) => {
            const first = list[0]
            const taken = list.filter((r) => r.status !== 'no_show').reduce((n, r) => n + r.party_size, 0)
            return (
              <Card key={first.slot_id} className="space-y-2">
                <p className="text-sm font-bold text-slate-700">
                  {fmtRange(first.starts_at, first.ends_at)} · {first.type_name}{' '}
                  <span className="font-semibold text-slate-400">
                    {taken}/{first.capacity}
                  </span>
                </p>
                <ul className="divide-y divide-slate-100">
                  {list.map((r) => (
                    <li key={r.booking_id} className="space-y-1.5 py-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-display text-[15px] font-extrabold text-ink">{r.name}</span>
                        {r.party_size > 1 && <span className="text-xs font-bold text-slate-500">×{r.party_size}</span>}
                        {r.status === 'requested' && <Badge tone="orange">Needs confirming</Badge>}
                        {r.status === 'checked_in' && <Badge tone="blue">Checked in</Badge>}
                        {r.status === 'no_show' && <Badge tone="slate">No show</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.email}
                        {r.phone ? ` · ${r.phone}` : ''}
                        {r.answer ? ` · ${r.answer}` : ''}
                        {r.notes ? ` · ${r.notes}` : ''}
                        {r.attested ? ' · confirmed requirements' : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.phone && (
                          <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`} className="rounded-full bg-brand-blue-50 px-3 py-1.5 text-xs font-bold text-brand-blue">
                            Call
                          </a>
                        )}
                        <a href={`mailto:${r.email}?subject=${encodeURIComponent(`OHRR — ${r.type_name} ${fmtDayShort(r.starts_at)}`)}`} className="rounded-full bg-brand-blue-50 px-3 py-1.5 text-xs font-bold text-brand-blue">
                          Email
                        </a>
                        {r.status === 'requested' && (
                          <button type="button" onClick={() => void act(r, 'confirmed')} className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white">
                            Confirm
                          </button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'requested') && (
                          <button type="button" onClick={() => void act(r, 'checked_in')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
                            Check in
                          </button>
                        )}
                        {r.status === 'confirmed' && (
                          <button type="button" onClick={() => void act(r, 'no_show')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
                            No show
                          </button>
                        )}
                        {r.status !== 'cancelled' && (
                          <button type="button" onClick={() => window.confirm(`Cancel ${r.name}'s booking?`) && void act(r, 'cancelled')} className="rounded-full px-3 py-1.5 text-xs font-bold text-red-600">
                            Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </section>
      ))}
    </div>
  )
}

/* ================================================================ times */

function MakeTimes({ types }: { types: BookingType[] }) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const type = types.find((t) => t.id === typeId)
  const today = new Date()
  const [from, setFrom] = useState(isoDate(today))
  const [to, setTo] = useState(isoDate(new Date(today.getTime() + 27 * 86_400_000)))
  const [weekdays, setWeekdays] = useState<number[]>([0, 6])
  const [start, setStart] = useState('12:00')
  const [end, setEnd] = useState('16:00')
  const [capacity, setCapacity] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotRow[] | null>(null)

  const loadSlots = useCallback(async () => {
    if (!typeId) return
    const f = new Date()
    f.setHours(0, 0, 0, 0)
    try {
      setSlots(await listSlots(typeId, f, new Date(f.getTime() + 60 * 86_400_000)))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [typeId])
  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!type) return
    setBusy(true)
    setError(null)
    setMade(null)
    try {
      const n = await generateSlots({
        typeId,
        from,
        to,
        weekdays,
        start,
        end,
        capacity: capacity ? Number(capacity) : null,
        note: note || null,
      })
      setMade(n)
      await loadSlots()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()))

  const byDay = useMemo(() => {
    const m = new Map<string, SlotRow[]>()
    for (const s of slots ?? []) m.set(dayKey(s.starts_at), [...(m.get(dayKey(s.starts_at)) ?? []), s])
    return [...m.entries()]
  }, [slots])

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          What
          <select className={staffInput} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {type && (
          <p className="text-xs text-slate-500">
            Each time is {durationLabel(type.duration_min)}; up to {type.capacity} {type.kind === 'shift' ? 'people' : 'booking'} per time unless you change it below.
          </p>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              From
              <input type="date" className={staffInput} value={from} onChange={(e) => setFrom(e.target.value)} required />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              To
              <input type="date" className={staffInput} value={to} onChange={(e) => setTo(e.target.value)} required />
            </label>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">On these days</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${weekdays.includes(i) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              First time starts
              <input type="time" className={staffInput} value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Last time ends by
              <input type="time" className={staffInput} value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              People per time
              <input inputMode="numeric" className={staffInput} value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ''))} placeholder={type ? String(type.capacity) : ''} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Note (optional)
              <input className={staffInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nail trims only" />
            </label>
          </div>
          <FormError>{error}</FormError>
          {made !== null && <p className="text-sm font-bold text-green-700">{made === 0 ? 'Those times already existed.' : `Made ${made} time${made === 1 ? '' : 's'}.`}</p>}
          <button type="submit" disabled={busy || weekdays.length === 0} className={`${btn.primary} w-full disabled:opacity-60`}>
            {busy ? 'Making times…' : 'Make these times'}
          </button>
        </form>
      </Card>

      <section className="space-y-2">
        <p className="font-display text-[15px] font-extrabold text-ink">Times in the next 60 days</p>
        {slots === null && <Spinner />}
        {slots && slots.length === 0 && <p className="text-sm text-slate-500">None yet — make some above.</p>}
        {byDay.map(([day, list]) => (
          <Card key={day} className="space-y-1.5">
            <p className="text-sm font-bold text-slate-700">{fmtDay(list[0].starts_at)}</p>
            <ul className="divide-y divide-slate-100">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className={`flex-1 ${s.is_open ? 'text-ink' : 'text-slate-400 line-through'}`}>
                    {fmtRange(s.starts_at, s.ends_at)} · {s.capacity} {s.note ? `· ${s.note}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSlotOpen(s.id, !s.is_open).then(loadSlots).catch((e) => setError(errMessage(e)))}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600"
                  >
                    {s.is_open ? 'Close' : 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm('Delete this time? Anyone booked on it is cancelled too.') && deleteSlot(s.id).then(loadSlots).catch((e) => setError(errMessage(e)))}
                    className="text-red-600"
                    aria-label="Delete"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </section>
    </div>
  )
}

/* ================================================================ setup */

const emptyType = (orgId: string): Partial<BookingType> & { org_id: string; slug: string; name: string } => ({
  org_id: orgId,
  slug: '',
  name: '',
  kind: 'shift',
  description: '',
  requirements: '',
  location: 'OHRR Adoption Center · 5485 N. High Street, Columbus',
  duration_min: 60,
  capacity: 2,
  max_party: 1,
  min_lead_hours: 2,
  max_per_month: null,
  confirm_mode: 'auto',
  ask_reason: '',
  attest_text: '',
  is_published: true,
  sort_order: 100,
})

function Setup({ orgId, types, onChanged }: { orgId: string; types: BookingType[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  return (
    <div className="space-y-3">
      {types.map((t) => (
        <Card key={t.id} className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[15px] font-extrabold text-ink">{t.name}</span>
                <Badge tone={t.kind === 'shift' ? 'blue' : 'orange'}>{t.kind === 'shift' ? 'Shift' : 'Appointment'}</Badge>
                {!t.is_published && <Badge tone="slate">Hidden</Badge>}
              </span>
              <span className="block text-xs text-slate-500">
                {durationLabel(t.duration_min)} · {t.capacity} per time · book {t.min_lead_hours}h ahead
                {t.max_per_month ? ` · max ${t.max_per_month}/month` : ''}
                {t.confirm_mode === 'staff' ? ' · staff confirms' : ''} · /book/{t.slug}
              </span>
            </span>
            <button type="button" onClick={() => setEditing(editing === t.id ? null : t.id)} className="text-sm font-bold text-brand-blue">
              {editing === t.id ? 'Close' : 'Edit'}
            </button>
          </div>
          {editing === t.id && (
            <TypeForm
              initial={t}
              onSaved={async () => {
                setEditing(null)
                await onChanged()
              }}
            />
          )}
        </Card>
      ))}
      {editing === 'new' ? (
        <Card>
          <TypeForm
            initial={emptyType(orgId)}
            onSaved={async () => {
              setEditing(null)
              await onChanged()
            }}
          />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add something bookable
        </button>
      )}
    </div>
  )
}

function TypeForm({ initial, onSaved }: { initial: Partial<BookingType> & { org_id: string; slug: string; name: string }; onSaved: () => Promise<void> }) {
  const [d, setD] = useState({ ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const num = (k: keyof BookingType) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value === '' ? null : Number(e.target.value) })
  const txt = (k: keyof BookingType) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveBookingType({
        ...d,
        slug: d.slug || slugify(d.name),
        description: d.description || null,
        requirements: d.requirements || null,
        location: d.location || null,
        ask_reason: d.ask_reason || null,
        attest_text: d.attest_text || null,
        max_per_month: d.max_per_month || null,
      })
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-3">
      <label className="block text-sm font-semibold text-slate-700">
        Name
        <input className={staffInput} required value={d.name} onChange={txt('name')} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Type
          <select className={staffInput} value={d.kind} onChange={txt('kind')}>
            <option value="shift">Volunteer shift</option>
            <option value="appointment">Appointment</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Who confirms
          <select className={staffInput} value={d.confirm_mode} onChange={txt('confirm_mode')}>
            <option value="auto">Booked instantly</option>
            <option value="staff">Staff confirms</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        What it is (shown to people)
        <textarea className={staffInput} rows={2} value={d.description ?? ''} onChange={txt('description')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Requirements — one per line
        <textarea className={staffInput} rows={3} value={d.requirements ?? ''} onChange={txt('requirements')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Where
        <input className={staffInput} value={d.location ?? ''} onChange={txt('location')} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Minutes
          <input inputMode="numeric" className={staffInput} value={d.duration_min ?? ''} onChange={num('duration_min')} required />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Per time
          <input inputMode="numeric" className={staffInput} value={d.capacity ?? ''} onChange={num('capacity')} required />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Per booking
          <input inputMode="numeric" className={staffInput} value={d.max_party ?? ''} onChange={num('max_party')} required />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Book at least (hours ahead)
          <input inputMode="numeric" className={staffInput} value={d.min_lead_hours ?? ''} onChange={num('min_lead_hours')} required />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Max per month (blank = no limit)
          <input inputMode="numeric" className={staffInput} value={d.max_per_month ?? ''} onChange={num('max_per_month')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        A question to ask (optional)
        <input className={staffInput} value={d.ask_reason ?? ''} onChange={txt('ask_reason')} placeholder="Which rabbit would you like to meet?" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        A box they must tick (optional)
        <input className={staffInput} value={d.attest_text ?? ''} onChange={txt('attest_text')} placeholder="I have completed the Buncare Orientation." />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-blue" checked={Boolean(d.is_published)} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
        People can see and book this
      </label>
      <FormError>{error}</FormError>
      <button type="submit" disabled={busy || !d.name.trim()} className={`${btn.primary} w-full disabled:opacity-60`}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
