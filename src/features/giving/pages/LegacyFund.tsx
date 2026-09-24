// /info/legacy-fund — the OHRR Legacy Fund: a gift in a will, trust or IRA, or
// $1,000 or more in a year, and the Rescue Rabbit Guardians who have given one.
// OHRR (2026-09-24): honor these people and promote it as an option; follow the
// live site's details for now. So the words are the live page's (staff edit them
// as the 'legacy-fund' page under Care guides & pages), the contact is the one it
// names, its "Request more info" form reaches the staff Inbox ('legacy-info'),
// and the Guardians — a picture on the live site — are a list staff keep
// (../guardians.ts). The website's page is the desktop mirror (src/pages/LegacyFund.tsx).
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageHeader, Screen, Card, IconTile, btn } from '../../../components/ui'
import { Icon, type IconName } from '../../../components/icons'
import { ArticleBody } from '../../../components/ArticleBody'
import { inputClass } from '../../../components/SchemaField'
import { useCareArticles } from '../../../lib/careContent'
import { submitRequest } from '../../../lib/requests'
import { givingOptions } from '../../../data/giving'
import { LEGACY_BODY, LEGACY_CONTACT } from '../../../data/legacyFund'
import { useGuardians } from '../guardians'

const DONATE = givingOptions.find((g) => g.id === 'donate')?.url ?? 'https://ohiohouserabbitrescue.org/support-ohrr/donate/'

/** Scroll to one of the screen's three parts (scroll-mt keeps it clear of the top bar). */
function jump(id: string, smooth = true) {
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
}

/* Like ActionCard, but it moves down the screen instead of opening another one. */
function JumpCard({
  target,
  title,
  subtitle,
  icon,
  tone = 'blue',
}: {
  target: string
  title: string
  subtitle: string
  icon: IconName
  tone?: 'blue' | 'orange'
}) {
  return (
    <button
      type="button"
      onClick={() => jump(target)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      <IconTile name={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
      </span>
      <Icon name="chevron" size={22} className="shrink-0 rotate-90 text-slate-300 transition group-hover:text-brand-orange" />
    </button>
  )
}

export default function LegacyFund() {
  const articles = useCareArticles()
  const page = articles?.find((a) => a.slug === 'legacy-fund')
  const body = page?.body || LEGACY_BODY
  const years = useGuardians()
  const latest = years?.[0]
  const { hash } = useLocation()

  // Staff → Rescue Rabbit Guardians links to /info/legacy-fund#guardians.
  useEffect(() => {
    if (hash && years) jump(hash.slice(1), false)
  }, [hash, years])

  return (
    <>
      <PageHeader
        icon="gift"
        title="OHRR Legacy Fund"
        subtitle="Giving bunnies a bright tomorrow. Remember the rabbits in your will, trust or IRA, or with a larger gift today, and become a Rescue Rabbit Guardian."
      />
      <Screen className="space-y-6">
        <Link to="/support" className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark">
          <Icon name="arrowLeft" size={16} /> Support OHRR
        </Link>

        {/* The three things people come here for, all on the first screen */}
        <div className="grid grid-cols-1 gap-3">
          <JumpCard target="ways" icon="gift" title="Ways to give to the fund" subtitle="A will, trust or IRA, or a gift today" />
          <JumpCard
            target="guardians"
            icon="heart"
            tone="orange"
            title="Rescue Rabbit Guardians"
            subtitle={latest ? `Thank you to our ${latest.year} Guardians` : 'Thank you to our Guardians'}
          />
          <JumpCard target="ask" icon="mail" title="Ask about the Legacy Fund" subtitle="Or tell us you’ve included OHRR" />
        </div>

        <section id="ways" className="scroll-mt-20 space-y-3">
          <img
            src="/img/news/ohrr-legacy-fund.webp"
            alt="OHRR Legacy Fund — giving bunnies a bright tomorrow. Guardians receive recognition on the OHRR website and at the Adoption Center."
            width={1024}
            height={603}
            className="h-auto w-full rounded-2xl border border-slate-200/80 bg-white shadow-sm"
            loading="lazy"
          />
          <Card>
            <ArticleBody body={body} />
          </Card>
          <Card className="space-y-1.5">
            <p className="font-display text-[15px] font-extrabold text-brand-blue">Already included OHRR?</p>
            <p className="text-sm leading-relaxed text-slate-600">
              Or want to talk about a gift? Contact {LEGACY_CONTACT.name} at{' '}
              <a href={`mailto:${LEGACY_CONTACT.email}`} className="break-all font-semibold text-brand-blue underline underline-offset-2">
                {LEGACY_CONTACT.email}
              </a>
              , or use the form below.
            </p>
            <button type="button" onClick={() => jump('ask')} className="inline-flex min-h-[40px] items-center gap-1 text-sm font-bold text-brand-orange">
              Ask about the Legacy Fund <Icon name="chevron" size={14} className="rotate-90" />
            </button>
          </Card>
        </section>

        <section id="guardians" className="scroll-mt-20 rounded-2xl border border-brand-blue/10 bg-brand-blue-50 p-4">
          <h2 className="font-display text-lg font-extrabold text-ink">
            {latest ? `${latest.year} Rescue Rabbit Guardians` : 'Rescue Rabbit Guardians'}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            Thank you to our Rescue Rabbit Guardians for your donations and future gifts. You are helping us give the bunnies
            of Ohio House Rabbit Rescue a bright today and tomorrow. We are so grateful to have your support.
          </p>
          {years === null ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : (
            latest && <NameColumns names={latest.names.map((g) => g.display_name)} />
          )}
          {years && years.length > 1 && (
            <details className="mt-4">
              <summary className="min-h-[40px] cursor-pointer py-2 text-sm font-bold text-brand-blue">Earlier years</summary>
              {years.slice(1).map((y) => (
                <div key={y.year} className="mt-3">
                  <p className="font-display text-base font-extrabold text-ink">{y.year}</p>
                  <NameColumns names={y.names.map((g) => g.display_name)} small />
                </div>
              ))}
            </details>
          )}
          <p className="mt-5 text-sm leading-relaxed text-slate-700">
            You can become a Rescue Rabbit Guardian too, through future gifts or donations you make today.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button type="button" onClick={() => jump('ask')} className={`${btn.blue} w-full`}>
              Ask about the Legacy Fund
            </button>
            <a href={DONATE} target="_blank" rel="noopener noreferrer" className={`${btn.outline} w-full bg-white`}>
              Donate today <Icon name="external" size={14} />
            </a>
          </div>
        </section>

        <section id="ask" className="scroll-mt-20 space-y-3">
          <div className="px-1">
            <h2 className="font-display text-lg font-extrabold text-ink">Request more info</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              About the OHRR Legacy Fund, a planned gift or becoming a Rescue Rabbit Guardian. Only OHRR’s team sees this.
            </p>
          </div>
          <AskForm />
          <p className="px-1 text-sm text-slate-600">
            Rather email?{' '}
            <a href={`mailto:${LEGACY_CONTACT.email}`} className="break-all font-semibold text-brand-blue underline underline-offset-2">
              {LEGACY_CONTACT.email}
            </a>
          </p>
          <Link to="/support" className="inline-flex min-h-[40px] items-center gap-1 px-1 text-sm font-bold text-brand-blue">
            <Icon name="arrowLeft" size={16} /> All ways to give
          </Link>
        </section>
      </Screen>
    </>
  )
}

/* Two columns on a phone, reading down each column so the A–Z order holds. */
function NameColumns({ names, small = false }: { names: string[]; small?: boolean }) {
  return (
    <ul className={`mt-4 columns-2 gap-4 ${small ? 'text-[13px]' : 'text-sm'}`}>
      {names.map((n) => (
        <li key={n} className="break-inside-avoid py-1 font-semibold leading-snug text-slate-800">
          {n}
        </li>
      ))}
    </ul>
  )
}

function AskForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', 'bot-field': '' })
  const [included, setIncluded] = useState(false)
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('busy')
    setError(null)
    try {
      await submitRequest('legacy-info', {
        ...form,
        included: included ? 'Yes — has already included OHRR in their plans' : '',
      })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that right now.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <Card className="space-y-2 border-green-200 bg-green-50/60">
        <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
          <Icon name="check" size={18} className="text-green-700" /> Thank you
        </p>
        <p className="text-sm leading-relaxed text-slate-700">
          Your message is with OHRR and someone will be in touch. We look forward to thanking you.
        </p>
      </Card>
    )
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Your name
          <input className={inputClass} required value={form.name} onChange={set('name')} autoComplete="name" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input className={inputClass} type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Phone <span className="font-normal text-slate-400">(optional)</span>
          <input className={inputClass} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Your question or message <span className="font-normal text-slate-400">(optional)</span>
          <textarea className={inputClass} rows={4} value={form.message} onChange={set('message')} />
        </label>
        <label className="flex items-start gap-3 py-1 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue"
            checked={included}
            onChange={(e) => setIncluded(e.target.checked)}
          />
          I’ve already included OHRR in my will, trust or beneficiary plans
        </label>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form['bot-field']} onChange={set('bot-field')} />
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={status === 'busy'} className={`${btn.primary} w-full disabled:opacity-60`}>
          {status === 'busy' ? 'Sending…' : 'Send'}
        </button>
      </Card>
    </form>
  )
}
