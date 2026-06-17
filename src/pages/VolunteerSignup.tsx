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

export default function VolunteerSignup() {
  const [params] = useSearchParams()
  const role = params.get('role') ?? 'Volunteer'
  const item = params.get('item') ?? ''

  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', email: '', phone: '', availability: '', notes: '' })

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({ 'form-name': 'volunteer-signup', role, item, ...form }),
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
        <h1 className="font-display text-xl font-extrabold text-ink">You’re on the list!</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Thanks, {form.name || 'friend'} — OHRR will reach out about{' '}
          {role.toLowerCase()}
          {item ? ` (${item})` : ''}.
        </p>
        <Link to="/volunteer" className={`${btn.blue} mx-auto`}>
          Back to Volunteer
        </Link>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <Link
        to="/volunteer"
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Volunteer
      </Link>

      <div>
        <Badge tone="blue">{role}</Badge>
        <h1 className="mt-2 font-display text-2xl font-black text-ink">Count me in</h1>
        {item && <p className="mt-1 text-sm font-semibold text-slate-500">{item}</p>}
      </div>

      <Card>
        {/* name + data-netlify enable Netlify Forms; a matching hidden form in
            index.html lets Netlify detect it at build time. */}
        <form
          name="volunteer-signup"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={onSubmit}
          className="space-y-3"
        >
          <input type="hidden" name="form-name" value="volunteer-signup" />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="item" value={item} />
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
          <label className="block text-sm font-semibold text-slate-700">
            When are you usually free?
            <input
              className={input}
              name="availability"
              placeholder="e.g. weekend afternoons"
              value={form.availability}
              onChange={set('availability')}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Anything you’d like OHRR to know?
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
            {status === 'submitting' ? 'Sending…' : 'Submit'}
          </button>
        </form>
      </Card>

      <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
        Submitting sends your interest to OHRR, who will follow up by email or phone.
      </p>
    </Screen>
  )
}
