import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'

export type PublicProduct = Pick<
  Database['public']['Tables']['hopshop_products']['Row'],
  'id' | 'name' | 'description' | 'price_cents'
>

// Public hook: OHRR's ACTIVE Hop Shop products, if the table is readable to the
// public. Today RLS limits hopshop_products to org members, so anonymous
// visitors get an error/empty result — we swallow that silently and return []
// so the screen falls back to the category list. If OHRR later opens a public
// read policy, real stock appears here with no app change.
export function useHopShopProducts(): PublicProduct[] | null {
  const [items, setItems] = useState<PublicProduct[] | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .from('hopshop_products')
      .select('id, name, description, price_cents')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        setItems(error ? [] : (data ?? []))
      })
    return () => {
      active = false
    }
  }, [])
  return items
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
