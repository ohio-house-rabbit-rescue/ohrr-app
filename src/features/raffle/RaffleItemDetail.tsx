// One Silent Auction item: large photo, description, donor, value, session.
// Won items stay visible with a "Won" badge (no winner is ever shown). If the
// item is unpublished the query returns nothing and we show a neutral
// "no longer listed" state.
import { Link, useParams } from 'react-router-dom'
import { Screen, Card, Badge, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useAuctionItem } from './useRaffleItems'
import { RafflePhoto } from './RafflePhoto'
import { SessionBadge } from './RaffleCatalog'
import { formatValue } from './types'

export default function RaffleItemDetail() {
  const { id } = useParams()
  const item = useAuctionItem(id)

  if (item === undefined) {
    return (
      <Screen>
        <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-4 h-6 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100" />
      </Screen>
    )
  }

  if (!item) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">This item is no longer listed</h1>
        <p className="text-sm text-slate-600">See what’s in the Silent Auction.</p>
        <Link to="/bunfest/auction" className={`${btn.blue} mx-auto`}>
          Back to the Silent Auction
        </Link>
      </Screen>
    )
  }

  const value = formatValue(item.value_cents)
  const won = item.status === 'won'

  return (
    <div>
      {/* Photo header with an in-app back button */}
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <RafflePhoto
            title={item.title}
            photo={item.photo_url}
            initialClassName="text-7xl"
            className={won ? 'opacity-70' : ''}
          />
        </div>
        <Link
          to="/bunfest/auction"
          aria-label="Back to the Silent Auction"
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:bg-white"
        >
          <Icon name="arrowLeft" size={20} />
        </Link>
        {won && (
          <span className="absolute right-4 top-4 inline-flex items-center rounded-lg bg-ink/85 px-2.5 py-1 font-display text-xs font-black uppercase tracking-wide text-white shadow-sm">
            Won
          </span>
        )}
      </div>

      <Screen className="space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-black text-ink">{item.title}</h1>
            {value && (
              <span className="shrink-0 pt-1 font-display text-lg font-extrabold text-emerald-600">{value}</span>
            )}
          </div>
          {item.donated_by && (
            <p className="mt-1 text-sm font-semibold text-slate-500">Donated by {item.donated_by}</p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <SessionBadge session={item.session} />
            {won && <Badge tone="slate">Won</Badge>}
          </div>
        </div>

        {item.description && (
          <Card>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">
              About this item
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {item.description}
            </p>
          </Card>
        )}

        <Link
          to="/bunfest/auction"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> All auction items
        </Link>
      </Screen>
    </div>
  )
}
