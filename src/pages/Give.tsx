import { useState } from 'react'
import { Link } from 'react-router-dom'
import { givingOptions, OHRR_EIN, type GivingOption } from '../data/giving'
import { ohrr } from '../data/ohrr'
import { Badge, PageHeader, Screen, SectionLabel } from '../components/ui'
import { Icon } from '../components/icons'
import { useWishListItems, type WishListItem } from '../features/giving/wishList'

function isExternal(url?: string) {
  return Boolean(url && /^https?:/.test(url))
}
const isInternal = (url?: string) => Boolean(url && url.startsWith('/'))

/**
 * The wish list's own items (update 32), each opening its Amazon page. A plain
 * link that leaves the app: on a phone the Amazon app picks up amazon.com
 * links by itself. No photos — Amazon's can't be used.
 */
function WishListItems({ items }: { items: WishListItem[] }) {
  return (
    <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
      {items.map((i) => (
        <li key={i.id} className="flex gap-3 py-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange-50 text-brand-orange">
            <Icon name="gift" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-ink">
              {i.name}
              {i.most_needed && (
                <span className="ml-1.5 align-middle">
                  <Badge tone="orange">Most needed</Badge>
                </span>
              )}
            </p>
            {i.note && <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{i.note}</p>}
            <a
              href={i.amazon_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-[40px] items-center gap-1 rounded-full border border-brand-blue/40 px-4 text-sm font-bold text-brand-blue transition hover:bg-brand-blue-50"
            >
              Buy on Amazon <Icon name="external" size={13} />
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}

function GivingCard({ g, wishItems = [] }: { g: GivingOption; wishItems?: WishListItem[] }) {
  const [open, setOpen] = useState(false)
  const ctaCls =
    'inline-flex items-center gap-1 rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-blue-dark active:scale-[.98]'
  // With items listed, the main button is the way to everything else on the list.
  const ctaLabel = wishItems.length > 0 ? 'See the whole wish list' : g.cta
  const cta = g.to ? (
    <Link to={g.to} className={ctaCls}>
      {ctaLabel} <Icon name="chevron" size={14} />
    </Link>
  ) : (
    <a
      href={g.url}
      target={isExternal(g.url) ? '_blank' : undefined}
      rel="noopener noreferrer"
      className={ctaCls}
    >
      {ctaLabel} <Icon name={isExternal(g.url) ? 'external' : 'mail'} size={14} />
    </a>
  )

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h3 className="font-display text-[15px] font-extrabold text-ink">{g.title}</h3>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{g.description}</p>
      {wishItems.length > 0 && <WishListItems items={wishItems} />}

      {open && g.details && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {g.details.map((d, i) => (
            <p key={i} className="text-sm leading-relaxed text-slate-600">
              {d}
            </p>
          ))}
          {g.links && g.links.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              {g.links.map((l) =>
                isInternal(l.url) ? (
                  <Link key={l.url} to={l.url} className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
                    {l.label} <Icon name="chevron" size={12} />
                  </Link>
                ) : (
                  <a
                    key={l.url}
                    href={l.url}
                    target={isExternal(l.url) ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue"
                  >
                    {l.label} <Icon name={isExternal(l.url) ? 'external' : 'mail'} size={12} />
                  </a>
                ),
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cta}
        {g.details && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            {open ? 'Less' : 'More'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Give() {
  const featured = givingOptions.filter((g) => g.featured)
  const rest = givingOptions.filter((g) => !g.featured)
  const wishItems = useWishListItems()

  return (
    <>
      <PageHeader
        icon="heart"
        title="Support OHRR"
        subtitle="A 501(c)(3) nonprofit that receives no government funds. Every gift funds rescue, vet care, spay/neuter & education — all year."
      />
      <Screen className="space-y-5">
        {featured.map((g) => (
          <a
            key={g.id}
            href={g.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-dark px-6 py-7 text-white shadow-sm transition active:scale-[.99]"
          >
            <div className="flex items-center gap-2">
              <Icon name="heart" size={20} />
              <h2 className="font-display text-xl font-extrabold">{g.title}</h2>
            </div>
            <p className="mt-2 text-sm text-white/90">{g.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-orange-dark">
              {g.cta} →
            </span>
          </a>
        ))}

        <div className="space-y-2.5">
          <SectionLabel>Every way to give</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            {rest.map((g) => (
              <GivingCard key={g.id} g={g} wishItems={g.id === 'wishlist' ? wishItems : undefined} />
            ))}
          </div>
        </div>

        <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
          Ohio House Rabbit Rescue is a 501(c)(3) · EIN {OHRR_EIN}. Links open OHRR’s official
          pages at{' '}
          <a
            href={ohrr.links.site}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-blue underline"
          >
            ohiohouserabbitrescue.org
          </a>
          ; donations are processed by OHRR, not this app.
        </p>
      </Screen>
    </>
  )
}
