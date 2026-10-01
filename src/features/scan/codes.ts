// Item numbers (update 41). Donations — and the auction or raffle items they
// become — carry DON-00001, a running number the database hands out. Hop Shop
// products carry a SKU, TYPE-VENDOR-ITEM: HAY-101-001 is Hay, from vendor 101,
// that vendor's first hay item (vendor 000 = no supplier: donated, or OHRR's
// own). Packet barcodes stay as their digits, a product's second code.
// Labels carry a QR that opens <app>/t/<code>, so the phone's own camera app
// opens the item too. The database reads codes the same way
// (normalize_item_code), so any spelling matches: "don 42" is DON-00042 and
// "hay-101-1" is HAY-101-001.
import { APP_URL } from '../mybunny/ics'

export const DON_PREFIX = 'DON-'

const DON_RE = /^DON-[0-9]+$/
const SKU_RE = /^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$/

/** "42" → "00042" (never cuts a longer number). */
function pad(digits: string, width: number): string {
  const n = String(parseInt(digits, 10))
  return n.length >= width ? n : n.padStart(width, '0')
}

/** Mirror of normalize_item_code() in SQL. Returns '' for nothing useful. */
export function normalizeCode(raw: string): string {
  let s = raw ?? ''
  const link = s.match(/\/t\/([^/?#]+)/)
  if (link) s = link[1]
  let m = s.match(/^\s*don[\s_-]*([0-9]{1,9})\s*$/i)
  if (m) return DON_PREFIX + pad(m[1], 5)
  m = s.match(/^\s*([A-Za-z]{3})[\s_-]+([0-9]{1,3})[\s_-]+([0-9]{1,6})\s*$/)
  if (m) return `${m[1].toUpperCase()}-${pad(m[2], 3)}-${pad(m[3], 3)}`
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!s) return ''
  if (/^[A-Z]{3}[0-9]{6,9}$/.test(s)) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`
  return s
}

/** DON-00042: a donation, or the auction or raffle item it became. */
export function isDonationCode(code: string): boolean {
  return DON_RE.test(code)
}

/** HAY-101-001: a Hop Shop product. */
export function isSku(code: string): boolean {
  return SKU_RE.test(code)
}

/** A number OHRR made (either kind), as opposed to a maker's barcode. */
export function isOhrrCode(code: string): boolean {
  return isDonationCode(code) || isSku(code)
}

/** A retail barcode (UPC-A/E, EAN-8/13, GTIN-14): digits only. */
export function isRetailBarcode(code: string): boolean {
  return /^[0-9]{8,14}$/.test(code)
}

/** HAY-101-001 → { type: 'HAY', vendor: '101', item: '001' }. */
export function skuParts(code: string): { type: string; vendor: string; item: string } | null {
  if (!isSku(code)) return null
  const [type, vendor, item] = code.split('-')
  return { type, vendor, item }
}

/** The URL printed inside a label's QR code. */
export function tagUrl(code: string): string {
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return `${base}/t/${code}`
}
