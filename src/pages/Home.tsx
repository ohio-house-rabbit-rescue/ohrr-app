import { Link } from 'react-router-dom'
import { event, highlights } from '../data/event'
import { Container } from '../components/ui'

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-700 to-emerald-800 text-white">
        <Container className="py-14 sm:py-20">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            Hosted by Ohio House Rabbit Rescue
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {event.name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-emerald-50">{event.tagline}</p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-emerald-50">
            <div>
              <dt className="sr-only">Date</dt>
              <dd>📅 {event.dateLabel} · {event.dateNote}</dd>
            </div>
            <div>
              <dt className="sr-only">Time</dt>
              <dd>🕙 {event.timeLabel}</dd>
            </div>
            <div>
              <dt className="sr-only">Location</dt>
              <dd>📍 {event.location.name}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/schedule"
              className="rounded-full bg-white px-6 py-3 font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
            >
              View the schedule
            </Link>
            <Link
              to="/give"
              className="rounded-full border border-white/70 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
            >
              Support OHRR
            </Link>
          </div>
        </Container>
      </section>

      {/* Intro */}
      <Container className="py-12">
        <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-stone-600">
          {event.blurb}
        </p>
      </Container>

      {/* Highlights */}
      <Container>
        <h2 className="text-2xl font-bold text-stone-900">What to expect</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h) => (
            <div
              key={h.title}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="text-3xl" aria-hidden>{h.icon}</div>
              <h3 className="mt-3 font-semibold text-stone-900">{h.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{h.text}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* Give CTA */}
      <Container className="py-12">
        <div className="rounded-2xl bg-emerald-700 px-6 py-10 text-center text-white sm:px-12">
          <h2 className="text-2xl font-bold">Every visit helps a rabbit</h2>
          <p className="mx-auto mt-2 max-w-2xl text-emerald-50">
            BunFest is the flagship fundraiser for Ohio House Rabbit Rescue. Your
            support funds spay/neuter, vet care, and the adoption center year-round.
          </p>
          <Link
            to="/give"
            className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            Ways to give
          </Link>
        </div>
      </Container>
    </>
  )
}
