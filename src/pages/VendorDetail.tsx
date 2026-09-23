import { Link, useParams } from 'react-router-dom'
import { useBunfestVendors } from '../features/bunfest/content'
import { useBunfestFloor } from '../features/bunfest/floorData'
import { formatNumbers, ROOM_NAMES } from '../features/bunfest/floor'
import { Screen, Card, Badge, SectionLabel, btn } from '../components/ui'
import { ContactLinks } from '../components/ContactLinks'
import { Icon } from '../components/icons'

export default function VendorDetail() {
  const { id } = useParams()
  const { items: vendors, loading } = useBunfestVendors()
  const floor = useBunfestFloor()
  const vendor = vendors.find((v) => v.id === id)

  if (!vendor && loading) return null
  if (!vendor) {
    return (
      <Screen className="space-y-4 text-center">
        <span className="mx-auto mt-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon name="store" size={30} />
        </span>
        <h1 className="font-display text-xl font-extrabold text-ink">Vendor not found</h1>
        <Link to="/bunfest/vendors" className={`${btn.blue} mx-auto`}>
          All vendors
        </Link>
      </Screen>
    )
  }

  const v = vendor
  const at = floor.placeOf('vendor', v.id)
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

      {at.numbers.length > 0 && at.room && (
        <Link
          to={`/bunfest/map?table=${at.numbers[0]}`}
          className="flex items-center gap-3 rounded-2xl border border-brand-blue/25 bg-brand-blue-50/50 p-4 transition hover:bg-brand-blue-50"
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-white">
            <Icon name="mappin" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-sm font-extrabold text-ink">
              {ROOM_NAMES[at.room]} · {at.numbers.length > 1 ? 'Tables' : 'Table'} {formatNumbers(at.numbers)}
            </span>
            <span className="block text-xs text-slate-500">Tap to see it on the map</span>
          </span>
          <Icon name="chevron" size={20} className="shrink-0 text-brand-blue" />
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
