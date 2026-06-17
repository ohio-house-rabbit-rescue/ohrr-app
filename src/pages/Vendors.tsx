import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { vendors, vendorCategories } from '../data/vendors'
import { boothForVendor, roomName } from '../data/floorplan'
import { PageHeader, Screen, Badge, SampleNote, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'

const CATEGORIES = ['All', ...vendorCategories] as const
type Filter = (typeof CATEGORIES)[number]

export default function Vendors() {
  const [category, setCategory] = useState<Filter>('All')

  const list = useMemo(
    () => (category === 'All' ? vendors : vendors.filter((v) => v.category === category)),
    [category],
  )

  return (
    <>
      <PageHeader
        icon="bag"
        title="Vendors"
        subtitle={`${vendors.length} makers & shops with specialty rabbit goods.`}
      />
      <Screen className="space-y-4">
        <SampleNote>
          Showing the 2025 vendors. The 2026 roster is announced closer to the event, and the booth
          locations shown are an estimate — OHRR sets the final layout.
        </SampleNote>
        <SegTabs options={CATEGORIES} value={category} onChange={setCategory} wrap />
        <div className="grid grid-cols-1 gap-3">
          {list.map((v) => (
            <Link
              key={v.id}
              to={`/bunfest/vendors/${v.id}`}
              className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-ink">{v.name}</h3>
                <Badge tone="orange">{v.category}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                {v.description}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
                  View details <Icon name="chevron" size={14} />
                </span>
                {(() => {
                  const b = boothForVendor(v.id)
                  return b ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                      <Icon name="mappin" size={12} className="text-slate-400" />
                      {roomName(b.room).replace(' Room', '')} · {b.label}
                    </span>
                  ) : null
                })()}
              </div>
            </Link>
          ))}
        </div>
      </Screen>
    </>
  )
}
