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

// How an opportunity is limited: not at all, by how many PEOPLE are needed, or
// by how many HOURS have to be covered. (supabase/migrations/20260922140000_*.sql)
export const LIMIT_KINDS = [
  { value: 'none', label: 'No limit' },
  { value: 'people', label: 'A number of people' },
  { value: 'hours', label: 'A number of hours' },
] as const

/** What's left — the line the public page shows. Null when there is no limit. */
export function remainingLabel(o: VolunteerOpp): string | null {
  if (o.limit_kind === 'people' && o.limit_people) {
    const left = Math.max(0, o.limit_people - (o.filled_people ?? 0))
    return left === 0 ? 'Full' : `${left} of ${o.limit_people} ${left === 1 ? 'spot' : 'spots'} left`
  }
  if (o.limit_kind === 'hours' && o.limit_hours) {
    const left = Math.max(0, Number(o.limit_hours) - Number(o.filled_hours ?? 0))
    return left === 0 ? 'Covered' : `${left % 1 === 0 ? left : left.toFixed(1)} of ${o.limit_hours} hours still needed`
  }
  return null
}

/** True when nothing more is needed — the card says so and stops asking. */
export function isFull(o: VolunteerOpp): boolean {
  if (o.limit_kind === 'people' && o.limit_people) return (o.filled_people ?? 0) >= o.limit_people
  if (o.limit_kind === 'hours' && o.limit_hours) return Number(o.filled_hours ?? 0) >= Number(o.limit_hours)
  return false
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
