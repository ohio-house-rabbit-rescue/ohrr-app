// Loads adoptable rabbits for the app. Tries the live Petfinder feed (via the
// Netlify function) and transparently falls back to the bundled sample rabbits
// when the feed is unconfigured, empty, or unreachable (e.g. local `vite dev`,
// where Netlify functions aren't running). The result is cached for the life of
// the page so the list and the detail view share a single fetch.

import { sampleRabbits, type Rabbit } from '../data/adoptables'

export type AdoptSource = 'petfinder' | 'sample'

export interface AdoptResult {
  rabbits: Rabbit[]
  source: AdoptSource
  updated?: string
}

let cache: Promise<AdoptResult> | null = null

async function fetchAdoptables(): Promise<AdoptResult> {
  try {
    const res = await fetch('/.netlify/functions/petfinder', {
      headers: { Accept: 'application/json' },
    })
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json()
      if (Array.isArray(data.rabbits) && data.rabbits.length > 0) {
        return { rabbits: data.rabbits as Rabbit[], source: 'petfinder', updated: data.updated }
      }
    }
  } catch {
    // Network error / not running under Netlify — fall through to sample data.
  }
  return { rabbits: sampleRabbits, source: 'sample' }
}

export function getAdoptables(): Promise<AdoptResult> {
  if (!cache) cache = fetchAdoptables()
  return cache
}

// Collapse a (possibly multi-line, HTML-ish) description into a short teaser.
export function teaser(r: Rabbit, max = 120): string {
  const text = (r.description || '').replace(/\s+/g, ' ').trim()
  if (!text) return `Say hello to ${r.name} — visit OHRR by appointment to meet this bunny.`
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}
