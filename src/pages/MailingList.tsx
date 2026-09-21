// /mailing-list — join OHRR's list (first name, last name, email — the same
// three questions as the live site). Lands in the staff Inbox as
// 'mailing-list'; the website's Inbox exports them as a CSV for whatever
// email service OHRR uses.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { inputClass } from '../components/SchemaField'
import { submitRequest } from '../lib/requests'

export default function MailingList() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      await submitRequest('mailing-list', {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
      })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you up right now.')
      setStatus('error')
    }
  }

  return (
    <>
      <PageHeader icon="mail" title="Join the mailing list" subtitle="Complete the form below to join our mailing list – we'd be hoppy to have you with us!" />
      <Screen className="space-y-4">
        {status === 'done' ? (
          <Card className="space-y-3 text-center">
            <p className="font-display text-lg font-extrabold text-ink">You’re on the list!</p>
            <p className="text-sm text-slate-600">Thanks, {form.firstName}. OHRR only sends the important stuff.</p>
            <Link to="/" className={`${btn.blue} mx-auto`}>
              Back home
            </Link>
          </Card>
        ) : (
          <form onSubmit={submit}>
            <Card className="space-y-3">
              <p className="text-sm leading-relaxed text-slate-600">
                We keep things simple and only send the important stuff: updates, fundraisers, opportunities, Midwest BunFest information, and ways
                you can help rescue rabbits when it matters most.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-slate-700">
                  First name
                  <input className={inputClass} required value={form.firstName} onChange={set('firstName')} autoComplete="given-name" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Last name
                  <input className={inputClass} required value={form.lastName} onChange={set('lastName')} autoComplete="family-name" />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input className={inputClass} type="email" required value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
              </label>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <button type="submit" disabled={status === 'submitting'} className={`${btn.primary} w-full disabled:opacity-60`}>
                {status === 'submitting' ? 'Signing you up…' : 'Join the list'}
              </button>
            </Card>
          </form>
        )}
      </Screen>
    </>
  )
}
