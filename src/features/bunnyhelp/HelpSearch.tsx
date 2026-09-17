// The "My bunny is…" box. Fuzzy-matches what the person types against OHRR's
// topics, puts the emergency card on top whenever an emergency topic matches,
// and offers "Ask OHRR" (email) + the vet directory when nothing matches.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { EmergencyCard, VetDirectoryLink } from '../mybunny/ui'
import { useCareTopics } from './useTopics'
import { buildIndex, cleanQuery, hasEmergency, searchTopics } from './search'
import { UrgencyChip } from './ui'
import { askOhrrHref, type CareTopic } from './types'

export function topicHref(t: CareTopic, opts: { bunnyId?: string; q?: string } = {}): string {
  const p = new URLSearchParams()
  if (opts.bunnyId) p.set('bunny', opts.bunnyId)
  if (opts.q) p.set('q', opts.q)
  const s = p.toString()
  return `/my-bunny/help/${t.slug}${s ? `?${s}` : ''}`
}

export default function HelpSearch({
  bunnyId,
  bunnyName,
  initialQuery = '',
  compact = false,
}: {
  bunnyId?: string
  bunnyName?: string
  initialQuery?: string
  /** Hides the "Browse all topics" link (used on the browse page itself). */
  compact?: boolean
}) {
  const { topics } = useCareTopics()
  const index = useMemo(() => buildIndex(topics), [topics])
  const [q, setQ] = useState(initialQuery)
  const cleaned = cleanQuery(q, bunnyName)
  const active = cleaned.length >= 2
  const results = useMemo(
    () => (active ? searchTopics(index, q, 6, bunnyName) : []),
    [index, q, active, bunnyName],
  )
  const emergency = hasEmergency(results)

  return (
    <Card className="space-y-3">
      <label className="block">
        <span className="font-display text-[16px] font-extrabold text-ink">
          {bunnyName ? `${bunnyName} is…` : 'My bunny is…'}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
          Describe what you’re seeing — “not eating”, “chewing cords”, “peeing outside the box”. You’ll get
          OHRR’s own guidance, never a diagnosis.
        </span>
        <span className="relative mt-2 block">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="not eating · digging the carpet · hiding"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="What is your bunny doing?"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          />
        </span>
      </label>

      {emergency && <EmergencyCard />}

      {active && results.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
          {results.map((t) => (
            <li key={t.id}>
              <Link
                to={topicHref(t, { bunnyId, q: cleaned })}
                className="group flex items-start gap-3 px-3.5 py-3 transition hover:bg-slate-50"
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
            </li>
          ))}
        </ul>
      )}

      {active && results.length === 0 && (
        <div className="space-y-2.5 rounded-2xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold text-ink">No matching topic yet.</p>
          <p className="text-xs leading-relaxed text-slate-500">
            Ask OHRR by email and they’ll point you in the right direction. For anything urgent, call a
            rabbit-savvy vet instead of waiting for a reply.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={askOhrrHref(cleaned, bunnyName)} className={`${btn.blue} px-4 py-2`}>
              <Icon name="mail" size={15} /> Ask OHRR
            </a>
            <VetDirectoryLink label="Find a vet" className="px-4 py-2" />
          </div>
        </div>
      )}

      {!compact && (
        <Link
          to={bunnyId ? `/my-bunny/help?bunny=${encodeURIComponent(bunnyId)}` : '/my-bunny/help'}
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          Browse all topics <Icon name="chevron" size={14} />
        </Link>
      )}
    </Card>
  )
}
