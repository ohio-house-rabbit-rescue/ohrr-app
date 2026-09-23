import { Link } from 'react-router-dom'
import { event } from '../data/event'
import { useBunfestFeatures } from '../features/bunfest/thisYear'
import { BUNFEST_HUB } from '../data/content'
import { useBunfestEvent, eventDate, eventTime } from '../lib/events'
import { Screen, SectionLabel, ActionCard, IconTile, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'
import PresentedBy from '../features/sponsors/PresentedBy'
import ShareButton, { appLink } from '../components/ShareButton'

export default function BunfestHome() {
  // This year's cards, from Staff → BunFest (bundled 2026 list until then)
  const { features } = useBunfestFeatures()
  // Date / time / venue / theme from the shared BunFest event record (live
  // when staff have published it, else the bundled seed) — never stale.
  const bunfest = useBunfestEvent()
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-blue to-brand-blue-dark px-5 pb-7 pt-6 text-white">
        {/* This year's event logo / theme art (swappable — see event.logo) */}
        <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
          <img
            src={event.logo}
            alt={`Midwest BunFest ${event.logoYear} logo`}
            className="mx-auto block h-auto w-full max-w-[300px]"
          />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
          <Icon name="sparkles" size={13} /> Presented by Ohio House Rabbit Rescue
        </span>
        <h1 className="mt-3 font-display text-3xl font-black leading-tight">
          The Midwest’s biggest rabbit party
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/90">{event.tagline}</p>
        {bunfest.theme && (
          <p className="mt-2 text-sm font-bold text-white">
            {new Date(bunfest.startsAt).getFullYear()} theme: {bunfest.theme}
          </p>
        )}

        <div className="mt-4 space-y-1.5 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="calendar" size={16} className="text-white/80" /> {eventDate(bunfest)}
          </span>
          <span className="flex items-center gap-2">
            <Icon name="clock" size={16} className="text-white/80" /> {eventTime(bunfest)}
          </span>
          <span className="flex items-center gap-2">
            <Icon name="mappin" size={16} className="text-white/80" /> {bunfest.venue} · {bunfest.city}
          </span>
        </div>

        <div className="mt-5 flex gap-2.5">
          <Link to="/bunfest/schedule" className={btn.white}>
            View schedule
          </Link>
          <a href={event.links.tickets} target="_blank" rel="noopener noreferrer" className={btn.primary}>
            Buy tickets
          </a>
        </div>
      </section>

      <Screen className="space-y-6">
        <PresentedBy surface="bunfest" />

        <ShareButton
          className="block"
          label="Share BunFest"
          filename="midwest-bunfest.png"
          caption={`Midwest BunFest — ${event.date}, ${event.venue.name}, ${event.venue.city}. A day of bunnies, education and vendors, presented by Ohio House Rabbit Rescue.`}
          card={{
            kicker: 'Presented by OHRR',
            title: `Midwest BunFest ${event.edition}`,
            subtitle: `${event.date} · ${event.timeLabel} · ${event.venue.name}, ${event.venue.city}`,
            photoUrl: event.logo,
            link: appLink('/bunfest'),
            cta: 'Come and meet the bunnies',
          }}
        />
        {/* At the festival */}
        <div className="space-y-2.5">
          <SectionLabel>At the festival</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((a) => {
              const inner = (
                <>
                  <IconTile name={a.icon} tone="orange" />
                  <span className="mt-2 block font-display text-sm font-extrabold text-ink">{a.title}</span>
                  {a.text && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{a.text}</span>}
                </>
              )
              const cls =
                'rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'
              // A card with nowhere to go is still worth showing — it tells
              // visitors what's on.
              if (a.href) {
                return (
                  <a key={a.id} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {inner}
                  </a>
                )
              }
              if (!a.to) {
                return (
                  <div key={a.id} className={cls.replace(' transition hover:-translate-y-0.5 hover:shadow-md', '')}>
                    {inner}
                  </div>
                )
              }
              return (
                <Link key={a.id} to={a.to} className={cls}>
                  {inner}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Explore */}
        <div className="space-y-2.5">
          <SectionLabel>Explore BunFest</SectionLabel>
          <div className="space-y-2.5">
            {BUNFEST_HUB.map((h) => (
              <ActionCard key={h.to} to={h.to} title={h.title} subtitle={h.subtitle} icon={h.icon} tone={h.tone} />
            ))}
          </div>
        </div>

        <Card className="border-slate-200 bg-white">
          <p className="text-[13px] leading-relaxed text-slate-500">
            The schedule, map and rabbit rules to print are on the{' '}
            <a
              className="font-bold text-brand-blue"
              href={event.links.festivalSite}
              target="_blank"
              rel="noopener noreferrer"
            >
              BunFest website
            </a>
            . The current official site is{' '}
            <a
              className="font-bold text-brand-blue"
              href={event.links.bunfest}
              target="_blank"
              rel="noopener noreferrer"
            >
              midwestbunfest.org
            </a>
            .
          </p>
        </Card>
      </Screen>
    </div>
  )
}
