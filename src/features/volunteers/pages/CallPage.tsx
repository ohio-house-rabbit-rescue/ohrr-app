// /volunteer/call/:slug — one volunteer call: what's needed, the shifts with
// the places left, and a short form to sign up for one or more of them.
//
// Reached from a post, a text, an email, a letter or a flyer; the ?src= on the
// link records which, so OHRR can see what worked. Signing up puts the person
// on the volunteer roster; asking what the hours are for (optional) means the
// right letter can be written from the record later, without asking again.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { errMessage } from '../../../lib/supabase'
import { mapsUrl } from '../../../lib/events'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { downloadBookingIcs } from '../../bookings/calendar'
import { rememberBooking } from '../../bookings/mine'
import type { BookingReceipt, BookingType } from '../../bookings/types'
import {
  HOURS_FOR,
  fmtDay,
  fmtHours,
  fmtShift,
  lengthText,
  needText,
  placesLeft,
  sourceFrom,
  whenText,
  type Call,
  type HoursFor,
} from '../calls'
import { loadPublicCall, signUpForCall, type SignUpResult } from '../callsApi'

const input =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export default function CallPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const source = sourceFrom(params)
  const [call, setCall] = useState<Call | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<SignUpResult | null>(null)

  useEffect(() => {
    loadPublicCall(slug)
      .then(setCall)
      .catch((e) => {
        setError(errMessage(e))
        setCall(null)
      })
  }, [slug])

  if (call === undefined) {
    return (
      <Screen className="space-y-3">
        <div className="mt-6 h-7 w-2/3 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      </Screen>
    )
  }

  if (!call) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">We couldn’t find that call</h1>
        <p className="text-base text-slate-600">{error ?? 'It may have been filled or taken down.'}</p>
        <Link to="/volunteer" className={`${btn.blue} mx-auto`}>
          Other ways to volunteer
        </Link>
      </Screen>
    )
  }

  if (done) return <Done call={call} result={done} />

  return (
    <>
      <PageHeader icon="users" title={call.title} subtitle={call.summary ?? 'Volunteers needed'} />
      <Screen className="space-y-5">
        <Card className="space-y-3">
          <Fact icon="calendar" label="When" value={whenText(call, true)} />
          {call.location && (
            <Fact
              icon="mappin"
              label="Where"
              value={
                <a href={mapsUrl(call.location)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2">
                  {call.location}
                </a>
              }
            />
          )}
          <Fact icon="users" label="What we need" value={`${needText(call)}.`} />
          {call.who && <Fact icon="heart" label="Who can help" value={call.who} />}
          {call.perks.length > 0 && <Fact icon="gift" label="What you get" value={call.perks.join(' · ')} />}
        </Card>

        {call.details && <p className="whitespace-pre-line px-1 text-base leading-relaxed text-slate-700">{call.details}</p>}

        {call.is_open === false ? (
          <Card className="text-center">
            <p className="font-display text-base font-extrabold text-ink">Sign-ups for this have closed</p>
            <p className="mt-1 text-base text-slate-600">Thank you for offering to help.</p>
            <Link to="/volunteer" className={`${btn.outline} mx-auto mt-3`}>
              Other ways to volunteer
            </Link>
          </Card>
        ) : placesLeft(call) === 0 ? (
          <Card className="text-center">
            <p className="font-display text-base font-extrabold text-ink">Every shift is full</p>
            <p className="mt-1 text-base text-slate-600">Thank you — and please check the other ways to help.</p>
            <Link to="/volunteer" className={`${btn.outline} mx-auto mt-3`}>
              Other ways to volunteer
            </Link>
          </Card>
        ) : (
          <SignUpForm call={call} source={source} onDone={setDone} />
        )}
      </Screen>
    </>
  )
}

function Fact({ icon, label, value }: { icon: 'calendar' | 'mappin' | 'users' | 'heart' | 'gift'; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-base leading-snug text-ink">{value}</p>
      </div>
    </div>
  )
}

function SignUpForm({ call, source, onDone }: { call: Call; source: string | null; onDone: (r: SignUpResult) => void }) {
  const shifts = (call.shifts ?? []).filter((s) => new Date(s.ends_at) > new Date())
  const [picked, setPicked] = useState<string[]>([])
  const [area, setArea] = useState('')
  const [f, setF] = useState({ name: '', email: '', phone: '' })
  const [hoursFor, setHoursFor] = useState<HoursFor | ''>('')
  const [details, setDetails] = useState<Record<string, string>>({})
  const [attested, setAttested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickedHours = useMemo(
    () =>
      shifts
        .filter((s) => picked.includes(s.slot_id))
        .reduce((h, s) => h + (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000, 0),
    [picked, shifts],
  )
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const ask = HOURS_FOR.find((h) => h.value === hoursFor)?.ask ?? []

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (picked.length === 0) return setError('Pick at least one shift.')
    if (call.areas.length > 0 && !area) return setError('Pick where you’d like to help.')
    if (call.requirements && !attested) return setError('Please confirm you’ve read what’s needed.')
    setBusy(true)
    try {
      const r = await signUpForCall({
        slug: call.slug,
        slotIds: picked,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        area,
        hoursFor,
        details: Object.fromEntries(Object.entries(details).filter(([, v]) => v.trim())),
        source,
        attested,
      })
      onDone(r)
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-2.5">
        <SectionLabel>1 · Pick your shift{shifts.length > 1 ? 's' : ''}</SectionLabel>
        {shifts.length > 1 && (
          <p className="px-1 text-sm text-slate-600">
            Shifts are {lengthText(call.shift_minutes)} long — pick as many as you’d like.
          </p>
        )}
        <div className="space-y-2">
          {shifts.map((s) => {
            const left = Math.max(0, s.capacity - s.taken)
            const on = picked.includes(s.slot_id)
            const full = left === 0 || !s.open
            return (
              <button
                key={s.slot_id}
                type="button"
                disabled={full && !on}
                aria-pressed={on}
                onClick={() => toggle(s.slot_id)}
                className={`flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                  on ? 'border-brand-blue bg-brand-blue-50' : full ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white'}`}>
                    {on && <Icon name="check" size={16} />}
                  </span>
                  <span className="font-display text-lg font-extrabold text-ink">{fmtShift(s)}</span>
                </span>
                <span className={`text-sm font-bold ${full ? 'text-slate-500' : left <= 1 ? 'text-brand-orange-dark' : 'text-slate-600'}`}>
                  {full ? 'Full' : `${left} of ${s.capacity} places left`}
                </span>
              </button>
            )
          })}
        </div>
        {picked.length > 0 && (
          <p className="px-1 text-sm font-semibold text-brand-blue">
            {picked.length} {picked.length === 1 ? 'shift' : 'shifts'} · {fmtHours(pickedHours)} {pickedHours === 1 ? 'hour' : 'hours'}
          </p>
        )}
      </section>

      {call.areas.length > 0 && (
        <section className="space-y-2.5">
          <SectionLabel>2 · Where you’d like to help</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {call.areas.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={area === a}
                onClick={() => setArea(a)}
                className={`min-h-[48px] rounded-full px-4 text-base font-bold ${area === a ? 'bg-brand-blue text-white' : 'border-2 border-slate-200 bg-white text-slate-700'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionLabel>{call.areas.length > 0 ? '3' : '2'} · About you</SectionLabel>
        <label className="block text-base font-semibold text-slate-700">
          Your name
          <input className={input} required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block text-base font-semibold text-slate-700">
          Email
          <input className={input} required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <span className="mt-1 block text-sm font-normal text-slate-500">So we can thank you, and keep a record of your hours.</span>
        </label>
        <label className="block text-base font-semibold text-slate-700">
          Phone <span className="font-normal text-slate-500">(optional)</span>
          <input className={input} type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </label>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Need a letter for your hours?</SectionLabel>
        <p className="px-1 text-sm text-slate-600">Optional. Every shift is recorded; tell us now and the right letter is ready when you need it.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={hoursFor === ''}
            onClick={() => setHoursFor('')}
            className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${hoursFor === '' ? 'bg-ink text-white' : 'border-2 border-slate-200 bg-white text-slate-700'}`}
          >
            No, just helping
          </button>
          {HOURS_FOR.map((h) => (
            <button
              key={h.value}
              type="button"
              aria-pressed={hoursFor === h.value}
              onClick={() => setHoursFor(h.value)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${hoursFor === h.value ? 'bg-ink text-white' : 'border-2 border-slate-200 bg-white text-slate-700'}`}
            >
              {h.label}
            </button>
          ))}
        </div>
        {ask.map((q) => (
          <label key={q.key} className="block text-base font-semibold text-slate-700">
            {q.label}
            <input className={input} placeholder={q.placeholder} value={details[q.key] ?? ''} onChange={(e) => setDetails({ ...details, [q.key]: e.target.value })} />
          </label>
        ))}
      </section>

      {call.requirements && (
        <Card className="space-y-2">
          <p className="font-display text-base font-extrabold text-ink">Before you sign up</p>
          <ul className="space-y-1.5">
            {call.requirements
              .split('\n')
              .map((r) => r.trim())
              .filter(Boolean)
              .map((r) => (
                <li key={r} className="flex gap-2 text-base leading-snug text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                  {r}
                </li>
              ))}
          </ul>
          <label className="flex items-start gap-3 pt-1 text-base font-semibold text-slate-700">
            <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 rounded border-slate-300 text-brand-blue" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
            I’ve read this and can do it
          </label>
        </Card>
      )}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-semibold text-red-700">{error}</p>}

      <button type="submit" disabled={busy} className={`${btn.primary} w-full !py-4 text-lg disabled:opacity-60`}>
        {busy ? 'Signing you up…' : 'Sign me up'}
      </button>
      <p className="text-center text-sm text-slate-500">No account needed. Change of plans? You can cancel from the next screen.</p>
    </form>
  )
}

function Done({ call, result }: { call: Call; result: SignUpResult }) {
  const receipts: BookingReceipt[] = result.shifts.map((s) => ({
    booking_id: s.booking_id,
    status: 'confirmed',
    cancel_token: s.cancel_token,
    type_name: call.title,
    kind: 'shift',
    location: call.location,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    party_size: 1,
  }))

  // Keep them on this phone, beside any other bookings.
  useEffect(() => {
    const type = { slug: `call-${call.slug}`, name: call.title, kind: 'shift', location: call.location } as BookingType
    receipts.forEach((r) => rememberBooking(r, type))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Screen className="space-y-5">
      <div className="pt-6 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Icon name="check" size={34} />
        </span>
        <h1 className="mt-3 font-display text-2xl font-black text-ink">Thank you!</h1>
        <p className="mt-1 text-base leading-relaxed text-slate-600">
          You’re down to help at {call.title} on {fmtDay(call.on_date)}. We’re so grateful.
        </p>
      </div>

      <section className="space-y-2.5">
        <SectionLabel>Your {receipts.length === 1 ? 'shift' : 'shifts'}</SectionLabel>
        {receipts.map((r) => (
          <Card key={r.booking_id} className="space-y-2">
            <p className="font-display text-lg font-extrabold text-ink">{fmtShift(r)}</p>
            {call.location && <p className="text-sm text-slate-600">{call.location}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadBookingIcs(r)} className={`${btn.outline} !px-4 !py-2 text-sm`}>
                <Icon name="calendar" size={15} /> Add to my calendar
              </button>
              <Link to={`/book/cancel/${r.cancel_token}`} className="inline-flex items-center px-2 text-sm font-semibold text-slate-600 underline underline-offset-2">
                Can’t make it? Cancel
              </Link>
            </div>
          </Card>
        ))}
      </section>

      {result.hours_token && (
        <Card className="space-y-2 border-brand-blue/30 bg-brand-blue-50/40">
          <p className="font-display text-base font-extrabold text-ink">Your volunteer hours</p>
          <p className="text-base leading-relaxed text-slate-700">
            This is your own page: every shift you do with OHRR adds up here, and you can print a record of it any time.
          </p>
          <Link to={`/volunteer/hours/${result.hours_token}`} className={`${btn.blue} w-full`}>
            Open my hours page
          </Link>
        </Card>
      )}

      <p className="text-center text-sm leading-relaxed text-slate-500">
        We’ve kept your {receipts.length === 1 ? 'shift' : 'shifts'} on this device. On the day, just tell the team your name when
        you arrive.
      </p>
    </Screen>
  )
}
