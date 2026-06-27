// Loads adoptable rabbits for the app. Priority:
//   1) Staff-managed rabbits in Supabase (the source once OHRR adds any)
//   2) The live Petfinder feed (via the Netlify function), if configured
//   3) Bundled sample rabbits (local dev, or before anything is set up)
// The result is cached for the life of the page so the list and detail view
// share a single fetch.

import { sampleRabbits, type Rabbit, type Sex, type AgeGroup } from '../data/adoptables'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'

export type AdoptSource = 'app' | 'petfinder' | 'sample'

export interface AdoptResult {
  rabbits: Rabbit[]
  source: AdoptSource
  updated?: string
}

type RabbitRow = Database['public']['Tables']['rabbits']['Row']

function rowToRabbit(r: RabbitRow): Rabbit {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    sex: (r.sex as Sex) || undefined,
    age: (r.age as AgeGroup) || undefined,
    breed: r.breed || undefined,
    size: r.size || undefined,
    spayedNeutered: r.spayed_neutered,
    houseTrained: r.house_trained,
    bonded: r.bonded,
    description: r.description || undefined,
    tags: r.tags ?? [],
    photo: r.photos?.[0],
    photos: r.photos ?? [],
    publishedAt: r.created_at,
  }
}

let cache: Promise<AdoptResult> | null = null

async function fetchAdoptables(): Promise<AdoptResult> {
  // 1) Staff-managed rabbits (Supabase). Once OHRR adds any, these are the list.
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from('rabbits')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (data && data.length > 0) {
        return { rabbits: data.map(rowToRabbit), source: 'app' }
      }
    } catch {
      // fall through to Petfinder / samples
    }
  }

  // 2) Live Petfinder feed via the Netlify function.
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

  // 3) Bundled samples.
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
