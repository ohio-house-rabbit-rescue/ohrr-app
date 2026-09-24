// Sponsors — Phase 1: shared types, labels, and row → model mappers.
//
// The Supabase tables (`sponsors`, `sponsor_placements`) are the contract the
// OHRR website reads too — see supabase/migrations/20260917150000_sponsors.sql.
// Everything in the app works off the camelCase models below.
import type { Database } from '../../lib/database.types'

export type SponsorRow = Database['public']['Tables']['sponsors']['Row']
export type PlacementRow = Database['public']['Tables']['sponsor_placements']['Row']
/** Staff-only: who to ask about renewing, and where that stands (update 24). */
export type RenewalRow = Database['public']['Tables']['sponsor_renewals']['Row']
export type RenewalStatus = RenewalRow['status']

/* ---- tiers (display order = this order) ---- */
export const TIERS = ['presenting', 'program', 'community', 'friend'] as const
export type SponsorTier = (typeof TIERS)[number]

export const TIER_LABEL: Record<SponsorTier, string> = {
  presenting: 'Presenting Partner',
  program: 'Program Sponsor',
  community: 'Community Supporter',
  friend: 'Friend of OHRR',
}

export function isTier(v: string): v is SponsorTier {
  return (TIERS as readonly string[]).includes(v)
}

export function tierLabel(tier: string): string {
  return isTier(tier) ? TIER_LABEL[tier] : tier
}

export function tierRank(tier: string): number {
  const i = (TIERS as readonly string[]).indexOf(tier)
  return i === -1 ? TIERS.length : i
}

/* ---- placement surfaces ---- */
export const SURFACES = [
  { value: 'home', label: 'App home' },
  { value: 'bunfest', label: 'BunFest home' },
  { value: 'silent-auction', label: 'Silent auction' },
  { value: 'events', label: 'Events' },
  { value: 'care-library', label: 'Care library' },
  { value: 'find-a-vet', label: 'Find a vet' },
  { value: 'happy-tails', label: 'Happy Tails' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'hop-shop', label: 'Hop Shop' },
  { value: 'my-bunny', label: 'My Bunny' },
] as const

export type Surface = (typeof SURFACES)[number]['value']

export function surfaceLabel(value: string): string {
  return SURFACES.find((s) => s.value === value)?.label ?? value
}

/* ---- app models ---- */
export interface Sponsor {
  id: string
  name: string
  tier: SponsorTier
  blurb?: string
  logoUrl?: string
  website?: string
  perkTitle?: string
  perkDetail?: string
  perkCode?: string
  termStart?: string // ISO date (YYYY-MM-DD)
  termEnd?: string // ISO date (YYYY-MM-DD)
  sortOrder: number
}

export interface Placement {
  id: string
  sponsorId: string
  surface: Surface
  startsAt?: string // ISO timestamp
  endsAt?: string // ISO timestamp
}

const orUndef = (v: string | null | undefined) => (v && v.trim().length > 0 ? v : undefined)

export function rowToSponsor(r: SponsorRow): Sponsor {
  return {
    id: r.id,
    name: r.name,
    tier: isTier(r.tier) ? r.tier : 'community',
    blurb: orUndef(r.blurb),
    logoUrl: orUndef(r.logo_url),
    website: orUndef(r.website),
    perkTitle: orUndef(r.perk_title),
    perkDetail: orUndef(r.perk_detail),
    perkCode: orUndef(r.perk_code),
    termStart: orUndef(r.term_start),
    termEnd: orUndef(r.term_end),
    sortOrder: r.sort_order,
  }
}

export function rowToPlacement(r: PlacementRow): Placement {
  return {
    id: r.id,
    sponsorId: r.sponsor_id,
    surface: r.surface as Surface,
    startsAt: orUndef(r.starts_at),
    endsAt: orUndef(r.ends_at),
  }
}

/** Sort: tier order (presenting first), then sort_order, then name. */
export function sortSponsors(list: Sponsor[]): Sponsor[] {
  return [...list].sort(
    (a, b) =>
      tierRank(a.tier) - tierRank(b.tier) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  )
}

/** Group an already-sorted list by tier, in tier display order (empty tiers omitted). */
export function groupByTier(list: Sponsor[]): { tier: SponsorTier; sponsors: Sponsor[] }[] {
  return TIERS.map((tier) => ({ tier, sponsors: list.filter((s) => s.tier === tier) })).filter(
    (g) => g.sponsors.length > 0,
  )
}

/** Display form of a website URL (no scheme / trailing slash). */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

/** Make a bare domain tappable (adds https:// when the scheme is missing). */
export function hrefFor(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
