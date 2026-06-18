import { Link, useSearchParams } from 'react-router-dom'
import { helpIntro, headerHelp, helpTopics, helpFor } from '../data/help'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Help() {
  const [params] = useSearchParams()
  const from = params.get('from') ? decodeURIComponent(params.get('from')!) : '/'
  const current = from !== '/' ? helpFor(from) : undefined

  return (
    <>
      <PageHeader icon="help" title="Help" subtitle={helpIntro} />
      <Screen className="space-y-6">
        {/* Contextual: help for the screen you came from */}
        {current && (
          <section className="space-y-2.5">
            <SectionLabel>On this screen</SectionLabel>
            <Card className="border-brand-blue/25 bg-brand-blue-50/40">
              <h2 className="font-display text-lg font-extrabold text-ink">{current.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{current.what}</p>
              {current.tips && (
                <ul className="mt-2.5 space-y-1.5">
                  {current.tips.map((tip) => (
                    <li key={tip} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                      <Icon name="info" size={14} className="mt-0.5 shrink-0 text-brand-blue" />
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
              <Link to={from} className={`${btn.blue} mt-3 px-4 py-2`}>
                <Icon name="arrowLeft" size={15} /> Back to {current.title}
              </Link>
            </Card>
          </section>
        )}

        {/* How to get around */}
        <section className="space-y-2.5">
          <SectionLabel>Getting around</SectionLabel>
          <Card className="divide-y divide-slate-100">
            {headerHelp.map((h) => (
              <div key={h.label} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="font-display text-sm font-extrabold text-ink">{h.label}</span>
                <span className="flex-1 text-sm leading-relaxed text-slate-600">{h.text}</span>
              </div>
            ))}
          </Card>
        </section>

        {/* Full guide — tap any to go there */}
        <section className="space-y-2.5">
          <SectionLabel>All sections</SectionLabel>
          <div className="space-y-2.5">
            {helpTopics.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="group block rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-[15px] font-extrabold text-ink">{t.title}</span>
                  <Icon name="chevron" size={16} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-slate-500">{t.what}</span>
              </Link>
            ))}
          </div>
        </section>
      </Screen>
    </>
  )
}
