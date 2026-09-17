import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import type { VetRow } from '../lib/vets'
import { seedVets, VET_REGIONS } from '../data/vets'

interface Draft {
  name: string
  doctors: string
  address: string
  city: string
  region: string
  phone: string
  phone2: string
  email: string
  website: string
  notes: string
  is_emergency: boolean
  is_low_cost_spay: boolean
  is_published: boolean
}

const emptyDraft: Draft = {
  name: '',
  doctors: '',
  address: '',
  city: '',
  region: 'Central Ohio',
  phone: '',
  phone2: '',
  email: '',
  website: '',
  notes: '',
  is_emergency: false,
  is_low_cost_spay: false,
  is_published: true,
}

function draftFrom(v: VetRow): Draft {
  return {
    name: v.name,
    doctors: v.doctors ?? '',
    address: v.address ?? '',
    city: v.city ?? '',
    region: v.region,
    phone: v.phone ?? '',
    phone2: v.phone2 ?? '',
    email: v.email ?? '',
    website: v.website ?? '',
    notes: v.notes ?? '',
    is_emergency: v.is_emergency,
    is_low_cost_spay: v.is_low_cost_spay,
    is_published: v.is_published,
  }
}

function toRow(d: Draft) {
  const t = (s: string) => s.trim() || null
  return {
    name: d.name.trim(),
    doctors: t(d.doctors),
    address: t(d.address),
    city: t(d.city),
    region: d.region.trim() || 'Central Ohio',
    phone: t(d.phone),
    phone2: t(d.phone2),
    email: t(d.email),
    website: t(d.website),
    notes: t(d.notes),
    is_emergency: d.is_emergency,
    is_low_cost_spay: d.is_low_cost_spay,
    is_published: d.is_published,
  }
}

function VetForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft
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
  const check = (k: 'is_emergency' | 'is_low_cost_spay' | 'is_published') => (e: { target: { checked: boolean } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.checked }))

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
      <label className="block text-sm font-semibold text-slate-700">
        Practice name
        <input className={staffInput} required value={draft.name} onChange={set('name')} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Doctors
        <input className={staffInput} value={draft.doctors} onChange={set('doctors')} placeholder="Dr. …, Dr. …" />
      </label>
      <div className="flex gap-3">
        <label className="block flex-[2] text-sm font-semibold text-slate-700">
          Street address
          <input className={staffInput} value={draft.address} onChange={set('address')} />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          City, State ZIP
          <input className={staffInput} value={draft.city} onChange={set('city')} placeholder="Columbus, OH 43214" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Region
        <input className={staffInput} list="vet-regions" value={draft.region} onChange={set('region')} />
        <datalist id="vet-regions">
          {VET_REGIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Phone
          <input className={staffInput} value={draft.phone} onChange={set('phone')} placeholder="614-…" />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Second phone / text
          <input className={staffInput} value={draft.phone2} onChange={set('phone2')} placeholder="Text 614-…" />
        </label>
      </div>
      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Email
          <input className={staffInput} type="email" value={draft.email} onChange={set('email')} />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Website
          <input className={staffInput} value={draft.website} onChange={set('website')} placeholder="https://…" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Notes
        <input className={staffInput} value={draft.notes} onChange={set('notes')} placeholder="e.g. Open 24/7 for exotics emergencies" />
      </label>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={draft.is_emergency} onChange={check('is_emergency')} />
          24/7 / after-hours emergencies (shows an EMERGENCY badge)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={draft.is_low_cost_spay} onChange={check('is_low_cost_spay')} />
          Low-cost spay/neuter (listed in that section)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={draft.is_published} onChange={check('is_published')} />
          Show in the app (uncheck for a draft)
        </label>
      </div>

      <FormError>{error}</FormError>

      <div className="flex gap-2">
        <button type="submit" disabled={busy || draft.name.trim().length === 0} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

function VetCard({ item, onChanged }: { item: VetRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('vets').update(toRow(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = async () => {
    setBusy(true)
    const { error } = await supabase.from('vets').update({ is_published: !item.is_published }).eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('vets').delete().eq('id', item.id)
    if (error) {
      setError(errMessage(error))
      setBusy(false)
      setConfirmDelete(false)
      return
    }
    onChanged()
  }

  if (editing) {
    return (
      <Card>
        <VetForm initial={draftFrom(item)} submitLabel="Save changes" onSubmit={saveEdit} onCancel={() => setEditing(false)} />
      </Card>
    )
  }

  return (
    <Card className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.name}</h3>
        {item.is_published ? <Badge tone="blue">Live</Badge> : <Badge tone="slate">Draft</Badge>}
      </div>
      {item.doctors && <p className="text-sm text-slate-500">{item.doctors}</p>}
      <p className="text-sm text-slate-600">{[item.address, item.city].filter(Boolean).join(', ')}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
        {item.phone && <span>{item.phone}</span>}
        {item.phone2 && <span>{item.phone2}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="slate">{item.region}</Badge>
        {item.is_emergency && <Badge tone="orange">Emergency</Badge>}
        {item.is_low_cost_spay && <Badge tone="orange">Low-cost spay/neuter</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={togglePublish} disabled={busy} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {item.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
          Edit
        </button>
        {confirmDelete ? (
          <>
            <button type="button" onClick={doDelete} disabled={busy} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
              {busy ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
            Delete
          </button>
        )}
      </div>
      <FormError>{error}</FormError>
    </Card>
  )
}

export default function StaffVets() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('content.education.edit')

  const [items, setItems] = useState<VetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [region, setRegion] = useState<string>('All')

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('vets')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order')
      .order('created_at')
    if (error) {
      setError(errMessage(error))
      setLoading(false)
      return
    }
    setItems(data ?? [])
    setLoading(false)
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const regions = useMemo(() => {
    const present = [...new Set(items.map((i) => i.region))]
    return ['All', ...present]
  }, [items])
  const list = region === 'All' ? items : items.filter((i) => i.region === region)

  const create = async (d: Draft) => {
    const { error } = await supabase.from('vets').insert({
      org_id: orgId,
      ...toRow(d),
      sort_order: items.length,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  // One tap to load the directory from ohiohouserabbitrescue.org (same rows as the SQL seed).
  const importSeed = async () => {
    setImporting(true)
    setError(null)
    const rows = seedVets.map((v, i) => ({
      org_id: orgId,
      name: v.name,
      doctors: v.doctors ?? null,
      address: v.address ?? null,
      city: v.city ?? null,
      region: v.region,
      phone: v.phone ?? null,
      phone2: v.phone2 ?? null,
      email: v.email ?? null,
      website: v.website ?? null,
      notes: v.notes ?? null,
      is_emergency: v.isEmergency,
      is_low_cost_spay: v.isLowCostSpay,
      is_published: true,
      sort_order: i,
      created_by: userId,
    }))
    const { error } = await supabase.from('vets').insert(rows)
    if (error) setError(errMessage(error))
    setImporting(false)
    if (!error) await load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Vet directory</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to edit the vet directory. An owner or admin can grant the “Edit
            education / care content” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Vet directory</h1>
          <p className="mt-1 text-sm text-slate-600">The rabbit-savvy vets shown in Find a vet.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className={`${btn.primary} shrink-0 !px-4 !py-2.5`}>
            <Icon name="phone" size={15} /> New
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New vet</p>
          <VetForm initial={emptyDraft} submitLabel="Add vet" onSubmit={create} onCancel={() => setCreating(false)} />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No vets yet. Load the directory from ohiohouserabbitrescue.org ({seedVets.length} vets),
            then edit from there — or add your own with “New”.
          </p>
          <button type="button" onClick={importSeed} disabled={importing} className={`${btn.blue} mx-auto disabled:opacity-60`}>
            {importing ? 'Importing…' : 'Import the vet directory'}
          </button>
        </Card>
      ) : (
        <>
          {regions.length > 2 && <SegTabs options={regions} value={region} onChange={setRegion} wrap />}
          <div className="grid grid-cols-1 gap-3">
            {list.map((item) => (
              <VetCard key={item.id} item={item} onChanged={load} />
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}
