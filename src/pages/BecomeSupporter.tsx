// /support/become-a-supporter — "Become a Supporter – It's free!" (the old
// site's form: name, address, email, phone). Lands in the staff Inbox as
// 'supporter'.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { inputClass } from '../components/SchemaField'
import { submitRequest } from '../lib/requests'

export default function BecomeSupporter() {
  const [f, setF] = useState({ firstName: '', lastName: '', street: '', street2: '', city: '', state: 'OH', zip: '', email: '', phone: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      await submitRequest('supporter', { ...f, name: `${f.firstName} ${f.lastName}`.trim() })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that right now.')
      setStatus('idle')
    }
  }
  return (
    <>
      <PageHeader icon="heart" title="Become a Supporter" subtitle="It’s free! There is no cost and you will receive updates on our progress and how you can help." />
      <Screen>
        {status === 'done' ? (
          <Card className="space-y-3 text-center">
            <p className="font-display text-lg font-extrabold text-ink">Welcome aboard, {f.firstName}!</p>
            <p className="text-sm text-slate-600">OHRR will keep you posted on progress and ways to help.</p>
            <Link to="/give" className={`${btn.blue} mx-auto`}>
              Back to Give
            </Link>
          </Card>
        ) : (
          <form onSubmit={submit}>
            <Card className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-slate-700">
                  First name
                  <input className={inputClass} required value={f.firstName} onChange={set('firstName')} autoComplete="given-name" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Last name
                  <input className={inputClass} required value={f.lastName} onChange={set('lastName')} autoComplete="family-name" />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Street address
                <input className={inputClass} required value={f.street} onChange={set('street')} autoComplete="address-line1" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Apt, suite, bldg. (optional)
                <input className={inputClass} value={f.street2} onChange={set('street2')} autoComplete="address-line2" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block text-sm font-semibold text-slate-700">
                  City
                  <input className={inputClass} required value={f.city} onChange={set('city')} autoComplete="address-level2" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  State
                  <input className={inputClass} required value={f.state} onChange={set('state')} autoComplete="address-level1" />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                ZIP code
                <input className={inputClass} required value={f.zip} onChange={set('zip')} autoComplete="postal-code" inputMode="numeric" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input className={inputClass} type="email" required value={f.email} onChange={set('email')} autoComplete="email" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Phone
                <input className={inputClass} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
              </label>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <button type="submit" disabled={status === 'submitting'} className={`${btn.primary} w-full disabled:opacity-60`}>
                {status === 'submitting' ? 'Sending…' : 'Join OHRR'}
              </button>
            </Card>
          </form>
        )}
      </Screen>
    </>
  )
}
