// /book/:slug — pick a time, leave your name, done. Shifts confirm on the spot;
// appointments show "OHRR will confirm". The confirmation offers a phone
// reminder / calendar entry and a private cancel link. Every rule (capacity,
// lead time, per-month limit) is enforced in the database; this page just
// explains the answer it gets back.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner } from '../../../components/staffui'
import { errMessage, isSupabaseConfigured } from '../../../lib/supabase'
import { isNative } from '../../../native/platform'
import { ohrr } from '../../../data/ohrr'
import { bookSlot, getBookingType, openSlots } from '../api'
import { rememberBooking } from '../mine'
import NotifyMe from '../NotifyMe'

// Friendly names for the things OHRR hasn't published times for yet, so the
// "no dates" screen can say what it's about.
const NOT_OPEN_YET: Record<string, string> = {
  'vet-clinic': 'Mobile vet clinic',
  'bonding-session': 'Bunny bonding sessions',
  'adoption-visit': 'Adoption appointments',
  'bunny-socialization': 'Bunny Socialization shifts',
  'buncare-shift': 'Buncare shifts',
}
import { downloadBookingIcs, googleCalendarUrl, scheduleBookingReminders } from '../calendar'
import { dayKey, durationLabel, fmtDay, fmtRange, fmtTime, type BookingReceipt, type BookingType, type OpenSlot, fmtWeekly, placeName } from '../types'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export default function BookPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [type, setType] = useState<BookingType | null | undefined>(undefined)
  const [slots, setSlots] = useState<OpenSlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<OpenSlot | null>(null)
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setType(null)
      return
    }
    let alive = true
    getBookingType(slug)
      .then((t) => {
        if (!alive) return
        setType(t)
        if (t) openSlots(slug).then((s) => alive && setSlots(s)).catch((e) => alive && setError(errMessage(e)))
      })
      .catch((e) => {
        if (!alive) return
        setError(errMessage(e))
        setType(null)
      })
    return () => {
      alive = false
    }
  }, [slug])

  const byDay = useMemo(() => {
    const m = new Map<string, OpenSlot[]>()
    for (const s of slots ?? []) {
      if (s.taken >= s.capacity) continue
      const k = dayKey(s.starts_at)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return [...m.entries()]
  }, [slots])

  if (type === undefined) return <Spinner />
  if (type === null) {
    // Nothing published under this slug yet (the vet clinic waits for confirmed
    // dates). Take an interest instead of ending the journey here.
    const name = NOT_OPEN_YET[slug] ?? 'these'
    return (
      <>
        <PageHeader icon="calendar" title={NOT_OPEN_YET[slug] ?? 'Booking'} />
        <Screen className="space-y-4">
          <Card className="space-y-2 text-sm text-slate-600">
            <p className="font-bold text-ink">No dates are up yet.</p>
            <p>
              OHRR sets {name.toLowerCase()} dates a few weeks ahead. Ask to be told when they go up, or email{' '}
              <a href={`mailto:${ohrr.email}`} className="font-semibold text-brand-blue">
                {ohrr.email}
              </a>
              .
            </p>
          </Card>
          <NotifyMe what={slug} label={name} />
        </Screen>
      </>
    )
  }

  if (receipt) return <Confirmation receipt={receipt} type={type} />

  const isShift = type.kind === 'shift'
  const reqs = (type.requirements ?? '').split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <>
      <PageHeader
        icon={isShift ? 'users' : 'calendar'}
        title={type.name}
        subtitle={type.description ?? undefined}
      />
      <Screen className="space-y-5">
        <Card className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-bold text-ink">{durationLabel(type.duration_min)}</span>
            {placeName(type.location) ? <> · {placeName(type.location)}</> : null}
          </p>
          {type.weekly.length > 0 && (
            <p>
              <span className="font-bold text-ink">Usual times:</span> {fmtWeekly(type.weekly).join(' · ')}
            </p>
          )}
          {type.max_per_month && (
            <p>
              Up to <strong>{type.max_per_month}</strong> per month per person.
            </p>
          )}
          {type.confirm_mode === 'staff' && <p>You pick a time; OHRR confirms it with you by phone or email.</p>}
          {reqs.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {reqs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </Card>

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        {!picked ? (
          <section className="space-y-2.5">
            <SectionLabel>Pick a time</SectionLabel>
            {slots === null && !error && <Spinner label="Finding open times…" />}
            {slots && byDay.length === 0 && (
              <Card className="space-y-2 text-sm text-slate-600">
                <p className="font-bold text-ink">No open times in the next two months.</p>
                <p>
                  Check back soon, or email{' '}
                  <a href={`mailto:${ohrr.email}?subject=${encodeURIComponent(type.name)}`} className="font-semibold text-brand-blue">
                    {ohrr.email}
                  </a>
                  .
                </p>
              </Card>
            )}
            {byDay.map(([day, list]) => (
              <Card key={day} className="space-y-2">
                <p className="font-display text-[15px] font-extrabold text-ink">{fmtDay(list[0].starts_at)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {list.map((s) => {
                    const left = s.capacity - s.taken
                    return (
                      <button
                        key={s.slot_id}
                        type="button"
                        onClick={() => setPicked(s)}
                        className="rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-left transition hover:border-brand-blue active:scale-[.98]"
                      >
                        <span className="block font-display text-base font-extrabold text-ink">{fmtRange(s.starts_at, s.ends_at)}</span>
                        <span className="block text-xs text-slate-500">
                          {isShift ? `${left} spot${left === 1 ? '' : 's'} left` : 'Open'}
                          {s.note ? ` · ${s.note}` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Card>
            ))}
          </section>
        ) : (
          <BookForm
            type={type}
            slot={picked}
            initialAnswer={params.get('rabbit') ?? ''}
            onBack={() => setPicked(null)}
            onBooked={(r) => {
              setReceipt(r)
              window.scrollTo({ top: 0 })
            }}
            onRefresh={() => openSlots(slug).then(setSlots).catch(() => undefined)}
          />
        )}
      </Screen>
    </>
  )
}

function BookForm({
  type,
  slot,
  initialAnswer,
  onBack,
  onBooked,
  onRefresh,
}: {
  type: BookingType
  slot: OpenSlot
  initialAnswer: string
  onBack: () => void
  onBooked: (r: BookingReceipt) => void
  onRefresh: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', answer: initialAnswer, notes: '' })
  const [party, setParty] = useState(1)
  const [attested, setAttested] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const left = slot.capacity - slot.taken

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      const r = await bookSlot({
        slotId: slot.slot_id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        party,
        answer: form.answer,
        notes: form.notes,
        attested,
      })
      onBooked(r)
    } catch (err) {
      setError(errMessage(err))
      setStatus('idle')
      onRefresh()
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange">
          <Icon name="clock" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-extrabold text-ink">{fmtDay(slot.starts_at)}</span>
          <span className="block text-sm text-slate-600">{fmtRange(slot.starts_at, slot.ends_at)}</span>
        </span>
        <button type="button" onClick={onBack} className="text-sm font-bold text-brand-blue">
          Change
        </button>
      </Card>

      <Card className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Your name
          <input className={input} required value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input className={input} type="email" required value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Phone
          <input className={input} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" />
        </label>
        {type.max_party > 1 && (
          <label className="block text-sm font-semibold text-slate-700">
            How many people are coming?
            <select className={input} value={party} onChange={(e) => setParty(Number(e.target.value))}>
              {Array.from({ length: Math.min(type.max_party, Math.max(1, left)) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {type.ask_reason && (
          <label className="block text-sm font-semibold text-slate-700">
            {type.ask_reason}
            <input className={input} value={form.answer} onChange={set('answer')} />
          </label>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Anything OHRR should know? (optional)
          <textarea className={input} rows={2} value={form.notes} onChange={set('notes')} />
        </label>
        {type.attest_text && (
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-blue" required />
            <span>{type.attest_text}</span>
          </label>
        )}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={status === 'submitting'} className={`${btn.primary} w-full disabled:opacity-60`}>
          {status === 'submitting' ? 'Booking…' : type.confirm_mode === 'staff' ? 'Request this time' : 'Book it'}
        </button>
        <p className="text-xs leading-relaxed text-slate-500">
          No account needed. Your details go only to OHRR, so they can reach you about this booking.
        </p>
      </Card>
    </form>
  )
}

function Confirmation({ receipt, type }: { receipt: BookingReceipt; type: BookingType }) {
  const [reminder, setReminder] = useState<'idle' | 'scheduled' | 'denied'>('idle')
  const confirmed = receipt.status === 'confirmed'
  const cancelHref = `/book/cancel/${receipt.cancel_token}`

  // Keep it on this phone: OHRR sends no confirmation email, so this is the
  // only lasting record of the time, the place and the private cancel link.
  useEffect(() => {
    rememberBooking(receipt, type)
  }, [receipt, type])

  return (
    <>
      <PageHeader icon="calendar" title={confirmed ? 'You’re booked!' : 'Request sent'} />
      <Screen className="space-y-4">
        <Card className="space-y-2">
          <div className="flex justify-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Icon name="check" size={34} />
            </span>
          </div>
          <p className="text-center font-display text-xl font-black text-ink">{receipt.type_name}</p>
          <p className="text-center text-base text-slate-700">
            {fmtDay(receipt.starts_at)}
            <br />
            {fmtTime(receipt.starts_at)} – {fmtTime(receipt.ends_at)}
          </p>
          {receipt.location && <p className="text-center text-sm text-slate-500">{receipt.location}</p>}
          {!confirmed && (
            <p className="rounded-xl bg-brand-orange-50 px-3 py-2 text-center text-sm font-semibold text-brand-orange">
              OHRR will confirm this with you by phone or email.
            </p>
          )}
          {receipt.party_size > 1 && <p className="text-center text-sm text-slate-500">{receipt.party_size} people</p>}
        </Card>

        <Card className="space-y-2">
          <p className="font-display text-[15px] font-extrabold text-ink">Remember it</p>
          {isNative ? (
            <>
              <button
                type="button"
                onClick={() => scheduleBookingReminders(receipt).then((r) => setReminder(r === 'scheduled' ? 'scheduled' : 'denied'))}
                className={`${btn.blue} w-full`}
                disabled={reminder === 'scheduled'}
              >
                {reminder === 'scheduled' ? 'Reminders set on this phone' : 'Remind me on this phone'}
              </button>
              {reminder === 'denied' && (
                <p className="text-xs text-slate-500">Notifications are off for the OHRR app — turn them on in your phone’s Settings.</p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => downloadBookingIcs(receipt)} className={`${btn.blue} w-full`}>
                Add to calendar
              </button>
              <a href={googleCalendarUrl(receipt)} target="_blank" rel="noopener noreferrer" className={`${btn.outline} w-full`}>
                Google Calendar
              </a>
            </div>
          )}
        </Card>

        <Card className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-bold text-ink">Saved on this phone.</span> You’ll find this booking — and the link
            below — on the app’s Home screen until it’s over.
          </p>
          <p>
            Can’t make it?{' '}
            <Link to={cancelHref} className="font-bold text-brand-blue">
              Cancel this booking
            </Link>{' '}
            — this link is private to you.
          </p>
          {type.kind === 'shift' && <p>Please book at least {type.min_lead_hours} hours ahead so someone is there to let you in.</p>}
        </Card>

        <Link to={type.kind === 'shift' ? '/volunteer' : '/'} className={`${btn.outline} w-full`}>
          Done
        </Link>
      </Screen>
    </>
  )
}
