import { givingOptions } from '../data/giving'
import { event } from '../data/event'
import { PageHeader, Screen } from '../components/ui'
import { Icon } from '../components/icons'

export default function Give() {
  const featured = givingOptions.filter((g) => g.featured)
  const rest = givingOptions.filter((g) => !g.featured)

  return (
    <>
      <PageHeader
        icon="heart"
        title="Support OHRR"
        subtitle="A 501(c)(3) nonprofit. Every gift funds rescue, vet care, spay/neuter & education — all year."
      />
      <Screen className="space-y-4">
        {featured.map((g) => (
          <a
            key={g.id}
            href={g.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-dark px-6 py-7 text-white shadow-sm transition active:scale-[.99]"
          >
            <div className="flex items-center gap-2">
              <Icon name="heart" size={20} />
              <h2 className="font-display text-xl font-extrabold">{g.title}</h2>
            </div>
            <p className="mt-2 text-sm text-white/90">{g.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-orange-dark">
              {g.cta} →
            </span>
          </a>
        ))}

        <div className="space-y-2.5">
          <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            More ways to help
          </p>
          <div className="grid grid-cols-1 gap-3">
            {rest.map((g) => (
              <a
                key={g.id}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="block font-display text-[15px] font-extrabold text-ink">
                  {g.title}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
                  {g.description}
                </span>
                <span className="mt-1.5 inline-block text-sm font-bold text-brand-blue group-hover:text-brand-blue-dark">
                  {g.cta} →
                </span>
              </a>
            ))}
          </div>
        </div>

        <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
          Links open Ohio House Rabbit Rescue’s official pages at{' '}
          <a
            href={event.links.ohrr}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-blue underline"
          >
            ohiohouserabbitrescue.org
          </a>
          . Donations are processed by OHRR, not this app.
        </p>
      </Screen>
    </>
  )
}
