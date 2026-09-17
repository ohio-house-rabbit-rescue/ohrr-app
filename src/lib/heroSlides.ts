import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'
import { seedHeroSlides, type HeroSlide, type SlidePlacement } from '../data/heroSlides'

export type HeroSlideRow = Database['public']['Tables']['hero_slides']['Row']

export function rowToSlide(r: HeroSlideRow): HeroSlide {
  return {
    id: r.id,
    placement: r.placement === 'featured' ? 'featured' : 'hero',
    headline: r.headline,
    subline: r.subline ?? undefined,
    imageUrl: r.image_url ?? undefined,
    ctaLabel: r.cta_label ?? undefined,
    ctaUrl: r.cta_url ?? undefined,
    startsAt: r.starts_at ?? undefined,
    endsAt: r.ends_at ?? undefined,
    sortOrder: r.sort_order,
  }
}

// A slide is active when it's inside its optional date window (the DB policy
// enforces the same for live rows; this also applies it to the seed).
export function isActiveSlide(s: HeroSlide, now = Date.now()): boolean {
  if (s.startsAt && new Date(s.startsAt).getTime() > now) return false
  if (s.endsAt && new Date(s.endsAt).getTime() < now) return false
  return true
}

function pick(slides: HeroSlide[], placement: SlidePlacement): HeroSlide[] {
  return slides
    .filter((s) => s.placement === placement && isActiveSlide(s))
    .sort((a, b) => b.sortOrder - a.sortOrder)
}

let cache: Promise<HeroSlide[] | null> | null = null

async function fetchLive(): Promise<HeroSlide[] | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('hero_slides')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: false })
    if (error || !data || data.length === 0) return null
    return data.map(rowToSlide)
  } catch {
    return null
  }
}

// Public hook: active slides for one placement — live rows when the table has
// any, else the bundled seed. Never null; the seed renders immediately.
export function useHeroSlides(placement: SlidePlacement = 'hero'): HeroSlide[] {
  const [slides, setSlides] = useState<HeroSlide[]>(() => pick(seedHeroSlides, placement))
  useEffect(() => {
    let active = true
    if (!cache) cache = fetchLive()
    cache.then((live) => {
      if (active && live) setSlides(pick(live, placement))
    })
    return () => {
      active = false
    }
  }, [placement])
  return slides
}
