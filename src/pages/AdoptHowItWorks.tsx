import { Link } from 'react-router-dom'
import {
  ohrr,
  adoptionSteps,
  stillDecidingNote,
  matchmakingNote,
  bunnyDateSteps,
  adoptionPolicy,
  adoptionPolicyRevised,
} from '../data/ohrr'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'

export function AdoptionStepsCard() {
  return (
    <div className="space-y-3">
      {adoptionSteps.map((s, i) => (
        <Card key={s.title} className="flex gap-3.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-black text-white">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[15px] font-extrabold text-ink">{s.title}</h3>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
            {i === 0 && (
              <Link
                to="/adopt/how-it-works#policy"
                className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-brand-blue"
              >
                Read the policy summary <Icon name="chevron" size={14} />
              </Link>
            )}
            {i === 1 && (
              <Link to="/adopt/apply" className={`${btn.primary} mt-2.5 px-4 py-2`}>
                Start the adoption application <Icon name="chevron" size={14} />
              </Link>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function AdoptHowItWorks() {
  return (
    <>
      <PageHeader
        icon="heart"
        title="How adopting works"
        subtitle="Three steps, by appointment on Saturdays and Sundays — plus OHRR’s Adoption Policy in plain language."
      />
      <Screen className="space-y-6">
        <Link
          to="/adopt"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Adoptable rabbits
        </Link>

        <section className="space-y-2.5">
          <SectionLabel>The three steps</SectionLabel>
          <AdoptionStepsCard />
        </section>

        <Card className="border-brand-blue/20 bg-brand-blue-50/60">
          <h3 className="font-display text-base font-extrabold text-ink">Still deciding?</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{stillDecidingNote}</p>
          <a
            href={`mailto:${ohrr.email}?subject=Bunny%20parent%20appointment`}
            className={`${btn.blue} mt-3 px-4 py-2`}
          >
            <Icon name="mail" size={15} /> Email to set up an hour-long visit
          </a>
        </Card>

        <section className="space-y-2.5">
          <SectionLabel>Free bunny matchmaking</SectionLabel>
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">{matchmakingNote}</p>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">
              What to expect at a bunny date
            </p>
            <ol className="mt-2 space-y-2.5">
              {bunnyDateSteps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-xs font-bold text-brand-blue">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-brand-blue">
              <Link to="/learn/bonding-bunnies" className="inline-flex items-center gap-1">
                Tips for bonding bunnies <Icon name="chevron" size={13} />
              </Link>
              <Link to="/services" className="inline-flex items-center gap-1">
                Request a bonding session <Icon name="chevron" size={13} />
              </Link>
            </div>
          </Card>
        </section>

        <section className="space-y-2.5">
          <SectionLabel>See the bunnies elsewhere</SectionLabel>
          <Card className="divide-y divide-slate-100 !p-0">
            <a
              href={ohrr.links.petfinder}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-brand-blue"
            >
              OHRR’s bunnies on Petfinder <Icon name="external" size={14} className="shrink-0 text-slate-300" />
            </a>
            <a
              href={ohrr.links.adoptAPet}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-brand-blue"
            >
              OHRR’s bunnies on Adopt-A-Pet <Icon name="external" size={14} className="shrink-0 text-slate-300" />
            </a>
          </Card>
        </section>

        <section id="policy" className="space-y-2.5 scroll-mt-20">
          <SectionLabel>Adoption Policy — the summary</SectionLabel>
          <p className="px-1 text-xs text-slate-400">
            Ohio House Rabbit Rescue, Inc. · {adoptionPolicyRevised}
          </p>
          <div className="space-y-2.5">
            {adoptionPolicy.map((s) => (
              <details key={s.heading} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm" open={s.heading === 'Adoption fee'}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 font-display text-sm font-extrabold text-ink">
                  {s.heading}
                  <Icon name="chevron" size={16} className="shrink-0 text-slate-400" />
                </summary>
                <div className="border-t border-slate-100 px-4 py-3">
                  <p className="text-sm leading-relaxed text-slate-600">{s.text}</p>
                </div>
              </details>
            ))}
          </div>
          <a
            href={ohrr.links.policy}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.outline} w-full`}
          >
            Full Adoption Policy (PDF) <Icon name="external" size={14} />
          </a>
        </section>

        <Card className="border-brand-orange/20 bg-brand-orange-50/50">
          <p className="text-sm leading-relaxed text-slate-600">
            Adoption questions? Email{' '}
            <a href={`mailto:${ohrr.email}`} className="break-all font-semibold text-brand-blue">
              {ohrr.email}
            </a>{' '}
            or call{' '}
            <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
              {ohrr.phone}
            </a>
            . Adoptions are by appointment at the Adoption Center, {ohrr.address}.
          </p>
        </Card>
      </Screen>
    </>
  )
}
