// Staff → Post queue → New post / Edit. A photo from the phone (or none),
// the words, which platforms, which day. "Save draft" keeps it with you;
// "Send for approval" puts it in front of someone else with "Approve social
// posts" (update 26), who approves it or sends it back with a note. Share-kit
// cards arrive here already filled in.
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { supabase, errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { pickPhoto, type PhotoSource } from '../../../native/camera'
import { HASHTAGS } from '../templates'
import {
  APPROVE_CAP,
  PLATFORMS,
  STATUS_LABEL,
  createPost,
  setPostStatus,
  shortDate,
  updatePost,
  uploadPostPhoto,
  type Platform,
  type PostDraft,
  type PostStatus,
  type SocialPost,
} from '../queue'

const empty: PostDraft = { title: '', caption: '', image_url: null, platforms: ['instagram', 'facebook'], scheduled_for: null, notes: '' }

// Change these on an approved post and the database sends it back for approval.
const wordsKey = (d: Pick<PostDraft, 'title' | 'caption' | 'image_url' | 'platforms'>) => JSON.stringify([d.title.trim(), d.caption, d.image_url, d.platforms])

// What the editor keeps about the stored post, besides the form.
interface Saved {
  id: string
  status: PostStatus
  createdBy: string | null
  approvedAt: string | null
  reviewNote: string | null
  words: string
}
const savedFrom = (p: SocialPost): Saved => ({
  id: p.id,
  status: p.status,
  createdBy: p.created_by,
  approvedAt: p.approved_at,
  reviewNote: p.review_note ?? null,
  words: wordsKey(p),
})

export default function PostEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const me = user?.id ?? ''
  const [d, setD] = useState<PostDraft>(empty)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) return
    let alive = true
    supabase
      .from('social_posts')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) setError(error ? errMessage(error) : 'Post not found')
        else {
          const p = data as SocialPost
          setD({ title: p.title, caption: p.caption, image_url: p.image_url, image_alt: p.image_alt, platforms: p.platforms, scheduled_for: p.scheduled_for, notes: p.notes ?? '', source: p.source })
          setSaved(savedFrom(p))
        }
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, isNew])

  if (!can('announcements.post') && !can(APPROVE_CAP)) return <Screen><p className="text-sm text-slate-600">You don’t have access to write posts.</p></Screen>

  const usePhoto = async (src: Blob | string) => {
    setPhotoBusy(true)
    setError(null)
    try {
      const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src
      const url = await uploadPostPhoto(blob, orgId)
      setD((x) => ({ ...x, image_url: url }))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setPhotoBusy(false)
    }
  }
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) await usePhoto(f)
  }
  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    try {
      const dataUrl = await pickPhoto(source)
      if (dataUrl) await usePhoto(dataUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t get that photo.')
    }
  }

  // 'keep' leaves the status alone. (An approved post whose words change goes
  // back for approval by itself: the database does that.)
  const save = async (target: 'draft' | 'submitted' | 'keep') => {
    if (!d.title.trim()) {
      setError('Give the post a short name (for the queue).')
      return
    }
    if (!d.caption.trim() && !d.image_url) {
      setError('Add some words or a picture.')
      return
    }
    setBusy(true)
    setError(null)
    let current = saved
    try {
      if (!current) {
        current = savedFrom(await createPost(orgId, me, d))
        setSaved(current)
      } else {
        await updatePost(current.id, d)
      }
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
      return
    }
    if (target !== 'keep' && target !== current.status) {
      try {
        await setPostStatus(current.id, target)
      } catch (e) {
        // The words are safe; only the status didn't change. Stay here and say why.
        setSaved({ ...current, words: wordsKey(d) })
        setError(`Saved, but ${target === 'submitted' ? 'not sent for approval' : 'not moved to drafts'}: ${errMessage(e)}`)
        setBusy(false)
        return
      }
    }
    navigate('/staff/posts')
  }

  const togglePlatform = (p: Platform) => setD((x) => ({ ...x, platforms: x.platforms.includes(p) ? x.platforms.filter((y) => y !== p) : [...x.platforms, p] }))

  if (loading) return <Spinner />

  const status = saved?.status ?? null
  const isDraft = status === null || status === 'draft' || status === 'archived'
  const mine = saved?.createdBy === me
  const wordsChanged = saved !== null && wordsKey(d) !== saved.words

  return (
    <Screen className="space-y-4">
      <Link to="/staff/posts" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        <Icon name="arrowLeft" size={20} /> Post queue
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-black text-ink">{isNew && !saved ? 'New post' : 'Edit post'}</h1>
        <Badge tone={status === 'submitted' ? 'orange' : status === 'approved' ? 'blue' : 'slate'}>{status ? STATUS_LABEL[status] : 'Draft · not saved yet'}</Badge>
      </div>
      {status === 'draft' && saved?.reviewNote && (
        <div className="rounded-2xl border border-brand-orange/40 bg-brand-orange-50 px-4 py-3">
          <p className="text-sm font-bold text-ink">Sent back for changes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{saved.reviewNote}</p>
          <p className="mt-1 text-xs text-slate-500">Make the changes, then send it for approval again.</p>
        </div>
      )}
      {status === 'submitted' && (
        <p className="text-sm text-slate-600">{mine ? 'Waiting for someone else to approve it.' : 'Waiting for approval.'} Saving changes keeps it in line.</p>
      )}
      {status === 'approved' && (
        <p className="text-sm text-slate-600">
          Approved {shortDate(saved?.approvedAt)}. Changing the words, the picture, the short name or where it goes sends it back for approval.
        </p>
      )}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void save(isDraft ? 'draft' : 'keep')
        }}
        className="space-y-4"
      >
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Picture</p>
          {d.image_url ? (
            <img src={d.image_url} alt="" className="w-full rounded-xl" />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
              <Icon name="camera" size={40} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void pick('camera')} disabled={photoBusy} className={`${btn.blue} w-full`}>
              <Icon name="camera" size={16} /> Camera
            </button>
            <button type="button" onClick={() => void pick('library')} disabled={photoBusy} className={`${btn.outline} w-full`}>
              Photos
            </button>
          </div>
          {d.image_url && (
            <button type="button" onClick={() => setD((x) => ({ ...x, image_url: null }))} className="text-sm font-bold text-red-600">
              Remove picture
            </button>
          )}
          {photoBusy && <p className="text-xs text-slate-500">Uploading…</p>}
          <p className="text-xs text-slate-500">
            Want a designed card instead? <Link to="/staff/share" className="font-bold text-brand-blue">Make one in the Share kit</Link> and tap “Save to queue”.
          </p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo" />
          <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Choose a photo" />
        </Card>

        <Card className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Short name (for the queue)
            <input className={staffInput} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Meet Clover · Hop Shop weekend · Easter reminder" maxLength={80} required />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            The words (caption)
            <textarea className={staffInput} rows={6} value={d.caption} onChange={(e) => setD({ ...d, caption: e.target.value })} placeholder="What people will read under the picture." />
          </label>
          {!d.caption.includes('#') && (
            <button type="button" onClick={() => setD({ ...d, caption: `${d.caption.trimEnd()}\n\n${HASHTAGS}` })} className="text-sm font-bold text-brand-blue">
              + Add OHRR’s hashtags
            </button>
          )}
        </Card>

        <Card className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Where it should go</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PLATFORMS.map((pl) => (
                <button
                  key={pl.value}
                  type="button"
                  onClick={() => togglePlatform(pl.value)}
                  className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${d.platforms.includes(pl.value) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Post on (optional — leave blank for “whenever”)
            <input type="date" className={staffInput} value={d.scheduled_for ?? ''} onChange={(e) => setD({ ...d, scheduled_for: e.target.value || null })} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Note for whoever posts it (optional)
            <input className={staffInput} value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} placeholder="Stories too · tag @midwestbunfest" />
          </label>
        </Card>

        <FormError>{error}</FormError>
        {isDraft ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" disabled={busy || photoBusy} className={`${btn.outline} w-full disabled:opacity-60`}>
              Save draft
            </button>
            <button type="button" onClick={() => void save('submitted')} disabled={busy || photoBusy} className={`${btn.primary} w-full disabled:opacity-60`}>
              <Icon name="check" size={16} /> Send for approval
            </button>
          </div>
        ) : (
          <div className={`grid gap-2 ${status === 'submitted' && mine ? 'grid-cols-2' : ''}`}>
            {status === 'submitted' && mine && (
              <button type="button" onClick={() => void save('draft')} disabled={busy || photoBusy} className={`${btn.outline} w-full disabled:opacity-60`}>
                Save as draft
              </button>
            )}
            <button type="submit" disabled={busy || photoBusy} className={`${btn.primary} w-full disabled:opacity-60`}>
              {status === 'approved' && wordsChanged ? 'Save and send for approval' : 'Save changes'}
            </button>
          </div>
        )}
      </form>
    </Screen>
  )
}
