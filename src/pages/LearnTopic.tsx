import { Link, useParams } from 'react-router-dom'
import { CARE_DISCLAIMER } from '../data/careArticles'
import {
  useCareArticles,
  asIconName,
  fallbackArticles,
  articleSource,
  type CareArticle,
} from '../lib/careContent'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { ArticleBody } from '../components/ArticleBody'
import { Spinner } from '../components/staffui'

function MoreTopics({ items }: { items: { id: string; title: string; icon: IconName }[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2.5 pt-1">
      <SectionLabel>More care topics</SectionLabel>
      <div className="grid grid-cols-1 gap-2">
        {items.map((o) => (
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
  )
}

function TipCallout({ tip }: { tip: string }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
      <Icon name="info" size={16} className="mt-0.5 shrink-0" />
      <p>
        <strong className="font-bold">Good to know:</strong> {tip}
      </p>
    </div>
  )
}

function NotFound() {
  return (
    <Screen className="space-y-4 text-center">
      <h1 className="pt-6 font-display text-xl font-extrabold text-ink">Topic not found</h1>
      <Link to="/learn" className={`${btn.blue} mx-auto`}>
        All care topics
      </Link>
    </Screen>
  )
}

function ArticleView({ article, all }: { article: CareArticle; all: CareArticle[] }) {
  const others = all
    .filter((a) => a.slug !== article.slug)
    .slice(0, 4)
    .map((a) => ({ id: a.slug, title: a.title, icon: asIconName(a.icon) }))
  const source = articleSource(article.slug)
  const isVetTopic = /vet|spay|health/i.test(article.slug)
  return (
    <>
      <PageHeader icon={asIconName(article.icon)} title={article.title} subtitle={article.summary} />
      <Screen className="space-y-4">
        <Link
          to="/learn"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Rabbit Care
        </Link>
        <Card>
          <ArticleBody body={article.body} />
        </Card>
        {article.tip && <TipCallout tip={article.tip} />}
        {isVetTopic && (
          <Link to="/vets" className={`${btn.primary} w-full`}>
            Find a rabbit-savvy vet <Icon name="chevron" size={16} />
          </Link>
        )}
        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.outline} w-full`}
          >
            Read the original article <Icon name="external" size={14} />
          </a>
        )}
        <MoreTopics items={others} />
        <p className="px-1 text-xs leading-relaxed text-slate-400">{CARE_DISCLAIMER}</p>
      </Screen>
    </>
  )
}

export default function LearnTopic() {
  const { id } = useParams()
  const live = useCareArticles()
  const articles = live && live.length > 0 ? live : fallbackArticles()
  const article = articles.find((a) => a.slug === id) ?? null

  if (article)
    return <ArticleView article={article} all={articles.filter((a) => (a.section ?? 'care') === (article.section ?? 'care'))} />
  if (live === null) {
    // Still loading — the slug may be a staff-written article.
    return (
      <Screen>
        <Spinner />
      </Screen>
    )
  }
  return <NotFound />
}
