import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { auctionItems, auctionCategories, type AuctionItem } from '../data/silentAuction'
import { PageHeader, Screen, Card, Badge, SampleNote, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'

const CATEGORIES = ['All', ...auctionCategories] as const
type Filter = (typeof CATEGORIES)[number]

function ItemCard({ item }: { item: AuctionItem }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <Icon name="award" size={26} />
            <span className="text-xs font-bold uppercase tracking-wide">Photo coming</span>
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-brand-blue px-1.5 font-display text-sm font-black text-white shadow-sm">
          #{item.number}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
          <span className="shrink-0 text-sm font-bold text-emerald-600">~{item.estValue}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <Badge tone="orange">{item.category}</Badge>
          <span className="truncate text-xs font-semibold text-slate-400">Donated by {item.donor}</span>
        </div>
      </div>
    </Card>
  )
}

export default function SilentAuction() {
  const [category, setCategory] = useState<Filter>('All')

  const list = useMemo(
    () => (category === 'All' ? auctionItems : auctionItems.filter((i) => i.category === category)),
    [category],
  )

  return (
    <>
      <PageHeader
        icon="award"
        title="Silent Auction"
        subtitle="Preview this year's silent auction items — then bid in person at the event."
      />
      <Screen className="space-y-4">
        <Link
          to="/bunfest/p/raffle"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Raffle & Silent Auction
        </Link>

        <SampleNote>
          Example items to show how the gallery works — OHRR’s real lineup (with photos and donors)
          appears here before the event. Bidding and payment happen in person at the auction tables.
        </SampleNote>

        <SegTabs options={CATEGORIES} value={category} onChange={setCategory} wrap />

        {list.length === 0 ? (
          <p className="px-1 pt-2 text-sm text-slate-500">No items in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {list.map((item) => (
              <ItemCard key={item.number} item={item} />
            ))}
          </div>
        )}
      </Screen>
    </>
  )
}
