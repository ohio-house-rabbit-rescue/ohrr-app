// Hop Shop manager — stock cards, suppliers and the reorder list. Writes go
// through SECURITY DEFINER functions gated on the hopshop.* capabilities
// (supabase/migrations/20260922110000_hopshop_suppliers.sql); suppliers are
// plain table rows behind RLS.
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

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

/** The plain-text order for one supplier — pasted into an email or read out on the phone. */
export function orderText(supplierName: string, items: StockCard[], accountNumber?: string | null): string {
  const lines = items.map((p) => {
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
