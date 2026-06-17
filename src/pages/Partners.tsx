import { Link } from 'react-router-dom'
import { partners } from '../data/partners'
import { PageHeader, Screen, Badge, SampleNote } from '../components/ui'
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

export default function Partners() {
  return (
    <>
      <PageHeader
        icon="users"
        title="Rescue Partners"
        subtitle={`${partners.length} rabbit rescues and humane organizations, together for the buns.`}
      />
      <Screen className="space-y-4">
        <SampleNote>
          Showing the 2025 rescue partners. The 2026 lineup is announced closer to the event.
        </SampleNote>
        <div className="grid grid-cols-1 gap-3">
          {partners.map((p) => (
            <Link
              key={p.id}
              to={`/bunfest/partners/${p.id}`}
              className={`group flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                p.host ? 'border-brand-blue/40 ring-1 ring-brand-blue/30' : 'border-slate-200/80'
              }`}
            >
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 font-display text-sm font-black text-brand-blue">
                {initials(p.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-display text-base font-extrabold text-ink">
                    {p.name}
                  </span>
                  {p.host && <Badge tone="blue">Host</Badge>}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                  <Icon name="mappin" size={14} className="shrink-0 text-slate-400" /> {p.location}
                </span>
              </span>
              <Icon
                name="chevron"
                size={18}
                className="shrink-0 text-slate-300 transition group-hover:text-brand-orange"
              />
            </Link>
          ))}
        </div>
      </Screen>
    </>
  )
}
