import { partners } from '../data/partners'
import { PageHeader, Container, Card, Badge, SampleBanner } from '../components/ui'

export default function Partners() {
  return (
    <>
      <PageHeader
        title="Rescue Partners"
        subtitle="Midwest BunFest brings together 15–20 rabbit rescues from across the region — all working to help rabbits find homes."
      />
      <Container className="py-8">
        <SampleBanner>
          Ohio House Rabbit Rescue is the host. The other rescues below are
          placeholders — the confirmed partner list is published closer to the event.
        </SampleBanner>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <Card key={p.id} className={p.host ? 'ring-2 ring-emerald-500' : ''}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-900">{p.name}</h3>
                {p.host && <Badge>Host</Badge>}
              </div>
              <p className="mt-1 text-sm text-stone-500">{p.location}</p>
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Visit website →
                </a>
              ) : (
                <p className="mt-3 text-xs italic text-stone-400">Details to be announced</p>
              )}
            </Card>
          ))}
        </div>
      </Container>
    </>
  )
}
