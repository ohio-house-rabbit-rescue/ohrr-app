// Staff manager for the Midwest BunFest Silent Auction (route /staff/raffle;
// gated on events.bunfest.manage — the DB enforces it too). Phone-first: adding
// an item starts with the camera, then the details. The "Auction setup" panel
// holds the two session close times, an optional intro line, and the raffle
// ticket pricing + details (the public raffle page shows those only when staff
// have entered them; the ticket form itself is a test feature switched on in
// /staff/settings). The public catalog shows the intro line only, never the times.
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
  }
}

function draftToRow(d: Draft) {
  const sort = Number.parseInt(d.sort_order, 10)
  return {
    title: d.title.trim(),
    description: d.description.trim() || null,
    donated_by: d.donated_by.trim() || null,
    value_cents: dollarsToCents(d.value),
    session: d.session,
    is_published: d.is_published,
    sort_order: Number.isFinite(sort) ? sort : 0,
    photo_url: d.photo_url,
  }
}

function ItemForm({
  initial,
  orgId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  orgId: string
  submitLabel: string
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
  onCreate,
  onCancel,
}: {
  orgId: string
  nextSortOrder: number
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
  onChanged,
  onMove,
}: {
  item: AuctionItem
  orgId: string
  isFirst: boolean
  isLast: boolean
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
    const { error } = await supabase.from('raffle_items').update(draftToRow(d)).eq('id', item.id)
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
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  const won = item.status === 'won'
  const value = formatValue(item.value_cents)

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
            {won ? <Badge tone="orange">Won</Badge> : <Badge tone="blue">Available</Badge>}
            {!item.is_published && <Badge tone="slate">Hidden</Badge>}
            <Badge tone="slate">{sessionLabel(item.session)}</Badge>
          </div>
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
        {won ? (
          <button type="button" disabled={busy} onClick={() => patch({ status: 'available' })} className={pill}>
            Back to available
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'won' })}
            className="rounded-full bg-brand-orange px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-orange-dark disabled:opacity-60"
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

function SetupPanel({
  orgId,
  settings,
  canManageSettings,
  onSaved,
}: {
  orgId: string
  settings: AuctionSettings | null
  canManageSettings: boolean
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
    setBusy(false)
    if (error) {
      setError(errMessage(error))
      return
    }
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
                  <Link to="/staff/settings" className="font-bold text-brand-blue hover:text-brand-blue-dark">
                    Settings
                  </Link>
                ) : (
                  <span>Settings (owners and admins)</span>
                )}
                .
              </p>
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

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const [itemsRes, settingsRes] = await Promise.all([
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
    ])
    if (itemsRes.error) {
      setError(errMessage(itemsRes.error))
      setLoading(false)
      return
    }
    setItems(sortForStaff(itemsRes.data ?? []))
    setSettings(settingsRes.data ?? null)
    setLoading(false)
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const create = async (d: Draft) => {
    const { error } = await supabase.from('raffle_items').insert({
      org_id: orgId,
      event_slug: AUCTION_EVENT_SLUG,
      ...draftToRow(d),
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
            Items appear in the BunFest app while they’re published. Mark items won as the day goes.
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
          onCreate={create}
          onCancel={() => setCreating(false)}
        />
      )}

      {!loading && (
        <SetupPanel orgId={orgId} settings={settings} canManageSettings={can('settings.manage')} onSaved={load} />
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
