// "Scan an item" — the shapes shared by the scan flow, the items list and the
// tag printer. One tag code → exactly one item of one kind; the kind decides
// which table holds the details (see the item_tags migration).
import type { IconName } from '../../components/icons'
import type { Capability } from '../../lib/capabilities'

export type ItemKind = 'auction' | 'raffle' | 'stock'

export const ITEM_KINDS: ItemKind[] = ['auction', 'raffle', 'stock']

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

export const KIND_META: Record<ItemKind, KindMeta> = {
  auction: {
    kind: 'auction',
    label: 'Silent Auction',
    hint: 'People write bids on a sheet. Highest bid wins.',
    icon: 'gavel',
    tone: 'orange',
    caps: ['events.bunfest.manage'],
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
    caps: ['events.bunfest.manage'],
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
    caps: ['hopshop.products.create', 'hopshop.products.edit', 'hopshop.inventory.update'],
    doneLabel: 'Hide from the shop',
    doneStatus: 'inactive',
    undoLabel: 'Show in the shop',
    openStatus: 'active',
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
  price_cents: number | null
  quantity: number | null
  status: string
  is_published: boolean
  session: 'morning' | 'afternoon' | 'all-day' | null
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
  }
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
  if (item.kind === 'stock') {
    const n = item.quantity ?? 0
    const count = n === 1 ? '1 in stock' : `${n} in stock`
    return item.status === 'inactive' ? `${count} · hidden from the shop` : count
  }
  const done = item.status === 'won' ? 'Won' : item.status === 'drawn' ? 'Drawn' : 'Available'
  return item.is_published ? done : `${done} · hidden`
}
