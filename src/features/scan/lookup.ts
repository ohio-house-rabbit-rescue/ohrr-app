// Best-effort product name for a retail barcode, from the Open Food Facts
// family of databases (free, no key, CORS-friendly). Coverage is patchy, so
// this only ever PRE-FILLS the name — the person confirms or types their own,
// and we never store the database's photo (its licence needs attribution).
// Any failure or timeout is silent: the flow works exactly as before.
import { isRetailBarcode } from './codes'

export interface ProductGuess {
  name: string
  brand: string | null
  /** Shown once as "does this look right?"; not saved. */
  thumb: string | null
}

const SOURCES = [
  'https://world.openpetfoodfacts.org', // hay, pellets, treats
  'https://world.openproductsfacts.org', // general goods
  'https://world.openfoodfacts.org',
  'https://world.openbeautyfacts.org',
]

const TIMEOUT_MS = 3500

interface OffResponse {
  status?: number
  product?: { product_name?: string; brands?: string; image_front_small_url?: string; image_front_url?: string }
}

async function fetchOne(base: string, code: string, signal: AbortSignal): Promise<ProductGuess | null> {
  const url = `${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,image_front_small_url,image_front_url`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const j = (await res.json()) as OffResponse
  const name = j.product?.product_name?.trim()
  if (j.status !== 1 || !name) return null
  const brand = j.product?.brands?.split(',')[0]?.trim() || null
  return {
    name,
    brand,
    thumb: j.product?.image_front_small_url ?? j.product?.image_front_url ?? null,
  }
}

export async function guessProduct(code: string): Promise<ProductGuess | null> {
  if (!isRetailBarcode(code)) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const results = await Promise.allSettled(SOURCES.map((s) => fetchOne(s, code, ctrl.signal)))
    for (const r of results) if (r.status === 'fulfilled' && r.value) return r.value
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** "Oxbow · Western Timothy Hay" → what goes in the name box. */
export function guessTitle(g: ProductGuess): string {
  if (g.brand && !g.name.toLowerCase().includes(g.brand.toLowerCase())) return `${g.brand} ${g.name}`
  return g.name
}
