// /volunteer/foster — foster interest form (three short screens). Lands in
// the staff Inbox as 'foster-application'.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fosterSections, fosterAgreement } from '../data/fosterForm'
import { ohrr } from '../data/ohrr'
import { Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { SchemaField, inputClass, type Values } from '../components/SchemaField'
import { useFormDraft, DRAFT_NOTE } from '../lib/formDraft'
import { submitRequest } from '../lib/requests'

export default function FosterForm() {
  const [step, setStep] = useState(0)
  const [values, setValues, clearDraft, restored] = useFormDraft<Values>('foster', {})
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const sections = fosterSections
  const total = sections.length + 1
  const section = sections[step]
  const setVal = (n: string, v: string | string[]) => setValues((s) => ({ ...s, [n]: v }))
  const toggle = (n: string, o: string) =>
    setValues((s) => {
      const cur = Array.isArray(s[n]) ? (s[n] as string[]) : []
      return { ...s, [n]: cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o] }
    })
  const missing = useMemo(
    () => (section ? section.fields.filter((f) => f.required && (Array.isArray(values[f.name]) ? (values[f.name] as string[]).length === 0 : !String(values[f.name] ?? '').trim())) : []),
    [section, values],
  )
  const next = () => {
    if (missing.length) return setError(`Please answer: ${missing.map((f) => f.label.slice(0, 40)).join(' · ')}`)
    setError(null)
    setStep((s) => s + 1)
    window.scrollTo({ top: 0 })
  }
  const submit = async () => {
    if (!agreed || !signature.trim()) return setError('Please tick the statement and type your name.')
    setStatus('submitting')
    setError(null)
    const flat: Record<string, string> = {}
    for (const s of sections) for (const f of s.fields) {
      const v = values[f.name]
      const str = Array.isArray(v) ? v.join(', ') : String(v ?? '')
      if (str.trim()) flat[f.name] = str
    }
    flat.agreed = fosterAgreement[0]
    flat.signature = signature.trim()
    try {
      await submitRequest('foster-application', flat)
      clearDraft()
      setStatus('done')
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that right now.')
      setStatus('idle')
    }
  }

  if (status === 'done')
    return (
      <Screen className="space-y-4 text-center">
        <img src="/ohrr-mark.png" alt="" className="mx-auto mt-6 h-14 w-14 object-contain" />
        <h1 className="font-display text-xl font-extrabold text-ink">Thank you, {(values.name as string) || 'friend'}!</h1>
        <p className="text-sm leading-relaxed text-slate-600">OHRR will be in touch about fostering — what it supplies, what it expects, and which rabbit might suit your home.</p>
        <Link to="/volunteer" className={`${btn.blue} mx-auto`}>
          Back to Volunteer
        </Link>
      </Screen>
    )

  return (
    <Screen className="space-y-5">
      <div className="flex items-center justify-between">
        {step === 0 ? (
          <Link to="/volunteer" className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
            <Icon name="arrowLeft" size={16} /> Volunteer
          </Link>
        ) : (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
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
      {restored && step === 0 && (
        <p className="rounded-xl bg-brand-blue-50/70 px-3 py-2 text-xs font-semibold text-brand-blue">{DRAFT_NOTE}</p>
      )}
      {step === 0 && (
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">Foster a rabbit</p>
          <h1 className="mt-1 font-display text-2xl font-black text-ink">Tell us about you</h1>
          <p className="mt-1 text-sm text-slate-500">
            Three short screens. Not sure fostering is for you?{' '}
            <Link to="/info/foster-a-rabbit" className="font-semibold text-brand-blue">
              Read what it involves
            </Link>
            .
          </p>
        </div>
      )}
      {section ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">{section.title}</h2>
          <Card className="space-y-3.5">
            {section.fields.map((f) => (
              <SchemaField key={f.name} f={f} values={values} setVal={setVal} toggle={toggle} />
            ))}
          </Card>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-ink">One last thing</h2>
          <Card className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-blue-50/60 p-3">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue" />
              <span className="text-sm text-ink">{fosterAgreement[0]}</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Type your name
              <input className={inputClass} value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Full name" />
            </label>
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
          {status === 'submitting' ? 'Sending…' : 'Send'}
        </button>
      )}
      <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
        Questions? Email{' '}
        <a href={`mailto:${ohrr.email}?subject=Fostering`} className="font-semibold text-brand-blue underline">
          {ohrr.email}
        </a>
      </p>
    </Screen>
  )
}
