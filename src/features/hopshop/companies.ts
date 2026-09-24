// The staff-only company record (update 27, supabase/migrations/
// 20260924210000_vendor_records_and_pack_sizes.sql): a photo, social links,
// mailing address, paperwork, booth needs, each BunFest year with them, and
// what they have given OHRR. None of it reaches the public site — the public
// vendor list still shows only the name, category, blurb and website.
//
// Until update 27 is run in Supabase these columns and tables don't exist, so
// every screen asks `vendorRecordsReady()` first and quietly hides the extras.
import { supabase } from '../../lib/supabase'
import { db, type Supplier, type SupplierInput } from './api'

export type InviteAgain = 'yes' | 'maybe' | 'no'

/** The columns update 27 adds to `suppliers`. */
export interface CompanyExtras {
  photo_url: string | null
  instagram: string | null
  facebook: string | null
  shop_url: string | null
  mailing_address: string | null
  license_number: string | null
  agreement_signed_on: string | null // yyyy-mm-dd
  insurance_expires: string | null // yyyy-mm-dd
  needs_power: boolean
  booth_notes: string | null
  invite_again: InviteAgain | null
}

/** A `suppliers` row; the extras are only there once update 27 has run. */
export type Company = Supplier & Partial<CompanyExtras>

/** One BunFest year with a company (`vendor_years_detail`). */
export interface VendorYear {
  supplier_id: string
  org_id: string
  year: number
  tables: number | null
  booth: string | null
  fee_cents: number | null
  paid_on: string | null
  paid_how: string | null
  notes: string | null
  updated_at?: string
}

export type DonationKind = 'auction' | 'raffle' | 'goods' | 'money' | 'sponsorship' | 'services' | 'other'

/** Something a company gave OHRR (`supplier_donations`). */
export interface Donation {
  id: string
  org_id: string
  supplier_id: string
  given_on: string
  kind: DonationKind
  description: string
  value_cents: number | null
  event_year: number | null
  acknowledged_on: string | null
  notes: string | null
  created_by?: string | null
  created_at?: string
}

export type DonationInput = Omit<Donation, 'id' | 'created_by' | 'created_at'> & { id?: string }

/** A silent-auction item that names the company that gave it. */
export interface GivenAuctionItem {
  id: string
  title: string
  value_cents: number | null
  event_slug: string
  status: string
}

export const DONATION_KIND_LABEL: Record<DonationKind, string> = {
  auction: 'Silent auction item',
  raffle: 'Raffle prize',
  goods: 'Goods for the rabbits',
  money: 'Money',
  sponsorship: 'Sponsorship',
  services: 'Services',
  other: 'Something else',
}

export const INVITE_AGAIN_LABEL: Record<InviteAgain, string> = {
  yes: 'Yes',
  maybe: 'Maybe',
  no: 'No',
}

/* --------------------------------------------------------------- probes */

let recordsProbe: Promise<boolean> | null = null

/** True once update 27 has run (the new supplier columns answer). Asked once per session. */
export function vendorRecordsReady(): Promise<boolean> {
  if (!recordsProbe) {
    recordsProbe = Promise.resolve(db.from('suppliers').select('photo_url').limit(1)).then(
      ({ error }) => !error,
      () => false,
    )
  }
  return recordsProbe
}

/* -------------------------------------------------------------- dates */

const pad = (n: number) => String(n).padStart(2, '0')

/** Today as yyyy-mm-dd in local time. */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function localDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

/** Whole days from today until the date (negative when it has passed). */
export function daysUntil(iso: string): number | null {
  const d = localDate(iso)
  if (!d) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

/** "Mar 4, 2027" */
export function fmtDate(iso: string | null | undefined): string {
  const d = iso ? localDate(iso) : null
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

export type InsuranceState = 'expired' | 'soon' | 'ok'

/** Past, within 30 days, or fine. */
export function insuranceState(iso: string | null | undefined): InsuranceState | null {
  if (!iso) return null
  const n = daysUntil(iso)
  if (n === null) return null
  return n < 0 ? 'expired' : n <= 30 ? 'soon' : 'ok'
}

export interface Flag {
  text: string
  tone: 'red' | 'orange' | 'slate'
}

/** The paperwork line under a company's name in the list. */
export function paperworkFlags(c: Company): Flag[] {
  if (!('insurance_expires' in c)) return [] // update 27 not run yet
  const out: Flag[] = []
  const ins = insuranceState(c.insurance_expires)
  if (ins === 'expired') out.push({ text: `Insurance ran out ${fmtDate(c.insurance_expires)}`, tone: 'red' })
  else if (ins === 'soon') out.push({ text: `Insurance ends ${fmtDate(c.insurance_expires)}`, tone: 'orange' })
  if (c.is_vendor) {
    out.push(
      c.agreement_signed_on
        ? { text: `Agreement signed ${c.agreement_signed_on.slice(0, 4)}`, tone: 'slate' }
        : { text: 'No vendor agreement on file', tone: 'orange' },
    )
  }
  if (c.needs_power) out.push({ text: 'Needs power', tone: 'slate' })
  if (c.invite_again === 'no') out.push({ text: 'Not inviting again', tone: 'slate' })
  return out
}

/* ----------------------------------------------------------- company */

/** Add https:// to a typed address; blank stays null. */
export function withScheme(v: string): string | null {
  const t = v.trim()
  if (!t) return null
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

/** "@bunnybrook" or a full address → a link to their Instagram. */
export function instagramUrl(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/instagram\.com/i.test(t)) return `https://${t.replace(/^\/+/, '')}`
  return `https://www.instagram.com/${t.replace(/^@/, '')}`
}

/** A Facebook page name or address → a link. */
export function facebookUrl(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (/facebook\.com|fb\.com/i.test(t)) return `https://${t.replace(/^\/+/, '')}`
  return `https://www.facebook.com/${t.replace(/^@/, '')}`
}

/**
 * Save a company with its update-27 details. The extras are only sent once the
 * columns exist, so the form keeps working before the SQL is run.
 */
export async function saveCompany(s: SupplierInput, extras: CompanyExtras | null): Promise<Company> {
  const row = extras ? { ...s, ...extras } : s
  const { data, error } = await db.from('suppliers').upsert(row, { onConflict: 'id' }).select('*').single()
  if (error) throw error
  return data as Company
}

/* ------------------------------------------------------------- photos */

const PHOTO_BUCKET = 'vendor-photos'

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image. Try a PNG or JPG.'))
    }
    img.src = url
  })
}

/** Shrink to `max` px on the longest side; PNGs stay PNG (logos keep their transparency). */
async function downscale(file: Blob, max = 1000): Promise<{ blob: Blob; ext: 'jpg' | 'png'; type: string }> {
  const img = await loadImage(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('Could not read that image. Try a PNG or JPG.')
  const scale = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not available on this device.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const png = file.type === 'image/png'
  const type = png ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.88))
  if (!blob) throw new Error('Could not process that image.')
  return { blob, ext: png ? 'png' : 'jpg', type }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Downscale, upload to vendor-photos/<org_id>/<uuid>.<ext>, and return the public URL. */
export async function uploadCompanyPhoto(file: Blob, orgId: string): Promise<string> {
  const { blob, ext, type } = await downscale(file)
  const path = `${orgId}/${uuid()}.${ext}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: type, upsert: false })
  if (error) throw error
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best-effort removal of a replaced or removed photo that lives in our bucket. */
export async function removeCompanyPhoto(url: string | null | undefined): Promise<void> {
  const m = url?.match(/\/storage\/v1\/object\/public\/vendor-photos\/(.+?)(?:\?.*)?$/)
  if (!m) return
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove([decodeURIComponent(m[1])])
  } catch {
    /* best effort */
  }
}

/* ------------------------------------------------ BunFest, year by year */

export async function listVendorYears(supplierId: string): Promise<VendorYear[]> {
  const { data, error } = await db
    .from('vendor_years_detail')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('year', { ascending: false })
  if (error) throw error
  return (data ?? []) as VendorYear[]
}

export async function saveVendorYear(y: VendorYear, previousYear?: number): Promise<void> {
  const { updated_at: _skip, ...row } = y
  void _skip
  // The year is part of the key: moving a row to another year replaces it.
  if (previousYear != null && previousYear !== y.year) {
    const { error } = await db.from('vendor_years_detail').insert(row)
    if (error) throw error
    await deleteVendorYear(y.supplier_id, previousYear)
    return
  }
  const { error } = await db.from('vendor_years_detail').upsert(row, { onConflict: 'supplier_id,year' })
  if (error) throw error
}

export async function deleteVendorYear(supplierId: string, year: number): Promise<void> {
  const { error } = await db.from('vendor_years_detail').delete().eq('supplier_id', supplierId).eq('year', year)
  if (error) throw error
}

/* ---------------------------------------------------- given to OHRR */

export async function listDonations(supplierId: string): Promise<Donation[]> {
  const { data, error } = await db
    .from('supplier_donations')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('given_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as Donation[]
}

export interface GiftTotals {
  count: number
  cents: number
}

/** Every company's gift count and stated total, for the list rows. */
export async function giftTotals(orgId: string): Promise<Map<string, GiftTotals>> {
  const { data, error } = await db.from('supplier_donations').select('supplier_id, value_cents').eq('org_id', orgId)
  if (error) throw error
  const out = new Map<string, GiftTotals>()
  for (const r of (data ?? []) as { supplier_id: string; value_cents: number | null }[]) {
    const t = out.get(r.supplier_id) ?? { count: 0, cents: 0 }
    t.count += 1
    t.cents += r.value_cents ?? 0
    out.set(r.supplier_id, t)
  }
  return out
}

export async function saveDonation(d: DonationInput): Promise<void> {
  const { id, ...row } = d
  const { error } = id
    ? await db.from('supplier_donations').update(row).eq('id', id)
    : await db.from('supplier_donations').insert(row)
  if (error) throw error
}

export async function deleteDonation(id: string): Promise<void> {
  const { error } = await db.from('supplier_donations').delete().eq('id', id)
  if (error) throw error
}

export async function markThanked(id: string, on: string | null): Promise<void> {
  const { error } = await db.from('supplier_donations').update({ acknowledged_on: on }).eq('id', id)
  if (error) throw error
}

/** Silent-auction items that name this company as the giver. */
export async function auctionItemsGivenBy(supplierId: string): Promise<GivenAuctionItem[]> {
  const { data, error } = await db
    .from('raffle_items')
    .select('id, title, value_cents, event_slug, status')
    .eq('donor_supplier_id', supplierId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as GivenAuctionItem[]
}

/** Which company gave a silent-auction item (null when none is set). */
export async function auctionItemDonor(itemId: string): Promise<string | null> {
  const { data, error } = await db.from('raffle_items').select('donor_supplier_id').eq('id', itemId).maybeSingle()
  if (error) throw error
  return (data as { donor_supplier_id: string | null } | null)?.donor_supplier_id ?? null
}

export async function setAuctionItemDonor(itemId: string, supplierId: string | null): Promise<void> {
  const { error } = await db.from('raffle_items').update({ donor_supplier_id: supplierId }).eq('id', itemId)
  if (error) throw error
}

/* ------------------------------------------------------- thank-you note */

const THANKS_FOR: Record<DonationKind, string> = {
  auction: 'for your gift to our silent auction',
  raffle: 'for the raffle prize you gave',
  goods: 'for the supplies you gave the rabbits',
  money: 'for your generous donation',
  sponsorship: 'for your sponsorship',
  services: 'for the help you gave us',
  other: 'for your generous gift',
}

/** A short, warm thank-you as a mailto: link. Staff edit it in their mail app before sending. */
export function thankYouMailto(c: Company, g: Donation): string {
  const first = c.contact_name?.trim().split(/\s+/)[0]
  const hello = first ? `Dear ${first},` : `Dear friends at ${c.name},`
  const when = g.event_year ? ` at Midwest BunFest ${g.event_year}` : ''
  const body = [
    hello,
    '',
    `Thank you so much ${THANKS_FOR[g.kind]}${when}: ${g.description.trim()}.`,
    '',
    `Kindness like yours helps us care for the rabbits waiting for their homes, and we are so glad to have ${c.name} in our corner.`,
    '',
    'With warm thanks,',
    'Ohio House Rabbit Rescue',
  ].join('\n')
  const subject = 'Thank you from Ohio House Rabbit Rescue'
  return `mailto:${c.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
