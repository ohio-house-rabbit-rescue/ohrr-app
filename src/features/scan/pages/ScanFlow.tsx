// "Scan an item" — the step-by-step flow. One question per screen:
//
//   scan → (found? item card + big actions)
//        → What is it? → Take a photo → What is it called? → A couple of
//          details → Saved! → Scan another
//
// Written for someone who finds ordinary forms hard: nothing to remember,
// nothing hidden in menus, Back always top-left, the one button that matters
// always at the bottom. The draft survives an accidental refresh.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { pickPhoto, type PhotoSource } from '../../../native/camera'
import Scanner from '../Scanner'
import { normalizeCode, isRetailBarcode, isOhrrCode } from '../codes'
import { guessProduct, guessTitle, type ProductGuess } from '../lookup'
import {
  adjustStock,
  dataUrlToBlob,
  deleteItem,
  findByCode,
  isNeeds40,
  saveItem,
  setDonationOutcome,
  setDonationPlan,
  setPublished,
  setStatus,
  setItemExtras,
  splitDonation,
  uploadItemPhoto,
} from '../api'
import { BigButton, BigInput, Busy, ErrorBox, ItemCard, KindTile, MoneyInput, StepShell, Stepper } from '../ScanUI'
import { HeadedForChips, MoreDetailsFields, QuantityField, ValueFields, emptyExtras, useCatalogSuggestions, type Extras } from '../DetailsFields'
import {
  ITEM_KINDS,
  KIND_META,
  centsToDollars,
  dollarsToCents,
  draftFromItem,
  emptyDraft,
  formatMoney,
  type HeadedFor,
  type ItemDraft,
  type ItemKind,
  type TaggedItem,
} from '../types'

type Step = 'scan' | 'type' | 'lookup' | 'found' | 'kind' | 'photo' | 'name' | 'details' | 'saving' | 'done'

const DRAFT_KEY = 'ohrr.scan.draft.v1'
const WIZARD: Step[] = ['kind', 'photo', 'name', 'details']

interface Saved {
  step: Step
  draft: ItemDraft
  editing: boolean
}

function loadSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    return WIZARD.includes(s.step) && s.draft?.code ? s : null
  } catch {
    return null
  }
}

function persist(s: Saved | null) {
  try {
    if (s) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* private mode */
  }
}

export default function ScanFlow() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const suggestions = useCatalogSuggestions(orgId)
  const [params, setParams] = useSearchParams()

  const [step, setStep] = useState<Step>('scan')
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft(''))
  const [item, setItem] = useState<TaggedItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [guess, setGuess] = useState<ProductGuess | null>(null)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [resumed, setResumed] = useState(false)
  const uploadRef = useRef<Promise<string> | null>(null)
  // Split a lot (update 40): how many to take off, and where that part is headed.
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitQty, setSplitQty] = useState(1)
  const [splitHead, setSplitHead] = useState<HeadedFor | ''>('')
  const [note, setNote] = useState<{ text: string; code?: string } | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  // The kinds this person may create (the DB checks for real on save).
  const allowedKinds = ITEM_KINDS.filter((k) => KIND_META[k].caps.some((c) => can(c)))
  // "Donation — sort later" is offered to anyone who may add items (update 36).
  const canDonation = KIND_META.donation.caps.some((c) => can(c))
  // A new code is a donation, or a Hop Shop item (added in Hop Shop inventory's own form).
  const canAddStock = can('hopshop.products.create')
  const askNewKind = canAddStock || !canDonation

  const update = useCallback((patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, ...patch })), [])

  /* ------------------------------------------------ lookup a code */
  const lookup = useCallback(
    async (raw: string) => {
      const code = normalizeCode(raw)
      if (!code) {
        setError('That didn’t look like a tag or a barcode. Try again, or type the code.')
        setStep('scan')
        return
      }
      setError(null)
      setStep('lookup')
      try {
        const found = await findByCode(orgId, code)
        if (found) {
          setItem(found)
          setDraft(draftFromItem(found))
          setEditing(false)
          setStep('found')
          return
        }
        // New: start with an empty draft for this code.
        const d = emptyDraft(code)
        setItem(null)
        setDraft(d)
        setEditing(false)
        setGuess(null)
        if (isRetailBarcode(code)) {
          // best-effort product name; it arrives while they answer "What is it?"
          guessProduct(code).then((g) => g && setGuess(g))
        }
        if (!askNewKind) {
          setDraft({ ...d, kind: 'donation' })
          setStep('photo')
        } else {
          setStep('kind')
        }
      } catch (err) {
        setError(errMessage(err))
        setStep('scan')
      }
    },
    [orgId, askNewKind],
  )

  // Arrived from a tag URL (/t/XXXXX) or the items list (?code=).
  useEffect(() => {
    const code = params.get('code')
    if (code && orgId) {
      setParams({}, { replace: true })
      void lookup(code)
      return
    }
    const saved = loadSaved()
    if (saved && !code) {
      setDraft(saved.draft)
      setEditing(saved.editing)
      setStep(saved.step)
      setResumed(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  // Keep the wizard's progress across a refresh; clear it once done.
  useEffect(() => {
    if (WIZARD.includes(step)) persist({ step, draft, editing })
    else if (step === 'done' || step === 'scan') persist(null)
  }, [step, draft, editing])

  const startOver = () => {
    persist(null)
    setDraft(emptyDraft(''))
    setItem(null)
    setEditing(false)
    setGuess(null)
    setError(null)
    setResumed(false)
    setTyped('')
    setStep('scan')
  }

  /* ------------------------------------------------ photo */
  const usePhoto = async (src: Blob | string) => {
    setError(null)
    setPhotoBusy(true)
    try {
      const preview = typeof src === 'string' ? src : URL.createObjectURL(src)
      update({ photoPreview: preview, photoUrl: null })
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      const p = uploadItemPhoto(blob, orgId)
      uploadRef.current = p
      const url = await p
      if (uploadRef.current === p) update({ photoUrl: url })
    } catch (err) {
      update({ photoPreview: null, photoUrl: null })
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

  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    try {
      const dataUrl = await pickPhoto(source)
      if (dataUrl) await usePhoto(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t get that photo.')
    }
  }

  /* ------------------------------------------------ save */
  const save = async () => {
    setError(null)
    setStep('saving')
    try {
      // If a photo is still uploading, wait for it rather than saving without.
      let d = draft
      if (uploadRef.current && !d.photoUrl) {
        try {
          const url = await uploadRef.current
          d = { ...d, photoUrl: url }
        } catch {
          /* photo failed; save the rest */
        }
      }
      let saved = await saveItem(orgId, d)
      // Condition, category and where it's kept travel separately (update 39).
      if (saved.kind === 'donation' || saved.kind === 'stock') {
        const changed = (d.condition ?? '') !== (saved.condition ?? '') || (d.category ?? '') !== (saved.category ?? '') || (d.location ?? '') !== (saved.location ?? '')
        if (changed) {
          try {
            saved = (await setItemExtras(orgId, saved.code, d)) ?? saved
          } catch (err) {
            setError(`Saved, but not the condition, category or place: ${errMessage(err)}`)
          }
        }
      }
      if (saved.kind === 'donation') {
        const planChanged =
          d.headedFor !== (saved.headed_for ?? '') ||
          d.valueBasis !== (saved.value_basis ?? 'each') ||
          d.size.trim() !== (saved.size ?? '') ||
          d.useBy !== (saved.use_by ?? '')
        if (planChanged) {
          try {
            saved =
              (await setDonationPlan(orgId, saved.code, {
                headed_for: d.headedFor || null,
                value_basis: d.valueBasis,
                size: d.size.trim() || null,
                use_by: d.useBy || null,
              })) ?? saved
          } catch (err) {
            // Without update 40 a value is always "for one": save the lot's value as one piece's.
            const cents = dollarsToCents(d.value)
            if (isNeeds40(err) && d.valueBasis === 'all' && cents != null && d.quantity > 1) {
              try {
                saved = await saveItem(orgId, { ...d, value: centsToDollars(Math.round(cents / d.quantity)) })
              } catch {
                /* the first save stands */
              }
            }
            setError(isNeeds40(err) ? 'Saved. Where it’s headed, value for the lot, size and use-by need database update 40.' : `Saved, but not where it’s headed: ${errMessage(err)}`)
          }
        }
      }
      setItem(saved)
      setDraft(draftFromItem(saved))
      persist(null)
      setStep(editing ? 'found' : 'done')
      setEditing(false)
    } catch (err) {
      setError(errMessage(err))
      setStep('details')
    }
  }

  /* ------------------------------------------------ actions on a found item */
  const act = async (fn: () => Promise<TaggedItem>) => {
    setBusy(true)
    setError(null)
    try {
      setItem(await fn())
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!item) return
    if (!window.confirm(`Remove “${item.title}” completely? This can’t be undone.`)) return
    setBusy(true)
    try {
      await deleteItem(orgId, item.code)
      startOver()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  /* ------------------------------------------------ step index for the dots */
  const stepNo = (s: Step) => {
    const list: Step[] = askNewKind ? ['kind', 'photo', 'name', 'details'] : ['photo', 'name', 'details']
    const i = list.indexOf(s)
    return { step: i + 1, of: list.length }
  }
  const prev = (s: Step): Step => {
    if (s === 'photo') return askNewKind ? 'kind' : 'scan'
    if (s === 'name') return 'photo'
    if (s === 'details') return 'name'
    return 'scan'
  }
  const backTo = (s: Step) => {
    if (editing && item) {
      setStep('found')
      return
    }
    const p = prev(s)
    if (p === 'scan') startOver()
    else setStep(p)
  }

  if (!orgId) return null

  /* ================================================= screens */

  if (step === 'scan' || step === 'type') {
    return (
      <StepShell
        title="Scan an item"
        help="Hold the phone over the OHRR tag or the barcode. It reads by itself."
        onBack={() => navigate('/staff')}
        backLabel="Dashboard"
      >
        <div className="space-y-4">
          {resumed && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-blue-50 px-4 py-3 text-[15px]">
              <span className="font-semibold text-ink">You were in the middle of an item.</span>
              <button type="button" onClick={() => setStep(loadSaved()?.step ?? 'kind')} className="font-extrabold text-brand-blue">
                Continue
              </button>
            </div>
          )}
          <ErrorBox>{error}</ErrorBox>
          {step === 'scan' ? (
            <Scanner onResult={(raw) => void lookup(raw)} onTypeInstead={() => setStep('type')} />
          ) : (
            <div className="space-y-4">
              <p className="text-base text-slate-600">The code is printed under the square on the tag — five letters and numbers.</p>
              <BigInput
                value={typed}
                onChange={setTyped}
                placeholder="7K3PX"
                ariaLabel="The code on the tag"
                mono
                autoFocus
                onEnter={() => typed.trim() && void lookup(typed)}
              />
              <BigButton onClick={() => void lookup(typed)} disabled={!typed.trim()} icon="search">
                Find it
              </BigButton>
              <BigButton onClick={() => setStep('scan')} tone="plain" icon="camera">
                Use the camera instead
              </BigButton>
            </div>
          )}
          {(canDonation || canAddStock) && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-[15px] text-slate-600">
              <p className="font-bold text-ink">No label on it yet?</p>
              <p className="mt-0.5">
                {canDonation && (
                  <>
                    <Link to="/staff/catalog" className="font-extrabold text-brand-blue underline-offset-2 hover:underline">
                      Add it as a donation
                    </Link>{' '}
                    — it gets the next DON number.{canAddStock ? ' Something the shop carries? ' : ''}
                  </>
                )}
                {canAddStock && (
                  <>
                    <Link to="/staff/hopshop?add=1" className="font-extrabold text-brand-blue underline-offset-2 hover:underline">
                      Add it to Hop Shop inventory
                    </Link>{' '}
                    — it gets a SKU.
                  </>
                )}
              </p>
            </div>
          )}
          <Link to="/staff/items" className="block text-center text-base font-bold text-brand-blue">
            See all scanned items
          </Link>
        </div>
      </StepShell>
    )
  }

  if (step === 'lookup') {
    return (
      <StepShell title="One moment…" onBack={startOver}>
        <Busy label="Looking it up" />
      </StepShell>
    )
  }

  if (step === 'found' && item) {
    const m = KIND_META[item.kind]
    const canThis = m.caps.some((c) => can(c))
    const isDone = item.kind === 'stock' ? item.status === 'inactive' : item.status === m.doneStatus
    return (
      <StepShell title="Found it" help="This tag is already on an item." onBack={startOver} backLabel="Scan">
        <div className="space-y-4">
          <ItemCard item={item} big />
          <ErrorBox>{error}</ErrorBox>
          {canThis && item.kind === 'stock' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-center text-base font-bold text-slate-600">How many are there now?</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy || (item.quantity ?? 0) <= 0}
                  onClick={() => void act(() => adjustStock(orgId, item.code, -1))}
                  className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-ink transition hover:bg-slate-200 active:scale-95 disabled:opacity-40"
                  aria-label="One fewer"
                >
                  <Icon name="minus" size={28} />
                </button>
                <span className="flex-1 text-center font-display text-4xl font-black text-ink">{item.quantity ?? 0}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => adjustStock(orgId, item.code, 1))}
                  className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-white transition hover:bg-brand-blue-dark active:scale-95 disabled:opacity-40"
                  aria-label="One more"
                >
                  <Icon name="plus" size={28} />
                </button>
              </div>
            </div>
          )}
          {note && (
            <div role="status" className="rounded-2xl bg-green-50 px-4 py-3 text-[15px] text-green-900">
              {note.text}{' '}
              {note.code && (
                <Link to={`/staff/labels?code=${encodeURIComponent(note.code)}`} className="font-bold text-brand-blue">
                  Print its label
                </Link>
              )}
            </div>
          )}
          {item.kind === 'donation' && item.in_basket && (
            <button
              type="button"
              onClick={() => void lookup(item.in_basket!.code)}
              className="block w-full rounded-2xl bg-brand-blue-50 px-4 py-3 text-left text-[15px] text-brand-blue"
            >
              In the basket <span className="font-bold">“{item.in_basket.title}”</span> ({item.in_basket.code}) — open it
            </button>
          )}
          {item.kind !== 'donation' && item.kind !== 'stock' && item.contents && item.contents.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-base font-bold text-ink">In this basket</p>
              <ul className="space-y-1">
                {item.contents.map((c, i) => (
                  <li key={c.code ?? i}>
                    <button
                      type="button"
                      onClick={() => c.code && void lookup(c.code)}
                      disabled={!c.code}
                      className="min-h-[44px] w-full text-left text-[15px] text-slate-700"
                    >
                      {c.quantity} × {c.title}
                      {c.size ? ` (${c.size})` : ''}
                      {c.donated_by ? ` · from ${c.donated_by}` : ''}
                      {c.value_total_cents != null ? ` · ${formatMoney(c.value_total_cents)}` : ''}
                      {c.code && <span className="ml-1 font-mono text-sm text-slate-500">{c.code}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canThis && item.kind === 'donation' && !item.outcome && (
            <BigButton
              tone="orange"
              icon="gavel"
              onClick={() => {
                setEditing(true)
                setStep('kind')
              }}
            >
              Where does it go?
            </BigButton>
          )}
          {canThis && item.kind === 'donation' && !item.outcome && (item.quantity ?? 1) > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={() => {
                  setSplitOpen((o) => !o)
                  setSplitQty(1)
                  setSplitHead('')
                }}
                aria-expanded={splitOpen}
                className="flex min-h-[44px] w-full items-center justify-between text-left text-base font-bold text-brand-blue"
              >
                Split this lot of {item.quantity}
                <Icon name="chevron" size={18} className={`text-slate-400 transition ${splitOpen ? 'rotate-90' : ''}`} />
              </button>
              {splitOpen && (
                <div className="mt-3 space-y-4">
                  <p className="text-[15px] text-slate-600">Take some off as their own item, with a new code. The rest stay here.</p>
                  <div>
                    <p className="mb-2 text-base font-bold text-ink">How many to take off?</p>
                    <Stepper
                      value={splitQty}
                      onChange={(n) => setSplitQty(Math.min(Math.max(1, n), (item.quantity ?? 2) - 1))}
                      ariaLabel="How many to take off"
                    />
                  </div>
                  <HeadedForChips v={{ ...emptyExtras(), headedFor: splitHead }} set={(p) => p.headedFor !== undefined && setSplitHead(p.headedFor)} />
                  <BigButton
                    disabled={busy}
                    icon="check"
                    onClick={() =>
                      void (async () => {
                        setBusy(true)
                        setError(null)
                        try {
                          const rest = (item.quantity ?? 0) - splitQty
                          const part = await splitDonation(orgId, item.code, splitQty, splitHead || null)
                          setNote({ text: `Split off ${splitQty} as ${part.code}. The other ${rest} stay as ${item.code}.`, code: part.code })
                          setItem(part)
                          setDraft(draftFromItem(part))
                          setSplitOpen(false)
                        } catch (err) {
                          setError(errMessage(err))
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }
                  >
                    Split off {splitQty}
                  </BigButton>
                </div>
              )}
            </div>
          )}
          {canThis && item.kind === 'donation' && !item.outcome && (
            <div className="grid grid-cols-2 gap-3">
              <BigButton tone="plain" disabled={busy} onClick={() => void act(async () => (await setDonationOutcome(orgId, item.code, 'rabbits')) ?? item)}>
                Used for the rabbits
              </BigButton>
              <BigButton tone="plain" disabled={busy} onClick={() => void act(async () => (await setDonationOutcome(orgId, item.code, 'passed_on')) ?? item)}>
                Passed on / not usable
              </BigButton>
            </div>
          )}
          {canThis && item.kind === 'donation' && item.outcome && item.outcome !== 'sorted' && (
            <BigButton tone="outline" disabled={busy} onClick={() => void act(async () => (await setDonationOutcome(orgId, item.code, null)) ?? item)}>
              {item.outcome === 'basket' ? 'Take it out of the basket' : 'Undo — it’s still waiting to be sorted'}
            </BigButton>
          )}
          {canThis && item.kind !== 'stock' && item.kind !== 'donation' && (
            <BigButton
              tone={isDone ? 'plain' : 'orange'}
              icon={isDone ? 'x' : 'check'}
              disabled={busy}
              onClick={() => void act(() => setStatus(orgId, item.code, isDone ? m.openStatus : m.doneStatus))}
            >
              {isDone ? m.undoLabel : m.doneLabel}
            </BigButton>
          )}
          {canThis && (
            <div className="grid grid-cols-2 gap-3">
              <BigButton
                tone="outline"
                icon="camera"
                onClick={() => navigate(`/staff/items/photos?code=${encodeURIComponent(item.code)}`)}
              >
                Photos
              </BigButton>
              <BigButton
                tone="outline"
                icon="keyboard"
                onClick={() => {
                  setEditing(true)
                  setStep('name')
                }}
              >
                Details
              </BigButton>
            </div>
          )}
          {canThis && item.kind !== 'stock' && item.kind !== 'donation' && (
            <BigButton
              tone="plain"
              disabled={busy}
              onClick={() => void act(() => setPublished(orgId, item.code, !item.is_published))}
            >
              {item.is_published ? 'Hide from the public list' : 'Show on the public list'}
            </BigButton>
          )}
          {canThis && item.kind !== 'donation' && (allowedKinds.length > 1 || canDonation) && (
            <BigButton
              tone="plain"
              onClick={() => {
                setEditing(true)
                setStep('kind')
              }}
            >
              It’s something else
            </BigButton>
          )}
          <BigButton tone="blue" icon="scan" onClick={startOver}>
            Scan another
          </BigButton>
          {canThis && (
            <button type="button" onClick={() => void remove()} disabled={busy} className="block w-full py-2 text-center text-base font-bold text-red-600">
              Remove this item
            </button>
          )}
        </div>
      </StepShell>
    )
  }

  if (step === 'kind' && !editing) {
    const { step: n, of } = stepNo('kind')
    return (
      <StepShell title="What is it?" help="Tap one." step={n} of={of} onBack={() => backTo('kind')}>
        <div className="space-y-3">
          {canDonation && (
            <KindTile
              kind="donation"
              label="A donation"
              hint="Something given to OHRR. Sort it later, or say where it’s headed."
              selected={draft.kind === 'donation'}
              onSelect={() => {
                update({ kind: 'donation', ...(guess && !draft.title ? { title: guessTitle(guess) } : {}) })
                setStep('photo')
              }}
            />
          )}
          {canAddStock && (
            <KindTile
              kind="stock"
              label="A Hop Shop item"
              hint="Something the shop carries, bought from a supplier. Opens Hop Shop inventory with this code."
              selected={false}
              onSelect={() => {
                persist(null)
                navigate(`/staff/hopshop?add=1&code=${encodeURIComponent(draft.code)}`)
              }}
            />
          )}
          {!canDonation && !canAddStock && (
            <ErrorBox>Your account can’t add items yet. Ask an admin to grant Silent Auction or Hop Shop access.</ErrorBox>
          )}
        </div>
      </StepShell>
    )
  }

  if (step === 'kind') {
    const { step: n, of } = stepNo('kind')
    const sorting = editing && item?.kind === 'donation'
    const choices: ItemKind[] = [...allowedKinds, ...(canDonation && !sorting ? (['donation'] as ItemKind[]) : [])]
    return (
      <StepShell title={sorting ? 'Where does it go?' : 'What is it?'} help="Tap one." step={editing ? undefined : n} of={editing ? undefined : of} onBack={() => backTo('kind')}>
        <div className="space-y-3">
          {choices.map((k) => (
            <KindTile
              key={k}
              kind={k}
              selected={draft.kind === k}
              onSelect={() => {
                update({ kind: k })
                if (guess && !draft.title) update({ kind: k, title: guessTitle(guess) })
                // Sorting a donation into the raffle or auction: the prize is worth the whole lot.
                if (sorting && item && (k === 'auction' || k === 'raffle')) {
                  const total = item.value_total_cents ?? (item.value_cents != null ? item.value_cents * Math.max(1, item.quantity ?? 1) : null)
                  if (total != null) update({ kind: k, value: centsToDollars(total) })
                }
                setStep(editing ? 'details' : 'photo')
              }}
            />
          ))}
          {choices.length === 0 && (
            <ErrorBox>Your account can’t add items yet. Ask an admin to grant Silent Auction or Hop Shop access.</ErrorBox>
          )}
        </div>
      </StepShell>
    )
  }

  if (step === 'photo') {
    const { step: n, of } = stepNo('photo')
    const kindLabel = draft.kind ? KIND_META[draft.kind].label : ''
    return (
      <StepShell
        title="Take a photo"
        help={`A clear photo helps people find the ${kindLabel === 'Hop Shop stock' ? 'product' : 'item'}.`}
        step={editing ? undefined : n}
        of={editing ? undefined : of}
        onBack={() => backTo('photo')}
        footer={
          <BigButton onClick={() => (editing ? void save() : setStep('name'))} disabled={photoBusy} icon={editing ? 'check' : undefined}>
            {editing ? 'Save photo' : draft.photoPreview ? 'Next' : 'Skip for now'}
          </BigButton>
        }
      >
        <div className="space-y-4">
          {draft.photoPreview ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              <img src={draft.photoPreview} alt="" className="h-64 w-full object-cover" />
              {photoBusy && <p className="px-4 py-2 text-center text-sm font-bold text-slate-500">Saving the photo…</p>}
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400">
              <Icon name="camera" size={56} />
            </div>
          )}
          <ErrorBox>{error}</ErrorBox>
          <BigButton onClick={() => void pick('camera')} tone="blue" icon="camera" disabled={photoBusy}>
            {draft.photoPreview ? 'Take another photo' : 'Open the camera'}
          </BigButton>
          <BigButton onClick={() => void pick('library')} tone="outline" disabled={photoBusy}>
            Choose from my photos
          </BigButton>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo" />
          <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Choose a photo" />
        </div>
      </StepShell>
    )
  }

  if (step === 'name') {
    const { step: n, of } = stepNo('name')
    const canNext = draft.title.trim().length > 0
    return (
      <StepShell
        title="What is it called?"
        help="A short name people will recognise on the table."
        step={editing ? undefined : n}
        of={editing ? undefined : of}
        onBack={() => backTo('name')}
        footer={
          <BigButton onClick={() => setStep('details')} disabled={!canNext}>
            Next
          </BigButton>
        }
      >
        <div className="space-y-4">
          {guess && !draft.title && (
            <button
              type="button"
              onClick={() => update({ title: guessTitle(guess) })}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-brand-blue/40 bg-brand-blue-50/60 p-3 text-left"
            >
              {guess.thumb && <img src={guess.thumb} alt="" className="h-14 w-14 rounded-xl object-cover" />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-brand-blue">Is it this?</span>
                <span className="block font-display text-lg font-extrabold text-ink">{guessTitle(guess)}</span>
              </span>
              <span className="rounded-full bg-brand-blue px-3 py-1.5 text-sm font-bold text-white">Yes</span>
            </button>
          )}
          <BigInput
            value={draft.title}
            onChange={(v) => update({ title: v })}
            placeholder={draft.kind === 'stock' ? 'Timothy hay, 40 oz' : 'Plush bunny basket'}
            ariaLabel="Name of the item"
            autoFocus
            onEnter={() => canNext && setStep('details')}
          />
          <p className="text-[15px] text-slate-500">Tip: the microphone key on your keyboard lets you say it instead of typing.</p>
          <label className="block">
            <span className="text-base font-bold text-ink">Anything else people should know? (optional)</span>
            <textarea
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={3}
              className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
              placeholder="Handmade · includes a $20 gift card · …"
            />
          </label>
        </div>
      </StepShell>
    )
  }

  if (step === 'details' && draft.kind) {
    const { step: n, of } = stepNo('details')
    const stock = draft.kind === 'stock'
    const donation = draft.kind === 'donation'
    // The shared detail fields read and write the draft (notes = description).
    const ex: Extras = {
      quantity: draft.quantity,
      price: draft.price,
      value: draft.value,
      valueBasis: draft.valueBasis,
      headedFor: draft.headedFor,
      size: draft.size,
      useBy: draft.useBy,
      condition: draft.condition ?? '',
      category: draft.category ?? '',
      location: draft.location ?? '',
      notes: draft.description,
    }
    const setEx = (p: Partial<Extras>) => {
      const { notes, ...rest } = p
      update(notes === undefined ? rest : { ...rest, description: notes })
    }
    return (
      <StepShell
        title={stock ? 'How many, and the price' : donation ? 'The details' : 'A couple of details'}
        help={donation ? 'All optional — fill in what you know.' : 'Both are optional — you can fill them in later.'}
        step={editing ? undefined : n}
        of={editing ? undefined : of}
        onBack={() => backTo('details')}
        footer={
          <BigButton onClick={() => void save()} icon="check">
            Save
          </BigButton>
        }
      >
        <div className="space-y-5">
          <ErrorBox>{error}</ErrorBox>
          {donation ? (
            <>
              <div>
                <p className="mb-2 text-base font-bold text-ink">Who gave it?</p>
                <BigInput value={draft.donatedBy} onChange={(v) => update({ donatedBy: v })} placeholder="A friend of OHRR" ariaLabel="Who donated it" />
              </div>
              <QuantityField v={ex} set={setEx} />
              <ValueFields v={ex} set={setEx} />
              <HeadedForChips v={ex} set={setEx} />
              <MoreDetailsFields
                v={ex}
                set={setEx}
                suggestions={suggestions}
                show={{ size: true, condition: true, category: true, location: true, useBy: true, price: true, notes: true }}
              />
            </>
          ) : stock ? (
            <>
              <div>
                <p className="mb-2 text-base font-bold text-ink">How many do we have?</p>
                <Stepper value={draft.quantity} onChange={(v) => update({ quantity: v })} ariaLabel="How many" />
              </div>
              <div>
                <p className="mb-2 text-base font-bold text-ink">Price for one</p>
                <MoneyInput value={draft.price} onChange={(v) => update({ price: v })} ariaLabel="Price for one" />
              </div>
              <MoreDetailsFields v={ex} set={setEx} suggestions={suggestions} show={{ category: true, location: true }} />
            </>
          ) : (
            <>
              <div>
                <p className="mb-2 text-base font-bold text-ink">Who gave it?</p>
                <BigInput
                  value={draft.donatedBy}
                  onChange={(v) => update({ donatedBy: v })}
                  placeholder="A friend of OHRR"
                  ariaLabel="Who donated it"
                />
              </div>
              <div>
                <p className="mb-2 text-base font-bold text-ink">What is it worth?</p>
                <MoneyInput value={draft.value} onChange={(v) => update({ value: v })} ariaLabel="Value in dollars" />
              </div>
            </>
          )}
        </div>
      </StepShell>
    )
  }

  if (step === 'saving') {
    return (
      <StepShell title="Saving…">
        <Busy label="Saving the item" />
      </StepShell>
    )
  }

  if (step === 'done' && item) {
    // A new donation gets the next DON number, a shop item its SKU: print the label to stick on.
    const numbered = isOhrrCode(item.code)
    const labelsAt = item.kind === 'stock' ? '/staff/hopshop/labels' : '/staff/labels'
    return (
      <StepShell title="Saved!" help={numbered ? `Its number is ${item.code}. Print its label and stick it on.` : 'All done.'}>
        <div className="space-y-4">
          <div className="flex justify-center">
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Icon name="check" size={44} />
            </span>
          </div>
          <ItemCard item={item} />
          {numbered && (
            <BigButton tone="blue" icon="printer" onClick={() => navigate(`${labelsAt}?code=${encodeURIComponent(item.code)}`)}>
              Print its label
            </BigButton>
          )}
          <BigButton tone="orange" icon="scan" onClick={startOver}>
            Scan another
          </BigButton>
          <BigButton tone="plain" onClick={() => navigate('/staff')}>
            I’m done
          </BigButton>
        </div>
      </StepShell>
    )
  }

  // Shouldn't happen; keep the person moving.
  return (
    <StepShell title="Scan an item" onBack={startOver}>
      <BigButton onClick={startOver} icon="scan">
        Start again
      </BigButton>
    </StepShell>
  )
}
