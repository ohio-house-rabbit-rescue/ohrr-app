// Items from OHRR's Amazon wish list (update 32, table `wish_list_items`).
// Amazon won't let a program read the list, so staff paste each item's own
// Amazon link in Staff → Wish list items. The Support page lists the published
// ones — "Most needed" first, then in staff's order — each with a "Buy on
// Amazon" button, and keeps the button to the whole list. No photos: Amazon's
// images can't be used. Until update 32 is run (or while there are no items)
// the Support page shows exactly what it did before. The website has the same
// rules in its own copy.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type WishListItem = Pick<
  Database['public']['Tables']['wish_list_items']['Row'],
  'id' | 'name' | 'amazon_url' | 'note' | 'most_needed' | 'sort_order' | 'is_published'
>

export const WISH_ITEM_COLUMNS = 'id, name, amazon_url, note, most_needed, sort_order, is_published'

/** The same rule as the database: https on amazon.com, a.co or amzn.to. */
const AMAZON_URL = /^https:\/\/([a-z0-9-]+\.)*(amazon\.com|a\.co|amzn\.to)\//i

export function isAmazonUrl(url: string): boolean {
  return AMAZON_URL.test(url.trim())
}

/**
 * Amazon's Share → Copy link sometimes copies a line of text with the link at
 * the end ("Amazon.com: Oxbow Western Timothy Hay … https://a.co/d/…"): keep
 * just the link.
 */
export function cleanAmazonLink(pasted: string): string {
  const m = /https:\/\/\S+/i.exec(pasted)
  return (m ? m[0] : pasted).trim()
}

/** "Most needed" first, then staff's order. */
export function sortWishItems<T extends Pick<WishListItem, 'most_needed' | 'sort_order' | 'name'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => Number(b.most_needed) - Number(a.most_needed) || a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  )
}

/** PostgREST: the table isn't there (update 32 not run yet). */
export function wishTableMissing(e: { code?: string; message?: string }): boolean {
  return e.code === 'PGRST205' || e.code === '42P01' || /schema cache|does not exist/i.test(e.message ?? '')
}

/** The published items, in order; [] when there are none (or update 32 isn't in). */
export function useWishListItems(): WishListItem[] {
  const [items, setItems] = useState<WishListItem[]>([])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    supabase
      .from('wish_list_items')
      .select(WISH_ITEM_COLUMNS)
      // Staff who keep the list can read the hidden ones too; the public page never shows them.
      .eq('is_published', true)
      .then(({ data, error }) => {
        if (alive && !error && data) setItems(sortWishItems(data))
      })
    return () => {
      alive = false
    }
  }, [])
  return items
}
