import { ohrr, adoptRequirements, adoptLinks } from '../data/ohrr'
import { PageHeader, Screen, Card, ExternalCard, SectionLabel } from '../components/ui'
import { Icon } from '../components/icons'

export default function Adopt() {
  return (
    <>
      <PageHeader
        icon="heart"
        title="Adopt a Rabbit"
        subtitle="Give a rescued rabbit a loving indoor home. Adoptions are by appointment."
      />
      <Screen className="space-y-4">
        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Before you adopt</h3>
          <p className="mt-1 text-sm text-slate-600">
            Every OHRR rabbit is spayed/neutered and vaccinated. Adopters agree to:
          </p>
          <ul className="mt-3 space-y-2">
            {adoptRequirements.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <Icon name="heart" size={16} className="mt-0.5 shrink-0 text-brand-orange" /> {r}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-2.5">
          <SectionLabel>Start here</SectionLabel>
          <div className="space-y-2.5">
            {adoptLinks.map((l) => (
              <ExternalCard key={l.title} href={l.url} title={l.title} description={l.description} icon={l.icon} />
            ))}
          </div>
        </div>

        <Card className="border-brand-blue/20 bg-brand-blue-50/60">
          <p className="text-sm leading-relaxed text-slate-600">
            Adoptions are by appointment at the Adoption Center, {ohrr.address}. Questions?
            Call{' '}
            <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
              {ohrr.phone}
            </a>
            .
          </p>
        </Card>
      </Screen>
    </>
  )
}
