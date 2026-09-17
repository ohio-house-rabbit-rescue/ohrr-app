import { Link } from 'react-router-dom'
import { ohrr } from '../data/ohrr'
import {
  mission,
  vision,
  background,
  majorGoals,
  adoptionCenter,
  volunteerFamily,
  familyThanks,
} from '../data/about'
import { mapsUrl } from '../lib/events'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'

function Row({
  icon,
  children,
}: {
  icon: 'mappin' | 'phone' | 'mail' | 'clock' | 'external' | 'info'
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon name={icon} size={15} className="mt-0.5 shrink-0 text-brand-blue" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function About() {
  return (
    <>
      <PageHeader
        icon="info"
        title="About OHRR"
        subtitle="Ohio’s first rescue and adoption center just for rabbits."
      />
      <Screen className="space-y-5">
        <div className="flex justify-center pb-1 pt-2">
          <img src="/ohrr-logo.jpg" alt="Ohio House Rabbit Rescue" className="w-60 max-w-full" />
        </div>

        {/* Visit & contact — parity with the live Contact page */}
        <Card className="space-y-3">
          <h3 className="font-display text-base font-extrabold text-ink">OHRR Adoption Center</h3>
          <Row icon="mappin">
            <a
              href={mapsUrl(ohrr.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
            >
              {ohrr.addressLine1}, {ohrr.addressLine2}
            </a>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{ohrr.directions}</p>
          </Row>
          <Row icon="clock">
            <span className="font-semibold text-ink">Hop Shop hours:</span>{' '}
            <span className="text-slate-600">{ohrr.hopShopHours}</span>
            <p className="text-xs text-slate-500">{ohrr.adoptionsNote}</p>
          </Row>
          <Row icon="phone">
            <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
              {ohrr.phone}
            </a>
          </Row>
          <Row icon="mail">
            <a href={`mailto:${ohrr.email}`} className="break-all font-semibold text-brand-blue">
              {ohrr.email}
            </a>
          </Row>
          <Row icon="mail">
            <span className="text-slate-600">Media inquiries &amp; interviews: </span>
            <a href={`mailto:${ohrr.mediaEmail}`} className="break-all font-semibold text-brand-blue">
              {ohrr.mediaEmail}
            </a>
          </Row>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={ohrr.links.facebook} target="_blank" rel="noopener noreferrer" className={`${btn.outline} px-4 py-2`}>
              Facebook <Icon name="external" size={13} />
            </a>
            <a href={ohrr.links.instagram} target="_blank" rel="noopener noreferrer" className={`${btn.outline} px-4 py-2`}>
              Instagram <Icon name="external" size={13} />
            </a>
            <Link to="/appointment" className={`${btn.blue} px-4 py-2`}>
              Schedule a visit
            </Link>
          </div>
        </Card>

        {/* Mission & Vision */}
        <section className="space-y-2.5">
          <SectionLabel>Mission &amp; vision</SectionLabel>
          <Card>
            <h3 className="font-display text-base font-extrabold text-ink">Our mission</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{mission}</p>
            <h3 className="mt-4 font-display text-base font-extrabold text-ink">Our vision</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{vision}</p>
          </Card>
        </section>

        {/* Background */}
        <section className="space-y-2.5">
          <SectionLabel>Background</SectionLabel>
          <Card className="space-y-2.5">
            {background.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-slate-600">
                {p}
              </p>
            ))}
            <details className="pt-1">
              <summary className="cursor-pointer text-sm font-bold text-brand-blue">Major goals</summary>
              <ul className="mt-2 space-y-2">
                {majorGoals.map((g) => (
                  <li key={g} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                    <Icon name="info" size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                    {g}
                  </li>
                ))}
              </ul>
            </details>
            <details>
              <summary className="cursor-pointer text-sm font-bold text-brand-blue">The Adoption Center</summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{adoptionCenter}</p>
            </details>
          </Card>
        </section>

        {/* Volunteer family */}
        <section className="space-y-2.5">
          <SectionLabel>Volunteer family</SectionLabel>
          <div className="space-y-2.5">
            {volunteerFamily.map((m) => (
              <details key={m.name} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-extrabold text-ink">{m.name}</span>
                    <span className="block text-xs text-slate-500">{m.role}</span>
                  </span>
                  <Icon name="chevron" size={16} className="shrink-0 text-slate-400" />
                </summary>
                <p className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
                  {m.bio}
                </p>
              </details>
            ))}
          </div>
          <p className="px-1 text-xs italic text-slate-500">{familyThanks}</p>
        </section>

        {/* Owner support — lead with "let's help you keep your bunny" */}
        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Need help with your rabbit?</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Before you make any decision, reach out. OHRR offers support and information to help you
            keep your bunny if at all possible.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`mailto:${ohrr.email}`} className={`${btn.outline} px-4 py-2`}>
              <Icon name="mail" size={14} /> Email OHRR
            </a>
            <Link to="/found" className={`${btn.outline} px-4 py-2`}>
              Found a rabbit / surrender
            </Link>
          </div>
        </Card>

        <p className="px-1 text-center text-xs text-slate-400">
          501(c)(3) nonprofit · EIN {ohrr.ein} · est. {ohrr.founded} · no government funds
        </p>
      </Screen>
    </>
  )
}
