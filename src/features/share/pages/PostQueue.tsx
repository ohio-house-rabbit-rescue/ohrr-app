// Staff → Post queue. Volunteers stack up posts; the one person with posting
// rights releases them: tap Share (the phone's share sheet → Instagram /
// Facebook / TikTok), then "Mark as posted". Ready-today posts float to the top.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError } from '../../../components/staffui'
import { canShareFiles, copyText, savePng, sharePng } from '../share'
import {
  PLATFORMS,
  deletePost,
  fetchImageBlob,
  isReady,
  listPosts,
  setPostStatus,
  whenLabel,
  type Platform,
  type SocialPost,
} from '../queue'

export default function PostQueue() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const canDraft = can('announcements.post')
  const canPublish = can('social.publish')
  const [posts, setPosts] = useState<SocialPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPosted, setShowPosted] = useState(false)

  const load = useCallback(async () => {
    try {
      setPosts(await listPosts(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  const groups = useMemo(() => {
    const all = posts ?? []
    return {
      ready: all.filter((p) => isReady(p)),
      scheduled: all.filter((p) => p.status === 'approved' && !isReady(p)),
      drafts: all.filter((p) => p.status === 'draft'),
      posted: all.filter((p) => p.status === 'posted').sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? '')).slice(0, 30),
    }
  }, [posts])

  if (!canDraft && !canPublish) return <Screen><p className="text-sm text-slate-600">You don’t have access to the post queue.</p></Screen>

  const patch = (id: string, fn: (p: SocialPost) => SocialPost) => setPosts((list) => (list ?? []).map((p) => (p.id === id ? fn(p) : p)))

  const act = async (p: SocialPost, status: SocialPost['status'], postedTo?: Platform[]) => {
    setError(null)
    try {
      await setPostStatus(p.id, status, postedTo)
      patch(p.id, (x) => ({ ...x, status, posted_at: status === 'posted' ? new Date().toISOString() : x.posted_at, posted_to: status === 'posted' ? (postedTo ?? x.platforms) : x.posted_to }))
    } catch (e) {
      setError(errMessage(e))
    }
  }
  const remove = async (p: SocialPost) => {
    if (!window.confirm(`Delete “${p.title}”?`)) return
    try {
      await deletePost(p.id)
      setPosts((list) => (list ?? []).filter((x) => x.id !== p.id))
    } catch (e) {
      setError(errMessage(e))
    }
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Post queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Anyone can add posts; {canPublish ? 'you release them' : 'the person with posting rights releases them'}. Ready ones come first.
        </p>
      </div>
      {canDraft && (
        <div className="grid grid-cols-2 gap-2">
          <Link to="/staff/posts/new" className={`${btn.primary} w-full`}>
            <Icon name="plus" size={16} /> New post
          </Link>
          <Link to="/staff/share" className={`${btn.outline} w-full`}>
            <Icon name="sparkles" size={16} /> From the Share kit
          </Link>
        </div>
      )}
      <FormError>{error}</FormError>
      {posts === null && !error && <Spinner />}

      <Group title="Ready to post" count={groups.ready.length} tone="orange" empty="Nothing is ready right now.">
        {groups.ready.map((p) => (
          <PostCard key={p.id} post={p} canDraft={canDraft} canPublish={canPublish} onStatus={act} onDelete={remove} ready />
        ))}
      </Group>
      <Group title="Scheduled" count={groups.scheduled.length} empty="No posts waiting for a date.">
        {groups.scheduled.map((p) => (
          <PostCard key={p.id} post={p} canDraft={canDraft} canPublish={canPublish} onStatus={act} onDelete={remove} />
        ))}
      </Group>
      <Group title="Drafts" count={groups.drafts.length} empty="No drafts — add one above.">
        {groups.drafts.map((p) => (
          <PostCard key={p.id} post={p} canDraft={canDraft} canPublish={canPublish} onStatus={act} onDelete={remove} />
        ))}
      </Group>
      <div>
        <button type="button" onClick={() => setShowPosted((v) => !v)} className="text-sm font-bold text-brand-blue">
          {showPosted ? 'Hide' : 'Show'} posted ({groups.posted.length})
        </button>
        {showPosted && (
          <div className="mt-2 space-y-2.5">
            {groups.posted.map((p) => (
              <PostCard key={p.id} post={p} canDraft={canDraft} canPublish={canPublish} onStatus={act} onDelete={remove} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}

function Group({ title, count, tone = 'blue', empty, children }: { title: string; count: number; tone?: 'blue' | 'orange'; empty: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[15px] font-extrabold text-ink">{title}</h2>
        <Badge tone={count > 0 ? tone : 'slate'}>{count}</Badge>
      </div>
      {count === 0 ? <p className="text-sm text-slate-500">{empty}</p> : children}
    </section>
  )
}

function PostCard({
  post,
  canDraft,
  canPublish,
  onStatus,
  onDelete,
  ready = false,
}: {
  post: SocialPost
  canDraft: boolean
  canPublish: boolean
  onStatus: (p: SocialPost, s: SocialPost['status'], to?: Platform[]) => Promise<void>
  onDelete: (p: SocialPost) => Promise<void>
  ready?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [postedTo, setPostedTo] = useState<Platform[]>(post.platforms)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (post.image_url) {
        const blob = await fetchImageBlob(post.image_url)
        const out = await sharePng(blob, `ohrr-post-${post.id.slice(0, 8)}.png`, post.caption)
        setMsg(out === 'shared' ? 'Sent to the share sheet. Paste the caption if it didn’t come along.' : out === 'saved' ? 'Image saved, caption copied — open the app and paste.' : null)
      } else {
        await copyText(post.caption)
        setMsg('Caption copied (this post has no image).')
      }
      setConfirming(true)
    } catch (e) {
      setMsg(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const label = post.status === 'posted' ? `Posted ${post.posted_at ? new Date(post.posted_at).toLocaleDateString() : ''}${post.posted_to?.length ? ` · ${post.posted_to.join(', ')}` : ''}` : whenLabel(post)

  return (
    <Card className={`space-y-2.5 ${ready ? 'border-brand-orange/40' : ''}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 text-left">
        {post.image_url ? (
          <img src={post.image_url} alt={post.image_alt ?? ''} className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
            <Icon name="mail" size={24} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-extrabold text-ink">{post.title}</span>
          <span className="block text-xs text-slate-500">
            {label} · {post.platforms.map((p) => PLATFORMS.find((x) => x.value === p)?.label ?? p).join(', ')}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{post.caption}</span>
        </span>
        <Icon name="chevron" size={18} className={`mt-1 shrink-0 text-slate-300 transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
          {post.image_url && <img src={post.image_url} alt={post.image_alt ?? ''} className="w-full rounded-xl" />}
          <p className="whitespace-pre-wrap text-sm text-slate-700">{post.caption}</p>
          {post.notes && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Note: {post.notes}</p>}

          {post.status !== 'posted' && canPublish && (
            <button type="button" onClick={() => void share()} disabled={busy} className={`${btn.primary} w-full py-3.5 disabled:opacity-60`}>
              <Icon name="external" size={18} /> {canShareFiles() ? 'Share now' : 'Save image + copy caption'}
            </button>
          )}
          {msg && <p className="text-xs font-semibold text-slate-600">{msg}</p>}
          {confirming && post.status !== 'posted' && canPublish && (
            <div className="space-y-2 rounded-2xl bg-brand-orange-50/60 p-3">
              <p className="text-sm font-bold text-ink">Posted it? Where?</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((pl) => (
                  <button
                    key={pl.value}
                    type="button"
                    onClick={() => setPostedTo((t) => (t.includes(pl.value) ? t.filter((x) => x !== pl.value) : [...t, pl.value]))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${postedTo.includes(pl.value) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                  >
                    {pl.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void onStatus(post, 'posted', postedTo)} className={`${btn.blue} w-full`}>
                <Icon name="check" size={16} /> Mark as posted
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {post.status === 'draft' && canDraft && (
              <button type="button" onClick={() => void onStatus(post, 'approved')} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white">
                Approve
              </button>
            )}
            {post.status === 'approved' && canDraft && (
              <button type="button" onClick={() => void onStatus(post, 'draft')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                Back to draft
              </button>
            )}
            {post.status !== 'posted' && canDraft && (
              <Link to={`/staff/posts/${post.id}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                Edit
              </Link>
            )}
            {post.image_url && (
              <button type="button" onClick={() => fetchImageBlob(post.image_url!).then((b) => savePng(b, `ohrr-post-${post.id.slice(0, 8)}.png`))} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                Save image
              </button>
            )}
            <button type="button" onClick={() => copyText(post.caption).then(() => setMsg('Caption copied.'))} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
              Copy caption
            </button>
            {post.status === 'posted' && canDraft && (
              <button type="button" onClick={() => void onStatus(post, 'draft')} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                Post again
              </button>
            )}
            {canDraft && (
              <button type="button" onClick={() => void onDelete(post)} className="px-2 py-2 text-sm font-bold text-red-600">
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
