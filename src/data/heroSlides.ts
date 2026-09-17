// Hero / featured slides — the bundled seed for the shared `hero_slides` table
// (see supabase/migrations/*_hero_slides.sql). The website's staff area manages
// the live rows; the app's Home screen reads them via useHeroSlides() and falls
// back to this list. `image_url` is null in the DB seed; what a slide shows when
// it has no image is decided by slideVisual() below. (Paths are inlined rather
// than imported from ./photos so scripts/generate-seed-sql.mjs can load this
// file under plain Node; the icons import is type-only, so it is stripped.)
//
// Sponsor rule (same as the website): a card that stands for a FUNCTION (events,
// ways to give, the auction) shows a fixed line icon so people see and remember
// its purpose. A photo is only for things that ARE content — real rabbits, auction
// items, artwork, the BunFest logo.
import type { IconName } from '../components/icons'

export type SlidePlacement = 'hero' | 'featured'

export interface HeroSlide {
  id: string
  placement: SlidePlacement
  headline: string
  subline?: string
  imageUrl?: string
  /** Seed-only (no DB column): the fixed line icon for a function card. */
  icon?: IconName
  ctaLabel?: string
  ctaUrl?: string
  startsAt?: string
  endsAt?: string
  sortOrder: number
}

export const seedHeroSlides: HeroSlide[] = [
  {
    id: 'hero-bunfest-2026',
    placement: 'hero',
    headline: 'Midwest BunFest 2026',
    subline: 'Sunday, October 25 · 10am–4pm · The Makoy, Hilliard — Binky On!',
    ctaLabel: 'Plan your day',
    ctaUrl: '/bunfest',
    endsAt: '2026-10-25T23:59:59-04:00',
    sortOrder: 100,
  },
  {
    id: 'hero-adopt',
    placement: 'hero',
    headline: 'Adopt a rescued rabbit',
    ctaUrl: '/adopt',
    sortOrder: 50,
  },
  {
    id: 'featured-silent-auction',
    placement: 'featured',
    headline: 'Silent Auction preview',
    icon: 'award',
    ctaUrl: '/bunfest/silent-auction',
    sortOrder: 40,
  },
  {
    // Real rabbits are content, so this card keeps a photo (see slideVisual()).
    id: 'featured-adopt',
    placement: 'featured',
    headline: 'Adoptable rabbits',
    ctaUrl: '/adopt',
    sortOrder: 30,
  },
  {
    id: 'featured-events',
    placement: 'featured',
    headline: 'Upcoming events',
    icon: 'calendar',
    ctaUrl: '/events',
    sortOrder: 20,
  },
  {
    id: 'featured-give',
    placement: 'featured',
    headline: 'Ways to give',
    icon: 'gift',
    ctaUrl: '/give',
    sortOrder: 10,
  },
]

// Bundled artwork used when a slide has no image_url (keyed by the CTA target).
// Only content gets a picture: the BunFest logo and a real rabbit for Adopt.
// Every other link shows its fixed icon (ROUTE_ICONS).
export const SLIDE_FALLBACK_IMAGES: Record<string, string> = {
  '/bunfest': '/bunfest-2026-logo.png',
  '/adopt': '/sample-bunnies/bunny-lop-caramel.jpg',
}

// The real-rabbit photo for an adopt card that has no uploaded image.
export const ADOPT_PHOTO = SLIDE_FALLBACK_IMAGES['/adopt']

// The standard icon for each link — the same meanings the website uses (its /give
// is the app's /support, /learn/vets is /vets, /surrender is /found, and
// /bunfest/silent-auction is /bunfest/auction). Ordered so the longest matching
// route wins (/partners/perks → ticket, any other /partners/… → star).
const ROUTE_ICONS: [route: string, icon: IconName][] = [
  ['/bunfest/silent-auction', 'award'],
  ['/bunfest/auction', 'award'],
  ['/bunfest/sponsors', 'award'],
  ['/bunfest/vendors', 'bag'],
  ['/bunfest/map', 'mappin'],
  ['/bunfest/visit', 'mappin'],
  ['/bunfest/partners', 'users'],
  ['/bunfest/give', 'gift'],
  ['/bunfest/schedule', 'calendar'],
  ['/bunfest', 'calendar'],
  ['/events', 'calendar'],
  ['/services', 'calendar'],
  ['/appointment', 'calendar'],
  ['/give', 'gift'],
  ['/support', 'gift'],
  ['/volunteer', 'users'],
  ['/vets', 'phone'],
  ['/learn', 'book'],
  ['/found', 'mappin'],
  ['/surrender', 'mappin'],
  ['/rescues', 'mappin'],
  ['/hop-shop', 'bag'],
  ['/tails', 'sparkles'],
  ['/news', 'sparkles'],
  ['/partners/perks', 'ticket'],
  ['/partners', 'star'],
  ['/contact', 'mail'],
  ['/about', 'info'],
  ['/help', 'help'],
  ['/my-bunny', 'heart'],
  ['/app', 'device'],
  // Only where no rabbit photo is appropriate — see slideVisual().
  ['/adopt', 'heart'],
]

// The path of an internal link ('/events?x#y/' → '/events'); null for external URLs.
function routeOf(url: string | null | undefined): string | null {
  if (!url || /^https?:\/\//i.test(url)) return null
  return url.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
}

// The fixed icon for a slide: the seed's own `icon`, else the standard icon for its link.
export function slideIcon(slide: Pick<HeroSlide, 'icon' | 'ctaUrl'>): IconName | null {
  if (slide.icon) return slide.icon
  const path = routeOf(slide.ctaUrl)
  if (!path) return null
  const hit = ROUTE_ICONS.find(([route]) => path === route || path.startsWith(`${route}/`))
  return hit ? hit[1] : null
}

// Adopt cards are about real rabbits, so they get a rabbit photo rather than an icon.
export function isAdoptSlide(slide: Pick<HeroSlide, 'ctaUrl'>): boolean {
  const path = routeOf(slide.ctaUrl)
  return path === '/adopt' || path?.startsWith('/adopt/') === true
}

export type SlideVisualSpec = { image: string; fit: 'cover' | 'contain' } | { icon: IconName }

// What a slide shows in its picture slot, in order: an uploaded image (the staff
// choice always wins), the BunFest logo or a real-rabbit photo for adopt cards,
// otherwise its fixed icon.
export function slideVisual(slide: Pick<HeroSlide, 'imageUrl' | 'icon' | 'ctaUrl'>): SlideVisualSpec | null {
  if (slide.imageUrl) return { image: slide.imageUrl, fit: 'cover' }
  const path = routeOf(slide.ctaUrl)
  if (path === '/bunfest') return { image: SLIDE_FALLBACK_IMAGES['/bunfest'], fit: 'contain' }
  if (isAdoptSlide(slide)) return { image: ADOPT_PHOTO, fit: 'cover' }
  const icon = slideIcon(slide)
  return icon ? { icon } : null
}

// The website links "Ways to give" to /give; in the app that screen is /support.
export function appPath(ctaUrl?: string): string | undefined {
  if (!ctaUrl) return undefined
  return ctaUrl === '/give' ? '/support' : ctaUrl
}
