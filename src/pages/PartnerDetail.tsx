import { Link, useParams } from 'react-router-dom'
import { partners } from '../data/partners'
import { Screen, Card, Badge, SectionLabel, btn } from '../components/ui'
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

export default function PartnerDetail() {
  const { id } = useParams()
  const partner = partners.find((p) => p.id === id)

  if (!partner) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          🐰
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Partner not found</h1>
        <Link to="/bunfest/partners" className={`${btn.blue} mx-auto`}>
          All rescue partners
        </Link>
      </Screen>
    )
  }

  const p = partner
  const others = partners.filter((x) => x.id !== p.id && !x.host).slice(0, 4)

  return (
    <Screen className="space-y-5">
      <Link
        to="/bunfest/partners"
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
          {p.host && (
            <span className="mt-1 inline-block">
              <Badge tone="orange">Host of Midwest BunFest</Badge>
            </span>
          )}
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Icon name="mappin" size={15} className="shrink-0 text-brand-blue" /> {p.location}
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <Icon name="users" size={15} className="shrink-0 text-brand-blue" />
          {p.host ? 'Founder & host of Midwest BunFest' : 'Rescue partner at Midwest BunFest'}
        </div>
      </Card>

      <p className="text-sm leading-relaxed text-slate-600">
        {p.host
          ? `${p.name} founds and hosts Midwest BunFest, bringing rabbit rescues together from across the country.`
          : `${p.name} is one of the rabbit rescues and humane organizations that partner with OHRR at Midwest BunFest, based in ${p.location}.`}
      </p>

      {p.url && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className={`${btn.outline} w-full`}>
          Visit website <Icon name="external" size={14} />
        </a>
      )}

      {others.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <SectionLabel>More rescue partners</SectionLabel>
          <div className="grid grid-cols-1 gap-2">
            {others.map((o) => (
              <Link
                key={o.id}
                to={`/bunfest/partners/${o.id}`}
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
