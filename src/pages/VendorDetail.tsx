import { Link, useParams } from 'react-router-dom'
import { vendors } from '../data/vendors'
import { boothForVendor, roomName } from '../data/floorplan'
import { Screen, Card, Badge, SectionLabel, btn } from '../components/ui'
import { ContactLinks } from '../components/ContactLinks'
import { Icon } from '../components/icons'

export default function VendorDetail() {
  const { id } = useParams()
  const vendor = vendors.find((v) => v.id === id)

  if (!vendor) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          🛍️
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Vendor not found</h1>
        <Link to="/bunfest/vendors" className={`${btn.blue} mx-auto`}>
          All vendors
        </Link>
      </Screen>
    )
  }

  const v = vendor
  const booth = boothForVendor(v.id)
  const related = vendors.filter((x) => x.id !== v.id && x.category === v.category).slice(0, 4)

  return (
    <Screen className="space-y-5">
      <Link
        to="/bunfest/vendors"
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Vendors
      </Link>

      <div>
        <Badge tone="orange">{v.category}</Badge>
        <h1 className="mt-2 font-display text-2xl font-black leading-tight text-ink">{v.name}</h1>
      </div>

      <Card>
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">
          What they make
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{v.description}</p>
      </Card>

      {booth && (
        <Link
          to={`/bunfest/map?vendor=${v.id}`}
          className="flex items-center gap-3 rounded-2xl border border-brand-blue/25 bg-brand-blue-50/50 p-4 transition hover:bg-brand-blue-50"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-white">
            <Icon name="mappin" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-extrabold text-ink">
              {roomName(booth.room)} · Booth {booth.label}
            </span>
            <span className="block text-xs text-slate-500">
              {booth.tables === 2 ? 'Two 8-ft tables' : 'One 8-ft table'} · tap to see it on the map
            </span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-brand-blue" />
        </Link>
      )}

      {v.url && (
        <section className="space-y-2.5">
          <SectionLabel>Shop</SectionLabel>
          <Card>
            <ContactLinks url={v.url} urlLabel="Visit shop" />
          </Card>
        </section>
      )}

      {related.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <SectionLabel>More in {v.category}</SectionLabel>
          <div className="grid grid-cols-1 gap-2">
            {related.map((o) => (
              <Link
                key={o.id}
                to={`/bunfest/vendors/${o.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm transition hover:border-slate-300 hover:shadow-sm"
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{o.name}</span>
                <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </Screen>
  )
}
