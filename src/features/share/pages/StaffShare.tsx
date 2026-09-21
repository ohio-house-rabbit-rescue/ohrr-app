// Staff → Share kit. Pick a rabbit, an event or a message; the app paints a
// branded card and writes the caption; tap Share and the phone's share sheet
// offers Instagram, Facebook, TikTok, Messages. No design tool, no typing.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { getAdoptables } from '../../../lib/adopt'
import { useEvents } from '../../../lib/events'
import { isUpcoming } from '../../../lib/eventFormat'
import type { Rabbit } from '../../../data/adoptables'
import { Screen, Card, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, staffInput } from '../../../components/staffui'
import {
  EDUCATION_CARDS,
  customPost,
  educationPost,
  eventPost,
  rabbitPost,
  suggestedEducation,
  type CardFormat,
  type CardPost,
} from '../templates'
import { canvasToBlob, renderCard } from '../render'
import { canShareFiles, copyText, savePng, sharePng } from '../share'
import { createPost, uploadPostPng } from '../queue'
import { useNavigate } from 'react-router-dom'

type Tab = 'suggested' | 'rabbits' | 'events' | 'messages' | 'custom'

export default function StaffShare() {
  const { can } = useAuth()
  const allowed = can('announcements.post')
  const [tab, setTab] = useState<Tab>('suggested')
  const [rabbits, setRabbits] = useState<Rabbit[] | null>(null)
  const [sampleRabbits, setSampleRabbits] = useState(false)
  const { events } = useEvents()
  const [post, setPost] = useState<CardPost | null>(null)
  const [custom, setCustom] = useState({ headline: '', subline: '' })

  useEffect(() => {
    let alive = true
    getAdoptables()
      .then((r) => {
        if (!alive) return
        setRabbits(r.rabbits)
        setSampleRabbits(r.source === 'sample')
      })
      .catch(() => alive && setRabbits([]))
    return () => {
      alive = false
    }
  }, [])

  const upcoming = useMemo(() => events.filter((e) => isUpcoming(e)).slice(0, 8), [events])
  const seasonal = useMemo(() => suggestedEducation(), [])

  const suggestions = useMemo<CardPost[]>(() => {
    const list: CardPost[] = []
    if (rabbits && rabbits.length > 0) list.push(rabbitPost(rabbits[0]))
    if (seasonal[0]) list.push(educationPost(seasonal[0]))
    if (upcoming[0]) list.push(eventPost(upcoming[0]))
    if (seasonal[1]) list.push(educationPost(seasonal[1]))
    return list
  }, [rabbits, seasonal, upcoming])

  if (!allowed) return <Screen><p className="text-sm text-slate-600">You don’t have access to the share kit (needs “Post announcements”).</p></Screen>

  if (post) return <Composer post={post} onBack={() => setPost(null)} />

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Share kit</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pick something, tap <strong>Share</strong>, choose Instagram, Facebook or TikTok. The picture and the caption are made for you.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['suggested', 'This week'],
            ['rabbits', 'Rabbits'],
            ['events', 'Events'],
            ['messages', 'Messages'],
            ['custom', 'Custom'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${tab === t ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'suggested' && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Good posts for right now</p>
          {rabbits === null && <Spinner label="Finding this week’s posts…" />}
          {suggestions.map((s) => (
            <PostRow key={s.id} post={s} onPick={() => setPost(s)} />
          ))}
          {sampleRabbits && rabbits && rabbits.length > 0 && (
            <p className="text-xs text-slate-500">The rabbits shown are sample listings until OHRR adds real ones under Adoptable rabbits.</p>
          )}
        </div>
      )}

      {tab === 'rabbits' && (
        <div className="space-y-2.5">
          {rabbits === null && <Spinner />}
          {rabbits && rabbits.length === 0 && <p className="text-sm text-slate-500">No adoptable rabbits listed yet.</p>}
          {rabbits?.map((r) => (
            <PostRow key={r.id} post={rabbitPost(r)} onPick={() => setPost(rabbitPost(r))} />
          ))}
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-2.5">
          {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming events. Add one under Events.</p>}
          {upcoming.map((e) => (
            <PostRow key={e.id} post={eventPost(e)} onPick={() => setPost(eventPost(e))} />
          ))}
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-2.5">
          <p className="text-xs text-slate-500">Education posts written for the people OHRR most needs to reach. The ones for this month come first.</p>
          {seasonal.map((c) => (
            <PostRow key={c.id} post={educationPost(c)} onPick={() => setPost(educationPost(c))} />
          ))}
          {EDUCATION_CARDS.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
        </div>
      )}

      {tab === 'custom' && (
        <Card className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Big line
            <input className={staffInput} value={custom.headline} onChange={(e) => setCustom({ ...custom, headline: e.target.value })} placeholder="Hop Shop open this weekend" maxLength={80} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Small line (optional)
            <textarea className={staffInput} rows={2} value={custom.subline} onChange={(e) => setCustom({ ...custom, subline: e.target.value })} placeholder="Saturday & Sunday noon–4, 5485 N. High St." maxLength={160} />
          </label>
          <button type="button" disabled={!custom.headline.trim()} onClick={() => setPost(customPost(custom.headline.trim(), custom.subline.trim()))} className={`${btn.primary} w-full disabled:opacity-60`}>
            Make the card
          </button>
        </Card>
      )}
    </Screen>
  )
}

function PostRow({ post, onPick }: { post: CardPost; onPick: () => void }) {
  const icon = post.card.kind === 'rabbit' ? 'heart' : post.card.kind === 'event' ? 'calendar' : post.card.kind === 'education' ? 'book' : 'sparkles'
  return (
    <button type="button" onClick={onPick} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-sm transition hover:border-slate-300">
      {post.card.photo ? (
        <img src={post.card.photo} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
          <Icon name={icon} size={24} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] font-extrabold text-ink">{post.label}</span>
        <span className="block truncate text-xs text-slate-500">{post.when ?? post.card.subline ?? post.card.kicker}</span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
    </button>
  )
}

function Composer({ post, onBack }: { post: CardPost; onBack: () => void }) {
  const navigate = useNavigate()
  const { membership, user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [format, setFormat] = useState<CardFormat>('square')
  const [caption, setCaption] = useState(post.caption)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shareable = canShareFiles()

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    let alive = true
    setBusy(true)
    renderCard(c, post.card, format, { logoUrl: '/ohrr-mark.png' })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not draw the card'))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [post, format])

  const filename = `ohrr-${post.id.replace(/[^a-z0-9]+/gi, '-')}-${format}.png`

  const share = async () => {
    const c = canvasRef.current
    if (!c) return
    setError(null)
    setStatus(null)
    try {
      const blob = await canvasToBlob(c)
      const out = await sharePng(blob, filename, caption)
      if (out === 'shared') setStatus('Sent to the share sheet. Paste the caption if the app didn’t keep it.')
      else if (out === 'saved') setStatus('Image saved and caption copied — open Instagram or Facebook, add the photo, paste the caption.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share')
    }
  }
  const save = async () => {
    const c = canvasRef.current
    if (!c) return
    try {
      savePng(await canvasToBlob(c), filename)
      setStatus('Image saved to your phone / downloads.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }
  const copy = async () => {
    setStatus((await copyText(caption)) ? 'Caption copied.' : 'Could not copy — select the text and copy it.')
  }
  // Store the card + caption in the post queue for whoever releases posts.
  const queue = async () => {
    const c = canvasRef.current
    if (!c || !membership) return
    setBusy(true)
    setError(null)
    try {
      const blob = await canvasToBlob(c)
      const url = await uploadPostPng(blob, membership.orgId)
      const created = await createPost(membership.orgId, user?.id ?? '', {
        title: post.label,
        caption,
        image_url: url,
        image_alt: post.card.headline,
        platforms: format === 'story' ? ['instagram'] : ['instagram', 'facebook'],
        scheduled_for: null,
        source: `kit:${post.id}`,
      })
      navigate(`/staff/posts/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save to the queue')
      setBusy(false)
    }
  }

  return (
    <Screen className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        <Icon name="arrowLeft" size={20} /> Share kit
      </button>

      <div className="flex gap-2">
        {(
          [
            ['square', 'Post (square)'],
            ['story', 'Story (tall)'],
          ] as [CardFormat, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" onClick={() => setFormat(f)} className={`min-h-[44px] flex-1 rounded-full text-sm font-bold ${format === f ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className={`mx-auto overflow-hidden rounded-2xl bg-slate-100 shadow-md ${format === 'story' ? 'w-[60%]' : 'w-full'}`}>
        <canvas ref={canvasRef} className="block h-auto w-full" aria-label="Preview of the post image" />
      </div>
      {busy && <p className="text-center text-xs text-slate-500">Drawing…</p>}

      <button type="button" onClick={() => void share()} disabled={busy} className={`${btn.primary} w-full py-4 text-base disabled:opacity-60`}>
        <Icon name="external" size={18} /> {shareable ? 'Share' : 'Save image + copy caption'}
      </button>
      <button type="button" onClick={() => void queue()} disabled={busy} className={`${btn.blue} w-full disabled:opacity-60`}>
        <Icon name="calendar" size={16} /> Save to the post queue (post later)
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className={`${btn.outline} w-full`}>
          Save image
        </button>
        <button type="button" onClick={() => void copy()} className={`${btn.outline} w-full`}>
          Copy caption
        </button>
      </div>
      {status && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{status}</p>}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <Card className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700">
          Caption (edit if you like)
          <textarea className={staffInput} rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </label>
        <p className="text-xs leading-relaxed text-slate-500">
          <strong>How to post:</strong> Share → pick Instagram (Feed or Story) or Facebook → the picture is already there → paste the caption → Post. TikTok: Share → TikTok → add the image as a photo post.
        </p>
      </Card>
    </Screen>
  )
}
