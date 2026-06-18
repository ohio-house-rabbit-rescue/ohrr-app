import { Link } from 'react-router-dom'
import { ohrr } from '../data/ohrr'
import { event } from '../data/event'
import { OHRR_HUB } from '../data/content'
import { Screen, SectionLabel, ActionCard, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function OhrrHome() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-blue to-brand-blue-dark px-5 pb-7 pt-6 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          Columbus, Ohio · 501(c)(3)
        </span>
        <h1 className="mt-3 font-display text-3xl font-black leading-tight">
          Every bunny deserves a home
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{ohrr.tagline}</p>
        <div className="mt-5 flex gap-2.5">
          <Link to="/adopt" className={btn.white}>
            Adopt a rabbit
          </Link>
          <Link to="/support" className={btn.primary}>
            Donate
          </Link>
        </div>
      </section>

      <Screen className="space-y-6">
        {/* The big Midwest BunFest button — teased in BunFest's own colors */}
        <Link
          to="/bunfest"
          className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#1690bf] to-[#0f7197] p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          {/* This year's event logo / theme art (swappable — see event.logo) */}
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <img
              src={event.logo}
              alt={`Midwest BunFest ${event.logoYear} logo`}
              className="mx-auto block h-auto w-full max-w-[280px]"
            />
          </div>
          <div className="relative mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
              <Icon name="star" size={13} /> Our flagship event · {event.logoYear} theme
            </span>
            <p className="mt-2 max-w-[17rem] text-sm text-white/90">
              The biggest rabbit festival in the Eastern U.S.
            </p>
            <span className="mt-2 flex items-center gap-1.5 text-sm font-bold text-white">
              <Icon name="calendar" size={14} className="shrink-0 text-white/90" /> {event.date}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#e0950f] px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition group-hover:bg-[#bd7c08]">
              Enter BunFest <Icon name="chevron" size={16} />
            </span>
          </div>
        </Link>

        {/* OHRR sections */}
        <div className="space-y-2.5">
          <SectionLabel>How you can help</SectionLabel>
          <div className="space-y-2.5">
            {OHRR_HUB.map((h) => (
              <ActionCard key={h.to} to={h.to} title={h.title} subtitle={h.subtitle} icon={h.icon} tone={h.tone} />
            ))}
          </div>
        </div>

        {/* Visit mini-card — the address lives in the appointment flow, not here */}
        <Card className="border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Icon name="clock" size={15} className="shrink-0 text-brand-blue" /> {ohrr.hoursShort}
          </div>
          <Link
            to="/appointment"
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            Visits are by appointment — schedule one <Icon name="chevron" size={14} />
          </Link>
        </Card>
      </Screen>
    </div>
  )
}
