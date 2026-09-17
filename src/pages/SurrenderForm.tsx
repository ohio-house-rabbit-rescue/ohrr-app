import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { intakeConfig, type IntakeType, type FormField } from '../data/surrenderForm'
import { surrenderContact } from '../data/surrender'
import { Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&')
}

const todayISO = () => new Date().toISOString().slice(0, 10)

type Values = Record<string, string | string[]>

export default function SurrenderForm() {
  const [params] = useSearchParams()
  const type: IntakeType = params.get('type') === 'good-samaritan' ? 'good-samaritan' : 'owner'
  const cfg = useMemo(() => intakeConfig(type), [type])

  const [values, setValues] = useState<Values>({})
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
      'form-name': 'surrender-intake',
      type: cfg.title,
      signature,
      agreement: 'Agreed to relinquishment terms',
      agreementDate: signDate,
    }
    for (const [k, v] of Object.entries(values)) flat[k] = Array.isArray(v) ? v.join(', ') : v
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(flat),
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

      {/* name + data-netlify enable Netlify Forms; a matching hidden form in
          index.html lets Netlify detect it at build time. */}
      <form
        name="surrender-intake"
        method="POST"
        data-netlify="true"
        netlify-honeypot="bot-field"
        onSubmit={onSubmit}
        className="space-y-5"
      >
        <input type="hidden" name="form-name" value="surrender-intake" />
        <input type="hidden" name="type" value={cfg.title} />
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
                <Field key={f.name} f={f} values={values} setVal={setVal} toggle={toggle} />
              ))}
            </Card>
          </section>
        ))}

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
            Something went wrong — please try again, or call OHRR at {surrenderContact.phone}.
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
        Questions? Call {surrenderContact.phone} or email{' '}
        <a href={`mailto:${surrenderContact.email}`} className="font-semibold text-brand-blue underline">
          {surrenderContact.email}
        </a>
        .
      </p>
    </Screen>
  )
}

function Field({
  f,
  values,
  setVal,
  toggle,
}: {
  f: FormField
  values: Values
  setVal: (name: string, v: string | string[]) => void
  toggle: (name: string, opt: string) => void
}) {
  const val = values[f.name]

  if (f.type === 'radio') {
    return (
      <div>
        <span className="block text-sm font-semibold text-slate-700">
          {f.label}
          {f.required && <span className="text-brand-orange"> *</span>}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {f.options!.map((o) => {
            const active = val === o
            return (
              <button
                key={o}
                type="button"
                onClick={() => setVal(f.name, active ? '' : o)}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-bold transition',
                  active
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                ].join(' ')}
              >
                {o}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (f.type === 'checkboxes') {
    const arr = Array.isArray(val) ? val : []
    return (
      <div>
        <span className="block text-sm font-semibold text-slate-700">{f.label}</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {f.options!.map((o) => {
            const active = arr.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(f.name, o)}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-bold transition',
                  active
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                ].join(' ')}
              >
                {o}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (f.type === 'textarea') {
    return (
      <label className="block text-sm font-semibold text-slate-700">
        {f.label}
        {f.required && <span className="text-brand-orange"> *</span>}
        <textarea
          name={f.name}
          rows={3}
          required={f.required}
          value={(val as string) ?? ''}
          onChange={(e) => setVal(f.name, e.target.value)}
          className={inputClass}
        />
      </label>
    )
  }

  return (
    <label className="block text-sm font-semibold text-slate-700">
      {f.label}
      {f.required && <span className="text-brand-orange"> *</span>}
      <input
        type={f.type}
        name={f.name}
        required={f.required}
        value={(val as string) ?? ''}
        onChange={(e) => setVal(f.name, e.target.value)}
        placeholder={f.placeholder}
        className={inputClass}
      />
    </label>
  )
}
