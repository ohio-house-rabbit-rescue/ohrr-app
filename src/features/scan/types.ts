// "Scan an item" — the shapes shared by the scan flow, the items list and the
// tag printer. One tag code → exactly one item of one kind; the kind decides
// which table holds the details (see the item_tags migration).
import type { IconName } from '../../components/icons'
import type { Capability } from '../../lib/capabilities'

export type ItemKind = 'auction' | 'raffle' | 'stock' | 'donation'

/** The kinds a thing can be sorted INTO (the "What is it?" tiles). */
export const ITEM_KINDS: ItemKind[] = ['auction', 'raffle', 'stock']

/** Every kind, including "donation" = cataloged, not sorted yet. */
export const ALL_KINDS: ItemKind[] = ['donation', 'auction', 'raffle', 'stock']

export interface KindMeta {
  kind: ItemKind
  /** Big-button label on the "What is it?" step. */
  label: string
  /** One plain sentence under the label. */
  hint: string
  icon: IconName
  tone: 'blue' | 'orange'
  /** Any of these lets the person handle this kind (the DB checks for real). */
  caps: Capability[]
  /** The "it's gone" status for this kind, in plain words. */
  doneLabel: string
  doneStatus: string
  /** Undo wording for the status above. */
  undoLabel: string
  openStatus: string
}

const EVENT_CAPS: Capability[] = ['events.bunfest.manage']
const STOCK_CAPS: Capability[] = ['hopshop.products.create', 'hopshop.products.edit', 'hopshop.inventory.update']

export const KIND_META: Record<ItemKind, KindMeta> = {
  auction: {
    kind: 'auction',
    label: 'Silent Auction',
    hint: 'People bid on it. Highest bid wins.',
    icon: 'gavel',
    tone: 'orange',
    caps: EVENT_CAPS,
    doneLabel: 'Mark as won',
    doneStatus: 'won',
    undoLabel: 'Not won yet',
    openStatus: 'available',
  },
  raffle: {
    kind: 'raffle',
    label: 'Raffle prize',
    hint: 'People drop tickets in a bowl. One ticket is drawn.',
    icon: 'ticket',
    tone: 'orange',
    caps: EVENT_CAPS,
    doneLabel: 'Mark as drawn',
    doneStatus: 'drawn',
    undoLabel: 'Not drawn yet',
    openStatus: 'available',
  },
  stock: {
    kind: 'stock',
    label: 'Hop Shop stock',
    hint: 'Something OHRR sells. We count how many there are.',
    icon: 'box',
    tone: 'blue',
    caps: STOCK_CAPS,
    doneLabel: 'Hide from the shop',
    doneStatus: 'inactive',
    undoLabel: 'Show in the shop',
    openStatus: 'active',
  },
  donation: {
    kind: 'donation',
    label: 'Donation — sort later',
    hint: 'Just catalog it now. Decide auction, raffle or shop afterwards.',
    icon: 'gift',
    tone: 'blue',
    caps: [...EVENT_CAPS, ...STOCK_CAPS],
    doneLabel: '',
    doneStatus: 'unsorted',
    undoLabel: '',
    openStatus: 'unsorted',
  },
}

/** What the RPCs return — the same shape for every kind. */
export interface TaggedItem {
  tag_id: string
  code: string
  kind: ItemKind
  ref_id: string
  title: string
  description: string | null
  donated_by: string | null
  value_cents: number | null
  photo_url: string | null
  /** All its photos, main first (update 37; missing before it). */
  photo_urls?: string[] | null
  price_cents: number | null
  quantity: number | null
  status: string
  is_published: boolean
  session: 'morning' | 'afternoon' | 'all-day' | null
  /** Donations only: the day it came in. */
  received_on?: string | null
  /** Set once its label has been printed (update 36). */
  label_printed_at?: string | null
  /** Update 39: condition (donations), category and where it's kept (donations; shop stock's shelf). */
  condition?: string | null
  category?: string | null
  location?: string | null
  /** Client only: the extra details couldn't be saved yet (update 39 not run). */
  details_skipped?: boolean
  created_at: string
  updated_at: string
}

/** The answers collected by the scan flow before saving. */
export interface ItemDraft {
  code: string
  kind: ItemKind | null
  title: string
  description: string
  donatedBy: string
  /** Dollars as typed ("25", "12.50") — converted to cents on save. */
  value: string
  price: string
  quantity: number
  photoUrl: string | null
  /** A local preview while the upload is still running / for the done card. */
  photoPreview: string | null
  /** Update 39: '', 'new', 'like_new', 'good' or 'fair'. */
  condition: string
  category: string
  location: string
}

export function emptyDraft(code: string): ItemDraft {
  return {
    code,
    kind: null,
    title: '',
    description: '',
    donatedBy: '',
    value: '',
    price: '',
    quantity: 1,
    photoUrl: null,
    photoPreview: null,
    condition: '',
    category: '',
    location: '',
  }
}

export function draftFromItem(item: TaggedItem): ItemDraft {
  return {
    code: item.code,
    kind: item.kind,
    title: item.title ?? '',
    description: item.description ?? '',
    donatedBy: item.donated_by ?? '',
    value: item.value_cents == null ? '' : centsToDollars(item.value_cents),
    price: item.price_cents == null ? '' : centsToDollars(item.price_cents),
    quantity: item.quantity ?? 1,
    photoUrl: item.photo_url,
    photoPreview: item.photo_url,
    condition: item.condition ?? '',
    category: item.category ?? '',
    location: item.location ?? '',
  }
}

export const CONDITIONS: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
]

export const conditionLabel = (v: string | null | undefined): string => CONDITIONS.find((c) => c.value === v)?.label ?? ''

/** "6 of them · $5 each · Like new · Food & hay · Kept: Bin 3" — the extra details in one line. */
export function extrasSummary(item: Pick<TaggedItem, 'kind' | 'quantity' | 'price_cents' | 'condition' | 'category' | 'location'>): string {
  const parts: string[] = []
  if (item.kind === 'donation' && item.quantity && item.quantity > 1) parts.push(`${item.quantity} of them`)
  if (item.kind === 'donation' && item.price_cents != null) parts.push(`${formatMoney(item.price_cents)} each`)
  if (item.condition) parts.push(conditionLabel(item.condition))
  if (item.category) parts.push(item.category)
  if (item.location) parts.push(`Kept: ${item.location}`)
  return parts.join(' · ')
}

/* ------------------------------------------------------------- money */

export function dollarsToCents(s: string): number | null {
  const cleaned = s.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function centsToDollars(c: number): string {
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)
}

export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return ''
  return `$${centsToDollars(cents)}`
}

/** Plain-words status for the item card and list rows. */
export function statusLabel(item: TaggedItem): string {
  if (item.kind === 'donation') return 'To be sorted'
  if (item.kind === 'stock') {
    const n = item.quantity ?? 0
    const count = n === 1 ? '1 in stock' : `${n} in stock`
    return item.status === 'inactive' ? `${count} · hidden from the shop` : count
  }
  const done = item.status === 'won' ? 'Won' : item.status === 'drawn' ? 'Drawn' : 'Available'
  return item.is_published ? done : `${done} · hidden`
}
