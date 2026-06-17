import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Screen, Card, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&')
}

export default function ServiceSignup() {
  const [params] = useSearchParams()
  const isClinic = params.get('type') === 'clinic'
  const service = isClinic ? 'Mobile vet clinic' : 'Bonding session'
  const date = params.get('date') ?? ''
  const time = params.get('time') ?? ''

  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', email: '', phone: '', bunny: '', notes: '' })

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': 'service-signup', service, date, time, ...form }),
      })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          🐰
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Request received!</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Thanks, {form.name || 'friend'} — OHRR will reach out to confirm your {service.toLowerCase()}
          {date ? ` on ${date}` : ''}
          {time ? ` at ${time}` : ''}.
        </p>
        <Link to="/services" className={`${btn.blue} mx-auto`}>
          Back to services
        </Link>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <Link
        to="/services"
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Services
      </Link>

      <div>
        <Badge tone={isClinic ? 'orange' : 'blue'}>{service}</Badge>
        <h1 className="mt-2 font-display text-2xl font-black text-ink">
          {isClinic ? 'Reserve your clinic time' : 'Request a bonding session'}
        </h1>
        {(date || time) && (
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {[date, time].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <Card>
        {/* name + data-netlify enable Netlify Forms; a matching hidden form in
            index.html lets Netlify detect it at build time. */}
        <form
          name="service-signup"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={onSubmit}
          className="space-y-3"
        >
          <input type="hidden" name="form-name" value="service-signup" />
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
            <input
              className={input}
              type="tel"
              name="phone"
              value={form.phone}
              onChange={set('phone')}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Your bunny’s name(s)
            <input className={input} name="bunny" value={form.bunny} onChange={set('bunny')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {isClinic ? 'Anything the vet should know?' : 'Tell us about your rabbit'}
            <textarea
              className={input}
              name="notes"
              rows={3}
              value={form.notes}
              onChange={set('notes')}
            />
          </label>

          {status === 'error' && (
            <p className="text-sm font-semibold text-red-600">
              Something went wrong — please try again, or call OHRR at 614-263-8557.
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Sending…' : 'Submit request'}
          </button>
        </form>
      </Card>

      <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
        Submitting sends your request to OHRR, who will confirm by email or phone.
      </p>
    </Screen>
  )
}
