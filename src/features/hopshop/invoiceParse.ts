// Reading an invoice's text into delivery lines — plain rules, no AI and no
// outside service. The text comes from the PDF itself or from photos read on
// the device (invoiceRead.ts). Each line is matched to a Hop Shop product the
// way a person would: the supplier's item number first (on a pack size or the
// product), then a match staff made by hand before (remembered per supplier),
// the packet barcode, and last the product's name ("check this one").
//
// Pure functions only, so they can be tested without a browser.

export interface MatchPack {
  id: string
  label: string
  units: number
  supplier_sku: string | null
}

export interface MatchProduct {
  id: string
  name: string
  code: string | null
  supplier_id: string | null
  supplier_sku: string | null
  barcode?: string | null
  cost_cents: number | null
  packs?: MatchPack[]
}

export interface MatchSupplier {
  id: string
  name: string
  email?: string | null
  website?: string | null
}

/** A match staff made by hand once (`supplier_invoice_matches`). */
export interface RememberedMatch {
  match_key: string
  product_id: string
  units_per: number
}

export type MatchHow = 'remembered' | 'pack' | 'item' | 'barcode' | 'name'

export interface LineMatch {
  productId: string
  /** The pack size the invoice counts in, when one matched (a case of 12). */
  packId: string | null
  /** Sellable items in one of what the invoice counts. */
  unitsPer: number
  how: MatchHow
  /** False for a name match: someone should look. */
  sure: boolean
}

export interface InvoiceLine {
  /** The line as it was read. */
  readAs: string
  /** Their item number, when the line had one we know (or looks like one). */
  itemNo: string | null
  description: string
  qty: number | null
  /** Price of one of what the invoice counts, in cents. */
  unitCents: number | null
  lineCents: number | null
  /** qty × price matched the line total, so the numbers were read right. */
  checked: boolean
  /** What a hand match is remembered under. */
  matchKey: string
  match: LineMatch | null
}

export interface InvoiceRead {
  supplierId: string | null
  invoiceNo: string | null
  /** yyyy-mm-dd */
  invoiceDate: string | null
  subtotalCents: number | null
  shippingCents: number | null
  taxCents: number | null
  totalCents: number | null
  lines: InvoiceLine[]
}

/* ------------------------------------------------------------ small helpers */

const MONEY_RE = /^\(?-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\)?$|^\(?-?\$?\d+\.\d{2}\)?$/
const NUMBER_RE = /^\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^\$?\d+(?:\.\d+)?$/

/** "$1,234.50" → 123450 */
export function toCents(token: string): number | null {
  const t = token.replace(/[$,()\s]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

const num = (token: string) => parseFloat(token.replace(/[$,]/g, ''))

/** Item numbers and barcodes compare without spaces, dashes or dots, in capitals. */
export const codeKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** A description as a remembered key: lower case, single spaces, no punctuation. */
export const wordsKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

const STOP = new Set(['the', 'and', 'for', 'with', 'of', 'a', 'an', 'oz', 'lb', 'lbs', 'ea', 'each', 'pk', 'pack', 'case', 'cs', 'ct', 'count', 'bag', 'box'])
const words = (s: string) =>
  wordsKey(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w))

// Units of measure sometimes printed beside the quantity.
const UOM = new Set(['EA', 'EACH', 'CS', 'CASE', 'CASES', 'BX', 'BOX', 'PK', 'PKG', 'PACK', 'BG', 'BAG', 'CT', 'DZ', 'UN', 'UNIT', 'UNITS', 'PC', 'PCS'])

// Lines that are never items.
const NOT_ITEM = /\b(sub-?total|total|tax|shipping|freight|handling|delivery|balance|amount due|amount paid|paid|payment|discount|credit|invoice|order\s*(no\.?|number|#)|date|page \d|bill to|ship to|sold to|terms|p\.?o\.?\s*(no|number|#)|account|thank you|remit)\b/i

// Address and contact lines, which a packing slip's "words then a count" could mistake for items.
const ADDRESS = /\b(p\.?\s*o\.?\s*box|suite|ste|street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln|hwy|highway|phone|tel|fax|zip)\b/i

/* ------------------------------------------------------------ the header */

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "09/30/2026", "2026-09-30", "Sep 30, 2026", "30 September 2026" → 2026-09-30. */
export function readDate(s: string): string | null {
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (m) return isoDate(+m[1], +m[2], +m[3])
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/)
  if (m) return isoDate(+m[3], +m[1], +m[2])
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/)
  if (m && MONTHS[m[1].slice(0, 4).toLowerCase()] !== undefined) return isoDate(+m[3], MONTHS[m[1].slice(0, 4).toLowerCase()], +m[2])
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) return isoDate(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2])
  m = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) return isoDate(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1])
  return null
}

/** The money on a line after a label: "Shipping: $12.95" → 1295. "Free" → 0. */
function amountAfter(line: string, label: RegExp): number | null {
  const m = line.match(label)
  if (!m || m.index === undefined) return null
  const rest = line.slice(m.index + m[0].length)
  if (/^\W*free\b/i.test(rest)) return 0
  const money = rest.match(/\(?-?\$?\s?\d{1,3}(?:,\d{3})*\.\d{2}\)?|\(?-?\$?\s?\d+\.\d{2}\)?/)
  return money ? toCents(money[0]) : null
}

function readHeader(lines: string[]) {
  let invoiceNo: string | null = null
  let invoiceDate: string | null = null
  let subtotal: number | null = null
  let shipping: number | null = null
  let tax: number | null = null
  let total: number | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!invoiceNo) {
      const m =
        line.match(/\b(?:invoice|order)\s*(?:no\.?|number|num\.?|#)\s*[:.#]?\s*([A-Z0-9][A-Z0-9\-/]{2,})/i) ??
        line.match(/\binvoice\s*[:#]\s*([A-Z0-9][A-Z0-9\-/]{2,})/i)
      if (m && !/^(date|total)$/i.test(m[1])) invoiceNo = m[1]
    }
    if (!invoiceDate && /\b(invoice|order)?\s*date\b/i.test(line)) {
      invoiceDate = readDate(line) ?? (lines[i + 1] ? readDate(lines[i + 1]) : null)
    }
    if (subtotal === null && /\bsub-?\s?total\b/i.test(line)) subtotal = amountAfter(line, /\bsub-?\s?total\b/i)
    if (shipping === null && /\b(shipping|freight|delivery charge|s\s*&\s*h)\b/i.test(line)) {
      shipping = amountAfter(line, /\b(shipping(?:\s*(?:&|and)\s*handling)?|freight|delivery charge|s\s*&\s*h)\b/i)
    }
    if (tax === null && /\b(sales\s+)?tax\b/i.test(line) && !/\btax\s*(id|exempt)/i.test(line)) tax = amountAfter(line, /\b(sales\s+)?tax\b/i)
    // The last "total" that isn't a subtotal is the grand total.
    if (/\b(grand\s+total|total\s+due|amount\s+due|balance\s+due|invoice\s+total|order\s+total|total)\b/i.test(line) && !/\bsub-?\s?total\b/i.test(line)) {
      const t = amountAfter(line, /\b(grand\s+total|total\s+due|amount\s+due|balance\s+due|invoice\s+total|order\s+total|total)\b/i)
      if (t !== null) total = t
    }
  }
  if (!invoiceDate) {
    for (const line of lines) {
      invoiceDate = readDate(line)
      if (invoiceDate) break
    }
  }
  return { invoiceNo, invoiceDate, subtotal, shipping, tax, total }
}

/** Which supplier the invoice is from: their name, web address or email domain in the text. */
export function findSupplier(text: string, suppliers: MatchSupplier[]): string | null {
  const t = text.toLowerCase()
  let best: { id: string; len: number } | null = null
  for (const s of suppliers) {
    const needles = [s.name.toLowerCase().trim()]
    const domain = (s.website ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    if (domain) needles.push(domain)
    const mail = (s.email ?? '').toLowerCase().split('@')[1]
    if (mail) needles.push(mail)
    for (const n of needles) {
      if (n.length >= 3 && t.includes(n) && (!best || n.length > best.len)) best = { id: s.id, len: n.length }
    }
  }
  return best?.id ?? null
}

/* ------------------------------------------------------------ the lines */

interface CodeHit {
  productId: string
  packId: string | null
  unitsPer: number
  how: MatchHow
}

interface Known {
  /** codeKey → what it is */
  codes: Map<string, CodeHit>
  /** match_key → remembered match */
  remembered: Map<string, RememberedMatch>
  products: MatchProduct[]
  supplierId: string | null
}

function knownCodes(products: MatchProduct[], supplierId: string | null, remembered: RememberedMatch[]): Known {
  const codes: Known['codes'] = new Map()
  // The supplier's own products first, so their item numbers win a tie.
  const ordered = [...products].sort((a, b) => Number(b.supplier_id === supplierId) - Number(a.supplier_id === supplierId))
  for (const p of ordered) {
    for (const k of p.packs ?? []) {
      const key = k.supplier_sku ? codeKey(k.supplier_sku) : ''
      if (key.length >= 2 && !codes.has(key)) codes.set(key, { productId: p.id, packId: k.id, unitsPer: Math.max(1, k.units), how: 'pack' })
    }
  }
  for (const p of ordered) {
    const key = p.supplier_sku ? codeKey(p.supplier_sku) : ''
    if (key.length >= 2 && !codes.has(key)) codes.set(key, { productId: p.id, packId: null, unitsPer: 1, how: 'item' })
    const bc = p.barcode ? codeKey(p.barcode) : ''
    if (bc && !codes.has(bc)) codes.set(bc, { productId: p.id, packId: null, unitsPer: 1, how: 'barcode' })
  }
  return { codes, remembered: new Map(remembered.map((r) => [wordsKey(r.match_key), r])), products, supplierId }
}

/** The best name match, when it's clear enough to suggest. */
function byName(description: string, known: Known): MatchProduct | null {
  const want = words(description)
  if (want.length === 0) return null
  let best: { p: MatchProduct; score: number } | null = null
  let second = 0
  for (const p of known.products) {
    const have = words(p.name)
    if (have.length === 0) continue
    const hits = have.filter((w) => want.includes(w)).length
    // Half how much of the product's name is there, half how alike the two are
    // overall (so a short name like "Timothy hay" doesn't win every hay line),
    // nudged up for the invoice's own supplier.
    const coverage = hits / have.length
    const alike = (2 * hits) / (have.length + want.length)
    const score = (coverage + alike) / 2 + (p.supplier_id && p.supplier_id === known.supplierId ? 0.05 : 0)
    if (!best || score > best.score) {
      second = best?.score ?? 0
      best = { p, score }
    } else if (score > second) second = score
  }
  return best && best.score >= 0.55 && best.score - second >= 0.15 ? best.p : null
}

/** One line of text → an invoice line, or null when it isn't an item. */
function readLine(raw: string, known: Known): InvoiceLine | null {
  const readAs = raw.replace(/\s+/g, ' ').trim()
  if (readAs.length < 3 || NOT_ITEM.test(readAs)) return null
  const tokens = readAs.split(' ')

  // Their item number or a barcode we know, anywhere on the line.
  let itemNo: string | null = null
  let codeHit: CodeHit | null = null
  let itemIdx = -1
  for (let i = 0; i < tokens.length && !codeHit; i++) {
    const bare = tokens[i].replace(/^[#(]+|[):,]+$/g, '')
    const key = codeKey(bare)
    const hit = key.length >= 2 ? known.codes.get(key) : undefined
    if (hit) {
      itemNo = bare
      codeHit = hit
      itemIdx = i
    }
  }

  // The numbers: money (two decimals) and plain counts.
  const money: { i: number; cents: number }[] = []
  const counts: { i: number; n: number }[] = []
  tokens.forEach((t, i) => {
    if (i === itemIdx) return
    if (MONEY_RE.test(t)) {
      const c = toCents(t)
      if (c !== null) money.push({ i, cents: Math.abs(c) })
    } else if (NUMBER_RE.test(t) && !t.startsWith('$')) {
      const n = num(t)
      if (n > 0 && n <= 99999 && !(t.length >= 6 && /^\d+$/.test(t))) counts.push({ i, n })
    }
  })

  let qty: number | null = null
  let unitCents: number | null = null
  let lineCents: number | null = null
  let checked = false
  const used = new Set<number>()
  if (money.length >= 2) {
    const total = money[money.length - 1]
    const unit = money[money.length - 2]
    lineCents = total.cents
    unitCents = unit.cents
    used.add(total.i).add(unit.i)
    // The count that makes count × price = line total.
    const fit = [...counts, ...money.slice(0, -2).map((m) => ({ i: m.i, n: m.cents / 100 }))].find(
      (c) => Math.abs(Math.round(c.n * unit.cents) - total.cents) <= Math.max(1, Math.round(total.cents * 0.005)),
    )
    if (fit) {
      qty = fit.n
      checked = true
      used.add(fit.i)
    } else if (unit.cents === total.cents && counts.length === 0) {
      qty = 1
      checked = true
    } else if (counts.length > 0) {
      qty = counts[0].n
      used.add(counts[0].i)
    }
  } else if (money.length === 1) {
    unitCents = money[0].cents
    used.add(money[0].i)
    const before = counts.filter((c) => c.i < money[0].i)
    const pick = before.length ? before[before.length - 1] : counts[0]
    if (pick) {
      qty = pick.n
      used.add(pick.i)
      lineCents = Math.round(qty * unitCents)
    }
  } else if (counts.length > 0) {
    // A packing slip: no prices, just a count — the last number on the line.
    // Without an item number we know, only words-then-a-small-count lines count.
    const pick = counts[counts.length - 1]
    const wordsOnLine = tokens.filter((t) => /[A-Za-z]{2,}/.test(t)).length
    const plain = pick.i === tokens.length - 1 && Number.isInteger(pick.n) && pick.n <= 999 && wordsOnLine >= 2 && !ADDRESS.test(readAs)
    if (itemNo || plain) {
      qty = pick.n
      used.add(pick.i)
    }
  }
  if (qty === null && money.length === 0) return null

  // A first word that looks like an item number we don't know yet (OX-900, not
  // "2nd" or "40oz"): kept as the line's item number, not in its description.
  const first = tokens[0] ?? ''
  const looksLikeItem =
    !itemNo &&
    !used.has(0) &&
    /\d/.test(first) &&
    /^[A-Z0-9][A-Z0-9\-./]{3,}$/i.test(first) &&
    !NUMBER_RE.test(first) &&
    !/^\d+(st|nd|rd|th)$/i.test(first) &&
    !/^\d+(\.\d+)?(oz|lb|lbs|g|kg|ml|l|in|ft|ct|pk|pc|pcs)$/i.test(first)
  const keyItem = itemNo ?? (looksLikeItem ? first : null)

  const description = tokens
    .filter(
      (t, i) =>
        i !== itemIdx &&
        !(looksLikeItem && i === 0) &&
        !used.has(i) &&
        !UOM.has(t.toUpperCase().replace(/[^A-Z]/g, '')) &&
        !MONEY_RE.test(t) &&
        !/^[x×]$/i.test(t),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!description && !keyItem) return null
  const matchKey = keyItem ? codeKey(keyItem).toLowerCase() : wordsKey(description)

  let match: LineMatch | null = null
  const remembered = known.remembered.get(matchKey) ?? known.remembered.get(wordsKey(description))
  if (remembered) {
    match = { productId: remembered.product_id, packId: null, unitsPer: Math.max(1, remembered.units_per), how: 'remembered', sure: true }
  } else if (codeHit) {
    match = { productId: codeHit.productId, packId: codeHit.packId, unitsPer: codeHit.unitsPer, how: codeHit.how, sure: true }
  } else {
    const p = byName(description, known)
    if (p) match = { productId: p.id, packId: null, unitsPer: 1, how: 'name', sure: false }
  }
  const matchedId = match?.productId
  if (matchedId && !known.products.some((p) => p.id === matchedId)) match = null

  return { readAs, itemNo: keyItem, description: description || (keyItem ?? ''), qty, unitCents, lineCents, checked, matchKey, match }
}

/** Every item line in the text, matched where possible. */
export function readLines(lines: string[], products: MatchProduct[], supplierId: string | null, remembered: RememberedMatch[]): InvoiceLine[] {
  const known = knownCodes(products, supplierId, remembered)
  return lines.map((l) => readLine(l, known)).filter((x): x is InvoiceLine => x !== null)
}

/** The whole invoice: who it's from, its number, date and totals, and its lines. */
export function readInvoice(
  lines: string[],
  ctx: { products: MatchProduct[]; suppliers: MatchSupplier[]; remembered?: (supplierId: string) => RememberedMatch[]; supplierId?: string | null },
): InvoiceRead {
  const text = lines.join('\n')
  const supplierId = ctx.supplierId ?? findSupplier(text, ctx.suppliers)
  const head = readHeader(lines)
  const remembered = supplierId && ctx.remembered ? ctx.remembered(supplierId) : []
  return {
    supplierId,
    invoiceNo: head.invoiceNo,
    invoiceDate: head.invoiceDate,
    subtotalCents: head.subtotal,
    shippingCents: head.shipping,
    taxCents: head.tax,
    totalCents: head.total,
    lines: readLines(lines, ctx.products, supplierId, remembered),
  }
}

/** Items this line adds to stock: what the invoice counts × the items in each. */
export function unitsFor(qty: number | null, unitsPer: number): number {
  if (qty === null || !Number.isFinite(qty)) return 0
  return Math.max(0, Math.round(qty * Math.max(1, unitsPer)))
}

/** What one sellable item cost: the invoice's price ÷ the items in each. */
export function costEach(unitCents: number | null, unitsPer: number): number | null {
  return unitCents === null ? null : Math.round(unitCents / Math.max(1, unitsPer))
}
