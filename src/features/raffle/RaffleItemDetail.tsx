// One auction item (BunFest's Silent Auction or the Online Auction): large photo, description, donor, value, session —
// and, since update 35, the bidding box (running bid, next minimum, close
// time, Place bid / Buy now for registered bidders) with the bid history.
// Sold items stay visible with a "Sold" badge (no winner is ever named).
// If the item is unpublished the catalog leaves it out and we show a neutral
// "no longer listed" state. The catalog is polled every 15 s, so a rival bid
// shows up without a refresh.
import { Link, useParams } from 'react-router-dom'
import { Screen, Card, Badge, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import ShareButton, { appLink } from '../../components/ShareButton'
import { RafflePhoto } from './RafflePhoto'
import PhotoGallery, { photoList } from '../../components/PhotoGallery'
import { SessionBadge, soldLabel } from './RaffleCatalog'
import { formatValue } from './types'
import { useCatalogItem } from '../auction/useAuction'
import { BidBox } from '../auction/BidBox'
import { useAuctionEvent } from '../auction/event'

export default function RaffleItemDetail() {
  const ev = useAuctionEvent()
  const auctionName = ev.online ? 'the Online Auction' : 'the Silent Auction'
  const { id } = useParams()
  const { item, state } = useCatalogItem(id)

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
        <p className="text-sm text-slate-600">See what’s in {auctionName}.</p>
        <Link to={ev.base} className={`${btn.blue} mx-auto`}>
          Back to {auctionName}
        </Link>
      </Screen>
    )
  }

  const value = formatValue(item.value_cents)
  const sold = item.status === 'won'
  const now = state.catalog?.now ?? new Date().toISOString()

  return (
    <div>
      {/* Photo header with an in-app back button */}
      <div className="relative">
        {photoList(item).length > 1 ? (
          <PhotoGallery photos={photoList(item)} alt={item.title} imgClassName={sold ? 'opacity-70' : ''} />
        ) : (
          <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
            <RafflePhoto
              title={item.title}
              photo={item.photo_url}
              initialClassName="text-7xl"
              className={sold ? 'opacity-70' : ''}
            />
          </div>
        )}
        <Link
          to={ev.base}
          aria-label={`Back to ${auctionName}`}
          className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:bg-white"
        >
          <Icon name="arrowLeft" size={20} />
        </Link>
        {sold && (
          <span className="absolute right-4 top-4 inline-flex items-center rounded-lg bg-ink/85 px-2.5 py-1 font-display text-xs font-black uppercase tracking-wide text-white shadow-sm">
            {soldLabel(item)}
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
            {!ev.online && <SessionBadge session={item.session} />}
            {sold && <Badge tone="slate">{soldLabel(item)}</Badge>}
          </div>
        </div>

        <BidBox item={item} settings={state.catalog?.settings ?? null} now={now} onChanged={state.refresh} />

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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={ev.base}
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            <Icon name="arrowLeft" size={16} /> All auction items
          </Link>
          <ShareButton
            label="Share this item"
            filename={`ohrr-auction-${item.id.slice(0, 8)}.png`}
            caption={
              ev.online
                ? `${item.title} — OHRR Online Auction. Bid in the OHRR app.`
                : `${item.title} — Silent auction · Midwest BunFest. Bid in the OHRR app.`
            }
            card={{
              kicker: ev.online ? 'Online auction' : 'Silent auction',
              title: item.title,
              subtitle: ev.online ? 'Ohio House Rabbit Rescue' : 'Midwest BunFest · Ohio House Rabbit Rescue',
              photoUrl: item.photo_url ?? undefined,
              link: appLink(`${ev.base}/${item.id}`),
              cta: 'Bid in the OHRR app',
            }}
          />
        </div>
      </Screen>
    </div>
  )
}
