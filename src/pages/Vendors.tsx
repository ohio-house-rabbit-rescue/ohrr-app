import { useMemo, useState } from 'react'
import { vendors, vendorCategories } from '../data/vendors'
import { PageHeader, Screen, Card, Badge, SampleNote, SegTabs } from '../components/ui'
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
          Showing the 2025 vendors. The 2026 roster is announced closer to the event.
        </SampleNote>
        <SegTabs options={CATEGORIES} value={category} onChange={setCategory} />
        <div className="grid grid-cols-1 gap-3">
          {list.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-ink">{v.name}</h3>
                <Badge tone="orange">{v.category}</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.description}</p>
              {v.url && (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
                >
                  Visit <Icon name="external" size={14} />
                </a>
              )}
            </Card>
          ))}
        </div>
      </Screen>
    </>
  )
}
