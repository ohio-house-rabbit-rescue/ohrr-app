import { sponsorTiers } from '../data/sponsors'
import { event } from '../data/event'
import { PageHeader, Container, Card } from '../components/ui'

export default function Sponsors() {
  return (
    <>
      <PageHeader
        title="Sponsors"
        subtitle="BunFest is powered by businesses and organizations that care about rabbits. Thank you to our supporters."
      />
      <Container className="py-8">
        <div className="space-y-8">
          {sponsorTiers.map((tier) => (
            <section key={tier.id}>
              <h2 className="text-xl font-bold text-stone-900">{tier.name}</h2>
              <p className="mt-1 text-sm text-stone-600">{tier.blurb}</p>

              {tier.sponsors.length > 0 ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tier.sponsors.map((name) => (
                    <Card key={name}>
                      <span className="font-semibold text-stone-900">{name}</span>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-white px-5 py-6 text-center text-sm text-stone-500">
                  This tier is open — your organization could be here.
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Become a sponsor */}
        <div className="mt-12 rounded-2xl bg-emerald-700 px-6 py-10 text-center text-white sm:px-12">
          <h2 className="text-2xl font-bold">Become a sponsor</h2>
          <p className="mx-auto mt-2 max-w-2xl text-emerald-50">
            Reach a national audience of rabbit owners and enthusiasts while supporting
            rescue and education. Sponsorships are available at every level.
          </p>
          <a
            href={event.links.bunfest}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            Sponsor inquiries
          </a>
        </div>
      </Container>
    </>
  )
}
