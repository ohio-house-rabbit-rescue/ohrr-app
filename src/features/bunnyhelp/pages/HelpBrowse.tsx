import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, Screen, SectionLabel, SegTabs } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { BackLink } from '../../mybunny/ui'
import { useMyBunny, findBunny } from '../../mybunny/storage'
import HelpSearch, { topicHref } from '../HelpSearch'
import { useCareTopics } from '../useTopics'
import { Disclaimer, UrgencyChip } from '../ui'
import { CATEGORIES, CATEGORY_LABEL, URGENCY_RANK, type TopicCategory } from '../types'

const ALL = 'All'
const FILTERS = [ALL, ...CATEGORIES.map((c) => CATEGORY_LABEL[c])] as const
type Filter = (typeof FILTERS)[number]

function categoryForLabel(label: string): TopicCategory | null {
  return CATEGORIES.find((c) => CATEGORY_LABEL[c] === label) ?? null
}

export default function HelpBrowse() {
  const [params] = useSearchParams()
  const bunnyId = params.get('bunny') ?? undefined
  const data = useMyBunny()
  const bunny = findBunny(data, bunnyId)
  const { topics, source } = useCareTopics()
  const [filter, setFilter] = useState<Filter>(ALL)

  const list = useMemo(() => {
    const cat = filter === ALL ? null : categoryForLabel(filter)
    return topics
      .filter((t) => !cat || t.category === cat)
      .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.sort_order - b.sort_order)
  }, [topics, filter])

  return (
    <>
      <PageHeader
        icon="help"
        title="Bunny Help"
        subtitle="Tell us what your bunny is doing and we’ll point you to OHRR’s own care guidance — never a diagnosis."
      />
      <Screen className="space-y-5">
        <BackLink to={bunny ? `/my-bunny/${bunny.id}` : '/my-bunny'} label={bunny?.name ?? 'My Bunny'} />

        <HelpSearch bunnyId={bunny?.id} bunnyName={bunny?.name} initialQuery={params.get('q') ?? ''} compact />

        <section className="space-y-2.5">
          <SectionLabel>Browse by topic</SectionLabel>
          <SegTabs options={FILTERS} value={filter} onChange={setFilter} wrap />
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {list.map((t) => (
              <Link
                key={t.id}
                to={topicHref(t, { bunnyId: bunny?.id })}
                className="group flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-extrabold text-ink">{t.title}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-500">{t.summary}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <UrgencyChip urgency={t.urgency} />
                  <Icon name="chevron" size={16} className="text-slate-300 transition group-hover:text-brand-orange" />
                </span>
              </Link>
            ))}
            {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No topics here yet.</p>}
          </div>
          {source === 'seed' && (
            <p className="px-1 text-xs text-slate-400">
              Built-in topics drawn from OHRR’s care resources. OHRR staff can edit and add to these.
            </p>
          )}
        </section>

        <Disclaimer className="px-1" />
      </Screen>
    </>
  )
}
