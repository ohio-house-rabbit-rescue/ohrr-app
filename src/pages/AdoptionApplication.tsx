// /adopt/apply — OHRR's adoption application, one section per screen on the
// phone. Answers are kept on the device until it's sent, so a phone call or a
// closed app doesn't lose twenty minutes of typing. Lands in the staff Inbox.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { applicationSections, applicationAgreement } from '../data/adoptionApplication'
import { ohrr } from '../data/ohrr'
import { Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { SchemaField, inputClass, type Values } from '../components/SchemaField'
import { submitRequest } from '../lib/requests'

const DRAFT_KEY = 'ohrr.adoption-application.draft'
const todayISO = () => new Date().toISOString().slice(0, 10)

export default function AdoptionApplication() {
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Values>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      const saved = raw ? (JSON.parse(raw) as Values) : {}
      const rabbit = params.get('rabbit')
      return rabbit && !saved.rabbit ? { ...saved, rabbit } : saved
    } catch {
      return {}
    }
  })
  const [certify, setCertify] = useState(false)
  const [returnAgree, setReturnAgree] = useState(false)
  const [signature, setSignature] = useState('')
  const [signDate, setSignDate] = useState(todayISO())
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values))
    } catch {
      /* private mode */
    }
  }, [values])

  const setVal = (name: string, v: string | string[]) => setValues((s) => ({ ...s, [name]: v }))
  const toggle = (name: string, opt: string) =>
    setValues((s) => {
      const cur = Array.isArray(s[name]) ? (s[name] as string[]) : []
      return { ...s, [name]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] }
    })

  const sections = applicationSections
  const total = sections.length + 1 // + agreement
  const section = sections[step]

  // Required questions in the current section that are still empty.
  const missing = useMemo(() => {
    if (!section) return []
    return section.fields.filter((f) => {
      if (!f.required) return false
      const v = values[f.name]
      return Array.isArray(v) ? v.length === 0 : !v || !String(v).trim()
    })
  }, [section, values])

  const next = () => {
    if (missing.length > 0) {
      setError(`Please answer: ${missing.map((f) => f.label.split('?')[0].slice(0, 40)).join(' · ')}`)
      return
    }
    setError(null)
    setStep((s) => s + 1)
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    setError(null)
    setStep((s) => Math.max(0, s - 1))
    window.scrollTo({ top: 0 })
  }

  const submit = async () => {
    if (!certify || !returnAgree || !signature.trim()) {
      setError('Please tick both statements and type your name as a signature.')
      return
    }
    setError(null)
    setStatus('submitting')
    const flat: Record<string, string> = {}
    for (const s of sections) for (const f of s.fields) {
      const v = values[f.name]
      if (v == null) continue
      const str = Array.isArray(v) ? v.join(', ') : String(v)
      if (str.trim()) flat[f.name] = str
    }
    flat.certified = applicationAgreement.certify
    flat.returnAgreement = applicationAgreement.returnPolicy
    flat.signature = signature.trim()
    flat.signatureDate = signDate
    try {
      await submitRequest('adoption-application', flat)
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      setStatus('done')
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the application.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <Screen className="space-y-4 text-center">
        <img src="/ohrr-mark.png" alt="" className="mx-auto mt-6 h-14 w-14 object-contain" />
        <h1 className="font-display text-xl font-extrabold text-ink">Application sent</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Thank you, {(values.name as string) || 'friend'}. An adoption facilitator will talk it through with you and set up a two-hour appointment
          at the Adoption Center (usually 12:00 or 2:00 on a Saturday or Sunday).
        </p>
        <Link to="/adopt" className={`${btn.blue} mx-auto`}>
          Back to Adopt
        </Link>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <div className="flex items-center justify-between">
        {step === 0 ? (
          <Link to="/adopt" className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
            <Icon name="arrowLeft" size={16} /> Adopt
          </Link>
        ) : (
          <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
            <Icon name="arrowLeft" size={16} /> Back
          </button>
        )}
        <span className="text-xs font-bold text-slate-400">
          Step {step + 1} of {total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-orange transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      {step === 0 && (
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">Adoption application</p>
          <h1 className="mt-1 font-display text-2xl font-black text-ink">Tell us about you</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Your answers stay on this phone until you send them. Please read the{' '}
            <a href={ohrr.links.policy} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue">
              adoption policy
            </a>{' '}
            first.
          </p>
        </div>
      )}

      {section ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-ink">{section.title}</h2>
            {section.intro && <p className="text-xs leading-relaxed text-slate-500">{section.intro}</p>}
          </div>
          <Card className="space-y-3.5">
            {section.fields.map((f) => (
              <SchemaField key={f.name} f={f} values={values} setVal={setVal} toggle={toggle} />
            ))}
          </Card>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">Agreement</h2>
          <Card className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-blue-50/60 p-3">
              <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue" />
              <span className="text-sm text-ink">{applicationAgreement.certify}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-blue-50/60 p-3">
              <input type="checkbox" checked={returnAgree} onChange={(e) => setReturnAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue" />
              <span className="text-sm text-ink">{applicationAgreement.returnPolicy}</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Signature — type your full name
              <input className={inputClass} required value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Full name" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Date
              <input type="date" className={inputClass} required value={signDate} onChange={(e) => setSignDate(e.target.value)} />
            </label>
            <p className="text-xs leading-relaxed text-slate-500">{applicationAgreement.reserves}</p>
          </Card>
        </section>
      )}

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      {section ? (
        <button type="button" onClick={next} className={`${btn.primary} w-full`}>
          Next <Icon name="chevron" size={16} />
        </button>
      ) : (
        <button type="button" onClick={() => void submit()} disabled={status === 'submitting'} className={`${btn.primary} w-full disabled:opacity-60`}>
          {status === 'submitting' ? 'Sending…' : 'Send my application'}
        </button>
      )}

      <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
        Questions? Call {ohrr.phone} or email{' '}
        <a href={`mailto:${ohrr.email}`} className="font-semibold text-brand-blue underline">
          {ohrr.email}
        </a>
        .
      </p>
    </Screen>
  )
}
