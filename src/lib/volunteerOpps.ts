import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'

export type VolunteerOpp = Database['public']['Tables']['volunteer_opportunities']['Row']

// The editable categories (foster has no list — it's static steps).
export const OPP_CATEGORIES = [
  { value: 'socialization', label: 'Socialization shifts' },
  { value: 'vet-transport', label: 'Vet-transport runs' },
  { value: 'events', label: 'Events' },
] as const

export type OppCategory = (typeof OPP_CATEGORIES)[number]['value']

export function categoryLabel(value: string): string {
  return OPP_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

// Public hook: live PUBLISHED opportunities for one category.
// Returns null while loading, then an array (empty when none) so callers can
// fall back to their built-in sample listings.
export function useVolunteerOpportunities(category: string): VolunteerOpp[] | null {
  const [items, setItems] = useState<VolunteerOpp[] | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .from('volunteer_opportunities')
      .select('*')
      .eq('category', category)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active) setItems(data ?? [])
      })
    return () => {
      active = false
    }
  }, [category])

  return items
}
