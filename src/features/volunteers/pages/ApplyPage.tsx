// /volunteer/apply — the volunteer application.
//
// OHRR vets new volunteers: someone applies here, staff read it in Staff →
// Volunteers and approve them for everything or for certain kinds of
// volunteering, and from then on the email they applied with lets them sign
// up for those shifts. ?role=socialization (or a role's name) ticks that kind
// to start with — the pages that ask for approval link here with it.
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { errMessage } from '../../../lib/supabase'
import { submitRequest } from '../../../lib/requests'
import { HOURS_FOR, type HoursFor } from '../calls'
import { APPROVAL_KINDS, applyToVolunteer, kindLabel, rememberVolunteerEmail } from '../approval'

const input =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

/** "socialization", "Bunny Socialization" or "buncare-shift" → the kind to tick. */
function kindsFrom(role: string | null): string[] {
  const r = (role ?? '').trim().toLowerCase()
  if (!r) return []
  const hit =
    APPROVAL_KINDS.find((k) => k.value === r || k.label.toLowerCase() === r) ?? APPROVAL_KINDS.find((k) => r.includes(k.value))
  return hit ? [hit.value] : []
}

export default function ApplyPage() {
  const [params] = useSearchParams()
  const [f, setF] = useState({
    name: '',
    email: '',
    phone: '',
    guardianName: '',
    guardianEmail: '',
    availability: '',
    experience: '',
    anythingElse: '',
  })
  const [age, setAge] = useState<'' | 'adult' | 'minor'>('')
  const [kinds, setKinds] = useState<string[]>(() => kindsFrom(params.get('role')))
  const [hoursFor, setHoursFor] = useState<HoursFor | ''>('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const txt = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const toggle = (k: string) => setKinds((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!age) return setError('Please say whether you’re 18 or older.')
    if (kinds.length === 0) return setError('Please pick at least one kind of volunteering.')
    if (!understood) return setError('Please tick the box at the end.')
    // Everything else they told us, in words staff can read as they are.
    const answers: Record<string, string> = { age: age === 'adult' ? '18 or older' : 'Under 18' }
    if (age === 'minor') {
      answers.guardianName = f.guardianName.trim()
      answers.guardianEmail = f.guardianEmail.trim()
    }
    if (f.availability.trim()) answers.availability = f.availability.trim()
    if (f.experience.trim()) answers.experience = f.experience.trim()
    if (f.anythingElse.trim()) answers.anythingElse = f.anythingElse.trim()
    if (hoursFor) answers.hoursFor = HOURS_FOR.find((h) => h.value === hoursFor)?.label ?? hoursFor
    const a = {
      name: f.name.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      kinds,
      answers,
      hoursFor: hoursFor || undefined,
      source: params.get('src') || 'app',
    }
    setBusy(true)
    try {
      try {
        await applyToVolunteer(a)
      } catch (err) {
        // Before update 25 runs there is no application function yet: the
        // application still reaches OHRR, through the Inbox.
        if (!/apply_to_volunteer|schema cache/i.test(errMessage(err))) throw err
        await submitRequest('volunteer-application', {
          name: a.name,
          email: a.email,
          phone: a.phone || undefined,
          kinds: kinds.map(kindLabel).join(', '),
          ...answers,
        })
      }
      rememberVolunteerEmail(a.email)
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Screen className="space-y-5">
        <div className="pt-6 text-center">
          <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Icon name="check" size={34} />
          </span>
          <h1 className="mt-3 font-display text-2xl font-black text-ink">Thank you, {f.name.trim().split(/\s+/)[0] || 'friend'}!</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-700">
            OHRR looks at every application. You’ll get an email once you’re approved, with a link to your own volunteer
            page.
          </p>
        </div>
        <Card className="text-base leading-relaxed text-slate-700">
          Once you’re approved, pick a shift on the Volunteer page and use this same email — {f.email.trim()} — when it
          asks for the email you applied with.
        </Card>
        <Link to="/volunteer" className={`${btn.blue} w-full !py-3.5 text-base`}>
          Back to Volunteer
        </Link>
      </Screen>
    )
  }

  return (
    <>
      <PageHeader icon="users" title="Apply to volunteer" subtitle="Tell OHRR a little about you. Someone reads every application." />
      <Screen className="space-y-5">
        <Link to="/volunteer" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={18} /> Volunteer
        </Link>

        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-3">
            <SectionLabel>About you</SectionLabel>
            <label className="block text-base font-semibold text-slate-700">
              Your name
              <input className={input} required autoComplete="name" value={f.name} onChange={txt('name')} />
            </label>
            <label className="block text-base font-semibold text-slate-700">
              Email
              <input className={input} required type="email" inputMode="email" autoComplete="email" value={f.email} onChange={txt('email')} />
              <span className="mt-1 block text-sm font-normal text-slate-500">OHRR will write to you here, and you’ll use it to sign up for shifts.</span>
            </label>
            <label className="block text-base font-semibold text-slate-700">
              Phone <span className="font-normal text-slate-500">(optional)</span>
              <input className={input} type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={txt('phone')} />
            </label>
            <div>
              <p className="text-base font-semibold text-slate-700">Your age</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    ['adult', '18 or older'],
                    ['minor', 'Under 18'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={age === v}
                    onClick={() => setAge(v)}
                    className={`min-h-[48px] rounded-full px-4 text-base font-bold ${age === v ? 'bg-brand-blue text-white' : 'border-2 border-slate-200 bg-white text-slate-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {age === 'minor' && (
              <Card className="space-y-3 bg-slate-50">
                <p className="text-base text-slate-700">A parent or guardian’s details, please, so OHRR can reach them too.</p>
                <label className="block text-base font-semibold text-slate-700">
                  Parent or guardian’s name
                  <input className={input} required value={f.guardianName} onChange={txt('guardianName')} />
                </label>
                <label className="block text-base font-semibold text-slate-700">
                  Parent or guardian’s email
                  <input className={input} required type="email" inputMode="email" value={f.guardianEmail} onChange={txt('guardianEmail')} />
                </label>
              </Card>
            )}
          </section>

          <section className="space-y-2.5">
            <SectionLabel>What you’d like to do</SectionLabel>
            <p className="px-1 text-sm text-slate-600">Pick as many as you like.</p>
            <div className="space-y-2">
              {APPROVAL_KINDS.map((k) => {
                const on = kinds.includes(k.value)
                return (
                  <button
                    key={k.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(k.value)}
                    className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                      on ? 'border-brand-blue bg-brand-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${
                        on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {on && <Icon name="check" size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-base font-extrabold text-ink">{k.label}</span>
                      <span className="block text-sm leading-snug text-slate-600">{k.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <SectionLabel>A little more</SectionLabel>
            <label className="block text-base font-semibold text-slate-700">
              When are you usually free?
              <textarea className={input} rows={2} value={f.availability} onChange={txt('availability')} placeholder="Weekend afternoons, some weekday evenings" />
            </label>
            <label className="block text-base font-semibold text-slate-700">
              Your experience with rabbits
              <textarea className={input} rows={3} value={f.experience} onChange={txt('experience')} placeholder="None yet is fine — we’ll show you." />
            </label>
            <label className="block text-base font-semibold text-slate-700">
              Anything OHRR should know? <span className="font-normal text-slate-500">(optional)</span>
              <textarea className={input} rows={2} value={f.anythingElse} onChange={txt('anythingElse')} />
            </label>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>Do you need your hours for anything?</SectionLabel>
            <p className="px-1 text-sm text-slate-600">If so, your volunteer page can make the right letter for you later.</p>
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
          </section>

          <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-base font-semibold text-slate-700">
            <input
              type="checkbox"
              required
              className="mt-0.5 h-6 w-6 shrink-0 rounded border-slate-300 text-brand-blue"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            I understand OHRR reviews every application and will email me.
          </label>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-semibold text-red-700">{error}</p>}

          <button type="submit" disabled={busy} className={`${btn.primary} w-full !py-4 text-lg disabled:opacity-60`}>
            {busy ? 'Sending…' : 'Send my application'}
          </button>
          <p className="text-center text-sm text-slate-500">Your answers go only to OHRR.</p>
        </form>
      </Screen>
    </>
  )
}
