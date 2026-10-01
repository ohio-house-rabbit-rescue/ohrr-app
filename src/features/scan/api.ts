// Supabase calls for "Scan an item". Every write is an RPC (SECURITY DEFINER,
// capability-checked in the database); photos go to the public `item-photos`
// bucket after the same phone-friendly downscale the auction manager uses.
import { supabase } from '../../lib/supabase'
import { downscaleToJpeg } from '../raffle/photoUpload'
import { dollarsToCents, type ItemDraft, type ItemKind, type TaggedItem } from './types'

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
  const first = await supabase.rpc('catalog_new_item', { ...base, ...extras })
  if (!first.error) {
    const item = asItem(first.data)
    if (!item) throw new Error('Saved, but the item could not be read back.')
    return item
  }
  if (!isMissingRpc(first.error)) throw first.error
  const old = await supabase.rpc('catalog_new_item', base)
  if (old.error) throw old.error
  const item = asItem(old.data)
  if (!item) throw new Error('Saved, but the item could not be read back.')
  const wanted =
    (input.quantity ?? 1) > 1 || input.priceCents != null || extras.p_condition || extras.p_category || extras.p_location
  return wanted ? { ...item, details_skipped: true } : item
}

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
