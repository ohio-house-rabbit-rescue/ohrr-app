import { Link } from 'react-router-dom'
import {
  surrenderIntro,
  surrenderSteps,
  surrenderDonation,
  afterSurrender,
  goodSamaritanNote,
  surrenderContact,
  fullPolicies,
} from '../data/surrender'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Surrender() {
  return (
    <>
      <PageHeader
        icon="heart"
        title="Surrendering a Rabbit"
        subtitle="Let’s see if we can help you keep your bunny first — and if not, here’s exactly how surrender works."
      />
      <Screen className="space-y-6">
        {/* Supportive lead */}
        <Card className="border-brand-blue/20 bg-brand-blue-50/50">
          <p className="text-sm leading-relaxed text-slate-700">{surrenderIntro}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`mailto:${surrenderContact.email}?subject=Rabbit%20surrender%20inquiry`} className={`${btn.blue} px-4 py-2`}>
              <Icon name="mail" size={15} /> Email OHRR
            </a>
          </div>
        </Card>

        {/* How it works */}
        <section className="space-y-2.5">
          <SectionLabel>How surrender works</SectionLabel>
          <div className="space-y-3">
            {surrenderSteps.map((s, i) => (
              <Card key={s.title} className="flex gap-3.5">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-black text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-extrabold text-ink">{s.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Donation callout */}
        <Card className="border-brand-orange/30 bg-brand-orange-50/60">
          <div className="flex items-start gap-3">
            <Icon name="heart" size={20} className="mt-0.5 shrink-0 text-brand-orange" />
            <div>
              <h3 className="font-display text-base font-extrabold text-ink">Surrender donation</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                <strong className="font-bold text-ink">{surrenderDonation.single}</strong> for a
                single rabbit ·{' '}
                <strong className="font-bold text-ink">{surrenderDonation.pair}</strong> for a bonded
                pair. This helps cover spay/neuter, food, vet care, and fostering &amp; adoption.
              </p>
            </div>
          </div>
        </Card>

        {/* What happens next */}
        <section className="space-y-2.5">
          <SectionLabel>What happens to your rabbit</SectionLabel>
          <Card>
            <ul className="space-y-2">
              {afterSurrender.map((t) => (
                <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                  <Icon name="heart" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
              OHRR is committed to the preservation of life. Behavioral and medical assessments are
              part of every intake; the full policy, including how rare medical-hardship cases are
              handled, is at the bottom of this page.
            </p>
          </Card>
        </section>

        {/* Forms */}
        <section className="space-y-2.5">
          <SectionLabel>Relinquishment forms</SectionLabel>
          <p className="px-1 text-sm leading-relaxed text-slate-600">{goodSamaritanNote}</p>
          <div className="grid grid-cols-1 gap-2.5">
            <Link
              to="/surrender/form?type=owner"
              className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                <Icon name="book" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold text-ink">
                  Owner Surrender &amp; Relinquishment form
                </span>
                <span className="block text-xs text-slate-500">If the rabbit is yours.</span>
              </span>
              <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
            </Link>
            <Link
              to="/surrender/form?type=good-samaritan"
              className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                <Icon name="book" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold text-ink">
                  Good Samaritan Surrender form
                </span>
                <span className="block text-xs text-slate-500">
                  If you rescued a rabbit that isn’t yours.
                </span>
              </span>
              <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
            </Link>
          </div>
          <p className="px-1 text-xs text-slate-400">
            Fill out the official relinquishment form right here in the app. Please contact OHRR
            first to confirm there’s space.
          </p>
        </section>

        {/* Contact */}
        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Questions?</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">OHRR is run entirely by volunteers, so email is the way to reach them — someone will reply as soon as they can.</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Icon name="mail" size={15} className="shrink-0 text-brand-blue" />
              <a
                href={`mailto:${surrenderContact.email}`}
                className="break-all font-semibold text-brand-blue"
              >
                {surrenderContact.email}
              </a>
            </div>
          </dl>
        </Card>

        {/* Full official policy text, in-app */}
        <section className="space-y-2.5">
          <SectionLabel>Full policies</SectionLabel>
          {fullPolicies.map((p) => (
            <details key={p.title} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 font-display text-sm font-extrabold text-ink">
                {p.title}
                <Icon name="chevron" size={16} className="shrink-0 text-slate-400" />
              </summary>
              <div className="border-t border-slate-100 px-4 py-3">
                {p.body.split('\n\n').map((para, i) => (
                  <p key={i} className="mb-2.5 text-sm leading-relaxed text-slate-600 last:mb-0">
                    {para}
                  </p>
                ))}
              </div>
            </details>
          ))}
          <p className="px-1 text-xs text-slate-400">
            Official text from Ohio House Rabbit Rescue’s Surrender &amp; Relinquishment Policy and
            Admissions Policy.
          </p>
        </section>
      </Screen>
    </>
  )
}
