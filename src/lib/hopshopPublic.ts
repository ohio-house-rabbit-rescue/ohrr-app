import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'

export type PublicProduct = Database['public']['Functions']['hopshop_public_products']['Returns'][number]

// Public hook: what is on the Hop Shop shelf right now — active products with
// photo, price and whether any are left — via the read-only RPC
// `hopshop_public_products` (supabase/migrations/20260921160000_public_shop.sql).
// Any error (function not pasted yet, offline) quietly resolves to [] so the
// screen falls back to the category list.
export function useHopShopProducts(): PublicProduct[] | null {
  const [items, setItems] = useState<PublicProduct[] | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .rpc('hopshop_public_products')
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
