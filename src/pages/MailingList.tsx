// /mailing-list — join OHRR's list (first name, last name, email — the same
// three questions as the live site — plus what you'd like to hear about).
// Since update 31 it goes to the email list itself (join_mailing_list, source
// 'app'), which staff see under Staff → Supporters. Before the update is run
// it falls back to the old Inbox request ('mailing-list'), so no sign-up is
// lost either way.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { inputClass } from '../components/SchemaField'
import { useAuth } from '../lib/auth'
import InterestPicker from '../features/account/InterestPicker'
import { getDeviceInterests, joinMailingList, type Interest } from '../features/account/emailList'

export default function MailingList() {
  const { user } = useAuth()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' })
  const [interests, setInterests] = useState<Interest[]>(() => {
    const ticked = getDeviceInterests()
    return ticked.length > 0 ? ticked : ['newsletter']
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (interests.length === 0) {
      setError('Tick at least one.')
      return
    }
    setStatus('submitting')
    setError(null)
    try {
      await joinMailingList({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        interests,
        source: 'app',
        fallbackFields: { firstName: form.firstName, lastName: form.lastName },
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
              {user && (
                <p className="rounded-xl bg-brand-blue-50 px-3 py-2.5 text-sm text-slate-700">
                  You’re signed in —{' '}
                  <Link to="/account" className="font-bold text-brand-blue">
                    choose your emails in My OHRR
                  </Link>{' '}
                  to change or stop them any time.
                </p>
              )}
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
              <InterestPicker value={interests} onChange={setInterests} />
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
