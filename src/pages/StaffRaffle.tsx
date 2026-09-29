// Staff manager for the Midwest BunFest Silent Auction (route /staff/raffle;
// gated on events.bunfest.manage — the DB enforces it too). Phone-first: adding
// an item starts with the camera, then the details. The "Auction setup" panel
// holds the two session close times, an optional intro line, and the raffle
// ticket pricing + details (the public raffle page shows those only when staff
// have entered them; the ticket form itself is a test feature switched on in
// /staff/features). The public catalog shows the intro line only, never the times.
//
// Update 35 (online bidding): each item gets a starting bid, bid step, Buy Now
// price and shipping fee; the setup panel gets the bidding switch, opening
// time, "going once" minutes, default step, Stripe publishable key and notes,
// saved through auction_save_settings(). Those fields only appear once the
// update is on the database (a one-column probe on load), so editing keeps
// working before it runs. Sales themselves are handled on the Auction desk.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen, SectionLabel } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { RafflePhoto } from '../features/raffle/RafflePhoto'
import { uploadAuctionPhoto } from '../features/raffle/photoUpload'
import {
  AUCTION_EVENT_SLUG,
  AUCTION_SESSIONS,
  centsToDollars,
  dollarsToCents,
  eventTimeToIso,
  formatEventTime,
  formatValue,
  isoToEventTime,
  rafflePriceLine,
  sessionLabel,
  sortForStaff,
  type AuctionItem,
  type AuctionSettings,
} from '../features/raffle/types'
import { GivenByCompany } from '../features/bunfest/GivenByCompany'
import { auctionApi, fmtWhen, money } from '../features/auction/client'

const pill =
  'rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60'

/* ------------------------------------------------------------------ */
/* Photo step — camera first                                           */
/* ------------------------------------------------------------------ */

function PhotoCapture({
  orgId,
  photo,
  onPhoto,
  compact = false,
}: {
  orgId: string
  photo: string | null
  onPhoto: (url: string | null) => void
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = '' // let the same file be picked again after a retake
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onPhoto(await uploadAuctionPhoto(file, orgId))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const inputs = (
    <>
      {/* capture="environment" opens the rear camera on phones; desktops get a file picker */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(e) => onFile(e.target)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => onFile(e.target)}
      />
    </>
  )

  if (photo) {
    return (
      <div className={compact ? 'flex items-center gap-3' : 'space-y-3'}>
        {inputs}
        <div
          className={`overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 ${
            compact ? 'h-20 w-20 shrink-0' : 'aspect-[4/3] w-full rounded-2xl'
          }`}
        >
          <img src={photo} alt="Item photo" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className={pill}>
            {busy ? 'Uploading…' : 'Retake'}
          </button>
          <button type="button" disabled={busy} onClick={() => libraryRef.current?.click()} className={pill}>
            Choose another
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPhoto(null)}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
        <FormError>{error}</FormError>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {inputs}
      <button
        type="button"
        disabled={busy}
        onClick={() => cameraRef.current?.click()}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-blue/40 bg-brand-blue-50/60 px-4 text-brand-blue transition hover:bg-brand-blue-50 disabled:opacity-60 ${
          compact ? 'py-5' : 'py-10'
        }`}
      >
        <span className="font-display text-base font-extrabold">
          {busy ? 'Uploading…' : 'Take a photo'}
        </span>
        <span className="text-xs font-semibold text-slate-500">Opens your camera</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => libraryRef.current?.click()}
        className="block w-full text-center text-sm font-bold text-brand-blue hover:text-brand-blue-dark disabled:opacity-60"
      >
        Choose from your photos instead
      </button>
      <FormError>{error}</FormError>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Item form                                                           */
/* ------------------------------------------------------------------ */

interface Draft {
  title: string
  description: string
  donated_by: string
  value: string // dollars as typed
  session: string
  is_published: boolean
  sort_order: string
  photo_url: string | null
  // Online bidding (update 35) — dollars as typed; blank = not set
  starting_bid: string
  bid_step: string
  buy_now: string
  pickup_only: boolean
  ship_fee: string
}

const emptyDraft: Draft = {
  title: '',
  description: '',
  donated_by: '',
  value: '',
  session: 'all-day',
  is_published: true,
  sort_order: '0',
  photo_url: null,
  starting_bid: '',
  bid_step: '',
  buy_now: '',
  pickup_only: true,
  ship_fee: '',
}

function draftFrom(i: AuctionItem): Draft {
  return {
    title: i.title,
    description: i.description ?? '',
    donated_by: i.donated_by ?? '',
    value: centsToDollars(i.value_cents),
    session: i.session,
    is_published: i.is_published,
    sort_order: String(i.sort_order),
    photo_url: i.photo_url,
    starting_bid: centsToDollars(i.starting_bid_cents ?? null),
    bid_step: centsToDollars(i.min_increment_cents ?? null),
    buy_now: centsToDollars(i.buy_now_cents ?? null),
    pickup_only: i.ship_fee_cents == null,
    ship_fee: centsToDollars(i.ship_fee_cents ?? null),
  }
}

// `withBidding`: only send the update-35 columns once the database has them.
function draftToRow(d: Draft, withBidding: boolean) {
  const sort = Number.parseInt(d.sort_order, 10)
  const base = {
    title: d.title.trim(),
    description: d.description.trim() || null,
    donated_by: d.donated_by.trim() || null,
    value_cents: dollarsToCents(d.value),
    session: d.session,
    is_published: d.is_published,
    sort_order: Number.isFinite(sort) ? sort : 0,
    photo_url: d.photo_url,
  }
  if (!withBidding) return base
  return {
    ...base,
    starting_bid_cents: dollarsToCents(d.starting_bid),
    min_increment_cents: dollarsToCents(d.bid_step) || null,
    buy_now_cents: dollarsToCents(d.buy_now) || null,
    ship_fee_cents: d.pickup_only ? null : (dollarsToCents(d.ship_fee) ?? 0),
  }
}

function ItemForm({
  initial,
  orgId,
  submitLabel,
  hasBidding,
  currentBidCents = null,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  orgId: string
  submitLabel: string
  /** The database has update 35 — show and save the bidding fields. */
  hasBidding: boolean
  /** The item's running bid, to keep a Buy Now price above it. */
  currentBidCents?: number | null
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set =
    (k: keyof Draft) =>
    (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    if (hasBidding) {
      const buyNow = dollarsToCents(draft.buy_now)
      if (buyNow != null && currentBidCents != null && buyNow <= currentBidCents) {
        setError(`The Buy Now price must be above the current bid (${money(currentBidCents)}).`)
        return
      }
      if (!draft.pickup_only && dollarsToCents(draft.ship_fee) == null) {
        setError('Enter the shipping fee (0 is fine), or tick “Pickup only”.')
        return
      }
    }
    setBusy(true)
    try {
      await onSubmit(draft)
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="text-sm font-semibold text-slate-700">Photo</span>
        <div className="mt-1.5">
          <PhotoCapture
            orgId={orgId}
            photo={draft.photo_url}
            compact
            onPhoto={(photo_url) => setDraft((d) => ({ ...d, photo_url }))}
          />
        </div>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Title
        <input className={staffInput} required value={draft.title} onChange={set('title')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Description
        <textarea className={staffInput} rows={3} value={draft.description} onChange={set('description')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Donated by
        <input className={staffInput} value={draft.donated_by} onChange={set('donated_by')} />
      </label>

      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Value ($)
          <input
            className={staffInput}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0"
            value={draft.value}
            onChange={set('value')}
          />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Session
          <select className={staffInput} value={draft.session} onChange={set('session')}>
            {AUCTION_SESSIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-end gap-3">
        <label className="block w-28 text-sm font-semibold text-slate-700">
          Sort order
          <input
            className={staffInput}
            type="number"
            inputMode="numeric"
            step="1"
            value={draft.sort_order}
            onChange={set('sort_order')}
          />
        </label>
        <label className="flex flex-1 items-center gap-2 pb-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-blue"
            checked={draft.is_published}
            onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
          />
          Show in the app
        </label>
      </div>

      {hasBidding && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div>
            <p className="font-display text-[15px] font-extrabold text-ink">Online bidding</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Blank starting bid = one bid step. Blank step = the auction’s default step (Auction setup).
            </p>
          </div>
          <div className="flex gap-3">
            <label className="block flex-1 text-sm font-semibold text-slate-700">
              Starting bid ($)
              <input className={staffInput} type="number" inputMode="decimal" min="0" step="0.01" placeholder="Not set" value={draft.starting_bid} onChange={set('starting_bid')} />
            </label>
            <label className="block flex-1 text-sm font-semibold text-slate-700">
              Bid step ($)
              <input className={staffInput} type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Default" value={draft.bid_step} onChange={set('bid_step')} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Buy Now price ($, optional)
            <input className={staffInput} type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="No Buy Now" value={draft.buy_now} onChange={set('buy_now')} />
          </label>
          <div className="flex items-end gap-3">
            <label className="flex min-h-[44px] flex-1 items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-brand-blue"
                checked={draft.pickup_only}
                onChange={(e) => setDraft((d) => ({ ...d, pickup_only: e.target.checked }))}
              />
              Pickup only
            </label>
            {!draft.pickup_only && (
              <label className="block w-36 text-sm font-semibold text-slate-700">
                Shipping fee ($)
                <input className={staffInput} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={draft.ship_fee} onChange={set('ship_fee')} />
              </label>
            )}
          </div>
        </div>
      )}

      <FormError>{error}</FormError>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || draft.title.trim().length === 0}
          className={`${btn.primary} flex-1 disabled:opacity-60`}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Add flow: photo first, then details                                 */
/* ------------------------------------------------------------------ */

function AddItem({
  orgId,
  nextSortOrder,
  hasBidding,
  onCreate,
  onCancel,
}: {
  orgId: string
  nextSortOrder: number
  hasBidding: boolean
  onCreate: (d: Draft) => Promise<void>
  onCancel: () => void
}) {
  const [step, setStep] = useState<'photo' | 'details'>('photo')
  const [photo, setPhoto] = useState<string | null>(null)

  if (step === 'photo') {
    return (
      <Card className="space-y-3">
        <p className="font-display text-[15px] font-extrabold text-ink">New item — photo first</p>
        <PhotoCapture orgId={orgId} photo={photo} onPhoto={setPhoto} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep('details')}
            className={`${btn.primary} flex-1`}
          >
            {photo ? 'Continue' : 'Continue without a photo'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New item — details</p>
      <ItemForm
        initial={{ ...emptyDraft, photo_url: photo, sort_order: String(nextSortOrder) }}
        orgId={orgId}
        submitLabel="Add item"
        hasBidding={hasBidding}
        onSubmit={onCreate}
        onCancel={onCancel}
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Item card (list)                                                    */
/* ------------------------------------------------------------------ */

function ItemCard({
  item,
  orgId,
  isFirst,
  isLast,
  hasBidding,
  onChanged,
  onMove,
}: {
  item: AuctionItem
  orgId: string
  isFirst: boolean
  isLast: boolean
  hasBidding: boolean
  onChanged: () => void
  onMove: (dir: -1 | 1) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = async (values: Partial<AuctionItem>) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('raffle_items').update(values).eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('raffle_items').update(draftToRow(d, hasBidding)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('raffle_items').delete().eq('id', item.id)
    if (error) {
      setError(errMessage(error))
      setBusy(false)
      setConfirmDelete(false)
      return
    }
    onChanged()
  }

  const move = async (dir: -1 | 1) => {
    setBusy(true)
    setError(null)
    try {
      await onMove(dir)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <Card>
        <ItemForm
          initial={draftFrom(item)}
          orgId={orgId}
          submitLabel="Save changes"
          hasBidding={hasBidding}
          currentBidCents={item.current_bid_cents ?? null}
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
        {/* Which company gave it — puts it on their card (update 27) */}
        <GivenByCompany orgId={orgId} itemId={item.id} />
      </Card>
    )
  }

  const won = item.status === 'won'
  const value = formatValue(item.value_cents)
  // A sale (a bid that closed, Buy Now, or a table sale) is the desk's to manage.
  const hasSale = Boolean(item.won_kind)
  const currentBid = item.current_bid_cents ?? null
  const bidCount = item.bid_count ?? 0

  return (
    <Card className="space-y-2">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <RafflePhoto title={item.title} photo={item.photo_url} initialClassName="text-2xl" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
            {value && <span className="shrink-0 text-sm font-bold text-emerald-600">{value}</span>}
          </div>
          {item.donated_by && (
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">Donated by {item.donated_by}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {won ? <Badge tone="orange">{hasSale ? (item.won_kind === 'buy_now' ? 'Sold · Buy Now' : 'Sold') : 'Won'}</Badge> : <Badge tone="blue">Available</Badge>}
            {!item.is_published && <Badge tone="slate">Hidden</Badge>}
            <Badge tone="slate">{sessionLabel(item.session)}</Badge>
          </div>
          {hasBidding && (
            <p className="mt-1.5 text-xs font-semibold text-slate-500">
              {currentBid != null ? (
                <>
                  {won ? 'Sold for' : 'Current bid'} {money(currentBid)} · {bidCount} bid{bidCount === 1 ? '' : 's'}
                  {item.high_bidder_no != null && !won && <> · Bidder #{item.high_bidder_no}</>}
                </>
              ) : (
                <>
                  No bids yet
                  {item.starting_bid_cents != null && <> · starts {money(item.starting_bid_cents)}</>}
                </>
              )}
              {item.buy_now_cents != null && !won && <> · Buy now {money(item.buy_now_cents)}</>}
              {' · '}
              {item.ship_fee_cents == null ? 'pickup only' : `ships +${money(item.ship_fee_cents)}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={busy || isFirst}
            onClick={() => move(-1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          >
            <Icon name="chevron" size={14} className="-rotate-90" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={busy || isLast}
            onClick={() => move(1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          >
            <Icon name="chevron" size={14} className="rotate-90" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {hasSale ? (
          <Link to="/staff/auction-desk" className={pill}>
            Sale on the Auction desk
          </Link>
        ) : won ? (
          <button type="button" disabled={busy} onClick={() => patch({ status: 'available' })} className={pill}>
            Back to available
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'won' })}
            className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-ink hover:bg-brand-orange-dark disabled:opacity-60"
          >
            Mark won
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ is_published: !item.is_published })}
          className={pill}
        >
          {item.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <button type="button" onClick={() => setEditing(true)} className={pill}>
          Edit
        </button>
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={doDelete}
              disabled={busy}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
      <FormError>{error}</FormError>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Auction setup panel                                                 */
/* ------------------------------------------------------------------ */

// ISO → the value a <input type="datetime-local"> wants (the phone's own zone).
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToIso(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Is the payment server (the website's /api/auction) set up? Plain words, no secrets. */
function PaymentServerStatus() {
  const [h, setH] = useState<Awaited<ReturnType<typeof auctionApi.health>> | undefined>(undefined)
  useEffect(() => {
    let alive = true
    auctionApi.health().then((r) => alive && setH(r))
    return () => {
      alive = false
    }
  }, [])
  if (h === undefined) return <p className="text-xs text-slate-400">Checking the payment server…</p>
  if (h === null) {
    return (
      <p className="text-xs leading-relaxed text-amber-800">
        Payment server: not reachable. The website’s <code>/api/auction</code> isn’t deployed yet (or this phone is offline).
        Registering and Buy Now need it; the catalog and bids don’t.
      </p>
    )
  }
  const ok = h.stripe && h.webhook && h.supabase
  return (
    <div className={`text-xs leading-relaxed ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
      <p className="font-bold">Payment server: {ok ? 'ready' : 'not finished'}</p>
      <ul className="mt-0.5 space-y-0.5">
        <li>
          Stripe secret key: {h.stripe ? `set (${h.stripe_mode === 'live' ? 'LIVE — real cards' : 'test mode — no real charges'})` : 'missing — add STRIPE_SECRET_KEY in Cloudflare → the website → Settings → Variables'}
        </li>
        <li>Stripe webhook: {h.webhook ? 'set' : 'missing — add STRIPE_WEBHOOK_SECRET in Cloudflare (Stripe → Developers → Webhooks)'}</li>
        <li>Supabase key: {h.supabase ? 'set' : 'missing — add SUPABASE_SERVICE_ROLE_KEY in Cloudflare (never in the app)'}</li>
      </ul>
    </div>
  )
}

function SetupPanel({
  orgId,
  settings,
  canManageSettings,
  hasBidding,
  onSaved,
}: {
  orgId: string
  settings: AuctionSettings | null
  canManageSettings: boolean
  /** The database has update 35 — show and save the online-bidding fields. */
  hasBidding: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [morning, setMorning] = useState('')
  const [afternoon, setAfternoon] = useState('')
  const [intro, setIntro] = useState('')
  // Raffle tickets (dollars / counts as typed; blank = not set)
  const [ticketPrice, setTicketPrice] = useState('')
  const [bundleQty, setBundleQty] = useState('')
  const [bundlePrice, setBundlePrice] = useState('')
  const [raffleDetails, setRaffleDetails] = useState('')
  // Online bidding (update 35)
  const [biddingOn, setBiddingOn] = useState(false)
  const [opensAt, setOpensAt] = useState('')
  const [extendMin, setExtendMin] = useState('5')
  const [defaultStep, setDefaultStep] = useState('5')
  const [stripeKey, setStripeKey] = useState('')
  const [biddingNote, setBiddingNote] = useState('')
  const [pickupNote, setPickupNote] = useState('')
  const [shippingNote, setShippingNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setMorning(isoToEventTime(settings?.morning_closes_at))
    setAfternoon(isoToEventTime(settings?.afternoon_closes_at))
    setIntro(settings?.intro_text ?? '')
    setTicketPrice(centsToDollars(settings?.raffle_ticket_price_cents))
    setBundleQty(settings?.raffle_bundle_qty ? String(settings.raffle_bundle_qty) : '')
    setBundlePrice(centsToDollars(settings?.raffle_bundle_price_cents))
    setRaffleDetails(settings?.raffle_details ?? '')
    setBiddingOn(settings?.bidding_enabled ?? false)
    setOpensAt(isoToLocalInput(settings?.bidding_opens_at))
    setExtendMin(String(settings?.extend_minutes ?? 5))
    setDefaultStep(centsToDollars(settings?.default_increment_cents ?? 500))
    setStripeKey(settings?.stripe_publishable_key ?? '')
    setBiddingNote(settings?.bidding_note ?? '')
    setPickupNote(settings?.pickup_note ?? '')
    setShippingNote(settings?.shipping_note ?? '')
    setError(null)
    setEditing(true)
  }

  const save = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const qty = Number.parseInt(bundleQty, 10)
    const bundle_qty = Number.isFinite(qty) && qty >= 2 ? qty : null
    const bundle_price = dollarsToCents(bundlePrice)
    if ((bundle_qty === null) !== (bundle_price === null)) {
      setBusy(false)
      setError('Enter both the bundle quantity (2 or more) and the bundle price, or leave both blank.')
      return
    }
    const { error } = await supabase.from('auction_settings').upsert(
      {
        org_id: orgId,
        event_slug: AUCTION_EVENT_SLUG,
        morning_closes_at: eventTimeToIso(morning),
        afternoon_closes_at: eventTimeToIso(afternoon),
        intro_text: intro.trim() || null,
        raffle_ticket_price_cents: dollarsToCents(ticketPrice),
        raffle_bundle_qty: bundle_qty,
        raffle_bundle_price_cents: bundle_price,
        raffle_details: raffleDetails.trim() || null,
      },
      { onConflict: 'org_id,event_slug' },
    )
    if (error) {
      setBusy(false)
      setError(errMessage(error))
      return
    }
    if (hasBidding) {
      const step = dollarsToCents(defaultStep)
      const ext = Number.parseInt(extendMin, 10)
      const key = stripeKey.trim()
      if (biddingOn && !key) {
        setBusy(false)
        setError('To switch bidding on, paste the Stripe publishable key (pk_live_… or pk_test_…).')
        return
      }
      if (key && !/^pk_(live|test)_/.test(key)) {
        setBusy(false)
        setError('That is not a Stripe publishable key — it starts with pk_live_ or pk_test_. The secret key (sk_…) never goes here.')
        return
      }
      const { error: rpcError } = await supabase.rpc('auction_save_settings', {
        p_org: orgId,
        p_event: AUCTION_EVENT_SLUG,
        p_patch: {
          bidding_enabled: biddingOn,
          bidding_opens_at: localInputToIso(opensAt) ?? '',
          extend_minutes: Number.isFinite(ext) ? Math.min(60, Math.max(0, ext)) : 5,
          default_increment_cents: step && step > 0 ? step : 500,
          stripe_publishable_key: key,
          bidding_note: biddingNote,
          pickup_note: pickupNote,
          shipping_note: shippingNote,
        },
      })
      if (rpcError) {
        setBusy(false)
        setError(errMessage(rpcError))
        return
      }
    }
    setBusy(false)
    setEditing(false)
    onSaved()
  }

  const morningLabel = formatEventTime(settings?.morning_closes_at)
  const afternoonLabel = formatEventTime(settings?.afternoon_closes_at)
  const priceLabel = rafflePriceLine(settings)

  return (
    <section className="space-y-2.5">
      <SectionLabel>Auction setup</SectionLabel>
      <Card className="space-y-3">
        {editing ? (
          <form onSubmit={save} className="space-y-3">
            <p className="text-xs leading-relaxed text-slate-500">
              Close times are on BunFest day (Oct 25, 2026), Eastern time. Visitors see the session
              names on each item, not these times.
            </p>
            <div className="flex gap-3">
              <label className="block flex-1 text-sm font-semibold text-slate-700">
                Morning closes
                <input className={staffInput} type="time" value={morning} onChange={(e) => setMorning(e.target.value)} />
              </label>
              <label className="block flex-1 text-sm font-semibold text-slate-700">
                Afternoon closes
                <input className={staffInput} type="time" value={afternoon} onChange={(e) => setAfternoon(e.target.value)} />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Intro line (optional)
              <input
                className={staffInput}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="Shown at the top of the public catalog"
              />
            </label>

            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div>
                <p className="font-display text-[15px] font-extrabold text-ink">Raffle tickets</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Shown on the BunFest raffle page. Leave a price blank and the app shows no price
                  at all — nothing is assumed.
                </p>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Ticket price ($ each)
                <input
                  className={staffInput}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Not set"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1 text-sm font-semibold text-slate-700">
                  Bundle quantity
                  <input
                    className={staffInput}
                    type="number"
                    inputMode="numeric"
                    min="2"
                    step="1"
                    placeholder="e.g. 6"
                    value={bundleQty}
                    onChange={(e) => setBundleQty(e.target.value)}
                  />
                </label>
                <label className="block flex-1 text-sm font-semibold text-slate-700">
                  Bundle price ($)
                  <input
                    className={staffInput}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Not set"
                    value={bundlePrice}
                    onChange={(e) => setBundlePrice(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Raffle details (optional)
                <textarea
                  className={staffInput}
                  rows={3}
                  value={raffleDetails}
                  onChange={(e) => setRaffleDetails(e.target.value)}
                  placeholder="Where tickets are sold, drawing time, how winners are notified"
                />
              </label>
            </div>

            {hasBidding && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="font-display text-[15px] font-extrabold text-ink">Online bidding</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    On = people can register, bid and Buy Now in the app and on the website. Off = the catalog is a preview.
                  </p>
                </div>
                <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={biddingOn} onChange={(e) => setBiddingOn(e.target.checked)} />
                  Online bidding is on
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Bidding opens (optional)
                  <input className={staffInput} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Blank = as soon as it’s switched on. Items close at their session’s time above.</span>
                </label>
                <div className="flex gap-3">
                  <label className="block flex-1 text-sm font-semibold text-slate-700">
                    Going once: extend by (minutes)
                    <input className={staffInput} type="number" inputMode="numeric" min="0" max="60" step="1" value={extendMin} onChange={(e) => setExtendMin(e.target.value)} />
                  </label>
                  <label className="block flex-1 text-sm font-semibold text-slate-700">
                    Default bid step ($)
                    <input className={staffInput} type="number" inputMode="decimal" min="0.01" step="0.01" value={defaultStep} onChange={(e) => setDefaultStep(e.target.value)} />
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">A bid in the last N minutes pushes that item’s close N minutes out; 0 turns it off.</p>
                <label className="block text-sm font-semibold text-slate-700">
                  Stripe publishable key
                  <input className={`${staffInput} font-mono text-xs`} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="pk_live_… or pk_test_…" value={stripeKey} onChange={(e) => setStripeKey(e.target.value)} />
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">
                    The <strong>pk_…</strong> key from Stripe → Developers → API keys. It’s safe to be public. The <strong>secret</strong> key (sk_…)
                    never goes here — it goes in Cloudflare, on the website’s payment server.
                  </span>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Bidding note (optional)
                  <textarea className={staffInput} rows={2} value={biddingNote} onChange={(e) => setBiddingNote(e.target.value)} placeholder="Shown at the top of the catalog — e.g. when cards are charged" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Pickup note (optional)
                  <textarea className={staffInput} rows={2} value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} placeholder="Where and when winners collect items" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Shipping note (optional)
                  <textarea className={staffInput} rows={2} value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} placeholder="How soon items ship, what can’t be shipped" />
                </label>
              </div>
            )}

            <FormError>{error}</FormError>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={`${btn.primary} flex-1 disabled:opacity-60`}>
                {busy ? 'Saving…' : 'Save setup'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Morning closes</p>
                <p className="mt-0.5 font-semibold text-ink">{morningLabel ?? 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Afternoon closes</p>
                <p className="mt-0.5 font-semibold text-ink">{afternoonLabel ?? 'Not set'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Intro line</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {settings?.intro_text?.trim() || <span className="text-slate-400">None — the catalog shows items only</span>}
              </p>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Raffle tickets</p>
              <p className="text-sm font-semibold text-ink">
                {priceLabel ?? <span className="font-normal text-slate-400">Price not set — the app shows no price</span>}
              </p>
              <p className="whitespace-pre-line text-sm text-slate-600">
                {settings?.raffle_details?.trim() || <span className="text-slate-400">No details yet</span>}
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                The in-app ticket reservation form is a test feature: it appears on the raffle
                page only while switched on in{' '}
                {canManageSettings ? (
                  <Link to="/staff/features" className="font-bold text-brand-blue hover:text-brand-blue-dark">
                    Settings
                  </Link>
                ) : (
                  <span>Settings (owners and admins)</span>
                )}
                .
              </p>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Online bidding</p>
              {hasBidding ? (
                <>
                  <p className="text-sm font-semibold text-ink">
                    {settings?.bidding_enabled ? (
                      <span className="text-emerald-700">On</span>
                    ) : (
                      <span className="text-slate-500">Off — the catalog is a preview</span>
                    )}
                    {settings?.bidding_opens_at && <> · opens {fmtWhen(settings.bidding_opens_at)}</>}
                  </p>
                  <p className="text-sm text-slate-600">
                    Going once: {settings?.extend_minutes ?? 5} min · default step {money(settings?.default_increment_cents ?? 500)} · Stripe key{' '}
                    {settings?.stripe_publishable_key ? (
                      <span className="font-semibold text-ink">{settings.stripe_publishable_key.startsWith('pk_live_') ? 'live' : 'test'}</span>
                    ) : (
                      <span className="text-amber-800">not set</span>
                    )}
                  </p>
                  {(settings?.bidding_note || settings?.pickup_note || settings?.shipping_note) && (
                    <p className="whitespace-pre-line text-xs text-slate-500">
                      {[settings?.bidding_note, settings?.pickup_note && `Pickup: ${settings.pickup_note}`, settings?.shipping_note && `Shipping: ${settings.shipping_note}`]
                        .filter(Boolean)
                        .join('\n')}
                    </p>
                  )}
                  <PaymentServerStatus />
                </>
              ) : (
                <p className="text-xs leading-relaxed text-slate-500">
                  The online-bidding switch, prices and Stripe key appear here once update 35 (RUN-THIS-IN-SUPABASE.sql) has been
                  run on the database.
                </p>
              )}
            </div>
            <button type="button" onClick={startEdit} className={pill}>
              {settings ? 'Edit setup' : 'Set up'}
            </button>
          </>
        )}
      </Card>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function StaffRaffle() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('events.bunfest.manage')

  const [items, setItems] = useState<AuctionItem[]>([])
  const [settings, setSettings] = useState<AuctionSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // Does the database have update 35 (online bidding)? One tiny probe on load.
  const [hasBidding, setHasBidding] = useState(false)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const [itemsRes, settingsRes, probe] = await Promise.all([
      supabase
        .from('raffle_items')
        .select('*')
        .eq('org_id', orgId)
        .eq('event_slug', AUCTION_EVENT_SLUG)
        .order('sort_order')
        .order('title'),
      supabase
        .from('auction_settings')
        .select('*')
        .eq('org_id', orgId)
        .eq('event_slug', AUCTION_EVENT_SLUG)
        .maybeSingle(),
      supabase.from('auction_settings').select('bidding_enabled').eq('org_id', orgId).limit(1),
    ])
    if (itemsRes.error) {
      setError(errMessage(itemsRes.error))
      setLoading(false)
      return
    }
    setItems(sortForStaff(itemsRes.data ?? []))
    setSettings(settingsRes.data ?? null)
    setHasBidding(!probe.error)
    setLoading(false)
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const create = async (d: Draft) => {
    const { error } = await supabase.from('raffle_items').insert({
      org_id: orgId,
      event_slug: AUCTION_EVENT_SLUG,
      ...draftToRow(d, hasBidding),
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  // Swap with the neighbour, then renumber every row whose position changed so
  // items that shared a sort_order (e.g. all 0) actually move.
  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= items.length) return
    const next = [...items]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    const updates = next
      .map((item, sort_order) => ({ item, sort_order }))
      .filter(({ item, sort_order }) => item.sort_order !== sort_order)
    const results = await Promise.all(
      updates.map(({ item, sort_order }) =>
        supabase.from('raffle_items').update({ sort_order }).eq('id', item.id),
      ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
    await load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Silent Auction</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to manage the Silent Auction. An owner or admin can grant the
            “Manage Midwest BunFest info” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  const nextSortOrder = items.reduce((max, i) => Math.max(max, i.sort_order), -1) + 1
  const availableCount = items.filter((i) => i.status === 'available' && i.is_published).length

  return (
    <Screen className="space-y-5">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Silent Auction</h1>
          <p className="mt-1 text-sm text-slate-600">
            Items appear in the BunFest app while they’re published.{' '}
            {hasBidding ? (
              <>
                Bids, Buy Now and sales run on the{' '}
                <Link to="/staff/auction-desk" className="font-bold text-brand-blue hover:text-brand-blue-dark">
                  Auction desk
                </Link>
                .
              </>
            ) : (
              'Mark items won as the day goes.'
            )}
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${btn.primary} shrink-0 !px-4 !py-2.5`}
          >
            <Icon name="award" size={15} /> Add
          </button>
        )}
      </div>

      {creating && (
        <AddItem
          orgId={orgId}
          nextSortOrder={nextSortOrder}
          hasBidding={hasBidding}
          onCreate={create}
          onCancel={() => setCreating(false)}
        />
      )}

      {!loading && (
        <SetupPanel orgId={orgId} settings={settings} canManageSettings={can('settings.manage')} hasBidding={hasBidding} onSaved={load} />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading items…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No items yet. Tap “Add” to photograph the first one — visitors see it in the BunFest
            app right away.
          </p>
        </Card>
      ) : (
        <section className="space-y-2.5">
          <SectionLabel>
            Items · {items.length} total · {availableCount} available in the app
          </SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            {items.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                orgId={orgId}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                hasBidding={hasBidding}
                onChanged={load}
                onMove={(dir) => move(item.id, dir)}
              />
            ))}
          </div>
        </section>
      )}
    </Screen>
  )
}
