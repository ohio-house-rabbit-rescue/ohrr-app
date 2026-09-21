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

export async function listItems(orgId: string, kind?: ItemKind | null): Promise<TaggedItem[]> {
  const { data, error } = await supabase.rpc('list_tagged_items', { p_org: orgId, p_kind: kind ?? null })
  if (error) throw error
  return ((data ?? []) as unknown[]).map(asItem).filter((x): x is TaggedItem => x !== null)
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
    p_price_cents: d.kind === 'stock' ? dollarsToCents(d.price) : null,
    p_quantity: d.kind === 'stock' ? Math.max(0, Math.round(d.quantity)) : null,
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
