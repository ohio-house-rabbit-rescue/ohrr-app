import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'

export type VolunteerOpp = Database['public']['Tables']['volunteer_opportunities']['Row']

// The editable categories — one per real volunteer position (category = the
// position's slug on the Volunteer pages) plus "events" for one-off needs.
// Unknown categories (e.g. added directly in the database) are tolerated: the
// UI shows the raw value as its label.
export const OPP_CATEGORIES = [
  { value: 'socialization', label: 'Bunny Socialization shifts' },
  { value: 'buncare', label: 'Buncare shifts' },
  { value: 'vet-transport', label: 'Vet delivery & pick-up runs' },
  { value: 'field-rescue', label: 'Field rescue needs' },
  { value: 'events', label: 'Events & fundraising' },
] as const

export type OppCategory = (typeof OPP_CATEGORIES)[number]['value']

export function categoryLabel(value: string): string {
  return OPP_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export function isKnownCategory(value: string): value is OppCategory {
  return OPP_CATEGORIES.some((c) => c.value === value)
}

// Public hook: live PUBLISHED opportunities for one category.
// Returns null while loading, then an array (empty when none) so callers can
// fall back to their built-in content.
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
      .then(({ data, error }) => {
        if (active) setItems(error ? [] : (data ?? []))
      })
    return () => {
      active = false
    }
  }, [category])

  return items
}
