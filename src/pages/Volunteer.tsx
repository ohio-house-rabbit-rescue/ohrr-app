import { volunteerWays, ohrr } from '../data/ohrr'
import { PageHeader, Screen, Card, IconTile, btn } from '../components/ui'

export default function Volunteer() {
  return (
    <>
      <PageHeader
        icon="users"
        title="Volunteer"
        subtitle="OHRR is volunteer-powered. A little time goes a long way for the buns."
      />
      <Screen className="space-y-4">
        <div className="space-y-3">
          {volunteerWays.map((w) => (
            <Card key={w.title} className="flex items-start gap-4">
              <IconTile name={w.icon} />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[15px] font-extrabold text-ink">{w.title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{w.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-b from-brand-blue to-brand-blue-dark px-6 py-7 text-center text-white">
          <h2 className="font-display text-lg font-extrabold">Ready to help?</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-white/85">
            Fill out OHRR’s volunteer form and the team will be in touch.
          </p>
          <a
            href={ohrr.links.volunteer}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.primary} mt-4`}
          >
            Become a volunteer
          </a>
        </div>
      </Screen>
    </>
  )
}
