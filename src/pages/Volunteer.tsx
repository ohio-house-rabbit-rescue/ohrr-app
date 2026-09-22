import { Link } from 'react-router-dom'
import {
  volunteerWays,
  volunteerIntro,
  otherVolunteerNeeds,
  otherNeedsNote,
  groupVisitNote,
  OHRR_CONTACT_EMAIL,
} from '../data/volunteer'
import { isFull, remainingLabel, useVolunteerOpportunities } from '../lib/volunteerOpps'
import { PageHeader, Screen, SectionLabel, ActionCard, Card, btn } from '../components/ui'
import MyBookingsCard from '../features/bookings/MyBookingsCard'
import MyHoursCard from '../features/volunteers/MyHoursCard'
import { Icon } from '../components/icons'
import PresentedBy from '../features/sponsors/PresentedBy'

function signupHref(role: string, code: string, item?: string) {
  const params = new URLSearchParams({ role, code })
  if (item) params.set('item', item)
  return `/volunteer/signup?${params.toString()}`
}

export default function Volunteer() {
  // Staff-posted one-off needs (events & fundraising) show here when present.
  const eventNeeds = useVolunteerOpportunities('events')

  return (
    <>
      <PageHeader
        icon="users"
        title="Volunteer"
        subtitle="We truly are one big, happy volunteer family and we would love to have you join us."
      />
      <Screen className="space-y-6">
        <PresentedBy surface="volunteer" />
        <MyBookingsCard />
        <MyHoursCard />
        <p className="px-1 text-sm leading-relaxed text-slate-600">{volunteerIntro}</p>

        {/* The four real positions */}
        <div className="space-y-2.5">
          <SectionLabel>Available volunteer positions</SectionLabel>
          <div className="space-y-2.5">
            {volunteerWays.map((w, i) => (
              <ActionCard
                key={w.slug}
                to={`/volunteer/${w.slug}`}
                title={w.title}
                subtitle={w.tagline}
                icon={w.icon}
                tone={i === 3 ? 'orange' : 'blue'}
              />
            ))}
          </div>
          <p className="px-1 text-xs leading-relaxed text-slate-500">{groupVisitNote}</p>
        </div>

        {/* Live: events needing hands */}
        {eventNeeds && eventNeeds.length > 0 && (
          <div className="space-y-2.5">
            <SectionLabel>Events needing hands</SectionLabel>
            <div className="space-y-3">
              {eventNeeds.map((o) => (
                <Card key={o.id}>
                  <h3 className="font-display text-base font-extrabold text-ink">{o.title}</h3>
                  {o.when_text && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <Icon name="calendar" size={14} className="shrink-0 text-brand-blue" />
                      {o.when_text}
                    </p>
                  )}
                  {o.where_text && (
                    <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-600">
                      <Icon name="mappin" size={14} className="shrink-0 text-brand-blue" />
                      {o.where_text}
                    </p>
                  )}
                  {remainingLabel(o) && (
                    <p className={`mt-1 text-xs font-bold uppercase tracking-wide ${isFull(o) ? 'text-slate-400' : 'text-brand-orange'}`}>
                      {remainingLabel(o)}
                    </p>
                  )}
                  {o.spots && <p className="mt-1 text-xs font-semibold text-slate-500">{o.spots}</p>}
                  {o.detail && <p className="mt-2 text-sm leading-relaxed text-slate-600">{o.detail}</p>}
                  <Link
                    to={signupHref('Event & Fundraising Volunteer', 'EVENTS', o.title)}
                    className={`${isFull(o) ? btn.outline : btn.blue} mt-3 w-full`}
                  >
                    {isFull(o) ? 'Ask to be on the list' : 'Sign up to help'} <Icon name="chevron" size={16} />
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Two doors the market data says matter most: fostering (students, renters,
            young adults) and digital help (the skill OHRR's volunteer base is short of) */}
        <div className="space-y-2.5">
          <SectionLabel>Two more ways in</SectionLabel>
          <Card className="space-y-2">
            <h3 className="font-display text-base font-extrabold text-ink">Foster a rabbit</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              A few weeks with a rabbit in your home while they recover or wait for a family. Renters and students welcome. The easiest first step there is.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/volunteer/foster" className={`${btn.primary} px-4 py-2`}>
                I’m interested <Icon name="chevron" size={14} />
              </Link>
              <Link to="/info/foster-a-rabbit" className={`${btn.outline} px-4 py-2`}>
                What it involves
              </Link>
            </div>
          </Card>
          <Card className="space-y-2">
            <h3 className="font-display text-base font-extrabold text-ink">Help OHRR online</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Good with Instagram, TikTok or short video? An hour a week posting from the ready-made Share kit reaches the people the rescue is missing. Students: this counts as real experience.
            </p>
            <Link to={signupHref('Social media & digital content', 'DIGITAL')} className={`${btn.blue} px-4 py-2`}>
              Count me in <Icon name="chevron" size={14} />
            </Link>
          </Card>
        </div>

        {/* Other volunteer needs */}
        <div className="space-y-2.5">
          <SectionLabel>Other volunteer needs</SectionLabel>
          <Card className="divide-y divide-slate-100 !p-0">
            {otherVolunteerNeeds.map((n) => (
              <Link
                key={n}
                to={signupHref(n, 'OTHER')}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-slate-50"
              >
                {n}
                <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </Card>
          <p className="px-1 text-xs leading-relaxed text-slate-500">
            {otherNeedsNote}{' '}
            <a href={`mailto:${OHRR_CONTACT_EMAIL}`} className="break-all font-semibold text-brand-blue">
              {OHRR_CONTACT_EMAIL}
            </a>
          </p>
        </div>

        {/* General interest — the in-app form */}
        <div className="rounded-2xl bg-gradient-to-b from-brand-blue to-brand-blue-dark px-6 py-7 text-center text-white">
          <h2 className="font-display text-lg font-extrabold">Not sure where to start?</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-white/85">
            Tell us a bit about you and how you’d like to help — OHRR will follow up to get you
            started.
          </p>
          <Link to={signupHref('General volunteer', 'GENERAL')} className={`${btn.primary} mt-4`}>
            Tell OHRR about you
            <Icon name="chevron" size={16} />
          </Link>
        </div>
      </Screen>
    </>
  )
}
