import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { helpIntro, faqCategories, type FaqItem } from '../data/help'
import { ohrr } from '../data/ohrr'
import { telHref, useOrgProfile } from '../lib/orgProfile'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'

function FaqRow({ item }: { item: FaqItem }) {
  return (
    <details className="group border-b border-slate-100 last:border-b-0">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-ink">
        {item.q}
        <Icon
          name="chevron"
          size={16}
          className="shrink-0 rotate-90 text-slate-300 transition group-open:-rotate-90"
        />
      </summary>
      <div className="px-4 pb-3.5">
        <p className="text-sm leading-relaxed text-slate-600">{item.a}</p>
        {item.link &&
          (item.link.to ? (
            <Link
              to={item.link.to}
              className="mt-2.5 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
            >
              {item.link.label} <Icon name="chevron" size={14} />
            </Link>
          ) : (
            <a
              href={item.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
            >
              {item.link.label} <Icon name="external" size={13} />
            </a>
          ))}
      </div>
    </details>
  )
}

export default function Help() {
  const org = useOrgProfile()
  const [params] = useSearchParams()
  const from = params.get('from') ? decodeURIComponent(params.get('from')!) : '/'
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return []
    return faqCategories
      .flatMap((c) => c.items)
      .filter((it) => `${it.q} ${it.a}`.toLowerCase().includes(q))
  }, [q])

  return (
    <>
      <PageHeader icon="help" title="Help & FAQ" subtitle={helpIntro} />
      <Screen className="space-y-6">
        {from !== '/' && (
          <Link
            to={from}
            className="-mt-1 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            <Icon name="arrowLeft" size={16} /> Back
          </Link>
        )}

        {/* Support hub — reach a human */}
        <Card className="border-brand-orange/25 bg-brand-orange-50/50">
          <h2 className="font-display text-base font-extrabold text-ink">Still need a hand?</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            OHRR is run by volunteers and happy to help — reach out anytime.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={telHref(org.phone)} className={`${btn.primary} px-4 py-2`}>
              <Icon name="phone" size={15} /> Call OHRR
            </a>
            <a href={`mailto:${ohrr.email}`} className={`${btn.outline} px-4 py-2`}>
              <Icon name="mail" size={15} /> Email OHRR
            </a>
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            {org.phone} · {org.hours}
          </p>
        </Card>

        {/* FAQ filter */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
          <Icon name="search" size={18} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the FAQ…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear" className="shrink-0 text-slate-400 hover:text-slate-600">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>

        {/* Filtered results, or full categorized FAQ */}
        {q ? (
          matches.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {matches.map((it) => (
                <FaqRow key={it.q} item={it} />
              ))}
            </div>
          ) : (
            <p className="px-1 text-sm text-slate-500">
              No FAQ matches “{query}”. Try the global search, or reach out above.
            </p>
          )
        ) : (
          faqCategories.map((cat) => (
            <section key={cat.title} className="space-y-2">
              <SectionLabel>{cat.title}</SectionLabel>
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                {cat.items.map((it) => (
                  <FaqRow key={it.q} item={it} />
                ))}
              </div>
            </section>
          ))
        )}
      </Screen>
    </>
  )
}
