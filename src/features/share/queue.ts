// The post queue: premade posts stored in `social_posts`, released later by
// the person with `social.publish`. See supabase/migrations/20260921130000_social_posts.sql.
// Update 26 (20260924200000_social_post_approval.sql) adds a second person's
// approval: draft → submitted ("Waiting for approval") → approved → posted.
// Every status change goes through set_social_post_status(), never a table update.
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import type { Capability } from '../../lib/capabilities'
import { downscaleToJpeg } from '../raffle/photoUpload'

export type PostStatus = 'draft' | 'submitted' | 'approved' | 'posted' | 'archived'
export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for approval',
  approved: 'Approved',
  posted: 'Posted',
  archived: 'Archived',
}

// "Approve social posts" (update 26) isn't in lib/capabilities.ts's list yet, so it's cast.
export const APPROVE_CAP = 'social.approve' as string as Capability
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
  approved_by: string | null
  approved_at: string | null
  posted_by: string | null
  posted_at: string | null
  posted_to: Platform[] | null
  created_at: string
  updated_at: string
  // Update 26 — not in database.types.ts yet, and absent until the update is run.
  submitted_by?: string | null
  submitted_at?: string | null
  review_note?: string | null
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

/**
 * Change a post's status (the only way to). `note` goes with a "Send back".
 * p_note arrives with update 26 and isn't in database.types.ts yet, hence the cast;
 * it's only sent when there is a note, so other calls still work before the update.
 */
export async function setPostStatus(id: string, status: PostStatus, postedTo?: Platform[], note?: string): Promise<void> {
  const text = note?.trim() || null
  const args = { p_id: id, p_status: status, p_posted_to: postedTo ?? null, ...(text ? { p_note: text } : {}) }
  const { error } = await supabase.rpc('set_social_post_status', args as Database['public']['Functions']['set_social_post_status']['Args'])
  if (error) throw new Error(statusError(error, status, Boolean(text)))
}

// Before update 26 is in the database there's no "Waiting for approval" and no
// note: say so, and keep the database's own words.
function statusError(e: { message: string; code?: string }, status: PostStatus, withNote: boolean): string {
  const missing = (status === 'submitted' && /bad status/i.test(e.message)) || (withNote && e.code === 'PGRST202')
  return missing ? `This needs database update 26 (social post approval), which isn’t in yet. (${e.message})` : e.message
}

// count_posts_to_approve arrives with update 26 and isn't in database.types.ts yet.
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

/** Posts waiting for approval that someone else wrote — 0 without the permission or before update 26. */
export async function countPostsToApprove(orgId: string): Promise<number> {
  try {
    const { data, error } = await (supabase.rpc as unknown as UntypedRpc).call(supabase, 'count_posts_to_approve', { p_org: orgId })
    return !error && typeof data === 'number' ? data : 0
  } catch {
    return 0
  }
}

/** Staff names by user id (Team profile name, else email) for "Approved by …". Empty if it can't load. */
export async function loadStaffNames(orgId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    const [members, profiles] = await Promise.all([
      supabase.rpc('list_org_members', { p_org: orgId }),
      supabase.from('memberships').select('user_id, display_name').eq('org_id', orgId),
    ])
    for (const m of members.data ?? []) if (m.email) names.set(m.user_id, m.email)
    for (const p of profiles.data ?? []) if (p.display_name?.trim()) names.set(p.user_id, p.display_name.trim())
  } catch {
    /* the queue works without names */
  }
  return names
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

/** "Sep 24" (with the year when it isn't this year). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
}

export function whenLabel(p: SocialPost): string {
  if (!p.scheduled_for) return 'Any time'
  const d = new Date(p.scheduled_for + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
