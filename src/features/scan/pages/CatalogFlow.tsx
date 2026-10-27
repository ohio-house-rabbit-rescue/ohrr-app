// Add a donation, fast: who it's from (once per drop-off) → photos (up to
// four) → say (or type) the name, how many, what it's worth (each or for the
// lot), where it's headed → Save → "Next item" (the camera opens again) or
// "Print this label". Everything else waits under "More details".
//
// Only donations come in here. Things the Hop Shop buys from a supplier to
// sell are added in Hop Shop inventory (supplier, cost, price, reorder), the
// one place for shop items; old ?kind=stock links go there.
//
// The app gives each item its own OHRR code; nothing has to be printed or
// scanned first. The label prints from here or from Print labels.
//
// Each photo uploads in the background while the name is typed. Save waits
// for them (and retries once); if a photo still fails, the item is saved
// with the others and the Saved screen says so, with "Try again".
//
// Receive into boxes (?box=1, OHRR 2026-10-27: "we need to input them to the
// app, print a label then put in a box"): start a box and write its number on
// it; every item saved goes in that box and its label prints from the Saved
// screen; "Box is full" closes it and starts the next. Box labels wait until
// the sorting is done (the 4 × 6 roll goes in then) and print together from
// Boxes, to stick over the number written on each box. It's for sorting a
// pile nobody wrote down ("its just a mess of items … no know donor"), so it
// never asks who it's from and makes no drop-off; a known donor's bag goes
// through plain Add a donation. A box left open is picked up again from the
// Receive into boxes tile, never from plain Add a donation.
//
// The two hidden file inputs are rendered ONCE, outside the screens: the
// camera's answer arrives on the element that opened it, and if that element
// has been swapped for a new one in the meantime the photo is lost.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { pickPhoto } from '../../../native/camera'
import {
  MAX_ITEM_PHOTOS,
  catalogNewItem,
  catalogToAuction,
  dataUrlToBlob,
  isNeeds40,
  listItems,
  markLabelsPrinted,
  recentDonors,
  setItemPhotos,
  startDropoff,
  uploadItemPhoto,
} from '../api'
import { BigButton, BigInput, ErrorBox, MoneyInput, StepShell } from '../ScanUI'
import { KIND_META, dollarsToCents, extrasSummary, usDate, type TaggedItem } from '../types'
import { HeadedForChips, MoreDetailsFields, QuantityField, ValueFields, emptyExtras, useCatalogSuggestions, type Extras } from '../DetailsFields'
import { boxByCode, loadPackingBox, newBox, putInBox, savePackingBox, type PackingBox } from '../boxes'
import { tellOthersLabelsChanged } from '../labelSync'
import { useLabelSize } from '../useLabelSize'
import BluetoothPrint from '../printer/BluetoothPrint'
import { bluetoothAvailable } from '../printer/bluetooth'

/** "$35" or "$12.50". */
const usd = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`)

type Step = 'start' | 'name' | 'saved' | 'full'

// Web Speech API (Chrome, Edge, Safari). Missing inside the iPhone app's web
// view → the mic is hidden and the keyboard's own dictation key does the job.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any =
  typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

interface Draft extends Extras {
  title: string
  /** Headed for the Silent Auction (staff who run it): the prices for its bid sheet. */
  startBid: string
  buyNow: string
}

/** The drop-off being added to: who it's from, once for the whole bag or box. */
interface Current {
  /** null until saved (or before update 40: the donor goes on each item instead). */
  id: string | null
  donor: string
  email: string
  date: string
  /** The day it was started; a new day starts a new drop-off. */
  day: string
}

const DROPOFF_KEY = 'ohrr.catalog.dropoff'

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadCurrent(): Current | null {
  try {
    const c = JSON.parse(localStorage.getItem(DROPOFF_KEY) ?? 'null') as Current | null
    return c && c.day === todayIso() ? c : null
  } catch {
    return null
  }
}

function saveCurrent(c: Current | null) {
  try {
    if (c) localStorage.setItem(DROPOFF_KEY, JSON.stringify(c))
    else localStorage.removeItem(DROPOFF_KEY)
  } catch {
    /* private mode */
  }
}

const looksLikeEmail = (e: string) => !e.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim())

/** One photo of the item being cataloged. The first is the main photo. */
interface Shot {
  key: number
  preview: string
  url: string | null
  state: 'uploading' | 'ready' | 'failed'
}

interface Saved {
  phase: 'photo' | 'saving' | 'saved' | 'failed'
  title: string
  donatedBy: string
  previews: string[]
  item?: TaggedItem
  /** How many photos could not be uploaded (0 = all fine). */
  photosFailed: number
  /** The extra photos could not be attached (e.g. before update 37). */
  photosNote?: string
  /** Quantity, price and the other details waited for database update 39. */
  detailsSkipped?: boolean
  /** Where it's headed, size, use-by and the drop-off waited for database update 40. */
  planSkipped?: boolean
  /** Moved straight into the Silent Auction, with these prices. */
  auction?: { start: number | null; buyNow: number | null }
  /** It stayed a donation headed for the auction, or its prices didn't save: why. */
  auctionNote?: string
  /** Put in the box being filled: its number and how many are in it now. */
  inBox?: { no: number; count: number | null }
  /** It was meant for the box being filled and didn't go in: why. */
  boxNote?: string
  /** Its label went to the Bluetooth printer. */
  printed?: string
  error?: string
}

/** A fresh item; where it's kept usually stays the same for a whole box. */
const emptyDraft = (location = ''): Draft => ({ title: '', startBid: '', buyNow: '', ...emptyExtras(location) })

const MORE_KEY = 'ohrr.catalog.more'

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function CatalogFlow() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const allowed = KIND_META.donation.caps.some((c) => can(c))
  // Runs the Silent Auction: a donation headed there goes straight in, with its prices.
  const canAuction = can('events.bunfest.manage')
  const [step, setStep] = useState<Step>('start')
  const [current, setCurrent] = useState<Current | null>(loadCurrent)
  const [who, setWho] = useState({ donor: '', email: '', date: todayIso() })
  const [dropoffNote, setDropoffNote] = useState<string | null>(null)
  // The drop-off is saved in the background (the camera must open inside the tap); Save waits for it.
  const dropoffPromise = useRef<Promise<string | null> | null>(current?.id ? Promise.resolve(current.id) : null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [shots, setShots] = useState<Shot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [photoRetrying, setPhotoRetrying] = useState(false)
  const [today, setToday] = useState<number | null>(null)
  const [unprinted, setUnprinted] = useState<number | null>(null)
  const [donors, setDonors] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const suggestions = useCatalogSuggestions(orgId)
  // Receive into boxes: the box being filled, how many are in it, and the one just closed.
  const wantsBoxes = params.get('box') === '1'
  const [packingBox, setBoxState] = useState<PackingBox | null>(loadPackingBox)
  const box = wantsBoxes ? packingBox : null
  const [boxCount, setBoxCount] = useState<number | null>(null)
  const [boxBusy, setBoxBusy] = useState(false)
  const [fullBox, setFullBox] = useState<{ box: PackingBox; count: number | null } | null>(null)
  const setBox = (b: PackingBox | null) => {
    setBoxState(b)
    savePackingBox(b)
  }
  // The item labels print at the size in the printer; the box labels wait.
  const labelSize = useLabelSize()
  const [printBusy, setPrintBusy] = useState<string | null>(null)
  // "More details" stays open or closed on this phone, as the person left it.
  const [more, setMore] = useState(() => {
    try {
      return localStorage.getItem(MORE_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggleMore = () =>
    setMore((m) => {
      try {
        localStorage.setItem(MORE_KEY, m ? '0' : '1')
      } catch {
        /* private mode */
      }
      return !m
    })
  // Each shot's file and upload, by key (the state above mirrors them).
  const filesRef = useRef<Map<number, { blob: Blob; upload: Promise<string> | null }>>(new Map())
  const shotKey = useRef(0)
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

  // How many are in the box being filled (it may have been deleted on another phone).
  useEffect(() => {
    if (!orgId || !box) {
      setBoxCount(null)
      return
    }
    let alive = true
    boxByCode(orgId, box.code)
      .then((b) => {
        if (!alive) return
        if (b) setBoxCount(b.items.length)
        else setBox(null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, box?.code])

  /* ------------------------------------------------ boxes */
  /** A new box with the next number: write it on the box, then add items. */
  const startBox = async () => {
    setBoxBusy(true)
    setError(null)
    try {
      const b = await newBox(orgId)
      setBox({ code: b.code, box_no: b.box_no })
      setBoxCount(0)
      setFullBox(null)
      setStep('start')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBoxBusy(false)
    }
  }

  /** The box is full: its label waits; the next box starts when they say. */
  const boxIsFull = () => {
    if (!box) return
    setFullBox({ box, count: boxCount })
    setBox(null)
    setError(null)
    setStep('full')
  }

  /** Not full after all: carry on filling it. */
  const reopenBox = () => {
    if (!fullBox) return
    setBox(fullBox.box)
    setFullBox(null)
    setStep('start')
  }

  /* ------------------------------------------------ photos */
  const setShot = (key: number, patch: Partial<Shot>) => setShots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  /** Upload one shot in the background; Save waits for it. */
  const startUpload = (key: number, blob: Blob) => {
    const p = uploadItemPhoto(blob, orgId)
    filesRef.current.set(key, { blob, upload: p })
    setShot(key, { state: 'uploading' })
    p.then(
      (url) => {
        if (filesRef.current.get(key)?.upload !== p) return
        setShot(key, { url, state: 'ready' })
      },
      () => {
        if (filesRef.current.get(key)?.upload !== p) return
        setShot(key, { state: 'failed' })
      },
    )
  }

  const addPhoto = async (src: Blob | string) => {
    setError(null)
    if (shots.length >= MAX_ITEM_PHOTOS) {
      setError(`${MAX_ITEM_PHOTOS} photos is the most for one item.`)
      return
    }
    try {
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      const key = ++shotKey.current
      setShots((list) => [...list, { key, preview: URL.createObjectURL(blob), url: null, state: 'uploading' }])
      startUpload(key, blob)
    } catch (err) {
      setError(`Couldn’t use that photo: ${errMessage(err)}`)
    }
  }

  const removePhoto = (key: number) => {
    filesRef.current.delete(key)
    setShots((list) => list.filter((s) => s.key !== key))
  }

  const makeMain = (key: number) => setShots((list) => [...list.filter((s) => s.key === key), ...list.filter((s) => s.key !== key)])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await addPhoto(file)
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
        if (dataUrl) await addPhoto(dataUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t get that photo.')
      }
    })()
  }

  /** Start (or keep adding to) a drop-off, then the first item. */
  const begin = () => {
    if (!current && !wantsBoxes) {
      if (!looksLikeEmail(who.email)) {
        setError('That email doesn’t look right. Fix it, or leave it empty.')
        return
      }
      const c: Current = { id: null, donor: who.donor.trim(), email: who.email.trim(), date: who.date || todayIso(), day: todayIso() }
      setCurrent(c)
      saveCurrent(c)
      setDropoffNote(null)
      dropoffPromise.current = startDropoff(orgId, { donorName: c.donor, donorEmail: c.email, receivedOn: c.date }).then(
        (d) => {
          if (!d?.id) return null
          const next = { ...c, id: d.id }
          setCurrent(next)
          saveCurrent(next)
          return d.id
        },
        (err) => {
          setDropoffNote(
            isNeeds40(err)
              ? 'Drop-offs need database update 40. Until then the donor is saved on each item.'
              : `The drop-off didn’t save (${errMessage(err)}). The donor is saved on each item.`,
          )
          return null
        },
      )
    }
    startItem()
  }

  /** A new drop-off: forget the current one (it stays in Drop-offs). */
  const newDropoff = () => {
    setCurrent(null)
    saveCurrent(null)
    dropoffPromise.current = null
    setDropoffNote(null)
    setWho({ donor: '', email: '', date: todayIso() })
  }

  /** A fresh item: empty form, then the camera. */
  const startItem = () => {
    setDraft((d) => emptyDraft(d.location))
    filesRef.current = new Map()
    setShots([])
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
  /**
   * Every shot's URL, in order: the background upload, or one more try.
   * Null where a photo could not be uploaded.
   */
  const settlePhotos = async (list: Shot[]): Promise<(string | null)[]> => {
    const out: (string | null)[] = []
    for (const s of list) {
      if (s.url) {
        out.push(s.url)
        continue
      }
      const f = filesRef.current.get(s.key)
      if (!f) {
        out.push(null)
        continue
      }
      let url: string | null = null
      try {
        url = f.upload ? await f.upload : await uploadItemPhoto(f.blob, orgId)
      } catch {
        try {
          const p = uploadItemPhoto(f.blob, orgId)
          filesRef.current.set(s.key, { blob: f.blob, upload: p })
          url = await p
        } catch {
          url = null
        }
      }
      setShot(s.key, url ? { url, state: 'ready' } : { state: 'failed' })
      out.push(url)
    }
    return out
  }

  const save = () => {
    const title = draft.title.trim()
    if (!title) return
    const donatedBy = wantsBoxes ? '' : (current?.donor ?? '')
    const snap = draft
    const list = shots
    const packing = box
    recogRef.current?.stop?.()
    setError(null)
    const waiting = list.some((s) => !s.url)
    setSaved({ phase: waiting ? 'photo' : 'saving', title, donatedBy, previews: list.map((s) => s.preview), photosFailed: 0 })
    setStep('saved')
    void (async () => {
      const settled = await settlePhotos(list)
      const urls = settled.filter((u): u is string => Boolean(u))
      const photosFailed = settled.length - urls.length
      setSaved((s) => (s ? { ...s, phase: 'saving' } : s))
      try {
        const dropoffId = !wantsBoxes && dropoffPromise.current ? await dropoffPromise.current.catch(() => null) : null
        let item = await catalogNewItem(orgId, {
          title,
          kind: 'donation',
          donatedBy,
          photoUrl: urls[0] ?? null,
          description: snap.notes,
          valueCents: dollarsToCents(snap.value),
          quantity: snap.quantity,
          priceCents: dollarsToCents(snap.price),
          condition: snap.condition,
          category: snap.category,
          location: snap.location,
          plan: {
            headed_for: snap.headedFor || null,
            value_basis: snap.valueBasis,
            size: snap.size.trim() || null,
            use_by: snap.useBy || null,
            dropoff_id: dropoffId,
          },
        })
        const detailsSkipped = Boolean(item.details_skipped)
        const planSkipped = Boolean(item.plan_skipped)
        let photosNote: string | undefined
        if (urls.length > 1) {
          try {
            item = await setItemPhotos(orgId, item.code, urls)
          } catch (err) {
            photosNote = `Only the first photo is on the item: ${errMessage(err)}`
          }
        }
        // Headed for the Silent Auction and they run it: straight in, with its prices.
        let auction: Saved['auction']
        let auctionNote: string | undefined
        if (snap.headedFor === 'auction' && canAuction) {
          const prices = { starting_bid_cents: dollarsToCents(snap.startBid), buy_now_cents: dollarsToCents(snap.buyNow) }
          try {
            item = await catalogToAuction(orgId, item.code, title, donatedBy, prices)
            auction = { start: prices.starting_bid_cents, buyNow: prices.buy_now_cents }
          } catch (err) {
            const msg = errMessage(err)
            if (/^It’s in the Silent Auction/.test(msg)) auction = { start: null, buyNow: null }
            auctionNote = auction ? msg : `Saved as a donation headed for the Silent Auction; it didn’t move in (${msg}). Move it from the item.`
          }
        }
        // Into the box being filled.
        let inBox: Saved['inBox']
        let boxNote: string | undefined
        if (packing) {
          try {
            const r = await putInBox(orgId, packing.code, [item.code])
            const count = r.box ? r.box.items.length : null
            inBox = { no: packing.box_no, count }
            if (count != null) setBoxCount(count)
            item = { ...item, box: { code: packing.code, box_no: packing.box_no, location: r.box?.location ?? null } }
          } catch (err) {
            boxNote = `It’s saved, but it didn’t go in Box ${packing.box_no}: ${errMessage(err)} Put it in from the box’s page.`
          }
        }
        setSaved((s) => (s ? { ...s, phase: 'saved', item, photosFailed, photosNote, detailsSkipped, planSkipped, auction, auctionNote, inBox, boxNote } : s))
        setToday((n) => (n ?? 0) + 1)
        setUnprinted((n) => (n ?? 0) + 1)
        if (donatedBy) setDonors((d) => [donatedBy, ...d.filter((x) => x.toLowerCase() !== donatedBy.toLowerCase())].slice(0, 12))
      } catch (err) {
        setSaved((s) => (s ? { ...s, phase: 'failed', error: errMessage(err) } : s))
      }
    })()
  }

  /** The item saved but some photos didn't: upload them again and attach the lot. */
  const retryPhotos = async () => {
    const item = saved?.item
    if (!item || photoRetrying) return
    setPhotoRetrying(true)
    setError(null)
    try {
      const settled = await settlePhotos(shots)
      const urls = settled.filter((u): u is string => Boolean(u))
      const stillFailed = settled.length - urls.length
      const updated = urls.length ? await setItemPhotos(orgId, item.code, urls) : item
      setSaved((s) => (s ? { ...s, item: updated, photosFailed: stillFailed, photosNote: undefined } : s))
      if (stillFailed) setError(`${stillFailed} photo${stillFailed === 1 ? '' : 's'} still didn’t upload.`)
    } catch (err) {
      setError(`The photos didn’t save: ${errMessage(err)}`)
    } finally {
      setPhotoRetrying(false)
    }
  }

  /** Its label went to the Bluetooth printer: marked printed for everyone. */
  const labelPrinted = async (code: string, msg: string) => {
    setSaved((s) => (s && s.item?.code === code ? { ...s, printed: msg } : s))
    try {
      await markLabelsPrinted(orgId, [code])
      tellOthersLabelsChanged(orgId)
      setUnprinted((n) => (n == null ? n : Math.max(0, n - 1)))
    } catch {
      /* it printed; Print labels can mark it */
    }
  }

  /** Back to the form with everything still filled in (after a failed save). */
  const backToForm = () => {
    setStep('name')
    setSaved(null)
  }

  /** Done with this bag or box: its drop-off page (the thank-you letter), the boxes, or the items list. */
  const finish = () => navigate(wantsBoxes ? '/staff/boxes' : current?.id ? `/staff/dropoffs/${current.id}` : '/staff/items')

  // Old "Add Hop Shop stock" links: shop items are added in Hop Shop inventory.
  if (params.get('kind') === 'stock') return <Navigate to="/staff/hopshop?add=1" replace />
  if (!orgId) return null
  if (!allowed) {
    return (
      <StepShell title="Add a donation" onBack={() => navigate('/staff')} backLabel="Dashboard">
        <ErrorBox>Your account can’t add donations yet. Ask an admin to grant Silent Auction or Hop Shop access.</ErrorBox>
      </StepShell>
    )
  }

  let screen: React.ReactNode

  /* ================================================= start */
  if (step === 'start') {
    screen = (
      <StepShell
        title={wantsBoxes ? 'Receive into boxes' : 'Add a donation'}
        help={
          wantsBoxes
            ? 'For sorting items nobody wrote down — no donor needed. Start a box and write its number on it. Add each item, print its label, put it in the box. Tap Box is full, then start the next one.'
            : 'Something given to OHRR: photo, name, how many, what it’s worth. Sort it later, or tick where it’s headed.'
        }
        onBack={() => navigate('/staff')}
        backLabel="Dashboard"
        footer={
          wantsBoxes && !box ? (
            <BigButton onClick={() => void startBox()} disabled={boxBusy} icon="box">
              {boxBusy ? 'Starting the box…' : 'Start a box'}
            </BigButton>
          ) : (
            <BigButton onClick={begin} icon="camera">
              {(wantsBoxes ? box && boxCount : current) ? 'Next item — open the camera' : 'Start — open the camera'}
            </BigButton>
          )
        }
      >
        <div className="space-y-4">
          <ErrorBox>{error}</ErrorBox>
          {box ? (
            <div className="rounded-3xl border-2 border-brand-orange bg-brand-orange-50 p-4 text-center">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-600">Filling</p>
              <p className="font-display text-5xl font-black leading-tight text-ink">Box {box.box_no}</p>
              <p className="mt-1 text-lg font-bold text-ink">Write {box.box_no} on the box.</p>
              <p className="text-[15px] text-slate-600">
                {boxCount == null ? '' : `${boxCount} item${boxCount === 1 ? '' : 's'} in it so far · `}
                <Link to={`/staff/boxes/${box.code}`} className="font-bold text-brand-blue">
                  See what’s in it
                </Link>
              </p>
              <div className="mt-3">
                <BigButton tone="outline" icon="check" onClick={boxIsFull}>
                  Box is full
                </BigButton>
              </div>
            </div>
          ) : wantsBoxes ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[15px] text-slate-600">
              <p className="text-base font-bold text-ink">How it works</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>Start a box — the app gives it the next number. Write the number on the box.</li>
                <li>For each item: photo, say the name, Save, print its label, put it in the box.</li>
                <li>Tap Box is full, and start the next box.</li>
                <li>When the sorting is done, put the 4 × 6 roll in the printer and print all the box labels from Boxes. Stick each one over the number.</li>
              </ol>
            </div>
          ) : null}
          {wantsBoxes ? null : current ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Adding to the drop-off from</p>
              <p className="font-display text-xl font-black text-ink">{current.donor || 'Someone not named'}</p>
              <p className="text-[15px] text-slate-600">
                {usDate(current.date)}
                {current.email ? ` · ${current.email}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4">
                {current.id && (
                  <Link to={`/staff/dropoffs/${current.id}`} className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-brand-blue">
                    See this drop-off
                  </Link>
                )}
                <button type="button" onClick={newDropoff} className="min-h-[44px] text-[15px] font-bold text-brand-blue">
                  Start a new drop-off
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-base font-bold text-ink">
                Who is it from? <span className="font-normal text-slate-500">(once for the whole bag or box)</span>
              </p>
              {donors.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Donors lately">
                  {donors.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWho((w) => ({ ...w, donor: w.donor === d ? '' : d }))}
                      aria-pressed={who.donor === d}
                      className={`min-h-[44px] shrink-0 rounded-full px-3.5 text-[15px] font-bold transition ${
                        who.donor === d ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
              <BigInput value={who.donor} onChange={(v) => setWho((w) => ({ ...w, donor: v }))} placeholder="Name, or leave empty" ariaLabel="Who it is from" />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[15px] font-bold text-slate-600">
                  Their email <span className="font-normal">(for the thank-you)</span>
                  <input
                    type="email"
                    value={who.email}
                    onChange={(e) => setWho((w) => ({ ...w, email: e.target.value }))}
                    placeholder="optional"
                    autoComplete="off"
                    className="mt-1 min-h-[52px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-ink outline-none focus:border-brand-blue"
                  />
                </label>
                <label className="block text-[15px] font-bold text-slate-600">
                  The day it came in
                  <input
                    type="date"
                    value={who.date}
                    onChange={(e) => setWho((w) => ({ ...w, date: e.target.value }))}
                    className="mt-1 min-h-[52px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-ink outline-none focus:border-brand-blue"
                  />
                </label>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-brand-blue-50 p-4 text-center">
              <p className="font-display text-3xl font-black text-brand-blue">{today ?? '–'}</p>
              <p className="text-sm font-bold text-slate-600">added today</p>
            </div>
            <Link to="/staff/labels" className="rounded-2xl bg-brand-orange-50 p-4 text-center">
              <p className="font-display text-3xl font-black text-brand-orange">{unprinted ?? '–'}</p>
              <p className="text-sm font-bold text-slate-600">labels to print</p>
            </Link>
          </div>
          {!wantsBoxes && (
            <div className="flex flex-wrap justify-center gap-x-5">
              <Link to="/staff/dropoffs" className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-blue">
                Drop-offs & thank-yous
              </Link>
              <Link to="/staff/items" className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-blue">
                See all items
              </Link>
            </div>
          )}
          {!wantsBoxes && can('hopshop.products.create') && (
            <p className="text-center text-[15px] text-slate-500">
              Something the shop carries, bought from a supplier?{' '}
              <Link to="/staff/hopshop?add=1" className="font-bold text-brand-blue">
                Add it in Hop Shop inventory
              </Link>
            </p>
          )}
        </div>
      </StepShell>
    )
  } else if (step === 'full' && fullBox) {
    /* ================================================= box is full */
    const n = fullBox.count
    screen = (
      <StepShell
        title={`Box ${fullBox.box.box_no} is full`}
        help="Its label waits until the sorting is done."
        onBack={reopenBox}
        backLabel="Not full yet"
        footer={
          <div className="space-y-2">
            <BigButton onClick={() => void startBox()} disabled={boxBusy} icon="box">
              {boxBusy ? 'Starting the box…' : 'Start the next box'}
            </BigButton>
            <BigButton tone="plain" onClick={() => navigate('/staff/boxes')}>
              I’m done for now
            </BigButton>
          </div>
        }
      >
        <div className="space-y-4">
          <ErrorBox>{error}</ErrorBox>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-center">
            <p className="font-display text-5xl font-black leading-tight text-ink">Box {fullBox.box.box_no}</p>
            {n != null && (
              <p className="text-lg font-bold text-slate-600">
                {n} item{n === 1 ? '' : 's'} in it
              </p>
            )}
            <Link to={`/staff/boxes/${fullBox.box.code}`} className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-blue">
              See what’s in it
            </Link>
          </div>
          <p className="text-base text-slate-600">
            When every box is done, put the 4 × 6 roll in the printer, open <span className="font-bold">Boxes</span> and print all the waiting box labels at
            once. Stick each label over the number you wrote on the box.
          </p>
        </div>
      </StepShell>
    )
  } else if (step === 'saved' && saved) {
    /* ================================================= saved */
    const s = saved
    const done = s.phase === 'saved' && s.item
    const title = s.phase === 'saved' ? 'Saved' : s.phase === 'failed' ? 'Didn’t save' : s.phase === 'photo' ? 'Saving the photos…' : 'Saving…'
    const main = s.previews[0] ?? s.item?.photo_url ?? null
    // Its label straight to the Bluetooth printer (a bid-sheet label needs the Print labels page for its prices).
    const btLabel = done && !s.auction && bluetoothAvailable()
    screen = (
      <StepShell
        title={title}
        help={done ? (box ? `Print its label, put it in Box ${box.box_no}, then Next item.` : 'Next item opens the camera. Labels can also be printed all at once later.') : undefined}
        onBack={s.phase === 'failed' ? backToForm : undefined}
        backLabel="Back"
        footer={
          <div className="space-y-2">
            {s.phase === 'failed' ? (
              <BigButton onClick={save} icon="check">
                Try again
              </BigButton>
            ) : (
              <BigButton onClick={startItem} disabled={!done || !!printBusy} icon="camera">
                {done ? 'Next item' : s.phase === 'photo' ? 'Saving the photos…' : 'Saving…'}
              </BigButton>
            )}
            <div className="grid grid-cols-2 gap-2">
              {box ? (
                <BigButton onClick={boxIsFull} disabled={(!done && s.phase !== 'failed') || !!printBusy} tone="outline" icon="check">
                  Box is full
                </BigButton>
              ) : btLabel ? (
                <BigButton onClick={() => s.item && navigate(`/staff/labels?code=${encodeURIComponent(s.item.code)}`)} disabled={!done} tone="plain" icon="printer">
                  Labels page
                </BigButton>
              ) : (
                <BigButton onClick={() => s.item && navigate(`/staff/labels?code=${encodeURIComponent(s.item.code)}`)} disabled={!done} tone="outline" icon="printer">
                  {s.auction ? 'Print the bid-sheet label' : 'Print this label'}
                </BigButton>
              )}
              <BigButton onClick={finish} disabled={(!done && s.phase !== 'failed') || !!printBusy} tone="plain">
                {current?.id && !wantsBoxes ? 'Finish this drop-off' : 'I’m done'}
              </BigButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <ErrorBox>{s.phase === 'failed' ? s.error : error}</ErrorBox>
          {/* Photo beside the words, so the name, donor and code all sit above the buttons. */}
          <div className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {main ? (
              <img src={main} alt="" className="h-32 w-32 shrink-0 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                <Icon name="camera" size={40} />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-display text-[22px] font-black leading-tight text-ink">{s.title}</p>
              {s.donatedBy && <p className="text-[15px] text-slate-600">Gift of {s.donatedBy}</p>}
              {s.item && extrasSummary(s.item) && <p className="text-[15px] text-slate-600">{extrasSummary(s.item)}</p>}
              <p className="text-sm text-slate-500">
                {s.auction ? 'In the Silent Auction' : 'Donation'}
                {s.auction?.start != null && ` · starts ${usd(s.auction.start)}`}
                {s.auction?.buyNow != null && ` · Buy it now ${usd(s.auction.buyNow)}`}
                {s.previews.length > 1 && ` · ${s.previews.length} photos`}
              </p>
              {done ? (
                <p className="flex items-center gap-2 pt-1 font-mono text-lg font-bold tracking-widest text-ink">
                  <Icon name="check" size={20} className="shrink-0 text-green-700" /> {s.item!.code}
                </p>
              ) : s.phase !== 'failed' ? (
                <p className="flex items-center gap-2 pt-1 text-[15px] text-slate-500">
                  <Icon name="clock" size={18} /> {s.phase === 'photo' ? 'Saving the photos…' : 'Saving…'}
                </p>
              ) : null}
              {done && s.inBox && (
                <p className="text-[15px] font-bold text-brand-orange">
                  In Box {s.inBox.no}
                  {s.inBox.count != null ? ` · ${s.inBox.count} item${s.inBox.count === 1 ? '' : 's'} in it` : ''}
                </p>
              )}
            </div>
          </div>
          {done && s.boxNote && (
            <div role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              {s.boxNote}
            </div>
          )}
          {btLabel && s.item && (
            <BluetoothPrint
              labels={[
                {
                  code: s.item.code,
                  item: { code: s.item.code, title: s.item.title, donated_by: s.item.donated_by, photo_url: s.item.photo_url, kindLabel: null },
                  copies: 1,
                },
              ]}
              size={labelSize}
              busy={printBusy}
              setBusy={setPrintBusy}
              onError={setError}
              onPrinted={(_codes, msg) => void labelPrinted(s.item!.code, msg)}
            />
          )}
          {done && !btLabel && box && (
            <BigButton onClick={() => s.item && navigate(`/staff/labels?code=${encodeURIComponent(s.item.code)}`)} tone="outline" icon="printer">
              {s.auction ? 'Print the bid-sheet label' : 'Print this label'}
            </BigButton>
          )}
          {s.printed && (
            <p role="status" className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-[15px] font-bold text-green-800">
              <Icon name="check" size={18} className="shrink-0" /> {s.printed}
            </p>
          )}
          {s.previews.length > 1 && (
            <div className="flex gap-2" aria-label="All the photos">
              {s.previews.map((p, i) => (
                <img key={p} src={p} alt="" className={`h-16 w-16 rounded-xl object-cover ${i === 0 ? 'ring-2 ring-brand-blue' : ''}`} />
              ))}
            </div>
          )}
          {done && s.auctionNote && (
            <div role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              {s.auctionNote}
            </div>
          )}
          {done && s.planSkipped && (
            <div role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              The item is saved. Where it’s headed, size, use-by and the drop-off need database update 40.
            </div>
          )}
          {done && s.detailsSkipped && (
            <div role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              The item is saved. How many, the price and the other details need database update 39; add them from the item once it has run.
            </div>
          )}
          {done && (s.photosFailed > 0 || s.photosNote) && (
            <div role="status" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              <Icon name="x" size={18} className="shrink-0" />
              <span className="min-w-0 flex-1">
                {s.photosFailed > 0
                  ? s.previews.length === 1
                    ? 'The item is saved, but its photo didn’t upload.'
                    : `The item is saved, but ${s.photosFailed} of its ${s.previews.length} photos didn’t upload.`
                  : s.photosNote}
              </span>
              {s.photosFailed > 0 && (
                <button type="button" onClick={() => void retryPhotos()} disabled={photoRetrying} className="shrink-0 font-extrabold underline-offset-2 hover:underline disabled:opacity-50">
                  {photoRetrying ? 'Trying…' : s.previews.length === 1 ? 'Try the photo again' : 'Try again'}
                </button>
              )}
            </div>
          )}
          {done && (
            <p className="text-center text-[15px] text-slate-500">
              {today ?? 1} added today ·{' '}
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
    const uploading = shots.filter((s) => s.state === 'uploading').length
    const failed = shots.filter((s) => s.state === 'failed').length
    const full = shots.length >= MAX_ITEM_PHOTOS
    screen = (
      <StepShell
        title="What is it?"
        help={[current?.donor && !wantsBoxes ? `Gift of ${current.donor}.` : null, box ? `Going in Box ${box.box_no}.` : null, 'Say or type the name, then Save.']
          .filter(Boolean)
          .join(' ')}
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

          {/* The photos: main first, a × on each, + for another (up to four). */}
          <div>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos of the item">
              {shots.map((s, i) => (
                <div key={s.key} className="relative shrink-0">
                  {/* Tap a photo to make it the cover (like choosing a cover on Instagram) */}
                  <button
                    type="button"
                    onClick={() => makeMain(s.key)}
                    aria-label={i === 0 ? `Photo ${i + 1}, the cover` : `Make photo ${i + 1} the cover`}
                    className="block"
                  >
                    <img src={s.preview} alt="" className={`h-24 w-24 rounded-2xl object-cover ${i === 0 ? 'ring-[3px] ring-brand-blue' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(s.key)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white shadow"
                  >
                    <Icon name="x" size={16} />
                  </button>
                  {i === 0 && (
                    <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-brand-blue px-1.5 py-0.5 text-[11px] font-extrabold uppercase text-white">Cover</span>
                  )}
                  {s.state === 'failed' && <span className="absolute inset-x-0 top-1 text-center text-[11px] font-extrabold text-red-700">not saved</span>}
                </div>
              ))}
              {!full && (
                <button
                  type="button"
                  onClick={() => openCamera('camera')}
                  aria-label={shots.length ? 'Add another photo' : 'Take a photo'}
                  className="inline-flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500"
                >
                  <Icon name="camera" size={28} />
                  <span className="text-xs font-bold">{shots.length ? `${shots.length} of ${MAX_ITEM_PHOTOS}` : 'Photo'}</span>
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={() => openCamera('camera')} disabled={full} className="min-h-[44px] text-[15px] font-bold text-brand-blue disabled:opacity-40">
                {shots.length ? 'Add another photo' : 'Take a photo'}
              </button>
              <button type="button" onClick={() => openCamera('library')} disabled={full} className="min-h-[44px] text-[15px] font-bold text-slate-600 disabled:opacity-40">
                Choose from my photos
              </button>
              {shots.length > 1 && <span className="text-sm text-slate-500">Tap a photo to make it the cover.</span>}
              {full && <span className="text-sm text-slate-500">{MAX_ITEM_PHOTOS} photos is the most.</span>}
              {!full && uploading > 0 && <span className="text-sm text-slate-500">Saving in the background…</span>}
              {!full && uploading === 0 && failed === 0 && shots.length > 0 && <span className="text-sm text-green-700">Photos saved.</span>}
              {!full && uploading === 0 && failed > 0 && <span className="text-sm text-amber-700">Not saved yet — Save tries again.</span>}
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

          {dropoffNote && (
            <div role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
              {dropoffNote}
            </div>
          )}
          <QuantityField v={draft} set={update} />
          <ValueFields v={draft} set={update} />
          <HeadedForChips v={draft} set={update} />
          {draft.headedFor === 'auction' &&
            (canAuction ? (
              <div className="space-y-2 rounded-2xl border-2 border-brand-blue/20 bg-brand-blue-50/50 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[15px] font-bold text-slate-700">Starting bid</p>
                    <MoneyInput value={draft.startBid} onChange={(p) => update({ startBid: p })} ariaLabel="Starting bid, in dollars" />
                  </div>
                  <div>
                    <p className="mb-1 text-[15px] font-bold text-slate-700">Buy it now</p>
                    <MoneyInput value={draft.buyNow} onChange={(p) => update({ buyNow: p })} ariaLabel="Buy it now price, in dollars" />
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Saves it straight into the Silent Auction, ready for its bid-sheet label. Leave Buy it now empty for bids only.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">It’s saved as a donation headed for the Silent Auction; someone who runs the auction moves it in and sets its prices.</p>
            ))}
          {draft.headedFor === 'shop' && <MoreDetailsFields v={draft} set={update} suggestions={suggestions} show={{ price: true }} />}
          <button
            type="button"
            onClick={toggleMore}
            aria-expanded={more}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block text-base font-bold text-brand-blue">More details</span>
              <span className="block truncate text-sm text-slate-500">
                {!more && draft.location ? `Kept: ${draft.location} · ` : ''}
                Size, condition, sort of thing, where it’s kept, use-by, notes
              </span>
            </span>
            <Icon name="chevron" size={20} className={`shrink-0 text-slate-400 transition ${more ? 'rotate-90' : ''}`} />
          </button>
          {more && (
            <MoreDetailsFields
              v={draft}
              set={update}
              suggestions={suggestions}
              show={{ size: true, condition: true, category: true, location: true, useBy: true, price: draft.headedFor !== 'shop', notes: true }}
            />
          )}
          <p className="text-sm text-slate-500">Only the name is needed. Everything else can be added or changed later from the items list.</p>
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
