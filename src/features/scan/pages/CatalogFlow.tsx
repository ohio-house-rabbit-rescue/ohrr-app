// Catalog donations, fast: take a photo → say (or type) the name → Next.
//
// The app gives each item its own OHRR code; nothing has to be printed or
// scanned first. Everything is saved as a DONATION ("sort later") unless a
// kind is picked for the session, and the label prints later from
// Print labels. Tapping Next opens the camera again straight away — the save
// runs in the background and reports on the next screen.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { pickPhoto } from '../../../native/camera'
import { catalogNewItem, dataUrlToBlob, listItems, recentDonors, uploadItemPhoto } from '../api'
import { BigButton, BigInput, ErrorBox, StepShell } from '../ScanUI'
import { ALL_KINDS, KIND_META, type ItemKind, type TaggedItem } from '../types'

type Step = 'start' | 'name'

const KIND_KEY = 'ohrr.catalog.kind'

// Web Speech API (Chrome, Edge, Safari). Missing inside the iPhone app's web
// view → the mic is hidden and the keyboard's own dictation key does the job.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any =
  typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

interface Draft {
  title: string
  donatedBy: string
  photoPreview: string | null
}

interface Pending {
  key: number
  title: string
  state: 'saving' | 'saved' | 'failed'
  item?: TaggedItem
  error?: string
}

const emptyDraft = (): Draft => ({ title: '', donatedBy: '', photoPreview: null })

function loadKind(allowed: ItemKind[]): ItemKind {
  try {
    const k = localStorage.getItem(KIND_KEY) as ItemKind | null
    if (k && allowed.includes(k)) return k
  } catch {
    /* ignore */
  }
  return allowed.includes('donation') ? 'donation' : allowed[0]
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function CatalogFlow() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()

  const allowedKinds = ALL_KINDS.filter((k) => KIND_META[k].caps.some((c) => can(c)))
  const [kind, setKind] = useState<ItemKind>(() => loadKind(allowedKinds))
  const [step, setStep] = useState<Step>('start')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [pending, setPending] = useState<Pending[]>([])
  const [today, setToday] = useState<number | null>(null)
  const [unprinted, setUnprinted] = useState<number | null>(null)
  const [donors, setDonors] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const uploadRef = useRef<Promise<string> | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)
  const keyRef = useRef(0)

  const update = useCallback((patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })), [])

  // Today's count, the unprinted-label count and the donor chips.
  useEffect(() => {
    if (!orgId) return
    let alive = true
    listItems(orgId)
      .then((rows) => {
        if (!alive) return
        setToday(rows.filter((r) => isToday(r.created_at)).length)
        setUnprinted(rows.filter((r) => !r.label_printed_at).length)
      })
      .catch(() => alive && setToday(0))
    recentDonors(orgId)
      .then((d) => alive && setDonors(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [orgId])

  useEffect(() => {
    try {
      localStorage.setItem(KIND_KEY, kind)
    } catch {
      /* ignore */
    }
  }, [kind])

  /* ------------------------------------------------ photo */
  const usePhoto = async (src: Blob | string) => {
    setError(null)
    setPhotoBusy(true)
    try {
      const preview = typeof src === 'string' ? src : URL.createObjectURL(src)
      update({ photoPreview: preview })
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      const p = uploadItemPhoto(blob, orgId)
      uploadRef.current = p
      await p
    } catch (err) {
      update({ photoPreview: null })
      uploadRef.current = null
      setError(`The photo didn’t save: ${errMessage(err)}`)
    } finally {
      setPhotoBusy(false)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await usePhoto(file)
  }

  /** Open the camera. On the web this must run inside the tap itself. */
  const openCamera = (source: 'camera' | 'library' = 'camera') => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    void (async () => {
      try {
        const dataUrl = await pickPhoto(source)
        if (dataUrl) await usePhoto(dataUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t get that photo.')
      }
    })()
  }

  const start = () => {
    setStep('name')
    setDraft(emptyDraft())
    uploadRef.current = null
    setError(null)
    openCamera('camera')
  }

  /* ------------------------------------------------ voice */
  const toggleVoice = () => {
    if (!SpeechRecognitionCtor) return
    if (listening) {
      recogRef.current?.stop()
      return
    }
    const recog = new SpeechRecognitionCtor()
    recogRef.current = recog
    recog.lang = 'en-US'
    recog.interimResults = false
    recog.maxAlternatives = 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const said = String(e.results?.[0]?.[0]?.transcript ?? '').trim()
      if (said) update({ title: said.charAt(0).toUpperCase() + said.slice(1) })
    }
    recog.onend = () => setListening(false)
    recog.onerror = () => setListening(false)
    setListening(true)
    recog.start()
  }

  /* ------------------------------------------------ save and next */
  const saveOne = (snapshot: Draft, upload: Promise<string> | null, key: number) => {
    const entry: Pending = { key, title: snapshot.title, state: 'saving' }
    setPending((p) => [entry, ...p].slice(0, 5))
    void (async () => {
      try {
        let photoUrl: string | null = null
        if (upload) {
          try {
            photoUrl = await upload
          } catch {
            photoUrl = null
          }
        }
        const item = await catalogNewItem(orgId, { title: snapshot.title, kind, donatedBy: snapshot.donatedBy, photoUrl })
        setPending((p) => p.map((x) => (x.key === key ? { ...x, state: 'saved', item } : x)))
        setToday((n) => (n ?? 0) + 1)
        setUnprinted((n) => (n ?? 0) + 1)
        const donor = snapshot.donatedBy.trim()
        if (donor) setDonors((d) => [donor, ...d.filter((x) => x.toLowerCase() !== donor.toLowerCase())].slice(0, 12))
      } catch (err) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, state: 'failed', error: errMessage(err) } : x)))
      }
    })()
  }

  const retry = (entry: Pending) => {
    setPending((p) => p.filter((x) => x.key !== entry.key))
    saveOne({ title: entry.title, donatedBy: '', photoPreview: null }, null, ++keyRef.current)
  }

  const next = () => {
    const title = draft.title.trim()
    if (!title) return
    const snapshot: Draft = { ...draft, title }
    const upload = uploadRef.current
    // Open the camera first (the tap is the permission), then save in the background.
    setDraft(emptyDraft())
    uploadRef.current = null
    setError(null)
    openCamera('camera')
    saveOne(snapshot, upload, ++keyRef.current)
    titleRef.current?.focus()
  }

  const saving = pending.some((p) => p.state === 'saving')
  const finish = () => navigate('/staff/items')

  if (!orgId) return null
  if (allowedKinds.length === 0) {
    return (
      <StepShell title="Catalog donations" onBack={() => navigate('/staff')} backLabel="Dashboard">
        <ErrorBox>Your account can’t add items yet. Ask an admin to grant Silent Auction or Hop Shop access.</ErrorBox>
      </StepShell>
    )
  }

  const fileInputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo" />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Choose a photo" />
    </>
  )

  /* ================================================= start */
  if (step === 'start') {
    return (
      <StepShell
        title="Catalog donations"
        help="Photo, say the name, Next. The app gives each item its own code; labels print later."
        onBack={() => navigate('/staff')}
        backLabel="Dashboard"
        footer={
          <BigButton onClick={start} icon="camera">
            Start — open the camera
          </BigButton>
        }
      >
        <div className="space-y-4">
          <ErrorBox>{error}</ErrorBox>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-base font-bold text-ink">Save each item as</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {allowedKinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition ${
                    kind === k ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Icon name={KIND_META[k].icon} size={16} /> {KIND_META[k].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">{KIND_META[kind].hint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-blue-50 p-4 text-center">
              <p className="font-display text-3xl font-black text-brand-blue">{today ?? '–'}</p>
              <p className="text-sm font-bold text-slate-600">cataloged today</p>
            </div>
            <Link to="/staff/labels" className="rounded-2xl bg-brand-orange-50 p-4 text-center">
              <p className="font-display text-3xl font-black text-brand-orange">{unprinted ?? '–'}</p>
              <p className="text-sm font-bold text-slate-600">labels to print</p>
            </Link>
          </div>
          <p className="text-[15px] text-slate-500">
            {SpeechRecognitionCtor
              ? 'Tap the microphone to say the item’s name instead of typing.'
              : 'The microphone key on your keyboard lets you say the item’s name instead of typing.'}
          </p>
          <Link to="/staff/items" className="block text-center text-base font-bold text-brand-blue">
            See all items
          </Link>
          {fileInputs}
        </div>
      </StepShell>
    )
  }

  /* ================================================= name (the loop) */
  const canNext = draft.title.trim().length > 0 && !photoBusy
  return (
    <StepShell
      title="What is it?"
      help="Say it or type it, then Next — the camera opens for the next one."
      onBack={() => setStep('start')}
      backLabel="Pause"
      footer={
        <div className="space-y-2">
          <BigButton onClick={next} disabled={!canNext} icon="camera">
            {photoBusy ? 'Saving the photo…' : 'Next item'}
          </BigButton>
          <button type="button" onClick={finish} disabled={saving} className="block w-full py-1 text-center text-base font-bold text-brand-blue disabled:opacity-50">
            {saving ? 'Finishing the last save…' : 'I’m done'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* the last saves, newest first */}
        {pending.slice(0, 2).map((p) => (
          <div
            key={p.key}
            role="status"
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[15px] ${
              p.state === 'failed' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'
            }`}
          >
            <Icon name={p.state === 'failed' ? 'x' : p.state === 'saved' ? 'check' : 'clock'} size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-bold">{p.title}</span>
              {p.state === 'saving' && ' · saving…'}
              {p.state === 'saved' && p.item && <span className="font-mono"> · {p.item.code}</span>}
              {p.state === 'failed' && ` · ${p.error}`}
            </span>
            {p.state === 'failed' && (
              <button type="button" onClick={() => retry(p)} className="shrink-0 font-extrabold underline-offset-2 hover:underline">
                Try again
              </button>
            )}
          </div>
        ))}
        <ErrorBox>{error}</ErrorBox>

        <div className="flex items-center gap-3">
          {draft.photoPreview ? (
            <img src={draft.photoPreview} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400">
              <Icon name="camera" size={32} />
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <button type="button" onClick={() => openCamera('camera')} disabled={photoBusy} className="block w-full rounded-xl bg-brand-blue-50 px-3 py-2.5 text-left text-[15px] font-bold text-brand-blue">
              {draft.photoPreview ? 'Take another photo' : 'Take a photo'}
            </button>
            <button type="button" onClick={() => openCamera('library')} disabled={photoBusy} className="block w-full rounded-xl bg-slate-100 px-3 py-2.5 text-left text-[15px] font-bold text-slate-700">
              Choose from my photos
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <input
              ref={titleRef}
              type="text"
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canNext) {
                  e.preventDefault()
                  next()
                }
              }}
              placeholder="Plush bunny basket"
              aria-label="Name of the item"
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="next"
              autoFocus
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-xl text-ink outline-none transition placeholder:text-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
            />
          </div>
          {SpeechRecognitionCtor && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Say the name'}
              className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition ${
                listening ? 'animate-pulse bg-red-600 text-white' : 'bg-brand-orange text-ink'
              }`}
            >
              <Icon name="mic" size={28} />
            </button>
          )}
        </div>

        <div>
          <p className="mb-2 text-base font-bold text-ink">
            Who gave it? <span className="font-normal text-slate-500">(optional)</span>
          </p>
          {donors.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {donors.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => update({ donatedBy: draft.donatedBy === d ? '' : d })}
                  aria-pressed={draft.donatedBy === d}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-[15px] font-bold transition ${
                    draft.donatedBy === d ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <BigInput value={draft.donatedBy} onChange={(v) => update({ donatedBy: v })} placeholder="A friend of OHRR" ariaLabel="Who donated it" />
        </div>
        <p className="text-sm text-slate-500">
          Saving as <span className="font-bold text-ink">{KIND_META[kind].label}</span>. Value, notes and where it goes can be added later from the items list.
        </p>
        {fileInputs}
      </div>
    </StepShell>
  )
}
