// Happy Tails — the published adoption stories.
//
// Stories arrive through the app's "Share your Happy Tail" form and land in the
// Inbox; publishing one turns it into a `happy_tails` row that the public page
// reads (supabase/migrations/20260922130000_tails_uploads_profile.sql). Until
// OHRR publishes the first one, the page keeps showing the bundled samples.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { tails as seedTails, type Tail, type TailStatus } from '../../data/tails'

export type TailRow = Database['public']['Tables']['happy_tails']['Row']
export type TailInput = Database['public']['Tables']['happy_tails']['Insert'] & { id?: string }

export function rowToTail(r: TailRow): Tail {
  return {
    id: r.id,
    bunny: r.bunny,
    family: r.family ?? undefined,
    status: r.status as TailStatus,
    photo: r.photo_url ?? undefined,
    since: r.since ?? undefined,
    summary: r.summary,
    // One entry, so the detail page's timeline still reads naturally.
    timeline: r.story ? [{ date: r.since ?? '', status: r.status as TailStatus, text: r.story }] : [],
  }
}

export interface TailsResult {
  items: Tail[]
  source: 'live' | 'seed'
  loading: boolean
}

/** Published stories, falling back to the bundled samples. */
export function useHappyTails(): TailsResult {
  const [state, setState] = useState<TailsResult>({ items: seedTails, source: 'seed', loading: isSupabaseConfigured })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('happy_tails')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data || data.length === 0) {
          setState({ items: seedTails, source: 'seed', loading: false })
          return
        }
        setState({ items: data.map(rowToTail), source: 'live', loading: false })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

/* ----------------------------------------------------------------- staff */

export async function listTails(orgId: string): Promise<TailRow[]> {
  const { data, error } = await supabase
    .from('happy_tails')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function saveTail(t: TailInput): Promise<TailRow> {
  const { data, error } = await supabase.from('happy_tails').upsert(t, { onConflict: 'id' }).select('*').single()
  if (error) throw error
  return data
}

export async function deleteTail(id: string): Promise<void> {
  const { error } = await supabase.from('happy_tails').delete().eq('id', id)
  if (error) throw error
}

export interface PublishInput {
  requestId: string
  bunny: string
  summary: string
  family?: string
  status?: TailStatus
  since?: string
  story?: string
  photoUrl?: string
}

/** Inbox → Happy Tails. Marks the request done and returns the new story's id. */
export async function publishHappyTail(i: PublishInput): Promise<string> {
  const { data, error } = await supabase.rpc('publish_happy_tail', {
    p_request_id: i.requestId,
    p_bunny: i.bunny,
    p_summary: i.summary,
    p_family: i.family ?? null,
    p_status: i.status ?? 'going-strong',
    p_since: i.since ?? null,
    p_story: i.story ?? null,
    p_photo_url: i.photoUrl ?? null,
  })
  if (error) throw error
  return data as string
}
