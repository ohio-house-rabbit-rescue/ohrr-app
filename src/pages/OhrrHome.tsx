import { Link } from 'react-router-dom'
import { ohrr, RABBIT_READY } from '../data/ohrr'
import { easterAhead } from '../lib/season'
import { useOrgProfile } from '../lib/orgProfile'
import { event } from '../data/event'
import { OHRR_HUB, OHRR_QUICK_ACTIONS } from '../data/content'
import { slideVisual, appPath, type HeroSlide } from '../data/heroSlides'
import { useHeroSlides } from '../lib/heroSlides'
import { useBunfestEvent, eventDate } from '../lib/events'
import { Screen, SectionLabel, ActionCard, Card, btn } from '../components/ui'
import { PhotoCard, IconPhotoTile } from '../components/PhotoCard'
import { Icon } from '../components/icons'
import AnnouncementsBanner from '../components/AnnouncementsBanner'
import PresentedBy from '../features/sponsors/PresentedBy'
import MyBunnyHomeCard from '../features/mybunny/HomeCard'
import MyBookingsCard from '../features/bookings/MyBookingsCard'
import HomeSearch from '../features/bunnyhelp/HomeSearch'
import ForYou from '../features/account/ForYou'

// One top card, in the existing "big BunFest button" styling. The BunFest slide
// keeps BunFest's own palette + logo and shows the live event date; any other
// slide uses the OHRR brand gradient. Its picture slot follows the sponsor rule
// (slideVisual): an uploaded image always wins, an adopt card shows a real
// rabbit, and every other function card shows its fixed line icon centred on
// the tinted top area so the purpose is recognisable at a glance.
function HeroCard({ slide }: { slide: HeroSlide }) {
  const to = appPath(slide.ctaUrl) ?? '/'
  const isBunfest = to === '/bunfest'
  const bunfest = useBunfestEvent()
  const visual = slideVisual(slide)
  const cls = isBunfest ? 'from-[#1690bf] to-[#0f7197]' : 'from-brand-blue to-brand-blue-dark'
  const days = isBunfest ? Math.ceil((new Date(bunfest.startsAt).getTime() - Date.now()) / 86_400_000) : NaN
  const countdown = Number.isFinite(days) && days > 0 ? `In ${days} day${days === 1 ? '' : 's'}` : null

  return (
    <Link
      to={to}
      className={`group relative w-[76%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-3xl bg-gradient-to-br ${cls} text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0`}
    >
      <div className={`relative h-[118px] ${isBunfest ? 'bg-white p-2.5' : 'bg-white/10'}`}>
        {visual &&
          ('image' in visual ? (
            isBunfest ? (
              <img
                src={visual.image}
                alt={`Midwest BunFest ${event.logoYear} logo`}
                className="mx-auto block h-full w-full object-contain"
              />
            ) : (
              <img src={visual.image} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <span aria-hidden="true" className="flex h-full items-center justify-center">
              <Icon name={visual.icon} size={68} className="text-white/95 transition duration-300 group-hover:scale-[1.06]" />
            </span>
          ))}
        {countdown && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-[#e0950f] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">
            {countdown}
          </span>
        )}
      </div>
      <div className="p-3.5">
        {isBunfest && (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-white/85">
            <Icon name="star" size={11} /> Our flagship event{bunfest.theme ? ` · ${bunfest.theme}` : ''}
          </span>
        )}
        <h2 className="mt-0.5 line-clamp-2 font-display text-[17px] font-black leading-tight">{slide.headline}</h2>
        <p className="mt-1 line-clamp-1 text-[12px] font-semibold text-white/85">
          {isBunfest ? `${eventDate(bunfest)}${bunfest.venue ? ` · ${bunfest.venue}` : ''}` : slide.subline ?? ''}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-extrabold text-white">
          {slide.ctaLabel ?? (isBunfest ? 'Enter BunFest' : 'Open')} <Icon name="chevron" size={14} />
        </span>
      </div>
    </Link>
  )
}

// Before anyone buys or adopts: OHRR's two-minute check (2026-09-24, OHRR's
// research: rabbits are given up almost always for human reasons).
function ThinkingAboutARabbit() {
  return (
    <div className="rounded-2xl border border-brand-orange/40 bg-brand-orange-50 p-4">
      <h2 className="font-display text-lg font-black leading-tight text-ink">Thinking about getting a rabbit?</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">
        Read this before Easter, before the pet store, before the kids ask twice. Seven honest questions, two minutes.
      </p>
      <Link to={RABBIT_READY} className={`${btn.primary} mt-3 min-h-[44px] w-full`}>
        Take the two-minute check
      </Link>
    </div>
  )
}

// Shows by itself in the seven weeks before Easter (lib/season.ts) — surrender
// requests rise two to three months after Easter.
function EasterReminder() {
  const easter = easterAhead()
  if (!easter) return null
  return (
    <Link
      to={RABBIT_READY}
      className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-brand-orange/40 bg-brand-orange-50 px-4 py-3 text-sm text-slate-800 transition hover:border-brand-orange"
    >
      <span className="min-w-0 flex-1">
        <strong className="text-ink">
          Easter is {easter.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Thinking about a bunny?
        </strong>{' '}
        Read this first.
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-brand-orange" />
    </Link>
  )
}

export default function OhrrHome() {
  // Hours / phone / address staff can change (Staff → Settings → OHRR details)
  const org = useOrgProfile()
  // Top cards: active hero slides (live from the shared hero_slides table when
  // present, else the bundled seed) — the BunFest slide first by sort order.
  const heroSlides = useHeroSlides('hero')
  const featuredSlides = useHeroSlides('featured')
  const slides = [...heroSlides, ...featuredSlides]

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-blue to-brand-blue-dark px-5 pb-4 pt-4 text-white">
        <h1 className="font-display text-2xl font-black leading-tight">
          Every bunny deserves a home
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-white/85">{ohrr.tagline}</p>
      </section>

      <Screen className="space-y-6">
        <EasterReminder />
        {/* Live staff-posted notices (hidden when there are none) */}
        <AnnouncementsBanner />
        {/* What's new for the things they ticked, since they last looked (hidden when nothing is),
            and — once, for people who haven't decided — the question about volunteer notifications */}
        <ForYou notifyPrompt />
        <PresentedBy surface="home" />

        {/* My Bunny first — the user's own rabbit is the daily reason to open the app —
            with Bunny Help right under it, one line: "my bunny is…" → OHRR's own guidance */}
        <div className="space-y-3">
          <MyBunnyHomeCard />
          <HomeSearch />
          {/* Shifts and appointments booked on this phone (hidden when there are none) */}
          <MyBookingsCard compact />
        </div>

        {/* Top cards — hero slides */}
        {slides.length > 0 && (
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slides.map((s) => (
              <HeroCard key={s.id} slide={s} />
            ))}
          </div>
        )}

        {/* Quick actions — fixed line icons for functions; a real rabbit photo only for Adopt */}
        <div className="space-y-2.5">
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {OHRR_QUICK_ACTIONS.map((q) =>
              q.icon ? (
                <IconPhotoTile key={q.to} to={q.to} title={q.title} subtitle={q.subtitle} icon={q.icon} variant="tile" />
              ) : (
                <PhotoCard key={q.to} to={q.to} title={q.title} subtitle={q.subtitle} photo={q.photo} variant="tile" />
              ),
            )}
          </div>
        </div>

        <ThinkingAboutARabbit />

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
          {org.notice && (
            <p className="mb-2 rounded-xl bg-brand-orange-50 px-3 py-2 text-sm font-bold text-brand-orange-dark">
              {org.notice}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Icon name="clock" size={18} className="shrink-0 text-brand-blue" /> Hop Shop {org.hours_short} ·{' '}
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
