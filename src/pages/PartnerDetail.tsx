import { Link, useParams } from 'react-router-dom'
import { useRescuePartners } from '../features/bunfest/content'
import { Screen, Card, Badge, SectionLabel, SampleNote, btn } from '../components/ui'
import { ContactLinks } from '../components/ContactLinks'
import { Icon } from '../components/icons'

function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function PartnerDetail({ base = '/bunfest/partners' }: { base?: string }) {
  const { id } = useParams()
  const { items: partners, loading } = useRescuePartners()
  const partner = partners.find((p) => p.id === id)

  if (!partner && loading) return null
  if (!partner) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">Partner not found</h1>
        <Link to={base} className={`${btn.blue} mx-auto`}>
          All rescue partners
        </Link>
      </Screen>
    )
  }

  const p = partner
  const hasContact = p.address || p.phone || p.email || p.url
  const others = partners.filter((x) => x.id !== p.id && !x.host).slice(0, 4)

  return (
    <Screen className="space-y-5">
      <Link
        to={base}
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Rescue Partners
      </Link>

      <div className="flex items-center gap-4">
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 font-display text-xl font-black text-brand-blue">
          {initials(p.name)}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black leading-tight text-ink">{p.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <Icon name="mappin" size={14} className="shrink-0 text-slate-400" /> {p.location}
          </p>
          {p.host && (
            <span className="mt-1.5 inline-block">
              <Badge tone="orange">Host of Midwest BunFest</Badge>
            </span>
          )}
        </div>
      </div>

      {/* Contact — reach them through the app */}
      <section className="space-y-2.5">
        <SectionLabel>Contact</SectionLabel>
        {hasContact ? (
          <Card>
            <ContactLinks address={p.address} phone={p.phone} email={p.email} url={p.url} />
          </Card>
        ) : (
          <SampleNote>We don’t have published contact details for this rescue yet.</SampleNote>
        )}
      </section>

      {others.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <SectionLabel>More rescue partners</SectionLabel>
          <div className="grid grid-cols-1 gap-2">
            {others.map((o) => (
              <Link
                key={o.id}
                to={`${base}/${o.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm transition hover:border-slate-300 hover:shadow-sm"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                  {initials(o.name)}
                </span>
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
