import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'
import { StaffTitle } from '../components/StaffTitle'
import { CardActions, EditorForm, Field, StepButton, pill } from '../components/StaffJob'
import { CheckRow, PartBox, byName, confirmRemove, useCardAction, useSaving } from '../components/ContentEditorBits'
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
  gives_rhdv2: boolean
  rhdv2_note: string
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
  gives_rhdv2: false,
  rhdv2_note: '',
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
    gives_rhdv2: v.gives_rhdv2,
    rhdv2_note: v.rhdv2_note ?? '',
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
    gives_rhdv2: d.gives_rhdv2,
    rhdv2_note: d.gives_rhdv2 ? t(d.rhdv2_note) : null,
    is_published: d.is_published,
  }
}

function VetForm({
  initial,
  title,
  saveLabel,
  onSubmit,
  onCancel,
  onRemove,
}: {
  initial: Draft
  title: string
  saveLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
  onRemove?: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const { busy, error, submit, guard } = useSaving(() => onSubmit(draft))
  const set =
    (k: keyof Draft) =>
    (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))
  const check = (k: 'is_emergency' | 'is_low_cost_spay' | 'gives_rhdv2' | 'is_published') => (v: boolean) =>
    setDraft((d) => ({ ...d, [k]: v }))

  return (
    <EditorForm
      title={title}
      hint="Needed parts are marked. Save puts the clinic in Find a vet right away if it is shown."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      saveLabel={saveLabel}
      canSave={draft.name.trim().length > 0}
      error={error}
      remove={
        onRemove
          ? { label: 'Remove this clinic', confirm: 'Remove this clinic? This can’t be undone.', onRemove: guard(onRemove) }
          : undefined
      }
    >
      <PartBox n="A" title="The clinic" hint="needed">
        <Field label="Practice name" needed>
          <input className={staffInput} required value={draft.name} onChange={set('name')} />
        </Field>
        <Field label="Doctors">
          <input className={staffInput} value={draft.doctors} onChange={set('doctors')} placeholder="Dr. …, Dr. …" />
        </Field>
        <Field label="Street address">
          <input className={staffInput} value={draft.address} onChange={set('address')} />
        </Field>
        <Field label="City, State ZIP">
          <input className={staffInput} value={draft.city} onChange={set('city')} placeholder="Columbus, OH 43214" />
        </Field>
        <Field label="Region" needed>
          <input className={staffInput} list="vet-regions" value={draft.region} onChange={set('region')} />
          <datalist id="vet-regions">
            {VET_REGIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      </PartBox>

      <PartBox n="B" title="Contact and hours" hint="optional">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Phone">
            <input className={staffInput} inputMode="tel" value={draft.phone} onChange={set('phone')} placeholder="614-…" />
          </Field>
          <Field label="Second phone or text">
            <input className={staffInput} value={draft.phone2} onChange={set('phone2')} placeholder="Text 614-…" />
          </Field>
          <Field label="Email">
            <input className={staffInput} type="email" value={draft.email} onChange={set('email')} />
          </Field>
          <Field label="Website">
            <input className={staffInput} value={draft.website} onChange={set('website')} placeholder="https://…" />
          </Field>
        </div>
      </PartBox>

      <PartBox n="C" title="Notes and what they offer" hint="optional">
        <Field label="Notes">
          <input className={staffInput} value={draft.notes} onChange={set('notes')} placeholder="e.g. Open 24/7 for exotics emergencies" />
        </Field>
        <CheckRow label="24/7 or after-hours emergencies" hint="Shows an Emergency badge." checked={draft.is_emergency} onChange={check('is_emergency')} />
        <CheckRow label="Low-cost spay/neuter" hint="Listed in that section." checked={draft.is_low_cost_spay} onChange={check('is_low_cost_spay')} />
        <CheckRow label="Gives the RHDV2 vaccine" hint="BunFest’s rabbit rule points people here." checked={draft.gives_rhdv2} onChange={check('gives_rhdv2')} />
        {draft.gives_rhdv2 && (
          <Field label="How to get it there">
            <input className={staffInput} value={draft.rhdv2_note} onChange={set('rhdv2_note')} placeholder="By appointment — call 614-…" />
          </Field>
        )}
      </PartBox>

      <PartBox n="D" title="Showing" hint="optional">
        <CheckRow label="Show in the app (leave unchecked to keep it as a draft)" checked={draft.is_published} onChange={check('is_published')} />
      </PartBox>
    </EditorForm>
  )
}

function VetCard({ item, onChanged }: { item: VetRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const { busy, error, run } = useCardAction()

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('vets').update(toRow(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = () =>
    run(async () => {
      const { error } = await supabase.from('vets').update({ is_published: !item.is_published }).eq('id', item.id)
      if (error) throw error
      onChanged()
    })

  const doDelete = async () => {
    const { error } = await supabase.from('vets').delete().eq('id', item.id)
    if (error) throw error
    onChanged()
  }

  if (editing) {
    return (
      <VetForm
        initial={draftFrom(item)}
        title={`Edit ${item.name}`}
        saveLabel="Save changes"
        onSubmit={saveEdit}
        onCancel={() => setEditing(false)}
        onRemove={doDelete}
      />
    )
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-base font-extrabold text-ink">{item.name}</h3>
        {item.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="slate">Hidden</Badge>}
      </div>
      {item.doctors && <p className="text-[15px] text-slate-500">{item.doctors}</p>}
      <p className="text-[15px] text-slate-600">{[item.address, item.city].filter(Boolean).join(', ')}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[15px] text-slate-600">
        {item.phone && <span>{item.phone}</span>}
        {item.phone2 && <span>{item.phone2}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="slate">{item.region}</Badge>
        {item.is_emergency && <Badge tone="orange">Emergency</Badge>}
        {item.is_low_cost_spay && <Badge tone="orange">Low-cost spay/neuter</Badge>}
      </div>

      <CardActions className="pt-1">
        <button type="button" onClick={() => setEditing(true)} className={pill.blue}>
          Edit
        </button>
        <button type="button" onClick={() => void togglePublish()} disabled={busy} className={pill.outline}>
          <Icon name={item.is_published ? 'eyeOff' : 'eye'} size={16} /> {item.is_published ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirmRemove(`“${item.name}”`)) void run(doDelete)
          }}
          className={pill.red}
        >
          <Icon name="trash" size={16} /> Remove
        </button>
      </CardActions>
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
  const list = useMemo(
    () => (region === 'All' ? items : items.filter((i) => i.region === region)).slice().sort(byName((v: VetRow) => v.name)),
    [items, region],
  )

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
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to edit the vet directory. An owner or admin can grant the “Edit
            education / care content” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Vet directory">
        <p>The rabbit-savvy vets shown in Find a vet. They are listed A to Z.</p>
      </StaffTitle>

      {!creating && (
        <div>
          <StepButton tone="orange" icon="plus" onClick={() => setCreating(true)}>
            Add a vet
          </StepButton>
        </div>
      )}

      {creating && (
        <VetForm initial={emptyDraft} title="New vet" saveLabel="Add vet" onSubmit={create} onCancel={() => setCreating(false)} />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No vets yet. Load the directory from ohiohouserabbitrescue.org ({seedVets.length} vets), then edit from there
            — or add your own with “Add a vet”.
          </p>
          <StepButton tone="blue" onClick={() => void importSeed()} disabled={importing} className="mx-auto">
            {importing ? 'Importing…' : 'Import the vet directory'}
          </StepButton>
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
