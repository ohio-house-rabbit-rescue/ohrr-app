// The Bunny Help box on the app's Home. It poses the questions people actually
// have — "Did my bunny stop eating?" — as a rotating prompt and three tappable
// ones, with the top matches appearing underneath as you type. Enter (or "See
// all") opens the full Bunny Help page with the same words.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { useCareTopics } from './useTopics'
import { buildIndex, cleanQuery, hasEmergency, searchTopics } from './search'
import { UrgencyChip } from './ui'
import { topicHref } from './HelpSearch'

// Real questions, each landing on one of OHRR's topics.
const QUESTIONS = [
  'Did my bunny stop eating?',
  'Why is my bunny hiding?',
  'Does my bunny have diarrhea?',
  'Why is my bunny digging the carpet?',
  'What can my bunny eat?',
  'Why is my bunny peeing outside the box?',
]
const QUICK = QUESTIONS.slice(0, 3)

export default function HomeSearch() {
  const { topics } = useCareTopics()
  const index = useMemo(() => buildIndex(topics), [topics])
  const [q, setQ] = useState('')
  const [prompt, setPrompt] = useState(0)
  const navigate = useNavigate()
  // Rotate the question in the empty box every few seconds.
  useEffect(() => {
    if (q) return
    const id = window.setInterval(() => setPrompt((p) => (p + 1) % QUESTIONS.length), 3500)
    return () => window.clearInterval(id)
  }, [q])
  const cleaned = cleanQuery(q)
  const active = cleaned.length >= 2
  const results = useMemo(() => (active ? searchTopics(index, q, 3) : []), [index, q, active])
  const emergency = hasEmergency(results)
  const allHref = `/my-bunny/help${active ? `?q=${encodeURIComponent(cleaned)}` : ''}`

  return (
    <div className="space-y-2">
      <p className="font-display text-[15px] font-extrabold text-ink">Is something up with your bunny?</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          navigate(allHref)
        }}
        className="relative"
      >
        <Icon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={QUESTIONS[prompt]}
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Ask about your bunny — search Bunny Help"
          className="w-full rounded-full border border-brand-blue/30 bg-brand-blue-50/50 py-3 pl-11 pr-4 text-[15px] text-ink outline-none transition placeholder:text-slate-500 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20"
        />
      </form>
      {!active && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => setQ(question)}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:border-brand-blue hover:text-brand-blue"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className={`overflow-hidden rounded-2xl border ${emergency ? 'border-red-200' : 'border-slate-200/80'} bg-white`}>
          {emergency && (
            <p className="bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700">
              This could be an emergency — call a rabbit-savvy vet now.
            </p>
          )}
          {results.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {results.map((t) => (
                <li key={t.id}>
                  <Link to={topicHref(t, { q: cleaned })} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[15px] font-extrabold text-ink">{t.title}</span>
                      <span className="block truncate text-xs text-slate-500">{t.summary}</span>
                    </span>
                    <UrgencyChip urgency={t.urgency} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3.5 py-2.5 text-sm text-slate-500">No topic matches yet — see all topics or ask OHRR.</p>
          )}
          <Link to={allHref} className="flex items-center justify-between px-3.5 py-2.5 text-sm font-bold text-brand-blue hover:bg-brand-blue-50/60">
            See all Bunny Help topics <Icon name="chevron" size={15} />
          </Link>
        </div>
      )}
    </div>
  )
}
