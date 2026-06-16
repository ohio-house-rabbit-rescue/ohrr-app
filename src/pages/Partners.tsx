import { partners } from '../data/partners'
import { PageHeader, Screen, Card, Badge, SampleNote } from '../components/ui'
import { Icon } from '../components/icons'

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
            <Card key={p.id} className={p.host ? 'border-brand-blue/40 ring-1 ring-brand-blue/30' : ''}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-ink">{p.name}</h3>
                {p.host && <Badge tone="blue">Host</Badge>}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                <Icon name="mappin" size={14} className="shrink-0 text-slate-400" /> {p.location}
              </p>
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
                >
                  Visit website <Icon name="external" size={14} />
                </a>
              )}
            </Card>
          ))}
        </div>
      </Screen>
    </>
  )
}
