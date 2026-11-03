import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionLabel, btn } from './ui'
import PhotoField from './PhotoField'
import {
  ACTIVITIES,
  SEXES,
  blankBunny,
  registerBunnies,
  type ActivityKey,
  type BunnyEntry,
} from '../features/bunfest/registration'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

const pill = (active: boolean) =>
  [
    'rounded-full px-3 py-1.5 text-sm font-bold transition',
    active
      ? 'bg-brand-blue text-white shadow-sm'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
  ].join(' ')

const today = () => new Date().toISOString().slice(0, 10)

const MAX_BUNNIES = 10

// Register the rabbits you are bringing to BunFest: you, each bunny with the RHDV2 vaccine date and a
// photo of the proof, the attendance agreement, and which activities you want. Sits next to the Spa and
// Glamour Shots session requests; staff see everyone in Staff → BunFest → Bunny registrations.
export function RegisterBunnies({ heading = 'Register your bunny' }: { heading?: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [owner, setOwner] = useState({ name: '', email: '', phone: '' })
  const [bunnies, setBunnies] = useState<BunnyEntry[]>([blankBunny()])
  const [activities, setActivities] = useState<ActivityKey[]>([])
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [sent, setSent] = useState<{ names: string[] } | null>(null)

  const setOwnerField = (k: keyof typeof owner) => (e: { target: { value: string } }) =>
    setOwner((o) => ({ ...o, [k]: e.target.value }))
  const setBunny = (i: number, patch: Partial<BunnyEntry>) =>
    setBunnies((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const toggleActivity = (k: ActivityKey) =>
    setActivities((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]))
  const busyPhoto = (b: boolean) => setUploading((n) => Math.max(0, n + (b ? 1 : -1)))

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      await registerBunnies({
        ownerName: owner.name,
        email: owner.email,
        phone: owner.phone,
        activities,
        note,
        bunnies,
        agreed,
      })
      setSent({ names: bunnies.map((b) => b.name.trim()).filter(Boolean) })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
      setStatus('idle')
    }
  }

  if (status === 'done' && sent) {
    return (
      <section className="space-y-2.5">
        <SectionLabel>{heading}</SectionLabel>
        <Card className="border-brand-blue/20 bg-brand-blue-50/50 text-center">
          <img src="/ohrr-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
          <h3 className="mt-1 font-display text-base font-extrabold text-ink">You’re registered!</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {sent.names.length === 1 ? sent.names[0] : sent.names.join(', ')} {sent.names.length === 1 ? 'is' : 'are'} on the
            BunFest list. Bring the vaccine proof to the door too, in case we need to check it. If you asked for a Spa or
            Glamour Shots time, request it on that page.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-2.5">
      <SectionLabel>{heading}</SectionLabel>
      <Card>
        <form name="bunfest-registration" onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Every rabbit coming to BunFest must be registered, with the date of its RHDV2 vaccine and proof. It takes a
            couple of minutes.
          </p>

          <div className="space-y-3">
            <h3 className="font-display text-base font-extrabold text-ink">About you</h3>
            <label className="block text-sm font-semibold text-slate-700">
              Your name
              <input className={input} name="name" autoComplete="name" required value={owner.name} onChange={setOwnerField('name')} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input className={input} type="email" name="email" autoComplete="email" required value={owner.email} onChange={setOwnerField('email')} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Phone <span className="font-normal text-slate-400">(optional)</span>
              <input className={input} type="tel" name="phone" autoComplete="tel" value={owner.phone} onChange={setOwnerField('phone')} />
            </label>
          </div>

          {bunnies.map((b, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-ink">
                  {bunnies.length > 1 ? `Bunny ${i + 1}` : 'Your bunny'}
                </h3>
                {bunnies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBunnies((list) => list.filter((_, j) => j !== i))}
                    className="min-h-[44px] px-2 text-sm font-bold text-slate-500"
                  >
                    Remove
                  </button>
                )}
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Name
                <input className={input} required value={b.name} onChange={(e) => setBunny(i, { name: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Age <span className="font-normal text-slate-400">(optional, like “3 years”)</span>
                <input className={input} value={b.age} onChange={(e) => setBunny(i, { age: e.target.value })} />
              </label>
              <div>
                <span className="block text-sm font-semibold text-slate-700">Girl or boy</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {SEXES.map((s) => (
                    <button key={s.key} type="button" aria-pressed={b.sex === s.key} onClick={() => setBunny(i, { sex: b.sex === s.key ? '' : s.key })} className={pill(b.sex === s.key)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Breed or color <span className="font-normal text-slate-400">(optional)</span>
                <input className={input} value={b.breedColor} onChange={(e) => setBunny(i, { breedColor: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Date of the RHDV2 vaccine
                <input
                  className={input}
                  type="date"
                  required
                  max={today()}
                  value={b.rhdv2Date}
                  onChange={(e) => setBunny(i, { rhdv2Date: e.target.value })}
                />
              </label>
              <PhotoField
                label="Photo of the proof"
                hint="The vaccine certificate, the vet bill, or the vet portal page. If you can’t now, bring it to the door."
                value={b.proofUrl}
                onChange={(url) => setBunny(i, { proofUrl: url })}
                onBusyChange={busyPhoto}
              />
            </div>
          ))}

          {bunnies.length < MAX_BUNNIES && (
            <button type="button" onClick={() => setBunnies((list) => [...list, blankBunny()])} className={`${btn.outline} w-full`}>
              Add another bunny
            </button>
          )}

          <div>
            <span className="block text-sm font-semibold text-slate-700">
              What would you like to do? <span className="font-normal text-slate-400">(pick any)</span>
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => (
                <button key={a.key} type="button" aria-pressed={activities.includes(a.key)} onClick={() => toggleActivity(a.key)} className={pill(activities.includes(a.key))}>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              This tells us how many to plan for. To hold a Spa or Glamour Shots time, also send a request on that page.
            </p>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Anything we should know? <span className="font-normal text-slate-400">(optional)</span>
            <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue" />
            <span className="text-sm leading-relaxed text-slate-700">
              I have read and agree to the{' '}
              <Link to="/bunfest/p/attendance-agreement" target="_blank" className="font-bold text-brand-blue underline">
                Rabbit Attendance Agreement
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={status === 'submitting' || uploading > 0 || !agreed}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Sending…' : uploading > 0 ? 'Sending photo…' : 'Register'}
          </button>
        </form>
      </Card>
    </section>
  )
}
