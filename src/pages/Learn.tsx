import { careTopics, CARE_DISCLAIMER } from '../data/care'
import { useCareArticles, asIconName } from '../lib/careContent'
import { PageHeader, Screen, ActionCard } from '../components/ui'

export default function Learn() {
  const live = useCareArticles()
  const useLive = (live?.length ?? 0) > 0

  const items = useLive
    ? live!.map((a) => ({
        id: a.slug,
        title: a.title,
        summary: a.summary,
        icon: asIconName(a.icon),
      }))
    : careTopics.map((t) => ({ id: t.id, title: t.title, summary: t.summary, icon: t.icon }))

  return (
    <>
      <PageHeader
        icon="book"
        title="Rabbit Care"
        subtitle="Good care means happier rabbits — and fewer surrenders. Here are the essentials, right in the app."
      />
      <Screen className="space-y-2.5">
        {items.map((t) => (
          <ActionCard
            key={t.id}
            to={`/learn/${t.id}`}
            title={t.title}
            subtitle={t.summary}
            icon={t.icon}
          />
        ))}
        <p className="px-1 pt-2 text-xs leading-relaxed text-slate-400">{CARE_DISCLAIMER}</p>
      </Screen>
    </>
  )
}
