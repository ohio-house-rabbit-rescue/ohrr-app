import { event } from '../data/event'
import { PageHeader, Container, Card, SampleBanner } from '../components/ui'

export default function Visit() {
  return (
    <>
      <PageHeader
        title="Plan Your Visit"
        subtitle="Everything you need to know before you go."
      />
      <Container className="py-8">
        <SampleBanner>
          Date, venue, and on-site details are preliminary. Confirm against the
          official BunFest site before making travel plans.
        </SampleBanner>

        {/* Key details */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <h3 className="text-sm font-semibold text-stone-500">When</h3>
            <p className="mt-1 font-semibold text-stone-900">{event.dateLabel}</p>
            <p className="text-sm text-stone-600">{event.dateNote}</p>
            <p className="mt-1 text-sm text-stone-600">{event.timeLabel}</p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-stone-500">Where</h3>
            <p className="mt-1 font-semibold text-stone-900">{event.location.name}</p>
            <p className="text-sm text-stone-600">{event.location.note}</p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-stone-500">Most recent edition</h3>
            <p className="mt-1 font-semibold text-stone-900">{event.lastConfirmedEdition}</p>
            <p className="text-sm text-stone-600">For reference</p>
          </Card>
        </div>

        {/* Bringing your rabbit */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="text-lg font-bold text-stone-900">Bringing your rabbit</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Well-behaved pet rabbits are welcome, subject to BunFest’s{' '}
              <strong>Rabbit Attendance Agreement</strong>. Bring a secure carrier, keep
              your bun comfortable, and watch for signs of stress in busy areas. Full
              rules are posted on the official site before the event.
            </p>
            <a
              href={event.links.bunfestEventInfo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Read the event info →
            </a>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-stone-900">Good to know</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-stone-600">
              <li>• Family-friendly — kids welcome.</li>
              <li>• Bring cash and cards for vendors, the silent auction, and raffle.</li>
              <li>• Wear comfortable shoes; it’s a full day of browsing and talks.</li>
              <li>• Parking and accessibility details: to be announced.</li>
            </ul>
          </Card>
        </div>

        {/* About the host */}
        <Card className="mt-8">
          <h3 className="text-lg font-bold text-stone-900">About the host: Ohio House Rabbit Rescue</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            OHRR runs Ohio’s first rescue-and-adoption center exclusively for domestic
            rabbits, in Columbus. The adoption center is open weekends — adoptions are by
            appointment.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-stone-500">Adoption Center</dt>
              <dd className="text-stone-700">5485 N. High Street, Columbus, OH 43214</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-500">Phone</dt>
              <dd className="text-stone-700">
                <a href="tel:+16142638557" className="hover:text-emerald-700">614-263-8557</a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-500">Hours</dt>
              <dd className="text-stone-700">Sat &amp; Sun, 12–4 PM · by appointment</dd>
            </div>
          </dl>
        </Card>
      </Container>
    </>
  )
}
