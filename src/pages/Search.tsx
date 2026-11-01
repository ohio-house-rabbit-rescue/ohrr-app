import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchAll, type SearchItem } from '../data/search'
import { Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { KEYBOARD_MIC_TIP, useVoiceInput } from '../features/scan/voice'

export default function Search() {
  const [params] = useSearchParams()
  const from = params.get('from') ? decodeURIComponent(params.get('from')!) : '/'
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const voice = useVoiceInput((text) => setQuery(text))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => searchAll(query), [query])
  const grouped = useMemo(() => {
    const m = new Map<string, SearchItem[]>()
    for (const r of results) {
      if (!m.has(r.group)) m.set(r.group, [])
      m.get(r.group)!.push(r)
    }
    return [...m.entries()]
  }, [results])

  return (
    <Screen className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to={from}
          aria-label="Close search"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
        >
          <Icon name="arrowLeft" size={18} />
        </Link>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
          <Icon name="search" size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the app…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear"
              className="shrink-0 text-slate-400 hover:text-slate-600"
            >
              <Icon name="x" size={16} />
            </button>
          )}
          {voice.supported && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-label="Search by voice"
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                voice.listening ? 'bg-brand-orange text-ink' : 'bg-brand-blue-50 text-brand-blue hover:bg-brand-blue hover:text-white'
              }`}
            >
              <Icon name="mic" size={15} />
            </button>
          )}
        </div>
      </div>

      {voice.listening && (
        <p className="px-1 text-sm font-semibold text-brand-orange">Listening… say what you’re looking for.</p>
      )}
      {voice.message && <p className="px-1 text-sm font-semibold text-slate-700">{voice.message}</p>}

      {/* Empty state */}
      {!query && (
        <div className="space-y-3 pt-2">
          <p className="px-1 text-sm leading-relaxed text-slate-500">
            Search across the whole app — rabbits, care guides, vendors, volunteer roles, BunFest
            sessions, and more. {voice.supported ? 'Type above or tap the mic to speak.' : `Type above. ${KEYBOARD_MIC_TIP}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {['Adopt', 'Bonding', 'Diet', 'Foster', 'Vendors', 'Donate'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {query && results.length === 0 && (
        <p className="px-1 pt-2 text-sm text-slate-500">
          No matches for “{query}”. Try another word, or browse from the bottom tabs.
        </p>
      )}

      {/* Results */}
      {grouped.map(([group, items]) => (
        <section key={group} className="space-y-2">
          <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            {group}
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {items.map((item) => (
              <Link
                key={item.group + item.to + item.title}
                to={item.to}
                className="flex items-center gap-3 border-b border-slate-100 px-3.5 py-3 last:border-b-0 hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{item.title}</span>
                  <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
                </span>
                <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  )
}
