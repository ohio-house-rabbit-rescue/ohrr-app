// The post queue: premade posts stored in `social_posts`, released later by
// the person with `social.publish`. See supabase/migrations/20260921130000_social_posts.sql.
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { downscaleToJpeg } from '../raffle/photoUpload'

export type PostStatus = 'draft' | 'approved' | 'posted' | 'archived'
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'other'
export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Other' },
]

export interface SocialPost {
  id: string
  org_id: string
  title: string
  caption: string
  image_url: string | null
  image_alt: string | null
  platforms: Platform[]
  scheduled_for: string | null
  status: PostStatus
  source: string | null
  notes: string | null
  created_by: string | null
  approved_at: string | null
  posted_at: string | null
  posted_to: Platform[] | null
  created_at: string
  updated_at: string
}

export interface PostDraft {
  title: string
  caption: string
  image_url: string | null
  image_alt?: string | null
  platforms: Platform[]
  scheduled_for: string | null
  notes?: string | null
  source?: string | null
}

export const BUCKET = 'social-images'

export async function listPosts(orgId: string): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('org_id', orgId)
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as SocialPost[]
}

export async function createPost(orgId: string, userId: string, d: PostDraft): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('social_posts')
    .insert({
      org_id: orgId,
      created_by: userId,
      title: d.title.trim(),
      caption: d.caption,
      image_url: d.image_url,
      image_alt: d.image_alt ?? null,
      platforms: d.platforms,
      scheduled_for: d.scheduled_for || null,
      notes: d.notes ?? null,
      source: d.source ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as SocialPost
}

export async function updatePost(id: string, d: Partial<PostDraft>): Promise<void> {
  const patch: Database['public']['Tables']['social_posts']['Update'] = {}
  if (d.title !== undefined) patch.title = d.title.trim()
  if (d.caption !== undefined) patch.caption = d.caption
  if (d.image_url !== undefined) patch.image_url = d.image_url
  if (d.image_alt !== undefined) patch.image_alt = d.image_alt
  if (d.platforms !== undefined) patch.platforms = d.platforms
  if (d.scheduled_for !== undefined) patch.scheduled_for = d.scheduled_for || null
  if (d.notes !== undefined) patch.notes = d.notes
  const { error } = await supabase.from('social_posts').update(patch).eq('id', id)
  if (error) throw error
}

export async function setPostStatus(id: string, status: PostStatus, postedTo?: Platform[]): Promise<void> {
  const { error } = await supabase.rpc('set_social_post_status', { p_id: id, p_status: status, p_posted_to: postedTo ?? null })
  if (error) throw error
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('social_posts').delete().eq('id', id)
  if (error) throw error
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** A Share-kit card (PNG, already 1080 px) — stored as-is. */
export async function uploadPostPng(blob: Blob, orgId: string): Promise<string> {
  const path = `${orgId}/${newId()}.png`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** A photo from the phone — downscaled to 1280 px JPEG first. */
export async function uploadPostPhoto(file: Blob, orgId: string): Promise<string> {
  const jpeg = await downscaleToJpeg(file)
  const path = `${orgId}/${newId()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Fetch a stored image as a Blob for the share sheet (bucket is CORS-open). */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not load the image')
  return res.blob()
}

export function isReady(p: SocialPost, today = localToday()): boolean {
  return p.status === 'approved' && (!p.scheduled_for || p.scheduled_for <= today)
}

export function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function whenLabel(p: SocialPost): string {
  if (!p.scheduled_for) return 'Any time'
  const d = new Date(p.scheduled_for + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
