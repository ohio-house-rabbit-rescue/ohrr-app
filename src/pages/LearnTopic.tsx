import { Link, useParams } from 'react-router-dom'
import { careTopics, CARE_DISCLAIMER } from '../data/care'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function LearnTopic() {
  const { id } = useParams()
  const topic = careTopics.find((t) => t.id === id)

  if (!topic) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          📖
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Topic not found</h1>
        <Link to="/learn" className={`${btn.blue} mx-auto`}>
          All care topics
        </Link>
      </Screen>
    )
  }

  const t = topic
  const others = careTopics.filter((x) => x.id !== t.id).slice(0, 4)

  return (
    <>
      <PageHeader icon={t.icon} title={t.title} subtitle={t.summary} />
      <Screen className="space-y-4">
        <Link
          to="/learn"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Rabbit Care
        </Link>

        {t.sections.map((s, i) => (
          <Card key={i}>
            {s.heading && (
              <h2 className="font-display text-base font-extrabold text-ink">{s.heading}</h2>
            )}
            {s.body && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{s.body}</p>
            )}
            {s.list && (
              <ul className="mt-2 space-y-2">
                {s.list.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-slate-700">
                    <Icon name="info" size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}

        {t.tip && (
          <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
            <span aria-hidden className="mt-0.5">
              ⚠️
            </span>
            <p>
              <strong className="font-bold">Watch out:</strong> {t.tip}
            </p>
          </div>
        )}

        {t.cta && (
          <Link to={t.cta.to} className={`${btn.primary} w-full`}>
            {t.cta.label}
            <Icon name="chevron" size={16} />
          </Link>
        )}

        {t.link && (
          <a
            href={t.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.outline} w-full`}
          >
            {t.link.label} <Icon name="external" size={14} />
          </a>
        )}

        <div className="space-y-2.5 pt-1">
          <SectionLabel>More care topics</SectionLabel>
          <div className="grid grid-cols-1 gap-2">
            {others.map((o) => (
              <Link
                key={o.id}
                to={`/learn/${o.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm transition hover:border-slate-300 hover:shadow-sm"
              >
                <span className="text-brand-blue">
                  <Icon name={o.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{o.title}</span>
                <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>

        <p className="px-1 text-xs leading-relaxed text-slate-400">{CARE_DISCLAIMER}</p>
      </Screen>
    </>
  )
}
