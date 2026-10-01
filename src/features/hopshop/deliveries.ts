// Deliveries (update 42): stock added from a supplier's invoice, with the
// record kept — supplier, invoice number and date, totals with the shipping
// actually paid, the invoice files (private bucket 'invoices'), and each line.
// Lines matched by hand are remembered per supplier (supplier_invoice_matches).
import { supabase } from '../../lib/supabase'
import { db } from './api'
import type { RememberedMatch } from './invoiceParse'

export interface DeliveryLine {
  id: string
  product_id: string | null
  product_name: string | null
  sku: string | null
  read_as: string | null
  supplier_sku: string | null
  qty_invoiced: number | null
  units_added: number
  unit_cost_cents: number | null
  line_total_cents: number | null
}

export interface Delivery {
  id: string
  supplier_id: string | null
  supplier_name: string | null
  invoice_no: string | null
  invoice_date: string | null
  received_on: string
  subtotal_cents: number | null
  shipping_cents: number | null
  tax_cents: number | null
  total_cents: number | null
  file_paths: string[]
  note: string | null
  created_at: string
  lines_count: number
  units: number
  lines: DeliveryLine[] | null
}

export interface DeliveryLineInput {
  product_id: string | null
  read_as: string | null
  supplier_sku: string | null
  qty_invoiced: number | null
  units: number
  unit_cost_cents: number | null
  line_total_cents: number | null
  update_cost: boolean
  match_key: string | null
  units_per: number
  remember: boolean
}

export interface DeliveryInput {
  supplier_id: string | null
  invoice_no: string | null
  invoice_date: string | null
  subtotal_cents: number | null
  shipping_cents: number | null
  tax_cents: number | null
  total_cents: number | null
  file_paths: string[]
  note: string | null
  allow_duplicate: boolean
  lines: DeliveryLineInput[]
}

const BUCKET = 'invoices'

export async function receiveDelivery(orgId: string, d: DeliveryInput): Promise<Delivery> {
  const { data, error } = await db.rpc('receive_delivery', { p_org: orgId, p_delivery: d })
  if (error) throw error
  return data as Delivery
}

export async function listDeliveries(orgId: string, supplierId?: string | null): Promise<Delivery[]> {
  const { data, error } = await db.rpc('list_deliveries', { p_org: orgId, p_supplier: supplierId ?? null })
  if (error) throw error
  return Array.isArray(data) ? (data as Delivery[]) : []
}

export async function deliveryDetail(orgId: string, id: string): Promise<Delivery | null> {
  const { data, error } = await db.rpc('delivery_detail', { p_org: orgId, p_id: id })
  if (error) throw error
  return (data as Delivery | null) ?? null
}

/** Takes the delivery's items back off stock, deletes the record and its files. */
export async function undoDelivery(orgId: string, id: string): Promise<void> {
  const { data, error } = await db.rpc('undo_delivery', { p_org: orgId, p_id: id })
  if (error) throw error
  const paths = Array.isArray(data) ? (data as string[]) : []
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

/** The matches staff made by hand for this supplier's invoices. */
export async function rememberedMatches(orgId: string, supplierId: string): Promise<RememberedMatch[]> {
  const { data, error } = await db
    .from('supplier_invoice_matches')
    .select('match_key, product_id, units_per')
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
  if (error) throw error
  return (data ?? []) as RememberedMatch[]
}

/** A photo, made smaller for keeping (longest side 2000 px, JPEG). PDFs are kept as they are. */
async function forKeeping(file: File): Promise<{ blob: Blob; type: string; ext: string }> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return { blob: file, type: 'application/pdf', ext: 'pdf' }
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))
    if (blob) return { blob, type: 'image/jpeg', ext: 'jpg' }
  } catch {
    /* keep the original */
  }
  return { blob: file, type: file.type || 'image/jpeg', ext: (file.name.split('.').pop() || 'jpg').toLowerCase() }
}

/** Puts the invoice files in the private bucket; returns their paths. */
export async function uploadInvoiceFiles(orgId: string, files: File[]): Promise<string[]> {
  const folder = `${orgId}/${crypto.randomUUID()}`
  const paths: string[] = []
  for (let i = 0; i < files.length; i++) {
    const { blob, type, ext } = await forKeeping(files[i])
    const base = files[i].name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40) || 'invoice'
    const path = `${folder}/${i + 1}-${base}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false })
    if (error) throw error
    paths.push(path)
  }
  return paths
}

/** A link to look at one invoice file (works for ten minutes). */
export async function invoiceFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}

/** "Sep 30, 2026" */
export const dayText = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
