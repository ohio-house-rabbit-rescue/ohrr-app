// Staff → Post queue. Volunteers write posts and send them for approval;
// someone else with "Approve social posts" approves them or sends them back
// with a note (update 26); the one person with posting rights releases the
// approved ones: tap Share (the phone's share sheet → Instagram / Facebook /
// TikTok), then "Mark as posted". Approvers see what's waiting first; after
// that, ready-today posts float to the top.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { canShareFiles, copyText, savePng, sharePng } from '../share'
import {
  APPROVE_CAP,
  PLATFORMS,
  STATUS_LABEL,
  deletePost,
  fetchImageBlob,
  isReady,
  listPosts,
  loadStaffNames,
  setPostStatus,
  shortDate,
  whenLabel,
  type Platform,
  type PostStatus,
  type SocialPost,
} from '../queue'

/** Resolves to the error text, or null when it worked (the list has reloaded). */
type OnStatus = (p: SocialPost, s: PostStatus, opts?: { postedTo?: Platform[]; note?: string }) => Promise<string | null>

export default function PostQueue() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const me = user?.id ?? ''
  const canDraft = can('announcements.post')
  const canPublish = can('social.publish')
  const canApprove = can(APPROVE_CAP)
  const [posts, setPosts] = useState<SocialPost[] | null>(null)
  const [names, setNames] = useState<Map<string, string>>(() => new Map())
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
  // Who approved a post — nice to have; the queue works without it.
  useEffect(() => {
    if (!orgId) return
    let alive = true
    void loadStaffNames(orgId).then((m) => {
      if (alive) setNames(m)
    })
    return () => {
      alive = false
    }
  }, [orgId])

  const groups = useMemo(() => {
    const all = posts ?? []
    return {
      // Other people's posts first: those are the ones an approver can act on.
      waiting: all.filter((p) => p.status === 'submitted').sort((a, b) => Number(a.created_by === me) - Number(b.created_by === me)),
      ready: all.filter((p) => isReady(p)),
      scheduled: all.filter((p) => p.status === 'approved' && !isReady(p)),
      drafts: all.filter((p) => p.status === 'draft'),
      posted: all.filter((p) => p.status === 'posted').sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? '')).slice(0, 30),
    }
  }, [posts, me])

  if (!canDraft && !canPublish && !canApprove) return <Screen><p className="text-sm text-slate-600">You don’t have access to the post queue.</p></Screen>

  const act: OnStatus = async (p, status, opts) => {
    setError(null)
    try {
      await setPostStatus(p.id, status, opts?.postedTo, opts?.note)
      await load()
      return null
    } catch (e) {
      return errMessage(e)
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
  const card = (p: SocialPost, ready = false) => (
    <PostCard key={p.id} post={p} me={me} names={names} canDraft={canDraft} canPublish={canPublish} canApprove={canApprove} onStatus={act} onDelete={remove} ready={ready} />
  )
  const waiting = (
    <Group title="Waiting for approval" count={groups.waiting.length} tone="orange" empty="Nothing is waiting for approval.">
      {groups.waiting.map((p) => card(p))}
    </Group>
  )

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Post queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Write a post and send it for approval. Someone other than the writer approves it, then {canPublish ? 'you release it' : 'the person with posting rights releases it'}.
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

      {canApprove && waiting}
      <Group title="Ready to post" count={groups.ready.length} tone="orange" empty="Nothing is ready right now.">
        {groups.ready.map((p) => card(p, true))}
      </Group>
      <Group title="Scheduled" count={groups.scheduled.length} empty="No posts waiting for a date.">
        {groups.scheduled.map((p) => card(p))}
      </Group>
      {!canApprove && waiting}
      <Group title="Drafts" count={groups.drafts.length} empty="No drafts — add one above.">
        {groups.drafts.map((p) => card(p))}
      </Group>
      <div>
        <button type="button" onClick={() => setShowPosted((v) => !v)} className="text-sm font-bold text-brand-blue">
          {showPosted ? 'Hide' : 'Show'} posted ({groups.posted.length})
        </button>
        {showPosted && <div className="mt-2 space-y-2.5">{groups.posted.map((p) => card(p))}</div>}
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

const pill = 'rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-60'

function PostCard({
  post,
  me,
  names,
  canDraft,
  canPublish,
  canApprove,
  onStatus,
  onDelete,
  ready = false,
}: {
  post: SocialPost
  me: string
  names: Map<string, string>
  canDraft: boolean
  canPublish: boolean
  canApprove: boolean
  onStatus: OnStatus
  onDelete: (p: SocialPost) => Promise<void>
  ready?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [postedTo, setPostedTo] = useState<Platform[]>(post.platforms)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendingBack, setSendingBack] = useState(false)
  const [note, setNote] = useState('')

  const mine = Boolean(me) && post.created_by === me
  const who = (id: string | null | undefined) => (!id ? null : id === me ? 'you' : (names.get(id) ?? null))
  const sentBack = post.status === 'draft' && Boolean(post.review_note)

  const run = async (status: PostStatus, opts?: { postedTo?: Platform[]; note?: string }) => {
    setBusy(true)
    setMsg(null)
    const err = await onStatus(post, status, opts)
    setBusy(false)
    if (err) setMsg(err)
    else {
      setSendingBack(false)
      setNote('')
      setConfirming(false)
    }
  }

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

  const statusText = sentBack ? 'Sent back' : (STATUS_LABEL[post.status] ?? post.status)
  const statusTone = post.status === 'submitted' || sentBack ? 'text-brand-orange' : post.status === 'approved' ? 'text-brand-blue' : 'text-slate-500'
  const label = post.status === 'posted' ? `${shortDate(post.posted_at)}${post.posted_to?.length ? ` · ${post.posted_to.join(', ')}` : ''}` : whenLabel(post)
  const approver = who(post.approved_by)
  const sender = who(post.submitted_by)

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
            <span className={`font-bold ${statusTone}`}>{statusText}</span> · {label} · {post.platforms.map((p) => PLATFORMS.find((x) => x.value === p)?.label ?? p).join(', ')}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{post.caption}</span>
        </span>
        <Icon name="chevron" size={18} className={`mt-1 shrink-0 text-slate-300 transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {sentBack && (
        <div className="rounded-xl border border-brand-orange/40 bg-brand-orange-50 px-3 py-2">
          <p className="text-xs font-bold text-ink">Sent back for changes</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{post.review_note}</p>
        </div>
      )}

      {open && (
        <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
          {post.image_url && <img src={post.image_url} alt={post.image_alt ?? ''} className="w-full rounded-xl" />}
          <p className="whitespace-pre-wrap text-sm text-slate-700">{post.caption}</p>
          {post.notes && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Note: {post.notes}</p>}

          {post.status === 'submitted' && post.submitted_at && (
            <p className="text-xs text-slate-500">
              Sent for approval {shortDate(post.submitted_at)}
              {sender ? ` by ${sender}` : ''}
            </p>
          )}
          {(post.status === 'approved' || post.status === 'posted') && post.approved_at && (
            <p className="text-xs font-semibold text-slate-600">
              Approved {shortDate(post.approved_at)}
              {approver ? ` by ${approver}` : ''}
            </p>
          )}

          {post.status === 'submitted' &&
            (canApprove && !mine ? (
              <div className="space-y-2 rounded-2xl bg-brand-blue-50/60 p-3">
                {!sendingBack ? (
                  <>
                    <p className="text-sm font-bold text-ink">Good to go?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => void run('approved')} disabled={busy} className={`${btn.blue} w-full disabled:opacity-60`}>
                        <Icon name="check" size={16} /> Approve
                      </button>
                      <button type="button" onClick={() => setSendingBack(true)} disabled={busy} className={`${btn.outline} w-full disabled:opacity-60`}>
                        Send back
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-semibold text-slate-700">
                      What should change? The writer sees this.
                      <textarea className={staffInput} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Use the other photo · spell her name the same both times" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => void run('draft', { note })} disabled={busy || !note.trim()} className={`${btn.primary} w-full disabled:opacity-60`}>
                        Send back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSendingBack(false)
                          setNote('')
                        }}
                        className={`${btn.outline} w-full`}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">{mine ? 'Waiting for someone else to approve' : 'Waiting for approval'}</p>
            ))}

          {post.status === 'draft' && canDraft && (
            <button type="button" onClick={() => void run('submitted')} disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
              <Icon name="check" size={16} /> Send for approval
            </button>
          )}

          {post.status === 'approved' && canPublish && (
            <button type="button" onClick={() => void share()} disabled={busy} className={`${btn.primary} w-full py-3.5 disabled:opacity-60`}>
              <Icon name="external" size={18} /> {canShareFiles() ? 'Share now' : 'Save image + copy caption'}
            </button>
          )}
          {msg && <p className="text-xs font-semibold text-slate-600">{msg}</p>}
          {confirming && post.status === 'approved' && canPublish && (
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
              <button type="button" onClick={() => void run('posted', { postedTo })} disabled={busy} className={`${btn.blue} w-full disabled:opacity-60`}>
                <Icon name="check" size={16} /> Mark as posted
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(post.status === 'approved' || (post.status === 'submitted' && mine)) && canDraft && (
              <button type="button" onClick={() => void run('draft')} disabled={busy} className={pill}>
                Back to draft
              </button>
            )}
            {post.status !== 'posted' && (canDraft || canApprove) && (
              <Link to={`/staff/posts/${post.id}`} className={pill}>
                Edit
              </Link>
            )}
            {post.image_url && (
              <button type="button" onClick={() => fetchImageBlob(post.image_url!).then((b) => savePng(b, `ohrr-post-${post.id.slice(0, 8)}.png`))} className={pill}>
                Save image
              </button>
            )}
            <button type="button" onClick={() => copyText(post.caption).then(() => setMsg('Caption copied.'))} className={pill}>
              Copy caption
            </button>
            {post.status === 'posted' && canDraft && (
              <button type="button" onClick={() => void run('draft')} disabled={busy} className={pill}>
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
