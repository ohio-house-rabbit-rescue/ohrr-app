// Midwest BunFest Silent Auction — the public catalog. Shows every PUBLISHED
// item: available items first, then items already sold (badged "Sold", never
// naming a winner). Hiding an item is staff unpublishing it.
//
// Update 35 adds online bidding: each card carries the running bid, Buy Now
// price, shipping and the countdown; the top of the page registers a bidder
// or shows their number. The data comes from auction_catalog() (polled every
// 15 s); before that function exists on the database the page falls back to
// the plain table read, with bidding closed. Session close times only appear
// as a countdown once an item is open for bids.
// Deliberately carries no rules/pricing/how-it-works copy — the only optional
// lines are the intro text and bidding note staff set in "Auction setup".
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, Badge, SegTabs, ActionCard, QuietNote } from '../../components/ui'
import { Icon } from '../../components/icons'
import { RafflePhoto } from './RafflePhoto'
import { formatValue, sessionLabel } from './types'
import PresentedBy from '../sponsors/PresentedBy'
import { bidLine, closesIn, money, type AuctionItem, type AuctionSettings } from '../auction/client'
import { shipLine, useCatalog, useRememberedBidder } from '../auction/useAuction'

const FILTERS = ['All', 'Morning', 'Afternoon'] as const
type Filter = (typeof FILTERS)[number]

// Session pill: keep the two timed sessions visually distinct.
export function SessionBadge({ session }: { session: string }) {
  const tone = session === 'morning' ? 'blue' : session === 'afternoon' ? 'orange' : 'slate'
  return <Badge tone={tone}>{sessionLabel(session)}</Badge>
}

/** "Sold" / "Sold · Buy Now" — the corner ribbon and the badge share it. */
export function soldLabel(item: AuctionItem): string {
  return item.won_kind === 'buy_now' ? 'Sold · Buy Now' : 'Sold'
}

function ItemCard({ item, now }: { item: AuctionItem; now: string }) {
  const value = formatValue(item.value_cents)
  const sold = item.status === 'won'
  const countdown = item.is_open ? closesIn(item.closes_at, now) : ''
  return (
    <Link
      to={`/bunfest/auction/${item.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <RafflePhoto title={item.title} photo={item.photo_url} className={sold ? 'opacity-70' : ''} />
        {sold && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-lg bg-ink/85 px-2 py-1 font-display text-xs font-black uppercase tracking-wide text-white shadow-sm">
            {soldLabel(item)}
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
        <p className="mt-2 text-sm font-bold text-ink">{bidLine(item)}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          {!sold && item.buy_now_cents != null && <>Buy now {money(item.buy_now_cents)} · </>}
          {shipLine(item)}
          {countdown && <> · {countdown}</>}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <SessionBadge session={item.session} />
            {sold && <Badge tone="slate">{soldLabel(item)}</Badge>}
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

/** The strip above the list: your bidder number, or the way to get one. */
function BidderStrip({ settings }: { settings: AuctionSettings | null }) {
  const me = useRememberedBidder()
  if (me) {
    return (
      <Link
        to="/bunfest/auction/me"
        className="flex items-center gap-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50 px-4 py-3 text-sm text-ink transition hover:border-brand-blue/40"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white">
          <Icon name="gavel" size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-extrabold">You’re registered as Bidder #{me.bidder_no}</span>
          <span className="block text-xs font-semibold text-slate-500">Your bids and wins</span>
        </span>
        <Icon name="chevron" size={18} className="shrink-0 text-brand-blue" />
      </Link>
    )
  }
  if (settings?.bidding_enabled && settings.stripe_publishable_key) {
    return (
      <ActionCard
        to="/bunfest/auction/register?next=/bunfest/auction"
        title="Register to bid"
        subtitle="Your name, email and a card — charged only if you win or use Buy now"
        icon="gavel"
        tone="orange"
      />
    )
  }
  return <QuietNote>Bidding opens online before BunFest; see the auction table on the day.</QuietNote>
}

export default function RaffleCatalog() {
  const { catalog, intro } = useCatalog(true)
  const items = catalog?.items ?? null
  const [filter, setFilter] = useState<Filter>('All')
  const [availableOnly, setAvailableOnly] = useState(false)

  // "Morning" / "Afternoon" include all-day items — they're on the table then too.
  // Available first, then sold, as before.
  const list = useMemo(() => {
    let all = items ?? []
    if (filter === 'Morning') all = all.filter((i) => i.session === 'morning' || i.session === 'all-day')
    if (filter === 'Afternoon') all = all.filter((i) => i.session === 'afternoon' || i.session === 'all-day')
    if (availableOnly) all = all.filter((i) => i.status === 'available')
    const rank = (s: string) => (s === 'available' ? 0 : 1)
    return [...all].sort((a, b) => rank(a.status) - rank(b.status) || a.sort_order - b.sort_order || a.title.localeCompare(b.title))
  }, [items, filter, availableOnly])

  const introText = intro?.trim()
  const note = catalog?.settings?.bidding_note?.trim()

  return (
    <>
      <PageHeader icon="award" title="Silent Auction" subtitle="Midwest BunFest 2026" />
      <Screen className="space-y-4">
        <PresentedBy surface="silent-auction" />
        <Link
          to="/bunfest"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Midwest BunFest
        </Link>

        {introText && <p className="px-1 text-[13px] leading-relaxed text-slate-500">{introText}</p>}

        {catalog && <BidderStrip settings={catalog.settings} />}
        {note && <p className="px-1 text-[13px] leading-relaxed text-slate-500">{note}</p>}

        {items !== null && items.length > 0 && (
          <div className="space-y-2">
            <SegTabs options={FILTERS} value={filter} onChange={setFilter} />
            <button
              type="button"
              onClick={() => setAvailableOnly((v) => !v)}
              aria-pressed={availableOnly}
              className={[
                'inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition',
                availableOnly
                  ? 'bg-brand-orange text-ink shadow-sm'
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
              <ItemCard key={item.id} item={item} now={catalog?.now ?? new Date().toISOString()} />
            ))}
          </div>
        )}
      </Screen>
    </>
  )
}
