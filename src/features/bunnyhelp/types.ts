// Bunny Help — "My bunny is…" search that routes people to OHRR's own care
// guidance (never a diagnosis). Topics live in the `care_topics` table (staff
// editable) with a code seed as the silent fallback.

export type TopicCategory =
  | 'health'
  | 'behavior'
  | 'diet'
  | 'litter'
  | 'bonding'
  | 'grooming'
  | 'housing'

export type TopicUrgency = 'emergency' | 'vet-today' | 'watch' | 'tip'

/** Mirrors a `care_topics` row (minus audit columns). */
export interface CareTopic {
  id: string
  slug: string
  title: string
  aliases: string[]
  category: TopicCategory
  urgency: TopicUrgency
  summary: string
  /** Light markdown: blank-line paragraphs, `## ` headings, `- ` bullets. */
  what_to_do: string
  /** Slug of an in-app Learn article, if one fits. */
  article_slug: string | null
  show_vets: boolean
  hopshop_note: string | null
  reviewed_by: string | null
  /** YYYY-MM-DD */
  reviewed_at: string | null
  is_published: boolean
  sort_order: number
}

export const CATEGORIES: readonly TopicCategory[] = [
  'health',
  'behavior',
  'diet',
  'litter',
  'bonding',
  'grooming',
  'housing',
]

export const CATEGORY_LABEL: Record<TopicCategory, string> = {
  health: 'Health',
  behavior: 'Behaviour',
  diet: 'Diet',
  litter: 'Litter box',
  bonding: 'Bonding',
  grooming: 'Grooming',
  housing: 'Home & setup',
}

export const URGENCIES: readonly TopicUrgency[] = ['emergency', 'vet-today', 'watch', 'tip']

/** Lower = more urgent; results sort by this first. */
export const URGENCY_RANK: Record<TopicUrgency, number> = {
  emergency: 0,
  'vet-today': 1,
  watch: 2,
  tip: 3,
}

export const URGENCY_LABEL: Record<TopicUrgency, string> = {
  emergency: 'Emergency',
  'vet-today': 'See a vet today',
  watch: 'Worth watching',
  tip: 'Tip',
}

export function isCategory(v: unknown): v is TopicCategory {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v)
}

export function isUrgency(v: unknown): v is TopicUrgency {
  return typeof v === 'string' && (URGENCIES as readonly string[]).includes(v)
}

export const DISCLAIMER =
  'This is general guidance from OHRR’s care resources, not a diagnosis — confirm with your vet.'

export const RESOURCES_URL = 'https://ohiohouserabbitrescue.org/rabbit-care/resources/'
export const OHRR_EMAIL = 'ohrrcontact@ohiohouserabbitrescue.org'

/** Bundled Learn article slugs that exist in the app today (src/data/care.ts). */
export const BUNDLED_LEARN_SLUGS: readonly string[] = [
  'diet',
  'housing',
  'foods-to-avoid',
  'litter',
  'bonding',
  'health',
  'stray',
]

/** "Ask OHRR" mailto with the bunny's name and the question prefilled. */
export function askOhrrHref(question: string, bunnyName?: string): string {
  const who = bunnyName?.trim() ? bunnyName.trim() : 'my bunny'
  const subject = `Question about ${who}: ${question.trim()}`.slice(0, 150)
  const body = `Hi OHRR,\n\nMy bunny ${bunnyName?.trim() ? `(${bunnyName.trim()}) ` : ''}is ${question.trim()}.\n\n(Sent from the OHRR app — Bunny Help)`
  return `mailto:${OHRR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
