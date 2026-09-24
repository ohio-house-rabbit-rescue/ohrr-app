// Hop Shop manager — stock cards, suppliers and the reorder list. Writes go
// through SECURITY DEFINER functions gated on the hopshop.* capabilities
// (supabase/migrations/20260922110000_hopshop_suppliers.sql); suppliers are
// plain table rows behind RLS.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

// Update 27's columns and tables (pack sizes, company records) aren't in database.types.ts yet; this untyped handle reaches them.
export const db = supabase as unknown as SupabaseClient

export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type OrderHow = NonNullable<Supplier['order_how']>

/** What product_admin_json() returns — a product with its stock, supplier and code. */
export interface StockCard {
  id: string
  name: string
  description: string | null
  price_cents: number
  sku: string | null
  is_active: boolean
  photo_url: string | null
  supplier_id: string | null
  supplier_name: string | null
  supplier_sku: string | null
  cost_cents: number | null
  unit: string | null
  category: string | null
  shelf: string | null
  reorder_point: number | null
  reorder_qty: number | null
  on_order_qty: number
  ordered_at: string | null
  quantity: number | null
  code: string | null
  updated_at: string
  // Update 27 (pack sizes) — absent until that SQL has run.
  order_url?: string | null
  ordered_pack_id?: string | null
  ordered_packs?: number | null
  packs?: Pack[]
}

/** A size the product comes in from the supplier: a single, a box, a case of 12 … (`product_packs`). */
export interface Pack {
  id: string
  label: string
  /** How many sellable items are in it. */
  units: number
  /** What OHRR pays for one pack. */
  cost_cents: number | null
  supplier_sku: string | null
  min_packs: number
  is_default: boolean
  notes: string | null
}

export const ORDER_HOW_LABEL: Record<OrderHow, string> = {
  website: 'On their website',
  email: 'By email',
  phone: 'By phone',
  rep: 'Through a rep',
  in_person: 'In person / pick up',
}

export const money = (cents: number | null | undefined) => (cents == null ? '—' : `$${(cents / 100).toFixed(2)}`)
export const toCents = (dollars: string): number | null => {
  const t = dollars.trim()
  if (!t) return null
  const n = Math.round(parseFloat(t) * 100)
  return Number.isFinite(n) && n >= 0 ? n : null
}
export const fromCents = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2))

/** Stock at or below the reorder point (only when a point is set). */
export function isLow(p: StockCard): boolean {
  return p.reorder_point != null && (p.quantity ?? 0) <= p.reorder_point
}

function asCards(data: unknown): StockCard[] {
  return Array.isArray(data) ? (data as StockCard[]) : []
}

export async function listProducts(orgId: string): Promise<StockCard[]> {
  const { data, error } = await supabase.rpc('list_products_admin', { p_org: orgId })
  if (error) throw error
  return asCards(data)
}

export interface ProductInput {
  id: string | null
  name: string
  price_cents: number
  description: string | null
  sku: string | null
  photo_url: string | null
  is_active: boolean
  supplier_id: string | null
  supplier_sku: string | null
  cost_cents: number | null
  unit: string | null
  category: string | null
  shelf: string | null
  reorder_point: number | null
  reorder_qty: number | null
  /** Only sent when set (new items, or a count typed on the form). */
  quantity: number | null
}

export async function saveProduct(orgId: string, i: ProductInput): Promise<StockCard> {
  const { data, error } = await supabase.rpc('save_product', {
    p_org: orgId,
    p_id: i.id,
    p_name: i.name,
    p_price_cents: i.price_cents,
    p_description: i.description,
    p_sku: i.sku,
    p_photo_url: i.photo_url,
    p_is_active: i.is_active,
    p_supplier_id: i.supplier_id,
    p_supplier_sku: i.supplier_sku,
    p_cost_cents: i.cost_cents,
    p_unit: i.unit,
    p_category: i.category,
    p_shelf: i.shelf,
    p_reorder_point: i.reorder_point,
    p_reorder_qty: i.reorder_qty,
    p_quantity: i.quantity,
  })
  if (error) throw error
  return data as unknown as StockCard
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('hopshop_products').delete().eq('id', id)
  if (error) throw error
}

export async function setStock(orgId: string, productId: string, userId: string, quantity: number): Promise<void> {
  const { error } = await supabase
    .from('hopshop_inventory')
    .upsert({ product_id: productId, org_id: orgId, quantity, updated_by: userId }, { onConflict: 'product_id' })
  if (error) throw error
}

export async function reorderList(orgId: string): Promise<StockCard[]> {
  const { data, error } = await supabase.rpc('hopshop_reorder', { p_org: orgId })
  if (error) throw error
  return asCards(data)
}

export async function setOrder(productId: string, action: 'ordered' | 'received' | 'clear', qty?: number | null): Promise<StockCard> {
  const { data, error } = await supabase.rpc('hopshop_set_order', { p_product_id: productId, p_action: action, p_qty: qty ?? null })
  if (error) throw error
  return data as unknown as StockCard
}

/* ------------------------------------------------------------ suppliers */

export async function listSuppliers(orgId: string): Promise<Supplier[]> {
  const { data, error } = await supabase.from('suppliers').select('*').eq('org_id', orgId).order('name')
  if (error) throw error
  return data ?? []
}

export type SupplierInput = Database['public']['Tables']['suppliers']['Insert'] & { id?: string }

export async function saveSupplier(s: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').upsert(s, { onConflict: 'id' }).select('*').single()
  if (error) throw error
  return data
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

/** Reorder list grouped by supplier (unassigned items last). */
export function groupBySupplier(items: StockCard[]): { key: string; name: string; supplierId: string | null; items: StockCard[] }[] {
  const groups = new Map<string, { key: string; name: string; supplierId: string | null; items: StockCard[] }>()
  for (const p of items) {
    const key = p.supplier_id ?? '—'
    const g = groups.get(key) ?? { key, name: p.supplier_name ?? 'No supplier set', supplierId: p.supplier_id, items: [] }
    g.items.push(p)
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => (a.supplierId === null ? 1 : b.supplierId === null ? -1 : a.name.localeCompare(b.name)))
}

/* ------------------------------------------------------------ pack sizes */

let packsProbe: Promise<boolean> | null = null

/** True once update 27 has run (the pack table answers). Asked once per session. */
export function packsReady(): Promise<boolean> {
  if (!packsProbe) {
    packsProbe = Promise.resolve(db.from('product_packs').select('id').limit(1)).then(
      ({ error }) => !error,
      () => false,
    )
  }
  return packsProbe
}

export type PackInput = Omit<Pack, 'id'> & { id: string | null }

/**
 * Make a product's packs match the editor's list: removed ones are deleted,
 * the rest saved in the order shown.
 */
export async function syncPacks(orgId: string, productId: string, before: Pack[], after: PackInput[]): Promise<void> {
  const kept = new Set(after.map((p) => p.id).filter((id): id is string => !!id))
  const gone = before.filter((p) => !kept.has(p.id)).map((p) => p.id)
  if (gone.length > 0) {
    const { error } = await db.from('product_packs').delete().in('id', gone)
    if (error) throw error
  }
  for (const [i, p] of after.entries()) {
    const { id, ...fields } = p
    const row = { ...fields, sort_order: i }
    const { error } = id
      ? await db.from('product_packs').update(row).eq('id', id)
      : await db.from('product_packs').insert({ ...row, org_id: orgId, product_id: productId })
    if (error) throw error
  }
}

/** The supplier's page for this product ("Order link"). */
export async function setOrderUrl(productId: string, url: string | null): Promise<void> {
  const { error } = await db.from('hopshop_products').update({ order_url: url }).eq('id', productId)
  if (error) throw error
}

/** Put whole packs on order: "2 cases of 12" puts 24 on order. */
export async function orderPacks(productId: string, packId: string, packs: number): Promise<StockCard> {
  const { data, error } = await db.rpc('hopshop_order_packs', { p_product_id: productId, p_pack_id: packId, p_packs: packs })
  if (error) throw error
  return data as StockCard
}

export interface PackChoice {
  packId: string
  count: number
}

/** The pack the reorder list suggests: the default one, or else the smallest. */
export function defaultPack(p: StockCard): Pack | null {
  const packs = p.packs ?? []
  if (packs.length === 0) return null
  return packs.find((k) => k.is_default) ?? [...packs].sort((a, b) => a.units - b.units)[0]
}

/** What to aim for: the reorder quantity, or enough to get back above the reorder point — whichever is more. */
export function unitsWanted(p: StockCard): number {
  const short = p.reorder_point != null ? p.reorder_point - (p.quantity ?? 0) + 1 : 0
  return Math.max(1, p.reorder_qty ?? 0, short)
}

/** Whole packs to cover what's wanted, never below the supplier's minimum. */
export function packsFor(p: StockCard, k: Pack): number {
  return Math.max(k.min_packs || 1, Math.ceil(unitsWanted(p) / Math.max(1, k.units)))
}

export function suggestPacks(p: StockCard): PackChoice | null {
  const k = defaultPack(p)
  return k ? { packId: k.id, count: packsFor(p, k) } : null
}

function plural(label: string): string {
  if (!/[a-z]$/i.test(label)) return label
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`
  return `${label}s`
}

/** "2 cases of 12" · "6 singles" · "1 box of 24" */
export function packName(k: Pack, count: number): string {
  const label = k.label.trim().toLowerCase() || 'pack'
  const word = count === 1 ? label : plural(label)
  return k.units === 1 ? `${count} ${word}` : `${count} ${word} of ${k.units}`
}

/** "2 cases of 12 (24) · $58.00" */
export function packLine(k: Pack, count: number): string {
  const units = k.units === 1 ? '' : ` (${count * k.units})`
  const cost = k.cost_cents != null ? ` · ${money(k.cost_cents * count)}` : ''
  return `${packName(k, count)}${units}${cost}`
}

/** "$2.42 each", from what one pack costs. */
export function eachFromPack(k: { cost_cents: number | null; units: number }): string | null {
  if (k.cost_cents == null || !k.units) return null
  return `$${(k.cost_cents / k.units / 100).toFixed(2)} each`
}

export function packOf(p: StockCard, choice: PackChoice | null | undefined): Pack | null {
  return (choice && p.packs?.find((k) => k.id === choice.packId)) || null
}

/** What one reorder line would cost, when the cost is known. */
export function lineCost(p: StockCard, choice: PackChoice | null | undefined): number | null {
  const k = packOf(p, choice)
  if (k && choice) return k.cost_cents != null ? k.cost_cents * choice.count : null
  return p.cost_cents != null ? p.cost_cents * (p.reorder_qty ?? 1) : null
}

/** "$75 minimum · free shipping" → 7500, when the minimum is written in dollars. */
export function minOrderCents(min: string | null | undefined): number | null {
  const m = min?.match(/\$\s*(\d+(?:\.\d{1,2})?)/)
  return m ? Math.round(parseFloat(m[1]) * 100) : null
}

/** "2 cases of 12 (24) ordered" — what went on order, in packs when it was ordered that way. */
export function onOrderText(p: StockCard): string {
  const k = p.ordered_pack_id ? p.packs?.find((x) => x.id === p.ordered_pack_id) : null
  if (k && p.ordered_packs) return `${packName(k, p.ordered_packs)} (${p.on_order_qty}) ordered`
  return `${p.on_order_qty} ordered`
}

/**
 * The plain-text order for one supplier — pasted into an email or read out on
 * the phone: each item with their item number, the packs and how many that is.
 */
export function orderText(
  supplierName: string,
  items: StockCard[],
  accountNumber?: string | null,
  choices?: Record<string, PackChoice | undefined>,
): string {
  const lines = items.map((p) => {
    const choice = choices?.[p.id] ?? suggestPacks(p)
    const k = packOf(p, choice)
    if (k && choice) {
      const sku = k.supplier_sku || p.supplier_sku
      const units = k.units === 1 ? '' : ` (${choice.count * k.units} in all)`
      return `• ${p.name}${sku ? ` — item ${sku}` : ''} — ${packName(k, choice.count)}${units}`
    }
    const qty = p.reorder_qty ?? 1
    const unit = p.unit ? ` ${p.unit}` : ''
    const sku = p.supplier_sku ? ` (item ${p.supplier_sku})` : ''
    return `• ${qty}${unit} × ${p.name}${sku}`
  })
  return [
    `Order for Ohio House Rabbit Rescue — ${supplierName}`,
    accountNumber ? `Account ${accountNumber}` : null,
    '',
    ...lines,
    '',
    'Thank you!',
    'Ohio House Rabbit Rescue · 5485 N. High Street, Columbus, OH 43214',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
}
