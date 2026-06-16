import { sponsors } from '../data/sponsors'
import { event } from '../data/event'
import { PageHeader, Screen, Card, Badge, SampleNote, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Sponsors() {
  const lead = sponsors.find((s) => s.lead)
  const rest = sponsors.filter((s) => !s.lead)

  return (
    <>
      <PageHeader
        icon="award"
        title="Sponsors"
        subtitle="BunFest runs on the generosity of these sponsors and donors."
      />
      <Screen className="space-y-4">
        <SampleNote>
          Showing the 2025 sponsors. The 2026 roster is announced closer to the event.
        </SampleNote>

        {lead && (
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-gradient-to-br from-brand-blue to-brand-blue-dark px-6 py-6 text-white shadow-sm transition active:scale-[.99]"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
              <Icon name="star" size={13} /> Lead Sponsor
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold">{lead.name}</h2>
            <p className="mt-1 text-sm text-white/90">{lead.blurb}</p>
          </a>
        )}

        <div className="grid grid-cols-1 gap-3">
          {rest.map((s) => (
            <Card key={s.name}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-extrabold text-ink">{s.name}</h3>
                <Badge tone="slate">{s.type}</Badge>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.blurb}</p>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
                >
                  Visit <Icon name="external" size={14} />
                </a>
              )}
            </Card>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-b from-brand-blue to-brand-blue-dark px-6 py-7 text-center text-white">
          <h2 className="font-display text-xl font-extrabold">Become a sponsor</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/85">
            Reach a national audience of rabbit lovers while supporting rescue and education.
          </p>
          <a
            href={event.links.bunfest}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.primary} mt-5`}
          >
            Sponsor inquiries
          </a>
        </div>
      </Screen>
    </>
  )
}
