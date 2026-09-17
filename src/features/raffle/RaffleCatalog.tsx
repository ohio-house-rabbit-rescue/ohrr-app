// Midwest BunFest Silent Auction — the public catalog. Shows every PUBLISHED
// item (RLS enforces this; the hook filters too): available items first, then
// items already won (badged "Won", never naming a winner). Hiding an item is
// staff unpublishing it. Session close times are never shown here.
// Deliberately carries no rules/pricing/how-it-works copy — the only optional
// line is the intro text staff set in "Auction setup".
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, Badge, SegTabs } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useAuctionItems, useAuctionSettings } from './useRaffleItems'
import { RafflePhoto } from './RafflePhoto'
import { formatValue, sessionLabel, type AuctionItem } from './types'

const FILTERS = ['All', 'Morning', 'Afternoon'] as const
type Filter = (typeof FILTERS)[number]

// Session pill: keep the two timed sessions visually distinct.
export function SessionBadge({ session }: { session: string }) {
  const tone = session === 'morning' ? 'blue' : session === 'afternoon' ? 'orange' : 'slate'
  return <Badge tone={tone}>{sessionLabel(session)}</Badge>
}

function ItemCard({ item }: { item: AuctionItem }) {
  const value = formatValue(item.value_cents)
  const won = item.status === 'won'
  return (
    <Link
      to={`/bunfest/auction/${item.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <RafflePhoto title={item.title} photo={item.photo_url} className={won ? 'opacity-70' : ''} />
        {won && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-lg bg-ink/85 px-2 py-1 font-display text-xs font-black uppercase tracking-wide text-white shadow-sm">
            Won
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
          {value && <span className="shrink-0 text-sm font-bold text-emerald-600">{value}</span>}
        </div>
        {item.donated_by && (
          <p className="mt-1 truncate text-xs font-semibold text-slate-400">Donated by {item.donated_by}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <SessionBadge session={item.session} />
            {won && <Badge tone="slate">Won</Badge>}
          </span>
          <Icon
            name="chevron"
            size={18}
            className="shrink-0 text-slate-300 transition group-hover:text-brand-orange"
          />
        </div>
      </div>
    </Link>
  )
}

export default function RaffleCatalog() {
  const items = useAuctionItems()
  const settings = useAuctionSettings()
  const [filter, setFilter] = useState<Filter>('All')
  const [availableOnly, setAvailableOnly] = useState(false)

  // "Morning" / "Afternoon" include all-day items — they're on the table then too.
  const list = useMemo(() => {
    let all = items ?? []
    if (filter === 'Morning') all = all.filter((i) => i.session === 'morning' || i.session === 'all-day')
    if (filter === 'Afternoon') all = all.filter((i) => i.session === 'afternoon' || i.session === 'all-day')
    if (availableOnly) all = all.filter((i) => i.status === 'available')
    return all
  }, [items, filter, availableOnly])

  const intro = settings?.intro_text?.trim()

  return (
    <>
      <PageHeader icon="award" title="Silent Auction" subtitle="Midwest BunFest 2026" />
      <Screen className="space-y-4">
        <Link
          to="/bunfest"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Midwest BunFest
        </Link>

        {intro && <p className="px-1 text-[13px] leading-relaxed text-slate-500">{intro}</p>}

        {items !== null && items.length > 0 && (
          <div className="space-y-2">
            <SegTabs options={FILTERS} value={filter} onChange={setFilter} />
            <button
              type="button"
              onClick={() => setAvailableOnly((v) => !v)}
              aria-pressed={availableOnly}
              className={[
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition',
                availableOnly
                  ? 'bg-brand-orange text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${availableOnly ? 'bg-white' : 'bg-emerald-500'}`}
              />
              Available only
            </button>
          </div>
        )}

        {items === null ? (
          <div className="grid grid-cols-1 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="aspect-[4/3] w-full animate-pulse bg-slate-100" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-slate-600">No items yet — check back closer to BunFest.</p>
          </Card>
        ) : list.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-slate-600">Nothing matches these filters right now.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {list.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Screen>
    </>
  )
}
