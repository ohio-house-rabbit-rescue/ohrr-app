import { givingOptions } from '../data/giving'
import { event } from '../data/event'
import { PageHeader, Container } from '../components/ui'

export default function Give() {
  const featured = givingOptions.filter((g) => g.featured)
  const rest = givingOptions.filter((g) => !g.featured)

  return (
    <>
      <PageHeader
        title="Support OHRR"
        subtitle="Ohio House Rabbit Rescue is a 501(c)(3) nonprofit. Every gift funds rescue, vet care, spay/neuter, and education — all year, not just at BunFest."
      />
      <Container className="py-8">
        {/* Featured */}
        {featured.map((g) => (
          <a
            key={g.id}
            href={g.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-emerald-700 px-6 py-8 text-white transition-colors hover:bg-emerald-800 sm:px-10"
          >
            <h2 className="text-2xl font-bold">{g.title}</h2>
            <p className="mt-2 max-w-2xl text-emerald-50">{g.description}</p>
            <span className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 font-semibold text-emerald-700">
              {g.cta} →
            </span>
          </a>
        ))}

        {/* More ways to give */}
        <h2 className="mt-10 text-xl font-bold text-stone-900">More ways to help</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {rest.map((g) => (
            <a
              key={g.id}
              href={g.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <h3 className="font-semibold text-stone-900">{g.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-stone-600">
                {g.description}
              </p>
              <span className="mt-3 text-sm font-medium text-emerald-700 group-hover:text-emerald-800">
                {g.cta} →
              </span>
            </a>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-stone-500">
          Links go to Ohio House Rabbit Rescue’s official pages at{' '}
          <a
            href={event.links.ohrr}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-emerald-700"
          >
            ohiohouserabbitrescue.org
          </a>
          . Donations are processed by OHRR, not this app.
        </p>
      </Container>
    </>
  )
}
