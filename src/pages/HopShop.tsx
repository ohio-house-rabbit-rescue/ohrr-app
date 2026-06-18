import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hopShopItems, hopShopCategories } from '../data/hopshop'
import { ohrr } from '../data/ohrr'
import { PageHeader, Screen, Card, Badge, SampleNote, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'

const CATEGORIES = ['All', ...hopShopCategories] as const
type Filter = (typeof CATEGORIES)[number]

export default function HopShop() {
  const [category, setCategory] = useState<Filter>('All')

  const list = useMemo(
    () => (category === 'All' ? hopShopItems : hopShopItems.filter((i) => i.category === category)),
    [category],
  )

  return (
    <>
      <PageHeader
        icon="bag"
        title="Hop Shop"
        subtitle="Rabbit supplies and OHRR merch — every purchase funds rescue, vet care, and education."
      />
      <Screen className="space-y-4">
        <SampleNote>
          This is sample inventory to show how the shop works. OHRR’s real, in-stock items will
          appear here as the team adds them.
        </SampleNote>

        {/* Where to shop */}
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            Browse what’s available, then pick it up in person — at the OHRR Adoption Center or the
            Hop Shop table at Midwest BunFest. (Purchases happen in person, not in the app.)
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Icon name="mappin" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
              <span className="text-slate-600">{ohrr.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="clock" size={15} className="shrink-0 text-brand-blue" />
              <span className="text-slate-600">{ohrr.hours}</span>
            </div>
          </dl>
        </Card>

        <SegTabs options={CATEGORIES} value={category} onChange={setCategory} wrap />

        <div className="grid grid-cols-1 gap-3">
          {list.map((item) => (
            <Card key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-extrabold text-ink">{item.name}</h3>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.blurb}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="orange">{item.category}</Badge>
                  <span
                    className={`text-xs font-bold ${
                      item.stock === 'Low stock' ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {item.stock}
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-display text-lg font-black text-brand-blue">
                {item.price}
              </span>
            </Card>
          ))}
        </div>

        <Card className="border-brand-orange/20 bg-brand-orange-50/50 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            Planning a trip to pick something up? Visits are by appointment.
          </p>
          <Link
            to="/appointment"
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            Schedule a visit <Icon name="chevron" size={14} />
          </Link>
        </Card>
      </Screen>
    </>
  )
}
