import { Link } from 'react-router-dom'
import { hopShopIntro, hopShopProducts, hopShopPurchaseNote } from '../data/hopshop'
import { ohrr } from '../data/ohrr'
import { useHopShopProducts, money } from '../lib/hopshopPublic'
import { mapsUrl } from '../lib/events'
import { PageHeader, Screen, Card, SectionLabel } from '../components/ui'
import { Icon } from '../components/icons'
import PresentedBy from '../features/sponsors/PresentedBy'

export default function HopShop() {
  const live = useHopShopProducts()
  const inStock = live ?? []

  return (
    <>
      <PageHeader
        icon="bag"
        title="Hop Shop"
        subtitle="Food, supplies and toys at the Adoption Center — profits support OHRR."
      />
      <Screen className="space-y-5">
        <PresentedBy surface="hop-shop" />
        <p className="px-1 text-sm leading-relaxed text-slate-600">{hopShopIntro}</p>

        {/* Hours + address (map link) */}
        <Card className="border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="clock" size={15} className="shrink-0 text-brand-blue" />
            <span className="font-semibold text-ink">Hop Shop hours:</span>
            <span className="text-slate-600">{ohrr.hopShopHours}</span>
          </div>
          <div className="mt-2.5 flex items-start gap-2 text-sm">
            <Icon name="mappin" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
            <span>
              <a
                href={mapsUrl(ohrr.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
              >
                {ohrr.addressLine1}, {ohrr.addressLine2}
              </a>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{ohrr.directions}</span>
            </span>
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            {ohrr.adoptionsNote} —{' '}
            <Link to="/appointment" className="font-semibold text-brand-blue">
              schedule a visit
            </Link>
            . {hopShopPurchaseNote}
          </p>
        </Card>

        {/* Live inventory, when OHRR opens it to the public */}
        {inStock.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>In the shop now</SectionLabel>
            <div className="grid grid-cols-1 gap-3">
              {inStock.map((p) => (
                <Card key={p.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[15px] font-extrabold text-ink">{p.name}</h3>
                    {p.description && (
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{p.description}</p>
                    )}
                  </div>
                  {p.price_cents > 0 && (
                    <span className="shrink-0 font-display text-lg font-black text-brand-blue">
                      {money(p.price_cents)}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* What the shop carries */}
        <section className="space-y-2.5">
          <SectionLabel>Products for purchase</SectionLabel>
          <Card className="divide-y divide-slate-100 !p-0">
            {hopShopProducts.map((p) => (
              <div key={p.name} className="px-4 py-3">
                <p className="font-display text-[15px] font-extrabold text-ink">{p.name}</p>
                {p.note && <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{p.note}</p>}
              </div>
            ))}
          </Card>
        </section>

        <Card className="border-brand-orange/20 bg-brand-orange-50/50">
          <p className="text-sm leading-relaxed text-slate-600">
            Setting up for a new bunny? See{' '}
            <Link to="/learn/bunny-living-space" className="font-semibold text-brand-blue">
              Bunny Living Space
            </Link>{' '}
            for what to buy first. The Hop Shop also has a table at{' '}
            <Link to="/bunfest" className="font-semibold text-brand-blue">
              Midwest BunFest
            </Link>
            .
          </p>
        </Card>
      </Screen>
    </>
  )
}
