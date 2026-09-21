import { useState } from 'react'
import { SESSION_SLOTS } from '../data/bunfestPages'
import { Card, SectionLabel, btn } from './ui'
import { Icon } from './icons'
import { submitRequest } from '../lib/requests'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

const pill = (active: boolean) =>
  [
    'rounded-full px-3 py-1.5 text-sm font-bold transition',
    active
      ? 'bg-brand-blue text-white shadow-sm'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
  ].join(' ')


// In-app reservation for a BunFest service (Bunny Spa / Glamour Shots). No
// payment needed up front — guests pay at the table; the team confirms the time.
export function ReserveSession({
  title,
  formName,
  services,
}: {
  title: string
  formName: string
  services?: string[]
}) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [service, setService] = useState('')
  const [slot, setSlot] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', bunny: '' })

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      await submitRequest('reserve-session', { service, time: slot, ...form })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <section className="space-y-2.5">
        <SectionLabel>Reserve a session</SectionLabel>
        <Card className="border-brand-blue/20 bg-brand-blue-50/50 text-center">
          <div className="text-4xl" aria-hidden>
            <img src="/ohrr-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
          </div>
          <h3 className="mt-1 font-display text-base font-extrabold text-ink">Time requested!</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            OHRR will confirm your {title.toLowerCase()}
            {service ? ` (${service.toLowerCase()})` : ''}
            {slot ? ` around ${slot}` : ''}. Just pay at the table when you arrive.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-2.5">
      <SectionLabel>Reserve a session</SectionLabel>
      <Card>
        <form
          name={formName}
          onSubmit={onSubmit}
          className="space-y-3.5"
        >
          <input type="hidden" name="service" value={service} />
          <input type="hidden" name="time" value={slot} />
          <p className="hidden">
            <label>
              Don’t fill this out: <input name="bot-field" />
            </label>
          </p>

          {services && (
            <div>
              <span className="block text-sm font-semibold text-slate-700">Service</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {services.map((s) => (
                  <button key={s} type="button" onClick={() => setService(service === s ? '' : s)} className={pill(service === s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="block text-sm font-semibold text-slate-700">
              Preferred time <span className="font-normal text-slate-400">— we’ll confirm</span>
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SESSION_SLOTS.map((s) => (
                <button key={s} type="button" onClick={() => setSlot(slot === s ? '' : s)} className={pill(slot === s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Your name
            <input className={input} name="name" required value={form.name} onChange={set('name')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Phone
            <input className={input} type="tel" name="phone" required value={form.phone} onChange={set('phone')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Your bunny’s name(s)
            <input className={input} name="bunny" value={form.bunny} onChange={set('bunny')} />
          </label>

          {status === 'error' && (
            <p className="text-sm font-semibold text-red-600">Something went wrong — please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting' || !slot}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Sending…' : 'Request this time'}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            No payment now — you pay at the {title} table at BunFest. RHDV2 vaccination required.
          </p>
        </form>
      </Card>
    </section>
  )
}
