import { Link } from 'react-router-dom'
import { event, activities } from '../data/event'
import { BUNFEST_HUB } from '../data/content'
import { Screen, SectionLabel, ActionCard, IconTile, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function BunfestHome() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-blue to-brand-blue-dark px-5 pb-7 pt-6 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
          <Icon name="sparkles" size={13} /> Presented by Ohio House Rabbit Rescue
        </span>
        <h1 className="mt-3 font-display text-3xl font-black leading-tight">
          The Midwest’s biggest rabbit party
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/90">{event.tagline}</p>

        <div className="mt-4 space-y-1.5 text-sm">
          <span className="flex items-center gap-2">
            <Icon name="calendar" size={16} className="text-white/80" /> {event.date}
          </span>
          <span className="flex items-center gap-2">
            <Icon name="clock" size={16} className="text-white/80" /> {event.timeLabel}
          </span>
          <span className="flex items-center gap-2">
            <Icon name="mappin" size={16} className="text-white/80" /> {event.venue.name} · {event.venue.city}
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
        {/* At the festival */}
        <div className="space-y-2.5">
          <SectionLabel>At the festival</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {activities.map((a) => (
              <a
                key={a.title}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <IconTile name={a.icon} tone="orange" />
                <span className="mt-2 block font-display text-sm font-extrabold text-ink">{a.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{a.text}</span>
              </a>
            ))}
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
            Official details and tickets at{' '}
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
