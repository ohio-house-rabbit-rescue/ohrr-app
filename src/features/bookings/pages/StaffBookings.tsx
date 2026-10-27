// Staff → Bookings: the job in the order it happens.
//
//   1 To confirm        requests waiting for a yes
//   2 Today             check people in at the door
//   3 Coming up         who's booked in the next days; email a whole shift
//   4 Make times        add times by hand (the weekly schedule fills in its own)
//   5 Hours             who volunteered how much, and their letters
//   6 Set up the types  what can be booked, when, and who may book it
//
// Everything the public /book pages show comes from step 6.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { authOrigin } from '../../../lib/appUrl'
import { Screen, Card, Badge } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { CardActions, EditorForm, Field, Part, pill } from '../../../components/StaffJob'
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
import { bccMailto, exportCsv, toCsv } from '../../../lib/exportFile'
import { copyText } from '../../share/share'
import {
  dayKey,
  durationLabel,
  fmtDay,
  fmtDayShort,
  fmtRange,
  fmtWeekly,
  statusLabel,
  WEEKDAY_SHORT,
  type BookingStatus,
  type BookingType,
  type RosterRow,
  type WeeklyRule,
} from '../types'
import HoursTab from './HoursTab'
import { APPROVAL_KINDS, kindLabel } from '../../volunteers/approval'
import { Explain, StaffTitle } from '../../../components/StaffTitle'

type Tab = 'confirm' | 'today' | 'coming' | 'times' | 'hours' | 'setup'

/** The steps, in the order the work happens. */
const STEPS: { tab: Tab; n: number; label: string }[] = [
  { tab: 'confirm', n: 1, label: 'To confirm' },
  { tab: 'today', n: 2, label: 'Today' },
  { tab: 'coming', n: 3, label: 'Coming up' },
  { tab: 'times', n: 4, label: 'Make times' },
  { tab: 'hours', n: 5, label: 'Hours' },
  { tab: 'setup', n: 6, label: 'Set up the types' },
]
const isTab = (s: string | null): s is Tab => STEPS.some((x) => x.tab === s)

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 48px buttons for the door: check in, confirm, no show. */
const big = '!min-h-[48px]'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** "Step 2 of 6 · Today" over the step's content. */
function StepLine({ n, label }: { n: number; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-slate-500" aria-label={`Step ${n} of ${STEPS.length}`}>
      Step {n} of {STEPS.length} · {label}
      <span className="flex gap-1" aria-hidden="true">
        {STEPS.map((s) => (
          <span key={s.tab} className={`h-2 w-2 rounded-full ${s.n <= n ? 'bg-brand-orange' : 'bg-slate-200'}`} />
        ))}
      </span>
    </p>
  )
}

export default function StaffBookings() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [params, setParams] = useSearchParams()
  const [picked, setPicked] = useState<Tab | null>(() => (isTab(params.get('tab')) ? (params.get('tab') as Tab) : null))
  const [types, setTypes] = useState<BookingType[] | null>(null)
  const [rows, setRows] = useState<RosterRow[] | null>(null)
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

  // Everyone booked from today on, for the next 60 days: steps 1–3 read from this.
  const reloadRows = useCallback(async () => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    try {
      setRows(await loadRoster(orgId, from, new Date(from.getTime() + 60 * 86_400_000)))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    if (orgId) void reloadRows()
  }, [orgId, reloadRows])

  const pending = (rows ?? []).filter((r) => r.status === 'requested').length
  // Open on the step the day calls for: requests first, otherwise the door.
  const tab: Tab = picked ?? (pending > 0 ? 'confirm' : 'today')
  const step = STEPS.find((s) => s.tab === tab)!
  const pick = (t: Tab) => {
    setPicked(t)
    setParams({ tab: t }, { replace: true })
  }

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
    <Screen className="space-y-4">
      <StaffTitle title="Bookings">
        <p>Shifts and appointments people book in the app and on the website.</p>
        <p>The steps run in the order the work happens: confirm requests, check people in, look ahead, add times, then set up what can be booked.</p>
      </StaffTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="The steps of Bookings">
        {STEPS.map((s) => {
          const on = tab === s.tab
          return (
            <button
              key={s.tab}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(s.tab)}
              className={`inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-2 text-sm font-bold ${on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
            >
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${on ? 'bg-white text-brand-blue' : 'bg-brand-blue text-white'}`}>{s.n}</span>
              {s.label}
              {s.tab === 'confirm' && pending > 0 ? ` (${pending})` : ''}
            </button>
          )
        })}
      </div>
      <StepLine n={step.n} label={step.label} />
      <FormError>{error}</FormError>
      {types === null && !error && <Spinner />}
      {types && (tab === 'confirm' || tab === 'today' || tab === 'coming') && (
        <Roster mode={tab} rows={rows} onAct={act} goTo={pick} />
      )}
      {types && tab === 'times' && <MakeTimes types={types} />}
      {types && tab === 'hours' && <HoursTab />}
      {types && tab === 'setup' && <Setup orgId={orgId} types={types} onChanged={reloadTypes} />}
    </Screen>
  )
}

/* ================================================================ roster */

function Roster({
  mode,
  rows,
  onAct,
  goTo,
}: {
  mode: 'confirm' | 'today' | 'coming'
  rows: RosterRow[] | null
  onAct: (r: RosterRow, status: BookingStatus) => Promise<void>
  goTo: (t: Tab) => void
}) {
  const [days, setDays] = useState(7)
  const todayKey = dayKey(new Date().toISOString())

  // What this step shows, from the 60 days loaded above.
  const shown = useMemo(() => {
    const live = (rows ?? []).filter((r) => r.status !== 'cancelled')
    if (mode === 'confirm') return live.filter((r) => r.status === 'requested')
    if (mode === 'today') return live.filter((r) => dayKey(r.starts_at) === todayKey)
    const limit = Date.now() + days * 86_400_000
    return live.filter((r) => dayKey(r.starts_at) > todayKey && new Date(r.starts_at).getTime() <= limit)
  }, [rows, mode, days, todayKey])

  const grouped = useMemo(() => {
    const byDay = new Map<string, Map<string, RosterRow[]>>()
    for (const r of shown) {
      const d = dayKey(r.starts_at)
      const m = byDay.get(d) ?? new Map<string, RosterRow[]>()
      m.set(r.slot_id, [...(m.get(r.slot_id) ?? []), r])
      byDay.set(d, m)
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [shown])

  const empty =
    mode === 'confirm'
      ? 'Nothing is waiting for a yes.'
      : mode === 'today'
        ? 'Nobody is booked for today.'
        : `Nobody is booked in the next ${days} days.`

  return (
    <div className="space-y-3">
      {mode === 'coming' && (
        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 60].map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)} aria-pressed={days === n} className={days === n ? pill.orange : pill.outline}>
              Next {n} days
            </button>
          ))}
        </div>
      )}
      {mode === 'today' && (
        <p className="text-[15px] text-slate-600">
          Tap <strong>Check in</strong> as people arrive.
        </p>
      )}
      {rows === null && <Spinner />}
      {rows && grouped.length === 0 && (
        <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center">
          <p className="text-base text-slate-600">{empty}</p>
          {mode === 'confirm' && (
            <button type="button" onClick={() => goTo('today')} className={pill.blue}>
              Go to 2 · Today
            </button>
          )}
        </div>
      )}
      {mode === 'coming' && rows && shown.length > 0 && (
        <button
          type="button"
          onClick={() =>
            exportCsv(
              `ohrr-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(
                ['Date', 'Time', 'What', 'Name', 'Email', 'Phone', 'People', 'Status', 'Answer', 'Notes'],
                shown.map((r) => [
                  fmtDayShort(r.starts_at),
                  fmtRange(r.starts_at, r.ends_at),
                  r.type_name,
                  r.name,
                  r.email,
                  r.phone ?? '',
                  r.party_size,
                  statusLabel(r.status),
                  r.answer ?? '',
                  r.notes ?? '',
                ]),
              ),
            )
          }
          className={pill.outline}
        >
          <Icon name="printer" size={16} /> Export this list (spreadsheet)
        </button>
      )}
      {grouped.map(([day, slots]) => (
        <section key={day} className="space-y-2">
          <p className="font-display text-base font-extrabold text-ink">{fmtDay([...slots.values()][0][0].starts_at)}</p>
          {[...slots.values()].map((list) => {
            const first = list[0]
            const taken = list.filter((r) => r.status !== 'no_show').reduce((n, r) => n + r.party_size, 0)
            return (
              <Card key={first.slot_id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-bold text-slate-700">
                    {fmtRange(first.starts_at, first.ends_at)} · {first.type_name}{' '}
                    <span className="font-semibold text-slate-500">
                      {taken}/{first.capacity}
                    </span>
                  </p>
                  {/* One message to a whole shift — a cancellation, a reminder.
                      Everyone goes in BCC, so nobody sees anyone else's address. */}
                  <a
                    href={bccMailto(
                      list.filter((r) => r.status !== 'cancelled').map((r) => r.email),
                      `OHRR — ${first.type_name}, ${fmtDayShort(first.starts_at)}`,
                    )}
                    className={pill.soft}
                  >
                    <Icon name="mail" size={16} /> Email everyone
                  </a>
                </div>
                <ul className="divide-y divide-slate-100">
                  {list.map((r) => (
                    <li key={r.booking_id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-display text-base font-extrabold text-ink">{r.name}</span>
                        {r.party_size > 1 && <span className="text-sm font-bold text-slate-600">×{r.party_size}</span>}
                        {r.status === 'requested' && <Badge tone="orange">Needs confirming</Badge>}
                        {r.status === 'checked_in' && <Badge tone="blue">Checked in</Badge>}
                        {r.status === 'no_show' && <Badge tone="slate">No show</Badge>}
                      </div>
                      <p className="text-[15px] text-slate-600">
                        {r.email}
                        {r.phone ? ` · ${r.phone}` : ''}
                        {r.answer && !r.answer.includes('\n') ? ` · ${r.answer}` : ''}
                        {r.notes ? ` · ${r.notes}` : ''}
                        {r.attested ? ' · confirmed requirements' : ''}
                      </p>
                      {/* Answers to the form's questions: one line each. */}
                      {r.answer?.includes('\n') && <p className="whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-[15px] leading-relaxed text-slate-700">{r.answer}</p>}
                      <CardActions>
                        {r.status === 'requested' && (
                          <button type="button" onClick={() => void onAct(r, 'confirmed')} className={`${pill.orange} ${big}`}>
                            <Icon name="check" size={16} /> Confirm
                          </button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'requested') && (
                          <button type="button" onClick={() => void onAct(r, 'checked_in')} className={`${pill.green} ${big}`}>
                            Check in
                          </button>
                        )}
                        {r.status === 'confirmed' && (
                          <button type="button" onClick={() => void onAct(r, 'no_show')} className={`${pill.outline} ${big}`}>
                            No show
                          </button>
                        )}
                        {r.phone && (
                          <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`} className={`${pill.soft} ${big}`}>
                            <Icon name="phone" size={16} /> Call
                          </a>
                        )}
                        <a href={`mailto:${r.email}?subject=${encodeURIComponent(`OHRR — ${r.type_name} ${fmtDayShort(r.starts_at)}`)}`} className={`${pill.soft} ${big}`}>
                          <Icon name="mail" size={16} /> Email
                        </a>
                        {r.status !== 'cancelled' && (
                          <button type="button" onClick={() => window.confirm(`Cancel ${r.name}’s booking?`) && void onAct(r, 'cancelled')} className={`${pill.red} ${big}`}>
                            Cancel booking
                          </button>
                        )}
                      </CardActions>
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

  const submit = async () => {
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
      <EditorForm
        title="Make times"
        hint="Fill in the days and hours; each time below is made for you."
        onSubmit={submit}
        busy={busy}
        saveLabel="Make these times"
        canSave={weekdays.length > 0 && !!type}
        error={error}
      >
        <div className="space-y-3">
          <Part n="A" hint="needed">What</Part>
          <Field label="What" needed>
            <select className={staffInput} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {type && (
            <Explain label="About these times">
              <p>
                {type.weekly.length > 0
                  ? 'The weekly schedule (step 6) fills in its own times. Use this for extras — a special day, a one-off clinic.'
                  : 'Tip: give this a weekly schedule in step 6 and the times make themselves.'}{' '}
                Each time is {durationLabel(type.duration_min)}; up to {type.capacity} {type.kind === 'shift' ? 'people' : 'booking'} per time unless you change it below.
              </p>
            </Explain>
          )}
        </div>
        <div className="space-y-3">
          <Part n="B" hint="needed">When</Part>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" needed>
              <input type="date" className={staffInput} value={from} onChange={(e) => setFrom(e.target.value)} required />
            </Field>
            <Field label="To" needed>
              <input type="date" className={staffInput} value={to} onChange={(e) => setTo(e.target.value)} required />
            </Field>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              On these days <span className="ml-1.5 text-xs font-bold text-brand-orange">needed</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={weekdays.includes(i)}
                  onClick={() => toggleDay(i)}
                  className={`min-h-[44px] min-w-[52px] rounded-full px-3.5 text-[15px] font-bold ${weekdays.includes(i) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First time starts" needed>
              <input type="time" className={staffInput} value={start} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field label="Last time ends by" needed>
              <input type="time" className={staffInput} value={end} onChange={(e) => setEnd(e.target.value)} required />
            </Field>
          </div>
        </div>
        <div className="space-y-3">
          <Part n="C" hint="optional">Details</Part>
          <div className="grid grid-cols-2 gap-3">
            <Field label="People per time">
              <input inputMode="numeric" className={staffInput} value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ''))} placeholder={type ? String(type.capacity) : ''} />
            </Field>
            <Field label="Note">
              <input className={staffInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nail trims only" />
            </Field>
          </div>
          {made !== null && <p className="text-[15px] font-bold text-green-700">{made === 0 ? 'Those times already existed.' : `Made ${made} time${made === 1 ? '' : 's'}.`}</p>}
        </div>
      </EditorForm>

      <section className="space-y-2">
        <p className="font-display text-base font-extrabold text-ink">Times in the next 60 days</p>
        {slots === null && <Spinner />}
        {slots && slots.length === 0 && <p className="text-[15px] text-slate-600">None yet — make some above.</p>}
        {byDay.map(([day, list]) => (
          <Card key={day} className="space-y-1.5">
            <p className="text-[15px] font-bold text-slate-700">{fmtDay(list[0].starts_at)}</p>
            <ul className="divide-y divide-slate-100">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-[15px]">
                  <span className={`min-w-0 flex-1 ${s.is_open ? 'text-ink' : 'text-slate-400 line-through'}`}>
                    {fmtRange(s.starts_at, s.ends_at)} · {s.capacity} {s.note ? `· ${s.note}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSlotOpen(s.id, !s.is_open).then(loadSlots).catch((e) => setError(errMessage(e)))}
                    className={pill.outline}
                  >
                    {s.is_open ? 'Close' : 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm('Delete this time? Anyone booked on it is canceled too.') && deleteSlot(s.id).then(loadSlots).catch((e) => setError(errMessage(e)))}
                    className={pill.red}
                  >
                    <Icon name="trash" size={16} /> Delete
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
  weekly: [],
  auto_weeks: 8,
})

function Setup({ orgId, types, onChanged }: { orgId: string; types: BookingType[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // A new type gets the questions box once the database has the column (update 43).
  const hasQuestions = types.some((t) => t.questions !== undefined)
  const linkFor = (slug: string) => `${authOrigin()}/book/${slug}`
  return (
    <div className="space-y-3">
      {types.map((t) =>
        editing === t.id ? (
          <TypeForm
            key={t.id}
            initial={t}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null)
              await onChanged()
            }}
          />
        ) : (
          <Card key={t.id} className="space-y-2">
            <div className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-base font-extrabold text-ink">{t.name}</span>
                <Badge tone={t.kind === 'shift' ? 'blue' : 'orange'}>{t.kind === 'shift' ? 'Shift' : 'Appointment'}</Badge>
                {!t.is_published && <Badge tone="slate">Hidden</Badge>}
              </span>
              <span className="block text-[15px] text-slate-600">
                {durationLabel(t.duration_min)} · {t.capacity} per time · book {t.min_lead_hours}h ahead
                {t.max_per_month ? ` · max ${t.max_per_month}/month` : ''}
                {t.confirm_mode === 'staff' ? ' · staff confirms' : ''}
              </span>
              {t.approval_role && (
                <span className="mt-1 block text-[15px] font-semibold text-slate-700">Only volunteers approved for {kindLabel(t.approval_role)}</span>
              )}
              {t.weekly.length > 0 ? (
                <span className="mt-1 block text-[15px] text-slate-600">
                  <span className="font-bold text-brand-blue">Every week:</span> {fmtWeekly(t.weekly).join(' · ')}
                </span>
              ) : (
                <span className="mt-1 block text-[15px] font-semibold text-brand-orange-dark">No weekly schedule — times only appear when made by hand.</span>
              )}
            </div>
            <CardActions>
              <button type="button" onClick={() => setEditing(t.id)} className={pill.blue}>
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(linkFor(t.slug))) {
                    setCopied(t.id)
                    setTimeout(() => setCopied((c) => (c === t.id ? null : c)), 1800)
                  }
                }}
                className={pill.outline}
              >
                {copied === t.id ? 'Copied' : 'Copy link'}
              </button>
              <a href={linkFor(t.slug)} target="_blank" rel="noopener noreferrer" className={pill.outline}>
                <Icon name="external" size={16} /> Open
              </a>
            </CardActions>
          </Card>
        ),
      )}
      {editing === 'new' ? (
        <TypeForm
          initial={{ ...emptyType(orgId), ...(hasQuestions ? { questions: '' } : {}) }}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await onChanged()
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add something bookable
        </button>
      )}
    </div>
  )
}

function TypeForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Partial<BookingType> & { org_id: string; slug: string; name: string }
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState({ ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = !initial.slug && !('id' in initial && initial.id)
  const num = (k: keyof BookingType) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value === '' ? null : Number(e.target.value) })
  const txt = (k: keyof BookingType) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const submit = async () => {
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
        // Only once update 43 has added the column (it is on every row from then on).
        ...(d.questions !== undefined ? { questions: d.questions?.trim() || null } : {}),
        approval_role: d.approval_role || null,
        max_per_month: d.max_per_month || null,
        auto_weeks: Math.min(26, Math.max(1, Number(d.auto_weeks) || 8)),
        weekly: (d.weekly ?? [])
          .filter((r) => r.days.length > 0 && r.start && r.end && r.end > r.start)
          .map((r) => ({ days: r.days, start: r.start, end: r.end, capacity: r.capacity || null, label: r.label?.trim() || null })),
      })
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={isNew ? 'Something new to book' : `Change ${initial.name || 'this'}`}
      hint="A and B are needed. C is for the people booking — fill in what helps them."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      canSave={!!d.name.trim()}
      error={error}
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">What it is</Part>
        <Field label="Name" needed>
          <input className={staffInput} required value={d.name} onChange={txt('name')} />
        </Field>
        <Field label="Type" needed>
          <select className={staffInput} value={d.kind} onChange={txt('kind')}>
            <option value="shift">Volunteer shift</option>
            <option value="appointment">Appointment</option>
          </select>
        </Field>
        <Field label="What it is (shown to people)">
          <textarea className={staffInput} rows={2} value={d.description ?? ''} onChange={txt('description')} />
        </Field>
        <Field label="Where">
          <input className={staffInput} value={d.location ?? ''} onChange={txt('location')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="needed">When and how many</Part>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Minutes" needed>
            <input inputMode="numeric" className={staffInput} value={d.duration_min ?? ''} onChange={num('duration_min')} required />
          </Field>
          <Field label="Per time" needed>
            <input inputMode="numeric" className={staffInput} value={d.capacity ?? ''} onChange={num('capacity')} required />
          </Field>
          <Field label="Per booking" needed>
            <input inputMode="numeric" className={staffInput} value={d.max_party ?? ''} onChange={num('max_party')} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Book at least (hours ahead)" needed>
            <input inputMode="numeric" className={staffInput} value={d.min_lead_hours ?? ''} onChange={num('min_lead_hours')} required />
          </Field>
          <Field label="Max per month" hint="Blank = no limit.">
            <input inputMode="numeric" className={staffInput} value={d.max_per_month ?? ''} onChange={num('max_per_month')} />
          </Field>
        </div>
        <WeeklyEditor rules={d.weekly ?? []} defaultCapacity={d.capacity ?? 1} onChange={(weekly) => setD({ ...d, weekly })} />
        <Field label="Keep this many weeks of times ready">
          <input inputMode="numeric" className={staffInput} value={d.auto_weeks ?? 8} onChange={num('auto_weeks')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">For the people booking</Part>
        <Field label="Who confirms">
          <select className={staffInput} value={d.confirm_mode} onChange={txt('confirm_mode')}>
            <option value="auto">Booked instantly</option>
            <option value="staff">Staff confirms</option>
          </select>
        </Field>
        <Field label="Who can book" hint="Approved-only: people enter the email they applied with before they see the times.">
          <select className={staffInput} value={d.approval_role ?? ''} onChange={(e) => setD({ ...d, approval_role: e.target.value || null })}>
            <option value="">Anyone</option>
            {d.approval_role && !APPROVAL_KINDS.some((k) => k.value === d.approval_role) && (
              <option value={d.approval_role}>Approved volunteers for {kindLabel(d.approval_role)}</option>
            )}
            {APPROVAL_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                Approved volunteers for {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Requirements — one per line">
          <textarea className={staffInput} rows={3} value={d.requirements ?? ''} onChange={txt('requirements')} />
        </Field>
        {d.questions !== undefined && (
          <Field
            label="Questions on the form — one per line"
            hint="Put choices after a | to make a pick-list. End the question with * if it must be answered. The answers show under each person in the list."
          >
            <textarea className={staffInput} rows={4} value={d.questions ?? ''} onChange={txt('questions')} placeholder={'Your rabbit’s name *\nSpayed or neutered? * | Yes | No | Booked in'} />
          </Field>
        )}
        <Field label={d.questions !== undefined ? 'A last question, answered in their own words' : 'A question to ask'}>
          <input className={staffInput} value={d.ask_reason ?? ''} onChange={txt('ask_reason')} placeholder="Which rabbit would you like to meet?" />
        </Field>
        <Field label="A box they must tick">
          <input className={staffInput} value={d.attest_text ?? ''} onChange={txt('attest_text')} placeholder="I have completed the Buncare Orientation." />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input type="checkbox" className="h-6 w-6 rounded border-slate-300 text-brand-blue" checked={Boolean(d.is_published)} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see and book this
        </label>
      </div>
    </EditorForm>
  )
}

/* ======================================================== weekly schedule */

// The standing schedule: one line per shift or appointment window. The
// database keeps the next weeks filled from these, so nobody has to remember
// to "make times" — and a removed line takes its future empty times with it.
function WeeklyEditor({
  rules,
  defaultCapacity,
  onChange,
}: {
  rules: WeeklyRule[]
  defaultCapacity: number
  onChange: (rules: WeeklyRule[]) => void
}) {
  const set = (i: number, patch: Partial<WeeklyRule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const toggle = (i: number, day: number) => {
    const days = rules[i].days.includes(day) ? rules[i].days.filter((x) => x !== day) : [...rules[i].days, day].sort()
    set(i, { days })
  }
  return (
    <div className="space-y-2 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
      <p className="text-base font-bold text-ink">Every week</p>
      <p className="text-sm text-slate-600">
        The times people can book, week after week. They appear by themselves{rules.length ? '.' : ' — add the first line.'}
      </p>
      {rules.map((r, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((label, day) => (
              <button
                key={label}
                type="button"
                aria-pressed={r.days.includes(day)}
                onClick={() => toggle(i, day)}
                className={`min-h-[44px] min-w-[48px] rounded-full px-2.5 text-sm font-bold ${r.days.includes(day) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm font-semibold text-slate-600">
              From
              <input type="time" className={staffInput} value={r.start} onChange={(e) => set(i, { start: e.target.value })} required />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              To
              <input type="time" className={staffInput} value={r.end} onChange={(e) => set(i, { end: e.target.value })} required />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              People
              <input
                inputMode="numeric"
                className={staffInput}
                value={r.capacity ?? ''}
                placeholder={String(defaultCapacity)}
                onChange={(e) => set(i, { capacity: e.target.value === '' ? null : Number(e.target.value.replace(/[^0-9]/g, '')) })}
              />
            </label>
          </div>
          <input
            className={staffInput}
            value={r.label ?? ''}
            aria-label="Name for this time"
            placeholder="Name for this time (optional) — Breakfast shift"
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <button
            type="button"
            onClick={() => window.confirm('Remove this weekly time? Its future empty times go with it.') && onChange(rules.filter((_, j) => j !== i))}
            className={pill.red}
          >
            <Icon name="trash" size={16} /> Remove this line
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rules, { days: [6, 0], start: '12:00', end: '13:00', capacity: null, label: '' }])}
        className={pill.soft}
      >
        <Icon name="plus" size={16} /> Add a weekly time
      </button>
    </div>
  )
}
