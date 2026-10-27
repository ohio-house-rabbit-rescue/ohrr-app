// Staff → Post queue. Volunteers write posts and send them for approval;
// someone else with "Approve social posts" approves them or sends them back
// with a note (update 26); the one person with posting rights releases the
// approved ones: tap Share (the phone's share sheet → Instagram / Facebook /
// TikTok), then "Mark as posted" — which is always there, whether or not Share
// was used. Approvers see what's waiting first; after that, ready-today posts
// float to the top, and inside each group the newest post is first. Groups with
// nothing in them are hidden. Under the drafts, the Easter campaign card
// (EasterCampaignCard.tsx) plans each spring's Easter posts — shown only while
// Easter is within the campaign's own window (NUDGE_DAYS before it, and the
// weeks after it that its posts run).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { CardActions, StepButton, pill } from '../../../components/StaffJob'
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
  localToday,
  setPostStatus,
  shortDate,
  whenLabel,
  type Platform,
  type PostStatus,
  type SocialPost,
} from '../queue'
import { NUDGE_DAYS, easterCampaign } from '../easterCampaign'
import { EasterCampaignCard, EasterNudge } from '../EasterCampaignCard'
import { StaffTitle } from '../../../components/StaffTitle'

/** Resolves to the error text, or null when it worked (the list has reloaded). */
type OnStatus = (p: SocialPost, s: PostStatus, opts?: { postedTo?: Platform[]; note?: string }) => Promise<string | null>

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` has gone. */
function daysUntil(from: string, to: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(to) - ms(from)) / 86_400_000)
}

/** Newest first. */
const newest = (a: SocialPost, b: SocialPost) => b.created_at.localeCompare(a.created_at)

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
      // Other people's posts first: those are the ones an approver can act on. Then newest.
      waiting: all
        .filter((p) => p.status === 'submitted')
        .sort((a, b) => Number(a.created_by === me) - Number(b.created_by === me) || newest(a, b)),
      ready: all.filter((p) => isReady(p)).sort(newest),
      scheduled: all.filter((p) => p.status === 'approved' && !isReady(p)).sort(newest),
      drafts: all.filter((p) => p.status === 'draft').sort(newest),
      posted: all.filter((p) => p.status === 'posted').sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? '')).slice(0, 30),
    }
  }, [posts, me])
  // This Easter's campaign posts, found in the list by their `source` marker.
  const campaign = useMemo(() => (posts ? easterCampaign(posts) : null), [posts])
  // The Easter card is only for the weeks around Easter: from NUDGE_DAYS before it
  // (the same window as the reminder) until the campaign moves on to next year.
  const campaignNear = campaign ? daysUntil(localToday(), campaign.easter) <= NUDGE_DAYS : false

  if (!canDraft && !canPublish && !canApprove) return <Screen><p className="text-base text-slate-600">You don’t have access to the post queue.</p></Screen>

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
    <Group title="Waiting for approval" count={groups.waiting.length} tone="orange">
      {groups.waiting.map((p) => card(p))}
    </Group>
  )
  const nothing =
    posts !== null &&
    groups.waiting.length + groups.ready.length + groups.scheduled.length + groups.drafts.length + groups.posted.length === 0

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Post queue" flow={['Write', 'Send for approval', 'Approved', 'Released']}>
        <p>
          Write a post and send it for approval. Someone other than the writer approves it, then {canPublish ? 'you release it' : 'the person with posting rights releases it'}.
        </p>
        <p>Ready posts are first, and the newest post is first in each group. Mark as posted is on every approved post, whether or not you used Share.</p>
      </StaffTitle>
      {canDraft && campaign && <EasterNudge campaign={campaign} />}
      {canDraft && (
        <div className="flex flex-wrap items-center gap-2">
          <StepButton tone="orange" icon="plus" to="/staff/posts/new">
            New post
          </StepButton>
          <StepButton icon="sparkles" to="/staff/share">
            From the Share kit
          </StepButton>
        </div>
      )}
      <FormError>{error}</FormError>
      {posts === null && !error && <Spinner />}
      {nothing && <Card className="text-base text-slate-600">Nothing in the queue yet.{canDraft ? ' Tap “New post” to write one.' : ''}</Card>}

      {canApprove && waiting}
      <Group title="Ready to post" count={groups.ready.length} tone="orange">
        {groups.ready.map((p) => card(p, true))}
      </Group>
      <Group title="Scheduled" count={groups.scheduled.length}>
        {groups.scheduled.map((p) => card(p))}
      </Group>
      {!canApprove && waiting}
      <Group title="Drafts" count={groups.drafts.length}>
        {groups.drafts.map((p) => card(p))}
      </Group>
      {campaign && campaignNear && <EasterCampaignCard campaign={campaign} canDraft={canDraft} onPlanned={load} />}
      {groups.posted.length > 0 && (
        <div className="space-y-2.5">
          <button type="button" onClick={() => setShowPosted((v) => !v)} aria-expanded={showPosted} className={pill.outline}>
            {showPosted ? 'Hide' : 'Show'} posted ({groups.posted.length})
          </button>
          {showPosted && <div className="space-y-2.5">{groups.posted.map((p) => card(p))}</div>}
        </div>
      )}
    </Screen>
  )
}

/** A group of posts; nothing is shown when it is empty. */
function Group({ title, count, tone = 'blue', children }: { title: string; count: number; tone?: 'blue' | 'orange'; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
        <Badge tone={tone}>{count}</Badge>
      </div>
      {children}
    </section>
  )
}

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
  const statusTone = post.status === 'submitted' || sentBack ? 'text-brand-orange' : post.status === 'approved' ? 'text-brand-blue' : 'text-slate-600'
  const label = post.status === 'posted' ? `${shortDate(post.posted_at)}${post.posted_to?.length ? ` · ${post.posted_to.join(', ')}` : ''}` : whenLabel(post)
  const approver = who(post.approved_by)
  const sender = who(post.submitted_by)

  return (
    <Card className={`space-y-3 ${ready ? 'border-brand-orange/40' : ''}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        {post.image_url ? (
          <img src={post.image_url} alt={post.image_alt ?? ''} className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
            <Icon name="mail" size={24} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-extrabold text-ink">{post.title}</span>
          <span className="block text-sm text-slate-600">
            <span className={`font-bold ${statusTone}`}>{statusText}</span> · {label} · {post.platforms.map((p) => PLATFORMS.find((x) => x.value === p)?.label ?? p).join(', ')}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-slate-600">{post.caption}</span>
        </span>
        <Icon name="chevron" size={18} className={`mt-1 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {sentBack && (
        <div className="rounded-xl border border-brand-orange/40 bg-brand-orange-50 px-3 py-2">
          <p className="text-sm font-bold text-ink">Sent back for changes</p>
          <p className="whitespace-pre-wrap text-base text-slate-700">{post.review_note}</p>
        </div>
      )}

      {open && (
        <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
          {post.image_url && <img src={post.image_url} alt={post.image_alt ?? ''} className="w-full rounded-xl" />}
          <p className="whitespace-pre-wrap text-base text-slate-700">{post.caption}</p>
          {post.notes && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Note: {post.notes}</p>}

          {post.status === 'submitted' && post.submitted_at && (
            <p className="text-sm text-slate-600">
              Sent for approval {shortDate(post.submitted_at)}
              {sender ? ` by ${sender}` : ''}
            </p>
          )}
          {(post.status === 'approved' || post.status === 'posted') && post.approved_at && (
            <p className="text-sm font-semibold text-slate-600">
              Approved {shortDate(post.approved_at)}
              {approver ? ` by ${approver}` : ''}
            </p>
          )}
        </div>
      )}

      {post.status === 'submitted' &&
        (canApprove && !mine ? (
          <div className="space-y-2 rounded-2xl bg-brand-blue-50/60 p-3">
            {!sendingBack ? (
              <>
                <p className="text-base font-bold text-ink">Good to go?</p>
                <CardActions>
                  <button type="button" onClick={() => void run('approved')} disabled={busy} className={pill.blue}>
                    <Icon name="check" size={16} /> Approve
                  </button>
                  <button type="button" onClick={() => setSendingBack(true)} disabled={busy} className={pill.outline}>
                    Send back
                  </button>
                </CardActions>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold text-slate-700">
                  What should change? The writer sees this.
                  <textarea className={staffInput} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Use the other photo · spell her name the same both times" />
                </label>
                <CardActions>
                  <button type="button" onClick={() => void run('draft', { note })} disabled={busy || !note.trim()} className={pill.orange}>
                    Send back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSendingBack(false)
                      setNote('')
                    }}
                    className={pill.outline}
                  >
                    Cancel
                  </button>
                </CardActions>
              </>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-base font-semibold text-slate-600">{mine ? 'Waiting for someone else to approve' : 'Waiting for approval'}</p>
        ))}

      {post.status === 'draft' && canDraft && (
        <CardActions>
          <button type="button" onClick={() => void run('submitted')} disabled={busy} className={pill.orange}>
            <Icon name="check" size={16} /> Send for approval
          </button>
        </CardActions>
      )}

      {post.status === 'approved' && canPublish && (
        <CardActions>
          <button type="button" onClick={() => void share()} disabled={busy} className={pill.orange}>
            <Icon name="external" size={16} /> {canShareFiles() ? 'Share now' : 'Save image + copy caption'}
          </button>
          <button type="button" onClick={() => setConfirming((v) => !v)} disabled={busy} aria-expanded={confirming} className={confirming ? pill.soft : pill.blue}>
            <Icon name="check" size={16} /> Mark as posted
          </button>
        </CardActions>
      )}
      {msg && <p className="text-sm font-semibold text-slate-700">{msg}</p>}
      {confirming && post.status === 'approved' && canPublish && (
        <div className="space-y-2 rounded-2xl bg-brand-orange-50/60 p-3">
          <p className="text-base font-bold text-ink">Posted it? Where?</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((pl) => (
              <button
                key={pl.value}
                type="button"
                aria-pressed={postedTo.includes(pl.value)}
                onClick={() => setPostedTo((t) => (t.includes(pl.value) ? t.filter((x) => x !== pl.value) : [...t, pl.value]))}
                className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold ${postedTo.includes(pl.value) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
              >
                {pl.label}
              </button>
            ))}
          </div>
          <CardActions>
            <button type="button" onClick={() => void run('posted', { postedTo })} disabled={busy} className={pill.blue}>
              <Icon name="check" size={16} /> Yes, it’s posted
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={pill.outline}>
              Not yet
            </button>
          </CardActions>
        </div>
      )}

      {open && (
        <CardActions className="border-t border-slate-100 pt-3">
          {(post.status === 'approved' || (post.status === 'submitted' && mine)) && canDraft && (
            <button type="button" onClick={() => void run('draft')} disabled={busy} className={pill.outline}>
              Back to draft
            </button>
          )}
          {post.status !== 'posted' && (canDraft || canApprove) && (
            <Link to={`/staff/posts/${post.id}`} className={pill.outline}>
              Edit
            </Link>
          )}
          {post.image_url && (
            <button type="button" onClick={() => fetchImageBlob(post.image_url!).then((b) => savePng(b, `ohrr-post-${post.id.slice(0, 8)}.png`))} className={pill.outline}>
              Save image
            </button>
          )}
          <button type="button" onClick={() => copyText(post.caption).then(() => setMsg('Caption copied.'))} className={pill.outline}>
            Copy caption
          </button>
          {post.status === 'posted' && canDraft && (
            <button type="button" onClick={() => void run('draft')} disabled={busy} className={pill.outline}>
              Post again
            </button>
          )}
          {canDraft && (
            <button type="button" onClick={() => void onDelete(post)} className={pill.red}>
              Delete
            </button>
          )}
        </CardActions>
      )}
    </Card>
  )
}
