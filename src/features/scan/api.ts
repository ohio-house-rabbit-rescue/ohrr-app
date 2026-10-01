// Supabase calls for "Scan an item". Every write is an RPC (SECURITY DEFINER,
// capability-checked in the database); photos go to the public `item-photos`
// bucket after the same phone-friendly downscale the auction manager uses.
import { supabase } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'
import { downscaleToJpeg } from '../raffle/photoUpload'
import { dollarsToCents, type HeadedFor, type ItemDraft, type ItemKind, type TaggedItem } from './types'

export const ITEM_PHOTO_BUCKET = 'item-photos'

function asItem(data: unknown): TaggedItem | null {
  if (!data || typeof data !== 'object') return null
  return data as TaggedItem
}

export async function findByCode(orgId: string, code: string): Promise<TaggedItem | null> {
  const { data, error } = await supabase.rpc('item_by_code', { p_org: orgId, p_code: code })
  if (error) throw error
  return asItem(data)
}

export async function listItems(orgId: string, kind?: ItemKind | null, unprinted = false): Promise<TaggedItem[]> {
  const args: { p_org: string; p_kind: string | null; p_unprinted?: boolean } = { p_org: orgId, p_kind: kind ?? null }
  if (unprinted) args.p_unprinted = true
  const { data, error } = await supabase.rpc('list_tagged_items', args)
  if (error) throw error
  return ((data ?? []) as unknown[]).map(asItem).filter((x): x is TaggedItem => x !== null)
}

/**
 * Catalog mode: save a new item in one call. The database makes the code
 * (OHRR-XXXXX) unless a scanned tag's code is given. Update 36.
 */
export interface CatalogInput {
  title: string
  kind?: ItemKind
  donatedBy?: string
  description?: string
  valueCents?: number | null
  photoUrl?: string | null
  code?: string | null
  /** Update 39 details (donations; quantity and price also for shop stock). */
  quantity?: number | null
  priceCents?: number | null
  condition?: string | null
  category?: string | null
  location?: string | null
  /** Update 40 (donations): where it's headed, value each/all, size, use-by, drop-off. */
  plan?: DonationPlan | null
}

/** Update 40: a donation's plan. Only the keys given are changed. */
export interface DonationPlan {
  headed_for?: HeadedFor | null
  value_basis?: 'each' | 'all'
  size?: string | null
  use_by?: string | null
  dropoff_id?: string | null
}

const isMissingRpc = (e: { code?: string; message?: string } | null) =>
  e?.code === 'PGRST202' || /could not find the function/i.test(e?.message ?? '')

const blank = (s: string | null | undefined) => (s ?? '').trim() || null

/**
 * Make the code and save the item in one call. Before update 39 the extra
 * details aren't accepted: the item is saved without them and comes back
 * with details_skipped, so the screen can say so.
 */
export async function catalogNewItem(orgId: string, input: CatalogInput): Promise<TaggedItem> {
  const base = {
    p_org: orgId,
    p_title: input.title.trim(),
    p_kind: input.kind ?? 'donation',
    p_description: blank(input.description),
    p_donated_by: blank(input.donatedBy),
    p_value_cents: input.valueCents ?? null,
    p_photo_url: input.photoUrl ?? null,
    p_price_cents: input.priceCents ?? null,
    p_quantity: input.quantity ?? null,
    p_code: input.code ?? null,
  }
  const extras = { p_condition: blank(input.condition), p_category: blank(input.category), p_location: blank(input.location) }
  const plan = input.plan && Object.values(input.plan).some((v) => v != null && v !== '' && v !== 'each') ? input.plan : null
  // Newest first: with the plan (update 40), then without it (39), then the bare call (36).
  if (plan) {
    const withPlan = await supabase.rpc('catalog_new_item', { ...base, ...extras, p_plan: plan as unknown as Json })
    if (!withPlan.error) {
      const item = asItem(withPlan.data)
      if (!item) throw new Error('Saved, but the item could not be read back.')
      return item
    }
    if (!isMissingRpc(withPlan.error)) throw withPlan.error
  }
  // Without update 40 a value is always "for one": turn a value for the whole lot into one piece's.
  const qty = Math.max(1, input.quantity ?? 1)
  if (plan?.value_basis === 'all' && base.p_value_cents != null && qty > 1) base.p_value_cents = Math.round(base.p_value_cents / qty)
  const first = await supabase.rpc('catalog_new_item', { ...base, ...extras })
  if (!first.error) {
    const item = asItem(first.data)
    if (!item) throw new Error('Saved, but the item could not be read back.')
    return plan ? { ...item, plan_skipped: true } : item
  }
  if (!isMissingRpc(first.error)) throw first.error
  const old = await supabase.rpc('catalog_new_item', base)
  if (old.error) throw old.error
  const item = asItem(old.data)
  if (!item) throw new Error('Saved, but the item could not be read back.')
  const wanted =
    (input.quantity ?? 1) > 1 || input.priceCents != null || extras.p_condition || extras.p_category || extras.p_location
  return wanted || plan ? { ...item, details_skipped: Boolean(wanted), plan_skipped: Boolean(plan) } : item
}

/* ------------------------------------------------------------- update 40 */

const NEEDS_40 = 'This needs database update 40.'

type Fn40 =
  | 'set_donation_plan'
  | 'set_donation_outcome'
  | 'split_donation'
  | 'make_basket'
  | 'sort_headed_donations'
  | 'start_dropoff'
  | 'update_dropoff'
  | 'set_dropoff_thanked'
  | 'list_dropoffs'
  | 'dropoff_detail'
  | 'donations_received'

async function rpc40<T>(fn: Fn40, args: Record<string, unknown>): Promise<T> {
  const call = supabase.rpc.bind(supabase) as unknown as (
    fn: Fn40,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  const { data, error } = await call(fn, args)
  if (error) {
    if (isMissingRpc(error)) throw new Error(NEEDS_40)
    throw error
  }
  return data as T
}

/** Headed for, value each/all, size, use-by, drop-off — only the keys given. */
export async function setDonationPlan(orgId: string, code: string, plan: DonationPlan): Promise<TaggedItem | null> {
  return asItem(await rpc40('set_donation_plan', { p_org: orgId, p_code: code, p_plan: plan }))
}

/** Used for the rabbits, passed on / not usable, or null to undo (also takes it out of a basket). */
export async function setDonationOutcome(orgId: string, code: string, outcome: 'rabbits' | 'passed_on' | null, note?: string): Promise<TaggedItem | null> {
  return asItem(await rpc40('set_donation_outcome', { p_org: orgId, p_code: code, p_outcome: outcome, p_note: blank(note) }))
}

/** Take some of a lot off as their own donation, with a new code. Returns the new part. */
export async function splitDonation(orgId: string, code: string, quantity: number, headedFor?: HeadedFor | null): Promise<TaggedItem> {
  const item = asItem(await rpc40('split_donation', { p_org: orgId, p_code: code, p_quantity: quantity, p_headed_for: headedFor ?? null }))
  if (!item) throw new Error('Split, but the new part could not be read back.')
  return item
}

/** Several donations become one raffle prize or auction lot. Returns the basket. */
export async function makeBasket(orgId: string, codes: string[], kind: 'raffle' | 'auction', title: string, description?: string): Promise<TaggedItem> {
  const item = asItem(await rpc40('make_basket', { p_org: orgId, p_codes: codes, p_kind: kind, p_title: title.trim(), p_description: blank(description) }))
  if (!item) throw new Error('Made, but the basket could not be read back.')
  return item
}

/** Move every donation headed for one place. Returns how many moved. */
export async function sortHeadedDonations(orgId: string, headedFor: HeadedFor): Promise<number> {
  const n = await rpc40<unknown>('sort_headed_donations', { p_org: orgId, p_headed_for: headedFor })
  return typeof n === 'number' ? n : 0
}

export interface Dropoff {
  id: string
  donor_name: string | null
  donor_email: string | null
  received_on: string
  note: string | null
  thanked_at: string | null
  created_at: string
  items: number
  pieces: number
  value_total_cents: number | null
}

export interface DonationLine {
  id: string
  title: string
  size: string | null
  quantity: number
  value_cents: number | null
  value_basis: 'each' | 'all'
  value_each_cents: number | null
  value_total_cents: number | null
  donated_by: string | null
  received_on: string
  dropoff_id: string | null
  headed_for: HeadedFor | null
  outcome: 'sorted' | 'basket' | 'rabbits' | 'passed_on' | null
  outcome_at: string | null
  sorted_kind: ItemKind | null
  split_from: string | null
  photo_url: string | null
  use_by: string | null
  created_at: string
  code: string | null
  went_to: { code: string; kind: ItemKind; title: string | null } | null
  /** donations_received only */
  dropoff_donor?: string | null
}

export async function startDropoff(orgId: string, d: { donorName?: string; donorEmail?: string; receivedOn?: string | null; note?: string }): Promise<Dropoff> {
  return rpc40<Dropoff>('start_dropoff', {
    p_org: orgId,
    p_donor_name: blank(d.donorName),
    p_donor_email: blank(d.donorEmail),
    p_received_on: d.receivedOn || null,
    p_note: blank(d.note),
  })
}

export async function updateDropoff(orgId: string, id: string, d: { donorName?: string; donorEmail?: string; receivedOn?: string | null; note?: string }): Promise<Dropoff> {
  return rpc40<Dropoff>('update_dropoff', {
    p_org: orgId,
    p_id: id,
    p_donor_name: blank(d.donorName),
    p_donor_email: blank(d.donorEmail),
    p_received_on: d.receivedOn || null,
    p_note: blank(d.note),
  })
}

export async function setDropoffThanked(orgId: string, id: string, thanked = true): Promise<Dropoff> {
  return rpc40<Dropoff>('set_dropoff_thanked', { p_org: orgId, p_id: id, p_thanked: thanked })
}

export async function listDropoffs(orgId: string, limit = 40): Promise<Dropoff[]> {
  const data = await rpc40<unknown>('list_dropoffs', { p_org: orgId, p_limit: limit })
  return Array.isArray(data) ? (data as Dropoff[]) : []
}

export async function dropoffDetail(orgId: string, id: string): Promise<(Dropoff & { lines: DonationLine[] }) | null> {
  const data = await rpc40<unknown>('dropoff_detail', { p_org: orgId, p_id: id })
  return data && typeof data === 'object' ? (data as Dropoff & { lines: DonationLine[] }) : null
}

/** Every donation received between two dates (YYYY-MM-DD), for the report. */
export async function donationsReceived(orgId: string, from: string, to: string): Promise<DonationLine[]> {
  const data = await rpc40<unknown>('donations_received', { p_org: orgId, p_from: from, p_to: to })
  return Array.isArray(data) ? (data as DonationLine[]) : []
}

export const isNeeds40 = (e: unknown) => e instanceof Error && e.message === NEEDS_40

/** Condition, category and where it's kept (update 39). */
export async function setItemExtras(orgId: string, code: string, x: { condition?: string | null; category?: string | null; location?: string | null }): Promise<TaggedItem | null> {
  const { data, error } = await supabase.rpc('set_item_extras', {
    p_org: orgId,
    p_code: code,
    p_condition: blank(x.condition),
    p_category: blank(x.category),
    p_location: blank(x.location),
  })
  if (error) {
    if (isMissingRpc(error)) throw new Error('Condition, category and where it’s kept need database update 39.')
    throw error
  }
  return asItem(data)
}

/** Places and categories typed lately, for one-tap chips (empty before update 39). */
export async function catalogSuggestions(orgId: string): Promise<{ locations: string[]; categories: string[] }> {
  const { data, error } = await supabase.rpc('catalog_suggestions', { p_org: orgId })
  if (error || !data || typeof data !== 'object') return { locations: [], categories: [] }
  const d = data as { locations?: unknown; categories?: unknown }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return { locations: strings(d.locations), categories: strings(d.categories) }
}

/** After printing labels: remember which are done (or undo with printed=false). */
export async function markLabelsPrinted(orgId: string, codes: string[], printed = true): Promise<number> {
  const { data, error } = await supabase.rpc('mark_labels_printed', { p_org: orgId, p_codes: codes, p_printed: printed })
  if (error) throw error
  return typeof data === 'number' ? data : 0
}

/** Donor names typed lately, newest first — for one-tap chips. */
export async function recentDonors(orgId: string, limit = 12): Promise<string[]> {
  const { data, error } = await supabase.rpc('recent_donors', { p_org: orgId, p_limit: limit })
  if (error) throw error
  return Array.isArray(data) ? (data as unknown[]).filter((x): x is string => typeof x === 'string') : []
}

export async function saveItem(orgId: string, d: ItemDraft): Promise<TaggedItem> {
  if (!d.kind) throw new Error('Pick what the item is first.')
  const { data, error } = await supabase.rpc('save_scanned_item', {
    p_org: orgId,
    p_code: d.code,
    p_kind: d.kind,
    p_title: d.title.trim(),
    p_description: d.description.trim() || null,
    p_donated_by: d.kind === 'stock' ? null : d.donatedBy.trim() || null,
    p_value_cents: d.kind === 'stock' ? null : dollarsToCents(d.value),
    p_photo_url: d.photoUrl,
    // Shop stock and (update 39) donations keep a price and how many.
    p_price_cents: d.kind === 'stock' || d.kind === 'donation' ? dollarsToCents(d.price) : null,
    p_quantity: d.kind === 'stock' ? Math.max(0, Math.round(d.quantity)) : d.kind === 'donation' ? Math.max(1, Math.round(d.quantity)) : null,
    p_session: null,
  })
  if (error) throw error
  const item = asItem(data)
  if (!item) throw new Error('Saved, but the item could not be read back.')
  return item
}

export async function adjustStock(orgId: string, code: string, delta: number): Promise<TaggedItem> {
  const { data, error } = await supabase.rpc('adjust_stock_by_code', { p_org: orgId, p_code: code, p_delta: delta })
  if (error) throw error
  const item = asItem(data)
  if (!item) throw new Error('Could not read the item back.')
  return item
}

export async function setStatus(orgId: string, code: string, status: string): Promise<TaggedItem> {
  const { data, error } = await supabase.rpc('set_item_status_by_code', {
    p_org: orgId,
    p_code: code,
    p_status: status,
  })
  if (error) throw error
  const item = asItem(data)
  if (!item) throw new Error('Could not read the item back.')
  return item
}

export async function setPublished(orgId: string, code: string, published: boolean): Promise<TaggedItem> {
  const { data, error } = await supabase.rpc('set_item_published_by_code', {
    p_org: orgId,
    p_code: code,
    p_published: published,
  })
  if (error) throw error
  const item = asItem(data)
  if (!item) throw new Error('Could not read the item back.')
  return item
}

export async function deleteItem(orgId: string, code: string): Promise<void> {
  const { error } = await supabase.rpc('delete_item_by_code', { p_org: orgId, p_code: code })
  if (error) throw error
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Downscale + upload a photo; resolves to its public URL. */
export async function uploadItemPhoto(file: Blob, orgId: string): Promise<string> {
  const jpeg = await downscaleToJpeg(file)
  const path = `${orgId}/${newId()}.jpg`
  const { error } = await supabase.storage
    .from(ITEM_PHOTO_BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from(ITEM_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** A data URL (from the native camera) → Blob, for the uploader above. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** Up to four photos per item (update 37). */
export const MAX_ITEM_PHOTOS = 4

/** An item's photos, main first — photo_urls, or the single photo_url before update 37. */
export function itemPhotos(item: { photo_url: string | null; photo_urls?: string[] | null }): string[] {
  const list = (item.photo_urls ?? []).filter(Boolean)
  if (list.length) return list.slice(0, MAX_ITEM_PHOTOS)
  return item.photo_url ? [item.photo_url] : []
}

/** Replace an item's photo list; the first becomes its main photo. */
export async function setItemPhotos(orgId: string, code: string, urls: string[]): Promise<TaggedItem> {
  const { data, error } = await supabase.rpc('set_item_photos', { p_org: orgId, p_code: code, p_photo_urls: urls.slice(0, MAX_ITEM_PHOTOS) })
  if (error) throw error
  const item = asItem(data)
  if (!item) throw new Error('Saved, but the item could not be read back.')
  return item
}
