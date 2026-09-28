// The Easter campaign: every spring, OHRR's before-Easter education posts and
// its after-Easter "talk to us before you give up" posts go into the post
// queue as drafts, dated from Easter Sunday, with one tap in Staff → Posts —
// and a reminder when Easter is close and nobody has done it yet.
//
// No table of its own: each draft's `source` says which Easter and which slot
// it is ("easter:2027:-5w"), so planning twice never adds a second copy. The
// drafts then go through the usual approval like any other post.
//
// The website carries a copy of this file — keep the two in sync.
import { supabase } from '../../lib/supabase'
import { easterSunday } from '../../lib/season'
import { EDUCATION_CARDS, educationPost, type EducationCard } from './templates'
import { canvasToBlob, renderCard } from './render'
import { DEFAULT_PLATFORMS, createPost, localToday, uploadPostPng, type SocialPost } from './queue'

/**
 * When each post goes, in weeks from Easter Sunday, and which Share-kit card it
 * uses. Before: families deciding on a bunny. After: new owners — requests to
 * surrender rise two to three months after Easter (lib/season.ts).
 */
export const EASTER_PLAN: { weeks: number; cardId: string }[] = [
  { weeks: -7, cardId: 'not-a-starter-pet' },
  { weeks: -5, cardId: 'easter-10-years' },
  { weeks: -3, cardId: 'not-a-starter-pet' },
  { weeks: -1, cardId: 'easter-10-years' },
  { weeks: 3, cardId: 'post-easter-keep' },
  { weeks: 7, cardId: 'post-easter-keep' },
  { weeks: 11, cardId: 'post-easter-keep' },
]

/** The reminder shows from this many days before Easter (about 9 weeks) while nothing is planned. */
export const NUDGE_DAYS = 63

export interface EasterSlot {
  weeks: number
  card: EducationCard
  /** The post's "Post on" day, YYYY-MM-DD. */
  date: string
  /** "Easter −5 weeks: A rabbit is a 10-year pet" */
  title: string
  /** The marker in social_posts.source: "easter:2027:-5w". */
  source: string
}

export interface EasterCampaign {
  year: number
  /** Easter Sunday, YYYY-MM-DD. */
  easter: string
  slots: (EasterSlot & { post: SocialPost | null; past: boolean })[]
  /** Some of this Easter's posts are (or were) in the queue. */
  planned: boolean
  /** How many posts planning would add now: not in the queue, and their day hasn't gone. */
  toAdd: number
}

const marker = (year: number) => `easter:${year}:`

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDay(new Date(y, m - 1, d + days))
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  })
  return Math.round((b - a) / 86_400_000)
}

/** "Apr 5, 2027" */
export function usDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "5 weeks before" / "1 week after" */
export function weeksLabel(weeks: number): string {
  const n = Math.abs(weeks)
  return `${n} week${n === 1 ? '' : 's'} ${weeks < 0 ? 'before' : 'after'}`
}

/** The card's headline as a queue name; a quoted myth gets its kicker ("Myth: “…”"). */
export function cardName(c: EducationCard): string {
  const h = c.headline.replace(/\.$/, '')
  return /^[“"]/.test(h) ? `${c.kicker.charAt(0)}${c.kicker.slice(1).toLowerCase()}: ${h}` : h
}

export function easterDay(year: number): string {
  return isoDay(easterSunday(year))
}

/** The Easter being worked towards: this year's until its last post's day has gone, then next year's. */
export function campaignYear(today = localToday()): number {
  const year = Number(today.slice(0, 4))
  const last = Math.max(...EASTER_PLAN.map((s) => s.weeks))
  return today <= addDays(easterDay(year), last * 7) ? year : year + 1
}

export function easterSlots(year: number): EasterSlot[] {
  const easter = easterDay(year)
  return EASTER_PLAN.flatMap(({ weeks, cardId }) => {
    const card = EDUCATION_CARDS.find((c) => c.id === cardId)
    if (!card) return []
    const n = Math.abs(weeks)
    return [
      {
        weeks,
        card,
        date: addDays(easter, weeks * 7),
        title: `Easter ${weeks < 0 ? '−' : '+'}${n} week${n === 1 ? '' : 's'}: ${cardName(card)}`,
        source: `${marker(year)}${weeks < 0 ? '-' : '+'}${n}w`,
      },
    ]
  })
}

/** This Easter's plan next to what the queue already holds. */
export function easterCampaign(posts: SocialPost[], today = localToday()): EasterCampaign {
  const year = campaignYear(today)
  const mine = posts.filter((p) => p.source?.startsWith(marker(year)))
  const slots = easterSlots(year).map((s) => {
    const post = mine.find((p) => p.source === s.source) ?? null
    return { ...s, post, past: !post && s.date < today }
  })
  return { year, easter: easterDay(year), slots, planned: mine.length > 0, toAdd: slots.filter((s) => !s.post && !s.past).length }
}

/** Easter's day when it's at most NUDGE_DAYS away and none of its posts are planned; else null. */
export function easterNudge(c: Pick<EasterCampaign, 'easter' | 'planned'>, today = localToday()): string | null {
  const days = daysBetween(today, c.easter)
  return !c.planned && days >= 0 && days <= NUDGE_DAYS ? c.easter : null
}

/** The markers of this Easter's posts in the queue, asked of the database (the list on screen may be stale). */
async function sourcesInQueue(orgId: string, year: number): Promise<Set<string>> {
  const { data, error } = await supabase.from('social_posts').select('source').eq('org_id', orgId).like('source', `${marker(year)}%`)
  if (error) throw error
  return new Set(((data ?? []) as { source: string | null }[]).map((r) => r.source ?? ''))
}

/** For the staff home: the Easter date when the reminder should show, else null (one small query, only near Easter). */
export async function easterReminder(orgId: string, today = localToday()): Promise<string | null> {
  const year = campaignYear(today)
  const easter = easterDay(year)
  if (!easterNudge({ easter, planned: false }, today)) return null
  try {
    return easterNudge({ easter, planned: (await sourcesInQueue(orgId, year)).size > 0 }, today)
  } catch {
    return null
  }
}

/** The Share-kit card, painted square as in the Composer; null if this device can't. */
async function paint(card: EducationCard, logoUrl: string): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas')
    await renderCard(canvas, educationPost(card).card, 'square', { logoUrl })
    return await canvasToBlob(canvas)
  } catch {
    return null
  }
}

export interface PlanOutcome {
  added: number
  /** Added without a picture (painting or uploading failed) — make one in the Share kit. */
  noPicture: number
}

/**
 * Put this Easter's missing posts in the queue as drafts, each with its card's
 * picture and caption. Posts already there (any status) and days that have
 * gone are skipped, so it's safe to run again.
 */
export async function planEasterCampaign(orgId: string, userId: string, year: number, logoUrl: string, today = localToday()): Promise<PlanOutcome> {
  const have = await sourcesInQueue(orgId, year)
  const todo = easterSlots(year).filter((s) => !have.has(s.source) && s.date >= today)
  const easter = easterDay(year)
  const pictures = new Map<string, Blob | null>()
  let added = 0
  let noPicture = 0
  for (const s of todo) {
    if (!pictures.has(s.card.id)) pictures.set(s.card.id, await paint(s.card, logoUrl))
    const png = pictures.get(s.card.id)
    let imageUrl: string | null = null
    if (png) {
      try {
        imageUrl = await uploadPostPng(png, orgId)
      } catch {
        /* the draft still goes in; the picture can be made in the Share kit */
      }
    }
    const kit = educationPost(s.card)
    await createPost(orgId, userId, {
      title: s.title,
      caption: kit.caption,
      image_url: imageUrl,
      image_alt: imageUrl ? kit.card.headline : null,
      platforms: DEFAULT_PLATFORMS,
      scheduled_for: s.date,
      notes: `Easter ${year} campaign: ${weeksLabel(s.weeks)} Easter (${usDate(easter)}).`,
      source: s.source,
    })
    added++
    if (!imageUrl) noPicture++
  }
  return { added, noPicture }
}
