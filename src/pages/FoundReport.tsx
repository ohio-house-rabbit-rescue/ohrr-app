// /found/report — tell OHRR about a rabbit found outdoors.
//
// The Found-a-rabbit page used to end at "email the help line", which loses the
// one thing a rescuer needs most: a photo and a location, together, from the
// phone that is standing in front of the rabbit. This sends both into the staff
// Inbox as a 'found-rabbit' request, and still shows the phone numbers for
// anyone who would rather call.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { inputClass } from '../components/SchemaField'
import PhotoField from '../components/PhotoField'
import { submitRequest } from '../lib/requests'
import { foundContacts } from '../data/found'
import { ohrr } from '../data/ohrr'

const CONDITION = [
  'Looks well — moving around normally',
  'Injured or bleeding',
  'Very thin, weak or not moving',
  'Being chased by a dog, cat or people',
  'Not sure',
]

export default function FoundReport() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    where: '',
    condition: '',
    description: '',
    contained: '',
    notes: '',
    photoUrl: '',
  })
  const [photoBusy, setPhotoBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      await submitRequest('found-rabbit', {
        name: form.name,
        phone: form.phone,
        email: form.email,
        where: form.where,
        condition: form.condition,
        description: form.description,
        contained: form.contained,
        notes: form.notes,
        photo: form.photoUrl,
      })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that right now.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <>
        <PageHeader icon="mappin" title="Report sent" />
        <Screen className="space-y-4">
          <Card className="space-y-3 text-center">
            <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Icon name="check" size={34} />
            </span>
            <p className="font-display text-lg font-extrabold text-ink">Thank you, {form.name || 'friend'}.</p>
            <p className="text-sm leading-relaxed text-slate-600">
              OHRR has your report and will be in touch. <strong>If the rabbit is hurt, or in danger right now</strong>,
              please also call — a phone call is faster than any form.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href={ohrr.phoneHref} className={`${btn.primary} px-4 py-2`}>
                <Icon name="phone" size={15} /> Call OHRR
              </a>
              <a href={`mailto:${foundContacts.chrsHelpLine}`} className={`${btn.outline} px-4 py-2`}>
                <Icon name="mail" size={15} /> CHRS Help Line
              </a>
            </div>
          </Card>
          <Card className="space-y-2 text-sm text-slate-600">
            <p className="font-bold text-ink">While you wait</p>
            <p>
              Keep the rabbit contained and safe if you can do so without risk — a box or a carrier in a quiet, shaded
              spot, with water and greens.
            </p>
            <Link to="/found" className="font-bold text-brand-blue">
              How to catch a stray rabbit safely →
            </Link>
          </Card>
          <Link to="/" className={`${btn.outline} w-full`}>
            Back home
          </Link>
        </Screen>
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon="mappin"
        title="Report a found rabbit"
        subtitle="A photo and where you saw it are the two things that help most. It goes straight to OHRR."
      />
      <Screen className="space-y-4">
        <Card className="border-brand-orange/30 bg-brand-orange-50/60 text-sm text-slate-700">
          <p>
            <strong>Hurt, or in danger right now?</strong> Call instead —{' '}
            <a href={ohrr.phoneHref} className="font-bold text-brand-blue">
              {ohrr.phone}
            </a>
            .
          </p>
        </Card>

        <form onSubmit={submit}>
          <Card className="space-y-3">
            <PhotoField
              label="A photo of the rabbit"
              hint="Even a blurry one from a distance helps us tell a pet rabbit from a wild one."
              value={form.photoUrl}
              onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
              onBusyChange={setPhotoBusy}
            />

            <label className="block text-sm font-semibold text-slate-700">
              Where is it?
              <input
                className={inputClass}
                required
                value={form.where}
                onChange={set('where')}
                placeholder="Street and cross street, or a park / landmark"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              How does it look?
              <select className={inputClass} value={form.condition} onChange={set('condition')}>
                <option value="">Choose one…</option>
                {CONDITION.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              What does it look like?
              <input
                className={inputClass}
                value={form.description}
                onChange={set('description')}
                placeholder="Colour, size, lop ears, collar…"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Have you been able to contain it?
              <select className={inputClass} value={form.contained} onChange={set('contained')}>
                <option value="">Choose one…</option>
                <option>Yes — it’s safe with me</option>
                <option>No — it’s still loose</option>
                <option>It comes and goes from my yard</option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Anything else?
              <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
            </label>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-bold text-ink">How OHRR reaches you</p>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Your name
              <input className={inputClass} required value={form.name} onChange={set('name')} autoComplete="name" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Phone
                <input className={inputClass} required type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Email <span className="font-normal text-slate-400">(optional)</span>
                <input className={inputClass} type="email" value={form.email} onChange={set('email')} autoComplete="email" />
              </label>
            </div>

            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={status === 'submitting' || photoBusy}
              className={`${btn.primary} w-full disabled:opacity-60`}
            >
              {status === 'submitting' ? 'Sending…' : photoBusy ? 'Waiting for the photo…' : 'Send this report'}
            </button>
            <p className="text-xs text-slate-500">
              OHRR uses this to find and help the rabbit. Nothing here is published.
            </p>
          </Card>
        </form>
      </Screen>
    </>
  )
}
