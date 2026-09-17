import { Link } from 'react-router-dom'
import { ohrr } from '../data/ohrr'
import { event } from '../data/event'
import { OHRR_HUB, OHRR_QUICK_ACTIONS } from '../data/content'
import { slideImage, appPath, type HeroSlide } from '../data/heroSlides'
import { useHeroSlides } from '../lib/heroSlides'
import { useBunfestEvent, eventDate } from '../lib/events'
import { Screen, SectionLabel, ActionCard, Card, btn } from '../components/ui'
import { PhotoCard } from '../components/PhotoCard'
import { Icon } from '../components/icons'
import AnnouncementsBanner from '../components/AnnouncementsBanner'
import PresentedBy from '../features/sponsors/PresentedBy'

// One top card, in the existing "big BunFest button" styling. The BunFest slide
// keeps BunFest's own palette + logo and shows the live event date; any other
// slide uses the OHRR brand gradient with its photo.
function HeroCard({ slide }: { slide: HeroSlide }) {
  const to = appPath(slide.ctaUrl) ?? '/'
  const isBunfest = to.startsWith('/bunfest')
  const bunfest = useBunfestEvent()
  const image = slideImage(slide)
  const cls = isBunfest
    ? 'from-[#1690bf] to-[#0f7197]'
    : 'from-brand-blue to-brand-blue-dark'
  const ctaCls = isBunfest ? 'bg-[#e0950f] group-hover:bg-[#bd7c08]' : 'bg-brand-orange group-hover:bg-brand-orange-dark'

  return (
    <Link
      to={to}
      className={`group relative block overflow-hidden rounded-3xl bg-gradient-to-br ${cls} p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}
    >
      {image &&
        (isBunfest ? (
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <img
              src={image}
              alt={`Midwest BunFest ${event.logoYear} logo`}
              className="mx-auto block h-auto w-full max-w-[280px]"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-white/10 shadow-sm">
            <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      <div className="relative mt-3">
        {isBunfest && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
            <Icon name="star" size={13} /> Our flagship event
            {bunfest.theme ? ` · ${bunfest.theme}` : ''}
          </span>
        )}
        <h2 className="mt-2 font-display text-xl font-black leading-tight">{slide.headline}</h2>
        {slide.subline && <p className="mt-1 max-w-[19rem] text-sm text-white/90">{slide.subline}</p>}
        {isBunfest && (
          <span className="mt-2 flex items-center gap-1.5 text-sm font-bold text-white">
            <Icon name="calendar" size={14} className="shrink-0 text-white/90" /> {eventDate(bunfest)}
            {bunfest.venue ? ` · ${bunfest.venue}` : ''}
          </span>
        )}
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${ctaCls} px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition`}
        >
          {slide.ctaLabel ?? (isBunfest ? 'Enter BunFest' : 'Open')} <Icon name="chevron" size={16} />
        </span>
      </div>
    </Link>
  )
}

export default function OhrrHome() {
  // Top cards: active hero slides (live from the shared hero_slides table when
  // present, else the bundled seed) — the BunFest slide first by sort order.
  const slides = useHeroSlides('hero')

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
        {/* Live staff-posted notices (hidden when there are none) */}
        <AnnouncementsBanner />
        <PresentedBy surface="home" />

        {/* Top cards — hero slides */}
        {slides.length > 0 && (
          <div className="space-y-3">
            {slides.map((s) => (
              <HeroCard key={s.id} slide={s} />
            ))}
          </div>
        )}

        {/* Quick actions — real photos, no icons */}
        <div className="space-y-2.5">
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            {OHRR_QUICK_ACTIONS.map((q) => (
              <PhotoCard key={q.to} to={q.to} title={q.title} subtitle={q.subtitle} photo={q.photo} />
            ))}
          </div>
        </div>

        {/* OHRR sections */}
        <div className="space-y-2.5">
          <SectionLabel>Explore</SectionLabel>
          <div className="space-y-2.5">
            {OHRR_HUB.map((h) => (
              <ActionCard key={h.to} to={h.to} title={h.title} subtitle={h.subtitle} icon={h.icon} tone={h.tone} />
            ))}
          </div>
        </div>

        {/* Visit mini-card */}
        <Card className="border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Icon name="clock" size={15} className="shrink-0 text-brand-blue" /> Hop Shop {ohrr.hoursShort} ·{' '}
            {ohrr.adoptionsNote.toLowerCase()}
          </div>
          <Link
            to="/appointment"
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            Schedule a visit <Icon name="chevron" size={14} />
          </Link>
        </Card>
      </Screen>
    </div>
  )
}
