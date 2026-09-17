// Hero / featured slides — the bundled seed for the shared `hero_slides` table
// (see supabase/migrations/*_hero_slides.sql). The website's staff area manages
// the live rows; the app's Home screen reads them via useHeroSlides() and falls
// back to this list. `image_url` is null in the DB seed; the app uses its own
// bundled photos (below) when a slide has no image. (Paths are inlined rather
// than imported from ./photos so scripts/generate-seed-sql.mjs can load this
// file under plain Node.)

export type SlidePlacement = 'hero' | 'featured'

export interface HeroSlide {
  id: string
  placement: SlidePlacement
  headline: string
  subline?: string
  imageUrl?: string
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
    ctaUrl: '/bunfest/silent-auction',
    sortOrder: 40,
  },
  {
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
    ctaUrl: '/events',
    sortOrder: 20,
  },
  {
    id: 'featured-give',
    placement: 'featured',
    headline: 'Ways to give',
    ctaUrl: '/give',
    sortOrder: 10,
  },
]

// Bundled artwork used when a slide has no image_url (keyed by the CTA target).
export const SLIDE_FALLBACK_IMAGES: Record<string, string> = {
  '/bunfest': '/bunfest-2025-logo.jpg',
  '/adopt': '/sample-bunnies/bunny-lop-caramel.jpg',
  '/bunfest/silent-auction': '/sample-auction/auction-basket.jpg',
  '/events': '/sample-bunnies/tail-fluffy.jpg',
  '/give': '/sample-bunnies/bunny-spotted.jpg',
  '/support': '/sample-bunnies/bunny-spotted.jpg',
}

export function slideImage(s: Pick<HeroSlide, 'imageUrl' | 'ctaUrl'>): string | undefined {
  return s.imageUrl || (s.ctaUrl ? SLIDE_FALLBACK_IMAGES[s.ctaUrl] : undefined)
}

// The website links "Ways to give" to /give; in the app that screen is /support.
export function appPath(ctaUrl?: string): string | undefined {
  if (!ctaUrl) return undefined
  return ctaUrl === '/give' ? '/support' : ctaUrl
}
