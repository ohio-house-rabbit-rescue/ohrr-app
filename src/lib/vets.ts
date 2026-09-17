import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'
import { seedVets, type Vet } from '../data/vets'

export type VetRow = Database['public']['Tables']['vets']['Row']

export function rowToVet(r: VetRow): Vet {
  return {
    id: r.id,
    name: r.name,
    doctors: r.doctors ?? undefined,
    address: r.address ?? undefined,
    city: r.city ?? undefined,
    region: r.region,
    phone: r.phone ?? undefined,
    phone2: r.phone2 ?? undefined,
    email: r.email ?? undefined,
    website: r.website ?? undefined,
    notes: r.notes ?? undefined,
    isEmergency: r.is_emergency,
    isLowCostSpay: r.is_low_cost_spay,
  }
}

export interface VetsResult {
  vets: Vet[]
  source: 'live' | 'seed'
}

// Public hook: live PUBLISHED vets, silently falling back to the bundled seed
// (the app is complete before the migration is applied).
export function useVets(): VetsResult {
  const [state, setState] = useState<VetsResult>({ vets: seedVets, source: 'seed' })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('vets')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (active && !error && data && data.length > 0) {
          setState({ vets: data.map(rowToVet), source: 'live' })
        }
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** Pull a dialable number out of free text like "Text 614-412-2146". */
export function phoneDigits(s: string): string | null {
  const m = s.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)
  return m ? m[0] : null
}

export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}
