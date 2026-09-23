import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { intakeConfig, type IntakeType } from '../data/surrenderForm'
import { SchemaField, type Values } from '../components/SchemaField'
import PhotoField from '../components/PhotoField'
import { useFormDraft, DRAFT_NOTE } from '../lib/formDraft'
import { surrenderContact } from '../data/surrender'
import { Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { submitRequest } from '../lib/requests'

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'


const todayISO = () => new Date().toISOString().slice(0, 10)

export default function SurrenderForm() {
  const [params] = useSearchParams()
  const type: IntakeType = params.get('type') === 'good-samaritan' ? 'good-samaritan' : 'owner'
  const cfg = useMemo(() => intakeConfig(type), [type])

  const [values, setValues, clearDraft, restored] = useFormDraft<Values>(`surrender-${type}`, {})
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')
  const [signDate, setSignDate] = useState(todayISO())
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')

  const setVal = (name: string, v: string | string[]) => setValues((s) => ({ ...s, [name]: v }))
  const toggle = (name: string, opt: string) =>
    setValues((s) => {
      const cur = Array.isArray(s[name]) ? (s[name] as string[]) : []
      return { ...s, [name]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] }
    })

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    // flatten values (arrays -> comma list) for the POST body
    const flat: Record<string, string> = {
      type: cfg.title,
      signature,
      agreement: 'Agreed to relinquishment terms',
      agreementDate: signDate,
    }
    for (const [k, v] of Object.entries(values)) flat[k] = Array.isArray(v) ? v.join(', ') : v
    if (photoUrl) flat.photo = photoUrl
    try {
      await submitRequest('surrender-intake', flat)
      clearDraft()
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          <img src="/ohrr-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Intake form received</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Thank you, {(values.name as string) || 'friend'}. OHRR will be in touch to confirm space
          and arrange a time. Remember to bring this rabbit’s supplies and the surrender donation on
          the day of surrender.
        </p>
        <Link to="/surrender" className={`${btn.blue} mx-auto`}>
          Back to surrender info
        </Link>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <Link
        to="/surrender"
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Surrender info
      </Link>

      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">
          Rabbit intake form
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">{cfg.title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Please contact OHRR first to confirm there’s space. This form goes straight to OHRR — it
          doesn’t complete the surrender on its own.
        </p>
      </div>
      <form
        name="surrender-intake"
        onSubmit={onSubmit}
        className="space-y-5"
      >
        <input type="hidden" name="type" value={cfg.title} />
        {restored && (
          <p className="rounded-xl bg-brand-blue-50/70 px-3 py-2 text-xs font-semibold text-brand-blue">{DRAFT_NOTE}</p>
        )}

        <p className="hidden">
          <label>
            Don’t fill this out: <input name="bot-field" />
          </label>
        </p>

        {cfg.sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <div>
              <h2 className="font-display text-base font-extrabold text-ink">{section.title}</h2>
              {section.intro && <p className="text-xs leading-relaxed text-slate-500">{section.intro}</p>}
            </div>
            <Card className="space-y-3.5">
              {section.fields.map((f) => (
                <SchemaField key={f.name} f={f} values={values} setVal={setVal} toggle={toggle} />
              ))}
            </Card>
          </section>
        ))}

        {/* A photo of the rabbit — the first thing intake wants to see */}
        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold text-ink">A photo</h2>
          <Card>
            <PhotoField
              label="Photo of the rabbit"
              hint="It helps OHRR judge age, breed and condition before the rabbit arrives."
              value={photoUrl}
              onChange={setPhotoUrl}
              onBusyChange={setPhotoBusy}
            />
          </Card>
        </section>

        {/* Relinquishment agreement */}
        <section className="space-y-3">
          <h2 className="font-display text-base font-extrabold text-ink">Relinquishment agreement</h2>
          <Card className="space-y-3">
            <ul className="space-y-2.5">
              {cfg.agreement.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-slate-600">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0 text-brand-blue" />
                  {line}
                </li>
              ))}
            </ul>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-blue-50/60 p-3">
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue"
              />
              <span className="text-sm font-semibold text-ink">
                I have read and agree to the terms above, and I am releasing all rights and claims
                for this rabbit to Ohio House Rabbit Rescue, Inc.
              </span>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Signature — type your full legal name
              <input
                name="signature"
                className={inputClass}
                required
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Full name"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Date
              <input
                type="date"
                name="agreementDate"
                className={inputClass}
                required
                value={signDate}
                onChange={(e) => setSignDate(e.target.value)}
              />
            </label>
          </Card>
        </section>

        {status === 'error' && (
          <p className="text-sm font-semibold text-red-600">
            Something went wrong — please try again, or email OHRR at {surrenderContact.email}.
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className={`${btn.primary} w-full disabled:opacity-60`}
        >
          {status === 'submitting' ? 'Sending…' : 'Submit intake form'}
        </button>
      </form>

      <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
        Questions? Email{' '}
        <a href={`mailto:${surrenderContact.email}`} className="font-semibold text-brand-blue underline">
          {surrenderContact.email}
        </a>
        .
      </p>
    </Screen>
  )
}
