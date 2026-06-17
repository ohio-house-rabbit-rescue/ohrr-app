import { Link } from 'react-router-dom'
import { volunteerWays } from '../data/volunteer'
import { PageHeader, Screen, SectionLabel, ActionCard, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Volunteer() {
  return (
    <>
      <PageHeader
        icon="users"
        title="Volunteer"
        subtitle="OHRR is volunteer-powered. A little time goes a long way for the buns."
      />
      <Screen className="space-y-6">
        {/* Become a volunteer — now an in-app flow, not an outbound link */}
        <div className="rounded-2xl bg-gradient-to-b from-brand-blue to-brand-blue-dark px-6 py-7 text-center text-white">
          <h2 className="font-display text-lg font-extrabold">Ready to help?</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-white/85">
            Tell us a bit about you and how you’d like to help — OHRR will follow up to get you
            started.
          </p>
          <Link
            to="/volunteer/signup?role=General%20volunteer&code=GENERAL"
            className={`${btn.primary} mt-4`}
          >
            Become a volunteer
            <Icon name="chevron" size={16} />
          </Link>
        </div>

        {/* Ways to help — each opens an in-app detail with real things to do */}
        <div className="space-y-2.5">
          <SectionLabel>Ways to help</SectionLabel>
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
        </div>

        <p className="flex items-center justify-center gap-2 px-1 text-center text-xs text-slate-400">
          <Badge tone="slate">Sample</Badge>
          Shifts, bunnies and runs inside are template data — OHRR’s live schedule will appear here.
        </p>
      </Screen>
    </>
  )
}
