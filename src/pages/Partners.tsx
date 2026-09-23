import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { REGIONS, US_STATES } from '../data/partners'
import { useRescuePartners } from '../features/bunfest/content'
import { PageHeader, Screen, Badge, SampleNote, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'

const AT_BUNFEST = 'At BunFest'

function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function Partners({
  base = '/bunfest/partners',
  title = 'Rescue Partners',
  subtitle,
}: {
  base?: string
  title?: string
  subtitle?: string
}) {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<string>('All')
  const { items: partners, source } = useRescuePartners()

  // "At BunFest" first when the directory knows who is coming this year, then
  // the regions actually present, in display order.
  const someAtBunfest = partners.some((p) => p.atBunfest)
  const regionTabs = useMemo(
    () => [
      'All',
      ...(someAtBunfest ? [AT_BUNFEST] : []),
      ...REGIONS.filter((r) => partners.some((p) => p.region === r)),
    ],
    [partners, someAtBunfest],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return partners.filter((p) => {
      const inRegion =
        region === 'All' ? true : region === AT_BUNFEST ? !!p.atBunfest : p.region === region
      const stateName = p.state ? (US_STATES[p.state] ?? '') : ''
      const hay = `${p.name} ${p.location} ${p.city ?? ''} ${p.state ?? ''} ${stateName} ${p.region ?? ''}`.toLowerCase()
      return inRegion && (!q || hay.includes(q))
    })
  }, [query, region, partners])

  return (
    <>
      <PageHeader
        icon="users"
        title={title}
        subtitle={
          subtitle ??
          (someAtBunfest
            ? `${partners.filter((p) => p.atBunfest).length} rescues at BunFest this year, ${partners.length} in the directory.`
            : `${partners.length} rabbit rescues & humane organizations — find one near you.`)
        }
      />
      <Screen className="space-y-4">
        {/* Search by name / state */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
          <Icon name="search" size={18} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or state…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear" className="shrink-0 text-slate-400 hover:text-slate-600">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>

        {/* Filter by region */}
        <SegTabs options={regionTabs} value={region} onChange={setRegion} wrap />
        {source === 'seed' && (
          <SampleNote>
            This directory is the one OHRR researched in 2026. Staff keep it current under
            Staff → BunFest → Rescue partners.
          </SampleNote>
        )}

        {list.length === 0 ? (
          <p className="px-1 pt-2 text-sm text-slate-500">
            No rescues match that. Try a different name, state, or region.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {list.map((p) => (
              <Link
                key={p.id}
                to={`${base}/${p.id}`}
                className={`group flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  p.host ? 'border-brand-blue/40 ring-1 ring-brand-blue/30' : 'border-slate-200/80'
                }`}
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 font-display text-sm font-black text-brand-blue">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-display text-base font-extrabold text-ink">{p.name}</span>
                    {p.host && <Badge tone="blue">Host</Badge>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                    <Icon name="mappin" size={14} className="shrink-0 text-slate-400" /> {p.location}
                  </span>
                </span>
                {p.region && <Badge tone="slate">{p.region}</Badge>}
                <Icon
                  name="chevron"
                  size={18}
                  className="shrink-0 text-slate-300 transition group-hover:text-brand-orange"
                />
              </Link>
            ))}
          </div>
        )}
      </Screen>
    </>
  )
}
