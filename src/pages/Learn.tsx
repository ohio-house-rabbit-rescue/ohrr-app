import { Link } from 'react-router-dom'
import { CARE_DISCLAIMER } from '../data/careArticles'
import { ohrr } from '../data/ohrr'
import { useCareArticles, asIconName, fallbackArticles } from '../lib/careContent'
import { PageHeader, Screen, ActionCard, SectionLabel, Card } from '../components/ui'
import { Icon } from '../components/icons'
import PresentedBy from '../features/sponsors/PresentedBy'

export default function Learn() {
  const liveAll = useCareArticles()
  // Only care guides here; Give/About/Adopt pages live at /info/<slug>.
  const live = liveAll && liveAll.filter((a) => (a.section ?? 'care') === 'care')
  const articles = live && live.length > 0 ? live : fallbackArticles()

  return (
    <>
      <PageHeader
        icon="book"
        title="Rabbit Care"
        subtitle="OHRR’s bunny-care articles, right in the app — diet, litter boxes, bonding, toys, and more."
      />
      <Screen className="space-y-5">
        <PresentedBy surface="care-library" />
        {/* Fast path into the vet directory */}
        <Link
          to="/vets"
          className="group flex items-center gap-4 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/60 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-white">
            <Icon name="phone" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-extrabold text-ink">Find a rabbit-savvy vet</span>
            <span className="mt-0.5 block text-sm text-slate-500">
              Ohio vets who know bunnies · 24/7 exotics emergencies
            </span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
        </Link>

        <div className="space-y-2.5">
          <SectionLabel>Articles on bunny care</SectionLabel>
          <div className="space-y-2.5">
            {articles.map((a) => (
              <ActionCard
                key={a.slug}
                to={`/learn/${a.slug}`}
                title={a.title}
                subtitle={a.summary}
                icon={asIconName(a.icon)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <SectionLabel>More resources</SectionLabel>
          <Card className="divide-y divide-slate-100 !p-0">
            <a
              href={ohrr.links.columbusHrs}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3"
            >
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-brand-blue">
                Columbus House Rabbit Society — Rabbit Care and Behavior Booklet
                <Icon name="external" size={14} className="shrink-0 text-slate-300" />
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Go to the CHRS site, click “Rabbit Care”, then download the booklet.
              </span>
            </a>
            <a
              href={ohrr.links.houseRabbitSociety}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-brand-blue"
            >
              House Rabbit Society — Rabbit Care Guide
              <Icon name="external" size={14} className="shrink-0 text-slate-300" />
            </a>
          </Card>
        </div>

        <p className="px-1 text-xs leading-relaxed text-slate-400">{CARE_DISCLAIMER}</p>
      </Screen>
    </>
  )
}
