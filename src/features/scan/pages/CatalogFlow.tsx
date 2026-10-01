// Catalog donations, fast: photo first → say (or type) the name and who gave
// it → Save → "Next item" (the camera opens again) or "Print this label".
//
// The app gives each item its own OHRR code; nothing has to be printed or
// scanned first. Everything is saved as a DONATION ("sort later") unless a
// kind is picked for the session, and the label prints from Print labels.
//
// The photo uploads in the background while the name is typed. Save waits
// for it (and retries once); if the photo still fails, the item is saved
// without it and the Saved screen says so, with "Try the photo again".
//
// The two hidden file inputs are rendered ONCE, outside the screens: the
// camera's answer arrives on the element that opened it, and if that element
// has been swapped for a new one in the meantime the photo is lost.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { pickPhoto } from '../../../native/camera'
import { catalogNewItem, dataUrlToBlob, listItems, recentDonors, saveItem, uploadItemPhoto } from '../api'
import { BigButton, BigInput, ErrorBox, StepShell } from '../ScanUI'
import { ALL_KINDS, KIND_META, type ItemKind, type TaggedItem } from '../types'

type Step = 'start' | 'name' | 'saved'

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

type UploadState = 'none' | 'uploading' | 'ready' | 'failed'

interface Saved {
  phase: 'photo' | 'saving' | 'saved' | 'failed'
  title: string
  donatedBy: string
  preview: string | null
  item?: TaggedItem
  photoFailed?: boolean
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
  const [uploadState, setUploadState] = useState<UploadState>('none')
  const [saved, setSaved] = useState<Saved | null>(null)
  const [photoRetrying, setPhotoRetrying] = useState(false)
  const [today, setToday] = useState<number | null>(null)
  const [unprinted, setUnprinted] = useState<number | null>(null)
  const [donors, setDonors] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  // The photo being cataloged: the file, its upload, and the URL once uploaded.
  const blobRef = useRef<Blob | null>(null)
  const uploadRef = useRef<Promise<string> | null>(null)
  const photoUrlRef = useRef<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

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
  /** Upload in the background; Save waits for it. */
  const startUpload = (blob: Blob) => {
    const p = uploadItemPhoto(blob, orgId)
    uploadRef.current = p
    photoUrlRef.current = null
    setUploadState('uploading')
    p.then(
      (url) => {
        if (uploadRef.current !== p) return
        photoUrlRef.current = url
        setUploadState('ready')
      },
      () => {
        if (uploadRef.current !== p) return
        setUploadState('failed')
      },
    )
  }

  const usePhoto = async (src: Blob | string) => {
    setError(null)
    try {
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      blobRef.current = blob
      update({ photoPreview: URL.createObjectURL(blob) })
      startUpload(blob)
    } catch (err) {
      setError(`Couldn’t use that photo: ${errMessage(err)}`)
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

  const clearPhoto = () => {
    blobRef.current = null
    uploadRef.current = null
    photoUrlRef.current = null
    setUploadState('none')
  }

  /** A fresh item: empty form, then the camera. */
  const startItem = () => {
    setDraft(emptyDraft())
    clearPhoto()
    setSaved(null)
    setError(null)
    setStep('name')
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

  /* ------------------------------------------------ save */
  /** The photo's URL: the background upload, or one more try. Null = gave up. */
  const settlePhoto = async (): Promise<string | null> => {
    if (photoUrlRef.current) return photoUrlRef.current
    const blob = blobRef.current
    if (!blob) return null
    try {
      const url = uploadRef.current ? await uploadRef.current : await uploadItemPhoto(blob, orgId)
      photoUrlRef.current = url
      setUploadState('ready')
      return url
    } catch {
      /* once more, fresh */
    }
    try {
      const p = uploadItemPhoto(blob, orgId)
      uploadRef.current = p
      const url = await p
      photoUrlRef.current = url
      setUploadState('ready')
      return url
    } catch {
      setUploadState('failed')
      return null
    }
  }

  const save = () => {
    const title = draft.title.trim()
    if (!title) return
    const donatedBy = draft.donatedBy.trim()
    const preview = draft.photoPreview
    recogRef.current?.stop?.()
    setError(null)
    setSaved({ phase: blobRef.current && !photoUrlRef.current ? 'photo' : 'saving', title, donatedBy, preview })
    setStep('saved')
    void (async () => {
      const photoUrl = await settlePhoto()
      const photoFailed = Boolean(blobRef.current) && !photoUrl
      setSaved((s) => (s ? { ...s, phase: 'saving' } : s))
      try {
        const item = await catalogNewItem(orgId, { title, kind, donatedBy, photoUrl })
        setSaved((s) => (s ? { ...s, phase: 'saved', item, photoFailed } : s))
        setToday((n) => (n ?? 0) + 1)
        setUnprinted((n) => (n ?? 0) + 1)
        if (donatedBy) setDonors((d) => [donatedBy, ...d.filter((x) => x.toLowerCase() !== donatedBy.toLowerCase())].slice(0, 12))
      } catch (err) {
        setSaved((s) => (s ? { ...s, phase: 'failed', error: errMessage(err) } : s))
      }
    })()
  }

  /** The item saved but its photo didn't: upload again and attach it. */
  const retryPhoto = async () => {
    const item = saved?.item
    const blob = blobRef.current
    if (!item || !blob || photoRetrying) return
    setPhotoRetrying(true)
    try {
      const url = await uploadItemPhoto(blob, orgId)
      photoUrlRef.current = url
      const updated = await saveItem(orgId, {
        code: item.code,
        kind: item.kind,
        title: item.title,
        description: item.description ?? '',
        donatedBy: item.donated_by ?? '',
        value: item.value_cents != null ? String(item.value_cents / 100) : '',
        price: item.price_cents != null ? String(item.price_cents / 100) : '',
        quantity: item.quantity ?? 0,
        photoUrl: url,
        photoPreview: null,
      })
      setSaved((s) => (s ? { ...s, item: updated, photoFailed: false } : s))
    } catch (err) {
      setError(`The photo didn’t save: ${errMessage(err)}`)
    } finally {
      setPhotoRetrying(false)
    }
  }

  /** Back to the form with everything still filled in (after a failed save). */
  const backToForm = () => {
    setStep('name')
    setSaved(null)
  }

  const finish = () => navigate('/staff/items')

  if (!orgId) return null
  if (allowedKinds.length === 0) {
    return (
      <StepShell title="Catalog donations" onBack={() => navigate('/staff')} backLabel="Dashboard">
        <ErrorBox>Your account can’t add items yet. Ask an admin to grant Silent Auction or Hop Shop access.</ErrorBox>
      </StepShell>
    )
  }

  let screen: React.ReactNode

  /* ================================================= start */
  if (step === 'start') {
    screen = (
      <StepShell
        title="Catalog donations"
        help="Photo, say the name, Save. The app gives each item its own code; labels print whenever you like."
        onBack={() => navigate('/staff')}
        backLabel="Dashboard"
        footer={
          <BigButton onClick={startItem} icon="camera">
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
          <ol className="list-decimal space-y-1 pl-5 text-[15px] text-slate-600">
            <li>Take the photo.</li>
            <li>Say or type the name, tap who gave it.</li>
            <li>Save — then the next item, or print its label.</li>
          </ol>
          <p className="text-[15px] text-slate-500">
            {SpeechRecognitionCtor
              ? 'Tap the microphone to say the item’s name instead of typing.'
              : 'The microphone key on your keyboard lets you say the item’s name instead of typing.'}
          </p>
          <Link to="/staff/items" className="block text-center text-base font-bold text-brand-blue">
            See all items
          </Link>
        </div>
      </StepShell>
    )
  } else if (step === 'saved' && saved) {
    /* ================================================= saved */
    const s = saved
    const done = s.phase === 'saved' && s.item
    const title = s.phase === 'saved' ? 'Saved' : s.phase === 'failed' ? 'Didn’t save' : s.phase === 'photo' ? 'Saving the photo…' : 'Saving…'
    screen = (
      <StepShell
        title={title}
        help={done ? 'Next item opens the camera. Labels can also be printed all at once later.' : undefined}
        onBack={s.phase === 'failed' ? backToForm : undefined}
        backLabel="Back"
        footer={
          <div className="space-y-2">
            {s.phase === 'failed' ? (
              <BigButton onClick={save} icon="check">
                Try again
              </BigButton>
            ) : (
              <BigButton onClick={startItem} disabled={!done} icon="camera">
                {done ? 'Next item' : s.phase === 'photo' ? 'Saving the photo…' : 'Saving…'}
              </BigButton>
            )}
            <div className="grid grid-cols-2 gap-2">
              <BigButton onClick={() => s.item && navigate(`/staff/labels?code=${encodeURIComponent(s.item.code)}`)} disabled={!done} tone="outline" icon="printer">
                Print this label
              </BigButton>
              <BigButton onClick={finish} disabled={!done && s.phase !== 'failed'} tone="plain">
                I’m done
              </BigButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <ErrorBox>{s.phase === 'failed' ? s.error : error}</ErrorBox>
          {/* Photo beside the words, so the name, donor and code all sit above the buttons. */}
          <div className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {s.preview || s.item?.photo_url ? (
              <img src={s.preview ?? s.item?.photo_url ?? undefined} alt="" className="h-32 w-32 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                <Icon name="camera" size={40} />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-display text-[22px] font-black leading-tight text-ink">{s.title}</p>
              {s.donatedBy && <p className="text-[15px] text-slate-600">From {s.donatedBy}</p>}
              <p className="text-sm text-slate-500">{KIND_META[kind].label}</p>
              {done ? (
                <p className="flex items-center gap-2 pt-1 font-mono text-lg font-bold tracking-widest text-ink">
                  <Icon name="check" size={20} className="shrink-0 text-green-700" /> {s.item!.code}
                </p>
              ) : s.phase !== 'failed' ? (
                <p className="flex items-center gap-2 pt-1 text-[15px] text-slate-500">
                  <Icon name="clock" size={18} /> {s.phase === 'photo' ? 'Saving the photo…' : 'Saving…'}
                </p>
              ) : null}
            </div>
          </div>
          {done && s.photoFailed && (
            <div role="status" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              <Icon name="x" size={18} className="shrink-0" />
              <span className="min-w-0 flex-1">The item is saved, but its photo didn’t upload.</span>
              <button type="button" onClick={() => void retryPhoto()} disabled={photoRetrying} className="shrink-0 font-extrabold underline-offset-2 hover:underline disabled:opacity-50">
                {photoRetrying ? 'Trying…' : 'Try the photo again'}
              </button>
            </div>
          )}
          {done && (
            <p className="text-center text-[15px] text-slate-500">
              {today ?? 1} cataloged today ·{' '}
              <Link to={`/staff/scan?code=${encodeURIComponent(s.item!.code)}`} className="font-bold text-brand-blue">
                Change something
              </Link>
            </p>
          )}
        </div>
      </StepShell>
    )
  } else {
    /* ================================================= name */
    const canSave = draft.title.trim().length > 0
    screen = (
      <StepShell
        title="What is it?"
        help="Say it or type it, tap who gave it, then Save."
        onBack={() => setStep('start')}
        backLabel="Pause"
        footer={
          <div className="space-y-2">
            <BigButton onClick={save} disabled={!canSave} icon="check">
              Save
            </BigButton>
            <button type="button" onClick={finish} className="block w-full py-1 text-center text-base font-bold text-brand-blue">
              I’m done
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <ErrorBox>{error}</ErrorBox>

          <div className="flex items-center gap-3">
            {draft.photoPreview ? (
              <img src={draft.photoPreview} alt="" className="h-28 w-28 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="inline-flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400">
                <Icon name="camera" size={32} />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <button type="button" onClick={() => openCamera('camera')} className="block w-full rounded-xl bg-brand-blue-50 px-3 py-2.5 text-left text-[15px] font-bold text-brand-blue">
                {draft.photoPreview ? 'Take another photo' : 'Take a photo'}
              </button>
              <button type="button" onClick={() => openCamera('library')} className="block w-full rounded-xl bg-slate-100 px-3 py-2.5 text-left text-[15px] font-bold text-slate-700">
                Choose from my photos
              </button>
              {draft.photoPreview && uploadState === 'uploading' && <p className="text-sm text-slate-500">Photo saving in the background…</p>}
              {draft.photoPreview && uploadState === 'ready' && <p className="text-sm text-green-700">Photo saved.</p>}
              {draft.photoPreview && uploadState === 'failed' && <p className="text-sm text-amber-700">Photo not saved yet — Save tries again.</p>}
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
                  if (e.key === 'Enter' && canSave) {
                    e.preventDefault()
                    save()
                  }
                }}
                placeholder="Plush bunny basket"
                aria-label="Name of the item"
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="done"
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
        </div>
      </StepShell>
    )
  }

  // The file inputs live here, above every screen, so they are never replaced
  // while the camera is open (see the note at the top).
  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo" />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Choose a photo" />
      {screen}
    </>
  )
}
