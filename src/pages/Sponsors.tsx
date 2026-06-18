import { sponsors, type Sponsor } from '../data/sponsors'
import { event } from '../data/event'
import { PageHeader, Screen, Card, Badge, SampleNote, btn } from '../components/ui'
import { ContactLinks } from '../components/ContactLinks'
import { Icon } from '../components/icons'

function SponsorCard({ s }: { s: Sponsor }) {
  return (
    <Card className={s.lead ? 'border-brand-blue/40 ring-1 ring-brand-blue/30' : ''}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-extrabold text-ink">{s.name}</h3>
        {s.lead ? (
          <Badge tone="blue">
            <Icon name="star" size={12} className="mr-1" /> Lead Sponsor
          </Badge>
        ) : (
          <Badge tone="slate">{s.type}</Badge>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.blurb}</p>
      {(s.address || s.phone || s.email || s.url) && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ContactLinks address={s.address} phone={s.phone} email={s.email} url={s.url} />
        </div>
      )}
    </Card>
  )
}

export default function Sponsors() {
  const lead = sponsors.filter((s) => s.lead)
  const rest = sponsors.filter((s) => !s.lead)

  return (
    <>
      <PageHeader
        icon="award"
        title="Sponsors"
        subtitle="BunFest runs on the generosity of these sponsors and donors — reach them right here."
      />
      <Screen className="space-y-4">
        <SampleNote>
          Showing the 2025 sponsors. The 2026 roster is announced closer to the event.
        </SampleNote>

        <div className="grid grid-cols-1 gap-3">
          {lead.map((s) => (
            <SponsorCard key={s.name} s={s} />
          ))}
          {rest.map((s) => (
            <SponsorCard key={s.name} s={s} />
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
