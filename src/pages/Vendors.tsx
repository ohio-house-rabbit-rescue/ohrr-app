import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBunfestVendors, vendorCategoriesOf } from '../features/bunfest/content'
import { useBunfestFloor } from '../features/bunfest/floorData'
import { formatNumbers, ROOM_NAMES } from '../features/bunfest/floor'
import { PageHeader, Screen, Badge, SampleNote, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'

export default function Vendors() {
  const [category, setCategory] = useState<string>('All')
  const { items: vendors, source } = useBunfestVendors()
  const floor = useBunfestFloor()
  const categories = useMemo(() => ['All', ...vendorCategoriesOf(vendors)], [vendors])

  const list = useMemo(
    () => (category === 'All' ? vendors : vendors.filter((v) => v.category === category)),
    [category, vendors],
  )

  return (
    <>
      <PageHeader
        icon="bag"
        title="Vendors"
        subtitle={`${vendors.length} makers & shops with specialty rabbit goods.`}
      />
      <Screen className="space-y-4">
        {source === 'seed' && (
          <SampleNote>
            Showing the 2025 vendors. This year’s roster appears here as soon as OHRR adds it
            (Staff → BunFest); the booth locations shown are an estimate.
          </SampleNote>
        )}
        <SegTabs options={categories} value={category} onChange={setCategory} wrap />
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
                  const at = floor.placeOf('vendor', v.id)
                  if (at.numbers.length === 0 || !at.room) return null
                  return (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Icon name="mappin" size={13} className="text-slate-400" />
                      {ROOM_NAMES[at.room].replace(' Room', '')} · {at.numbers.length > 1 ? 'Tables' : 'Table'}{' '}
                      {formatNumbers(at.numbers)}
                    </span>
                  )
                })()}
              </div>
            </Link>
          ))}
        </div>
      </Screen>
    </>
  )
}
