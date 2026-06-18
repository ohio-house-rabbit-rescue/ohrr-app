import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ohrr } from '../data/ohrr'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

const REASONS = ['Adoption visit', 'Meet a specific rabbit', 'General visit', 'Other'] as const
const DAYS = ['Saturday', 'Sunday', 'Either'] as const
// OHRR is open 12–4 PM; 30-minute slots, last start at 3:30 (before the 4 PM close).
const SLOTS = [
  '12:00 PM',
  '12:30 PM',
  '1:00 PM',
  '1:30 PM',
  '2:00 PM',
  '2:30 PM',
  '3:00 PM',
  '3:30 PM',
] as const

const pill = (active: boolean) =>
  [
    'rounded-full px-3 py-1.5 text-sm font-bold transition',
    active
      ? 'bg-brand-blue text-white shadow-sm'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
  ].join(' ')

function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&')
}

// Shown once a visit is requested — this is where the address lives.
function WhereToFindUs() {
  return (
    <Card className="border-brand-blue/20 bg-brand-blue-50/50 text-left">
      <h3 className="font-display text-base font-extrabold text-ink">Where to find us</h3>
      <dl className="mt-2 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Icon name="mappin" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
          <span className="text-slate-600">{ohrr.address}</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="clock" size={15} className="shrink-0 text-brand-blue" />
          <span className="text-slate-600">{ohrr.hours}</span>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="phone" size={15} className="shrink-0 text-brand-blue" />
          <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
            {ohrr.phone}
          </a>
        </div>
      </dl>
    </Card>
  )
}

export default function Appointment() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [reason, setReason] = useState('')
  const [day, setDay] = useState('')
  const [slots, setSlots] = useState<string[]>([])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const toggleSlot = (s: string) =>
    setSlots((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  // keep selected slots in clock order for a tidy summary
  const orderedSlots = SLOTS.filter((s) => slots.includes(s))

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({
          'form-name': 'appointment-request',
          reason,
          day,
          times: orderedSlots.join(', '),
          ...form,
        }),
      })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    const summary = [day, orderedSlots.join(', ')].filter(Boolean).join(' · ')
    return (
      <>
        <PageHeader icon="calendar" title="Appointment requested" />
        <Screen className="space-y-4 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            Thanks, {form.name || 'friend'} — OHRR will reach out to confirm a time
            {summary ? <> from your requested {summary}</> : ''}. Here’s where to find us once it’s
            set:
          </p>
          <WhereToFindUs />
          <Link to="/" className={`${btn.blue} mx-auto`}>
            Back to Home
          </Link>
        </Screen>
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon="calendar"
        title="Schedule a Visit"
        subtitle="OHRR welcomes visitors by appointment, Saturdays & Sundays, 12–4 PM. Pick the times that work for you — these are requests, and the team will confirm one with you."
      />
      <Screen className="space-y-4">
        {/* Prefer to call? */}
        <Card className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600">Prefer to call to set up a time?</span>
          <a href={ohrr.phoneHref} className={`${btn.blue} shrink-0 px-4 py-2`}>
            <Icon name="phone" size={15} /> Call
          </a>
        </Card>

        <Card>
          {/* name + data-netlify enable Netlify Forms; a matching hidden form in
              index.html lets Netlify detect it at build time. */}
          <form
            name="appointment-request"
            method="POST"
            data-netlify="true"
            netlify-honeypot="bot-field"
            onSubmit={onSubmit}
            className="space-y-4"
          >
            <input type="hidden" name="form-name" value="appointment-request" />
            <input type="hidden" name="reason" value={reason} />
            <input type="hidden" name="day" value={day} />
            <input type="hidden" name="times" value={orderedSlots.join(', ')} />
            <p className="hidden">
              <label>
                Don’t fill this out: <input name="bot-field" />
              </label>
            </p>

            <label className="block text-sm font-semibold text-slate-700">
              Your name
              <input className={input} name="name" required value={form.name} onChange={set('name')} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                className={input}
                type="email"
                name="email"
                required
                value={form.email}
                onChange={set('email')}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Phone
              <input className={input} type="tel" name="phone" value={form.phone} onChange={set('phone')} />
            </label>

            <div>
              <span className="block text-sm font-semibold text-slate-700">What’s the visit for?</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(reason === r ? '' : r)} className={pill(reason === r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-700">Which day works?</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button key={d} type="button" onClick={() => setDay(day === d ? '' : d)} className={pill(day === d)}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-700">
                Requested time(s)
                <span className="ml-1 font-normal text-slate-400">— pick any that work</span>
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SLOTS.map((s) => (
                  <button key={s} type="button" onClick={() => toggleSlot(s)} className={pill(slots.includes(s))}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Choosing a few gives the team flexibility to confirm one — your selections are
                requests, not a booked time.
              </p>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              Anything else?
              <textarea className={input} name="notes" rows={3} value={form.notes} onChange={set('notes')} />
            </label>

            {status === 'error' && (
              <p className="text-sm font-semibold text-red-600">
                Something went wrong — please try again, or call OHRR at {ohrr.phone}.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className={`${btn.primary} w-full disabled:opacity-60`}
            >
              {status === 'submitting' ? 'Sending…' : 'Request appointment'}
            </button>
          </form>
        </Card>

        <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
          OHRR will confirm your appointment by email or phone — and you’ll get the address and
          directions to plan your visit.
        </p>
      </Screen>
    </>
  )
}
