import { Link } from 'react-router-dom'
import { hopShopIntro, hopShopProducts, hopShopPurchaseNote } from '../data/hopshop'
import { ohrr } from '../data/ohrr'
import { telHref, useOrgProfile } from '../lib/orgProfile'
import { useHopShopProducts, money } from '../lib/hopshopPublic'
import { mapsUrl } from '../lib/events'
import { PageHeader, Screen, Card, SectionLabel } from '../components/ui'
import { Icon } from '../components/icons'
import PresentedBy from '../features/sponsors/PresentedBy'
import { useState } from 'react'
import PhotoGallery, { photoList } from '../components/PhotoGallery'
import { HiddenFromPublic, useFeature } from '../features/settings/FeatureGate'
import { HOP_SHOP_ITEMS_FLAG } from '../features/settings/features'

export default function HopShop() {
  const org = useOrgProfile()
  const live = useHopShopProducts()
  const inStock = live ?? []
  const shelf = useFeature(HOP_SHOP_ITEMS_FLAG)
  const [opened, setOpened] = useState<string | null>(null)

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

        {/* Hours + address (map link) — one of the two screens with the street address */}
        <Card className="border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="clock" size={15} className="shrink-0 text-brand-blue" />
            <span className="font-semibold text-ink">Hop Shop hours:</span>
            <span className="text-slate-600">{org.hopshop_hours}</span>
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

        {/* What staff have scanned onto the shelf (hopshop_public_products) */}
        {shelf.show && inStock.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>On the shelf now</SectionLabel>
            {shelf.preview && <HiddenFromPublic />}
            <p className="px-1 text-xs text-slate-500">Buy at the Adoption Center counter. Counts change as things sell.</p>
            <div className="grid grid-cols-1 gap-3">
              {inStock.map((p) => (
                <Card key={p.id} className={`flex items-start gap-3 ${p.in_stock ? '' : 'opacity-60'}`}>
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
                      <Icon name="bag" size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-[15px] font-extrabold text-ink">{p.name}</h3>
                      {p.price_cents > 0 && (
                        <span className="shrink-0 font-display text-lg font-black text-brand-blue">{money(p.price_cents)}</span>
                      )}
                    </div>
                    {p.description && <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{p.description}</p>}
                    {!p.in_stock && <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Sold out — ask at the counter</p>}
                    {photoList(p).length > 1 && (
                      <button
                        type="button"
                        onClick={() => setOpened(opened === p.id ? null : p.id)}
                        aria-expanded={opened === p.id}
                        className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue"
                      >
                        <Icon name="camera" size={15} /> {opened === p.id ? 'Hide the photos' : `See all ${photoList(p).length} photos`}
                      </button>
                    )}
                    {opened === p.id && (
                      <div className="mt-2 overflow-hidden rounded-xl">
                        <PhotoGallery photos={photoList(p)} alt={p.name} />
                      </div>
                    )}
                  </div>
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
