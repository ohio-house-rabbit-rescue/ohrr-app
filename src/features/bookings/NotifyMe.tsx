// "Tell me when there's a time" — the way out of a dead end.
//
// A booking type that OHRR hasn't published yet (the mobile vet clinic waits
// for confirmed dates) used to answer "This isn't open for booking right now",
// and that was the whole screen. Now the same screen takes a name and a way to
// reach someone, so the interest reaches the Inbox and OHRR has a list to call
// the day the dates are set.
import { useState, type FormEvent } from 'react'
import { Card, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { inputClass } from '../../components/SchemaField'
import { submitRequest } from '../../lib/requests'

export default function NotifyMe({ what, label }: { what: string; label: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      await submitRequest('notify-me', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        what: label,
        slug: what,
        notes: form.notes,
      })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that right now.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <Card className="space-y-2 border-green-200 bg-green-50/60 text-sm text-slate-700">
        <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
          <Icon name="check" size={18} className="text-green-700" /> You’re on the list
        </p>
        <p>OHRR will get in touch with you as soon as {label.toLowerCase()} dates are set.</p>
      </Card>
    )
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-3">
        <div>
          <p className="font-display text-[15px] font-extrabold text-ink">Tell me when there’s a time</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Leave your name and OHRR will let you know the moment {label.toLowerCase()} dates go up.
          </p>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Your name
          <input className={inputClass} required value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input className={inputClass} type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Phone
            <input className={inputClass} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Anything OHRR should know? <span className="font-normal text-slate-400">(optional)</span>
          <input className={inputClass} value={form.notes} onChange={set('notes')} placeholder="Nail trim for two rabbits" />
        </label>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={status === 'submitting' || (!form.email.trim() && !form.phone.trim())}
          className={`${btn.primary} w-full disabled:opacity-60`}
        >
          {status === 'submitting' ? 'Sending…' : 'Let me know'}
        </button>
        {!form.email.trim() && !form.phone.trim() && (
          <p className="text-xs text-slate-500">Add an email or a phone number so OHRR can reach you.</p>
        )}
      </Card>
    </form>
  )
}
