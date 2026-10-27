import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { StaffTitle, Explain } from '../components/StaffTitle'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { CardActions, EditorForm, Field, Part, StepButton, pill } from '../components/StaffJob'
import { SponsorLogo } from '../features/sponsors/SponsorLogo'
import {
  SURFACES,
  TIERS,
  isTier,
  surfaceLabel,
  tierLabel,
  tierRank,
  type PlacementRow,
  type SponsorRow,
  type SponsorTier,
  type Surface,
} from '../features/sponsors/types'

// Sponsors — Phase 1 staff manager (/staff/sponsors), gated on
// events.bunfest.manage. CRUD for the partner roster (with logo upload) and,
// per sponsor, the "Presented by" placements. Follows StaffAdopt / StaffAnnouncements.

interface Draft {
  name: string
  tier: SponsorTier
  blurb: string
  logo_url: string
  website: string
  perk_title: string
  perk_detail: string
  perk_code: string
  term_start: string // YYYY-MM-DD or ''
  term_end: string // YYYY-MM-DD or ''
  /** Warn this many days before the term ends. */
  remind_days: string
  is_active: boolean
  sort_order: string // '' = append to the end of its tier
}

const emptyDraft: Draft = {
  name: '',
  tier: 'community',
  blurb: '',
  logo_url: '',
  website: '',
  perk_title: '',
  perk_detail: '',
  perk_code: '',
  term_start: '',
  term_end: '',
  remind_days: '21',
  is_active: true,
  sort_order: '',
}

function draftFrom(s: SponsorRow): Draft {
  return {
    name: s.name,
    tier: isTier(s.tier) ? s.tier : 'community',
    blurb: s.blurb ?? '',
    logo_url: s.logo_url ?? '',
    website: s.website ?? '',
    perk_title: s.perk_title ?? '',
    perk_detail: s.perk_detail ?? '',
    perk_code: s.perk_code ?? '',
    term_start: s.term_start ?? '',
    term_end: s.term_end ?? '',
    remind_days: String(s.remind_days ?? 21),
    is_active: s.is_active,
    sort_order: String(s.sort_order),
  }
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function fmtDate(iso: string): string {
  try {
    // Date-only strings parse as UTC; add the time so it shows the same calendar day.
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/* ---- logo upload: downscale to max 800px, then sponsor-logos/<org_id>/<uuid>.<ext> ---- */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image. Try a PNG or JPG.'))
    }
    img.src = url
  })
}

async function downscaleLogo(
  file: File,
  max = 800,
): Promise<{ blob: Blob; ext: 'jpg' | 'png'; type: string }> {
  const img = await loadImage(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('Could not read that image. Try a PNG or JPG.')
  const scale = Math.min(1, max / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not available in this browser.')
  ctx.drawImage(img, 0, 0, cw, ch)
  // Keep transparency for anything that isn't a JPEG (most logos are PNG/SVG).
  const png = file.type !== 'image/jpeg'
  const type = png ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.9))
  if (!blob) throw new Error('Could not process that image.')
  return { blob, ext: png ? 'png' : 'jpg', type }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function uploadLogo(file: File, orgId: string): Promise<string> {
  const { blob, ext, type } = await downscaleLogo(file)
  const path = `${orgId}/${uuid()}.${ext}`
  const { error } = await supabase.storage
    .from('sponsor-logos')
    .upload(path, blob, { contentType: type, upsert: false })
  if (error) throw error
  return supabase.storage.from('sponsor-logos').getPublicUrl(path).data.publicUrl
}

// Best-effort cleanup of a replaced/removed logo that lives in our bucket.
function storagePathOf(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/sponsor-logos\/(.+?)(?:\?.*)?$/)
  return m ? decodeURIComponent(m[1]) : null
}
async function removeLogoObject(url: string) {
  const path = storagePathOf(url)
  if (!path) return
  try {
    await supabase.storage.from('sponsor-logos').remove([path])
  } catch {
    /* best effort */
  }
}

function LogoUploader({
  name,
  logoUrl,
  orgId,
  onChange,
}: {
  name: string
  logoUrl: string
  orgId: string
  onChange: (next: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadLogo(f, orgId)
      if (logoUrl) await removeLogoObject(logoUrl)
      onChange(url)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const old = logoUrl
    onChange('')
    if (old) await removeLogoObject(old)
  }

  return (
    <div>
      <span className="text-sm font-semibold text-slate-700">
        Logo <span className="ml-1.5 text-xs font-semibold text-slate-400">optional</span>
      </span>
      <div className="mt-1.5 flex items-center gap-3">
        <SponsorLogo name={name || 'Sponsor'} logoUrl={logoUrl || undefined} size="md" />
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${pill.soft} cursor-pointer ${busy ? 'opacity-60' : ''}`}>
            <Icon name="award" size={16} />
            {busy ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
          </label>
          {logoUrl && (
            <button type="button" onClick={remove} disabled={busy} className={pill.red}>
              Remove logo
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        The real brand logo (PNG or JPG). It’s resized to 800px max.
      </p>
      <FormError>{error}</FormError>
    </div>
  )
}

/* ---- sponsor form ---- */

function SponsorForm({
  heading,
  initial,
  orgId,
  saveLabel,
  onSubmit,
  onCancel,
  onRemove,
}: {
  heading: string
  initial: Draft
  orgId: string
  saveLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
  onRemove?: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set =
    (k: keyof Draft) =>
    (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={heading}
      hint="Only the name is needed. Everything else can be filled in later."
      onSubmit={() => run(() => onSubmit(draft))}
      onCancel={onCancel}
      busy={busy}
      saveLabel={saveLabel}
      canSave={draft.name.trim().length > 0}
      error={error}
      remove={
        onRemove
          ? { label: 'Remove', confirm: `Remove ${initial.name || 'this partner'}? This can’t be undone.`, onRemove: () => run(onRemove) }
          : undefined
      }
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">
          Who
        </Part>
        <Field label="Name" needed>
          <input
            className={staffInput}
            required
            value={draft.name}
            onChange={set('name')}
            placeholder="Business or organization"
          />
        </Field>
        <Field label="Tier" needed>
          <select
            className={staffInput}
            value={draft.tier}
            onChange={(e) => setDraft((d) => ({ ...d, tier: e.target.value as SponsorTier }))}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {tierLabel(t)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">
          Logo and words
        </Part>
        <LogoUploader
          name={draft.name}
          logoUrl={draft.logo_url}
          orgId={orgId}
          onChange={(logo_url) => setDraft((d) => ({ ...d, logo_url }))}
        />
        <Field label="Blurb">
          <textarea
            className={staffInput}
            rows={2}
            value={draft.blurb}
            onChange={set('blurb')}
            placeholder="One or two sentences about this partner"
          />
        </Field>
        <Field label="Website">
          <input
            className={staffInput}
            type="url"
            inputMode="url"
            value={draft.website}
            onChange={set('website')}
            placeholder="https://"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">
          Partner perk
        </Part>
        <Field label="Perk title">
          <input
            className={staffInput}
            value={draft.perk_title}
            onChange={set('perk_title')}
            placeholder="e.g. 10% off for OHRR adopters"
          />
        </Field>
        <Field label="Perk details">
          <textarea
            className={staffInput}
            rows={2}
            value={draft.perk_detail}
            onChange={set('perk_detail')}
            placeholder="How to redeem, any limits or dates"
          />
        </Field>
        <Field label="Code" hint="Revealed when someone taps “Show code.”">
          <input
            className={staffInput}
            value={draft.perk_code}
            onChange={set('perk_code')}
            placeholder="e.g. OHRR2026"
            autoCapitalize="characters"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="D" hint="optional">
          How long
        </Part>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Term start">
            <input className={staffInput} type="date" value={draft.term_start} onChange={set('term_start')} />
          </Field>
          <Field label="Term end">
            <input className={staffInput} type="date" value={draft.term_end} onChange={set('term_end')} />
          </Field>
        </div>
        {draft.term_end && (
          <Field label="Remind us this many days before it ends">
            <input
              className={staffInput}
              inputMode="numeric"
              value={draft.remind_days}
              onChange={(e) => setDraft((d) => ({ ...d, remind_days: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="21"
            />
          </Field>
        )}
        <Explain label="What the term does">
          <p>
            After the term end date the partner is hidden from the public automatically — and the staff dashboard
            warns you before that happens, so a renewal can be asked for in time.
          </p>
        </Explain>
      </div>

      <div className="space-y-3">
        <Part n="E" hint="optional">
          Showing
        </Part>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-6 w-6 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
            checked={draft.is_active}
            onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
          />
          Show in the app
        </label>
        <Field label="Sort order" hint="Or leave it blank and use Move up and Move down on the list.">
          <input
            className={staffInput}
            type="number"
            inputMode="numeric"
            value={draft.sort_order}
            onChange={set('sort_order')}
            placeholder="auto"
          />
        </Field>
      </div>
    </EditorForm>
  )
}

function draftToPatch(d: Draft) {
  const n = parseInt(d.sort_order, 10)
  return {
    name: d.name.trim(),
    tier: d.tier,
    blurb: d.blurb.trim() || null,
    logo_url: d.logo_url.trim() || null,
    website: d.website.trim() || null,
    remind_days: Math.min(180, Math.max(0, Number(d.remind_days) || 21)),
    perk_title: d.perk_title.trim() || null,
    perk_detail: d.perk_detail.trim() || null,
    perk_code: d.perk_code.trim() || null,
    term_start: d.term_start || null,
    term_end: d.term_end || null,
    is_active: d.is_active,
    ...(Number.isFinite(n) ? { sort_order: n } : {}),
  }
}

/* ---- placements sub-editor ---- */

const pad = (n: number) => String(n).padStart(2, '0')
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function windowText(p: PlacementRow): string {
  if (p.starts_at && p.ends_at) return `${fmtDateTime(p.starts_at)} – ${fmtDateTime(p.ends_at)}`
  if (p.starts_at) return `From ${fmtDateTime(p.starts_at)}`
  if (p.ends_at) return `Until ${fmtDateTime(p.ends_at)}`
  return 'Always (while active)'
}

function PlacementsEditor({ sponsor, orgId }: { sponsor: SponsorRow; orgId: string }) {
  const [items, setItems] = useState<PlacementRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [surface, setSurface] = useState<Surface>('home')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('sponsor_placements')
      .select('*')
      .eq('sponsor_id', sponsor.id)
      .order('created_at')
    if (error) {
      setError(errMessage(error))
      setItems([])
      return
    }
    setItems(data ?? [])
  }, [sponsor.id])

  useEffect(() => {
    load()
  }, [load])

  // Pre-select the first surface this sponsor isn't on yet.
  useEffect(() => {
    if (!items) return
    const used = new Set(items.map((p) => p.surface))
    const free = SURFACES.find((s) => !used.has(s.value))
    if (free && used.has(surface)) setSurface(free.value)
  }, [items, surface])

  const add = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('sponsor_placements').insert({
      org_id: orgId,
      sponsor_id: sponsor.id,
      surface,
      starts_at: fromLocalInput(startsAt),
      ends_at: fromLocalInput(endsAt),
      is_active: true,
    })
    setBusy(false)
    if (error) {
      setError(errMessage(error))
      return
    }
    setStartsAt('')
    setEndsAt('')
    await load()
  }

  const toggle = async (p: PlacementRow) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('sponsor_placements')
      .update({ is_active: !p.is_active })
      .eq('id', p.id)
    setBusy(false)
    if (error) setError(errMessage(error))
    else await load()
  }

  const remove = async (p: PlacementRow) => {
    if (!window.confirm(`Remove the ${surfaceLabel(p.surface)} placement?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('sponsor_placements').delete().eq('id', p.id)
    setBusy(false)
    if (error) setError(errMessage(error))
    else await load()
  }

  return (
    <div className="mt-1 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="font-display text-base font-black text-ink">“Presented by” placements</p>
      <p className="text-sm leading-relaxed text-slate-600">
        Each placement shows a small “Presented by {sponsor.name}” strip on that screen — always,
        or only inside a date window.
      </p>

      {items === null ? (
        <p className="text-sm font-semibold text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No placements yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-base font-bold text-ink">{surfaceLabel(p.surface)}</span>
                  {p.is_active ? <Badge tone="blue">On</Badge> : <Badge tone="slate">Off</Badge>}
                </div>
                <p className="text-sm text-slate-600">{windowText(p)}</p>
              </div>
              <CardActions>
                <button type="button" onClick={() => toggle(p)} disabled={busy} className={pill.outline}>
                  {p.is_active ? 'Turn off' : 'Turn on'}
                </button>
                <button type="button" onClick={() => remove(p)} disabled={busy} className={pill.red}>
                  Remove
                </button>
              </CardActions>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="space-y-3 border-t border-slate-200 pt-3">
        <Part n="A" hint="needed">
          Add a placement
        </Part>
        <Field label="Add to screen" needed>
          <select
            className={staffInput}
            value={surface}
            onChange={(e) => setSurface(e.target.value as Surface)}
          >
            {SURFACES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Starts">
            <input
              className={staffInput}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <input
              className={staffInput}
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
        </div>
        <button type="submit" disabled={busy} className={pill.blue}>
          {busy ? 'Saving…' : 'Add placement'}
        </button>
      </form>
      <FormError>{error}</FormError>
    </div>
  )
}

/* ---- sponsor card (list item) ---- */

function SponsorCard({
  item,
  orgId,
  canMoveUp,
  canMoveDown,
  onMove,
  onChanged,
}: {
  item: SponsorRow
  orgId: string
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (dir: -1 | 1) => Promise<void>
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [placementsOpen, setPlacementsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expired = Boolean(item.term_end && item.term_end < todayIso())

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('sponsors').update(draftToPatch(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const toggleActive = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('sponsors')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
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

  const doDelete = async () => {
    const { error } = await supabase.from('sponsors').delete().eq('id', item.id)
    if (error) throw error
    if (item.logo_url) await removeLogoObject(item.logo_url)
    onChanged()
  }

  const confirmDelete = async () => {
    if (!window.confirm(`Remove ${item.name}? This can’t be undone.`)) return
    setBusy(true)
    setError(null)
    try {
      await doDelete()
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <SponsorForm
        heading="Edit this partner"
        initial={draftFrom(item)}
        orgId={orgId}
        saveLabel="Save"
        onSubmit={saveEdit}
        onCancel={() => setEditing(false)}
        onRemove={doDelete}
      />
    )
  }

  const term =
    item.term_start && item.term_end
      ? `${fmtDate(item.term_start)} – ${fmtDate(item.term_end)}`
      : item.term_end
        ? `Until ${fmtDate(item.term_end)}`
        : item.term_start
          ? `From ${fmtDate(item.term_start)}`
          : null

  return (
    <Card className="space-y-3">
      <div className="flex gap-3">
        <SponsorLogo name={item.name} logoUrl={item.logo_url ?? undefined} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-extrabold text-ink">{item.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={item.tier === 'presenting' ? 'orange' : 'blue'}>{tierLabel(item.tier)}</Badge>
            {!item.is_active && <Badge tone="slate">Hidden</Badge>}
            {expired && <Badge tone="slate">Term ended</Badge>}
            {item.perk_title && <Badge tone="orange">Perk</Badge>}
          </div>
          {term && <p className="mt-1 text-sm text-slate-600">{term}</p>}
          {item.website && <p className="mt-0.5 truncate text-sm text-slate-500">{item.website}</p>}
        </div>
      </div>

      <CardActions>
        <button type="button" onClick={() => setEditing(true)} className={pill.blue}>
          Edit
        </button>
        <button
          type="button"
          onClick={() => setPlacementsOpen((o) => !o)}
          aria-expanded={placementsOpen}
          className={placementsOpen ? pill.soft : pill.outline}
        >
          Placements
        </button>
        <button type="button" onClick={toggleActive} disabled={busy} className={pill.outline}>
          {item.is_active ? 'Hide' : 'Show'}
        </button>
        <button type="button" onClick={() => move(-1)} disabled={busy || !canMoveUp} className={pill.outline}>
          Move up
        </button>
        <button type="button" onClick={() => move(1)} disabled={busy || !canMoveDown} className={pill.outline}>
          Move down
        </button>
        <button type="button" onClick={confirmDelete} disabled={busy} className={pill.red}>
          Remove
        </button>
      </CardActions>

      {placementsOpen && <PlacementsEditor sponsor={item} orgId={orgId} />}
      <FormError>{error}</FormError>
    </Card>
  )
}

/* ---- screen ---- */

const sortRows = (rows: SponsorRow[]) =>
  [...rows].sort(
    (a, b) =>
      tierRank(a.tier) - tierRank(b.tier) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  )

export default function StaffSponsors() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('events.bunfest.manage')

  const [items, setItems] = useState<SponsorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase.from('sponsors').select('*').eq('org_id', orgId)
    if (error) {
      setError(errMessage(error))
      setLoading(false)
      return
    }
    setItems(sortRows(data ?? []))
    setLoading(false)
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const create = async (d: Draft) => {
    const patch = draftToPatch(d)
    const { error } = await supabase.from('sponsors').insert({
      org_id: orgId,
      ...patch,
      sort_order: patch.sort_order ?? items.filter((s) => s.tier === d.tier).length,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  // Reorder within a tier: swap with the neighbor, then renumber that tier 0..n.
  const move = async (item: SponsorRow, dir: -1 | 1) => {
    const group = items.filter((s) => s.tier === item.tier)
    const i = group.findIndex((s) => s.id === item.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= group.length) return
    const next = [...group]
    ;[next[i], next[j]] = [next[j], next[i]]
    const updates = next
      .map((s, idx) => ({ id: s.id, sort_order: idx, was: s.sort_order }))
      .filter((u) => u.sort_order !== u.was)
    const results = await Promise.all(
      updates.map((u) =>
        supabase.from('sponsors').update({ sort_order: u.sort_order }).eq('id', u.id),
      ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
    await load()
  }

  const groups = TIERS.map((tier) => ({
    tier,
    rows: items.filter((s) => s.tier === tier),
  })).filter((g) => g.rows.length > 0)

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Sponsors & partners</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to manage sponsors. An owner or admin can grant the “Manage
            Midwest BunFest info” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Sponsors & partners">
        <p>The roster on the public Our Partners page, partner perks, and “Presented by” strips.</p>
        <p>Partners are listed by tier. Move up and Move down change the order inside a tier. To remove a partner for good, tap Remove.</p>
      </StaffTitle>

      {!creating && (
        <div className="flex flex-wrap items-center gap-2">
          <StepButton tone="orange" icon="plus" onClick={() => setCreating(true)}>
            New sponsor
          </StepButton>
          <StepButton to="/staff/sponsors/renewals" icon="calendar">
            Renewals list
          </StepButton>
        </div>
      )}

      {creating && (
        <SponsorForm
          heading="New sponsor"
          initial={emptyDraft}
          orgId={orgId}
          saveLabel="Add sponsor"
          onSubmit={create}
          onCancel={() => setCreating(false)}
        />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading sponsors…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No sponsors yet. Tap “New sponsor” to list the first partner — until then the public page says
            partners will be announced.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.tier} className="space-y-2.5">
              <h2 className="font-display text-lg font-extrabold text-ink">{tierLabel(g.tier)}s</h2>
              <div className="grid grid-cols-1 gap-3">
                {g.rows.map((item, idx) => (
                  <SponsorCard
                    key={item.id}
                    item={item}
                    orgId={orgId}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < g.rows.length - 1}
                    onMove={(dir) => move(item, dir)}
                    onChanged={load}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}
