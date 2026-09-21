// Tag codes. Printed OHRR tags carry "OHRR-XXXXX" (5 characters from an
// alphabet with no 0/O or 1/I, so a code read aloud or typed can't be
// misheard) and a QR that opens <app>/t/XXXXX — so the phone's own camera app
// opens the item too. Retail barcodes stay as their digits. The database
// normalises the same way (normalize_item_code), so any spelling matches.
import { APP_URL } from '../mybunny/ics'

export const TAG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const TAG_LENGTH = 5
export const TAG_PREFIX = 'OHRR-'

function randomIndex(max: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % max
  }
  return Math.floor(Math.random() * max)
}

/** A fresh printable code, e.g. "OHRR-7K3PX". Always contains a letter. */
export function newTagCode(): string {
  for (;;) {
    let body = ''
    for (let i = 0; i < TAG_LENGTH; i++) body += TAG_ALPHABET[randomIndex(TAG_ALPHABET.length)]
    if (/[A-Z]/.test(body)) return TAG_PREFIX + body
  }
}

/** Mirror of normalize_item_code() in SQL. Returns '' for nothing useful. */
export function normalizeCode(raw: string): string {
  let s = raw ?? ''
  const m = s.match(/\/t\/([^/?#]+)/)
  if (m) s = m[1]
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!s) return ''
  if (/^OHRR[A-Z0-9]{5}$/.test(s)) return TAG_PREFIX + s.slice(4)
  if (/^[A-Z0-9]{5}$/.test(s) && !/^[0-9]+$/.test(s)) return TAG_PREFIX + s
  return s
}

export function isTagCode(code: string): boolean {
  return code.startsWith(TAG_PREFIX)
}

/** A retail barcode (UPC-A/E, EAN-8/13, GTIN-14): digits only. */
export function isRetailBarcode(code: string): boolean {
  return /^[0-9]{8,14}$/.test(code)
}

/** The URL printed inside a tag's QR code. */
export function tagUrl(code: string): string {
  const body = code.startsWith(TAG_PREFIX) ? code.slice(TAG_PREFIX.length) : code
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return `${base}/t/${body}`
}

/** "OHRR-7K3PX" → "7K3PX" (what's printed large on the tag). */
export function shortCode(code: string): string {
  return code.startsWith(TAG_PREFIX) ? code.slice(TAG_PREFIX.length) : code
}
