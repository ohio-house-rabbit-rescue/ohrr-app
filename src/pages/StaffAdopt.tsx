import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import type { Database } from '../lib/database.types'

type Rabbit = Database['public']['Tables']['rabbits']['Row']

const STATUSES = ['Available', 'Pending', 'Adopted']
const SEXES = ['', 'Male', 'Female', 'Unknown']
const AGES = ['', 'Baby', 'Young', 'Adult', 'Senior']
const SIZES = ['', 'Small', 'Medium', 'Large']

interface Draft {
  name: string
  status: string
  sex: string
  age: string
  breed: string
  size: string
  spayed_neutered: boolean
  house_trained: boolean
  bonded: boolean
  description: string
  tags: string
  photos: string[]
  is_published: boolean
}

const emptyDraft: Draft = {
  name: '',
  status: 'Available',
  sex: '',
  age: '',
  breed: '',
  size: '',
  spayed_neutered: true,
  house_trained: false,
  bonded: false,
  description: '',
  tags: '',
  photos: [],
  is_published: true,
}

function draftFrom(r: Rabbit): Draft {
  return {
    name: r.name,
    status: r.status,
    sex: r.sex ?? '',
    age: r.age ?? '',
    breed: r.breed ?? '',
    size: r.size ?? '',
    spayed_neutered: r.spayed_neutered,
    house_trained: r.house_trained,
    bonded: r.bonded,
    description: r.description ?? '',
    tags: (r.tags ?? []).join(', '),
    photos: r.photos ?? [],
    is_published: r.is_published,
  }
}

const splitTags = (s: string) =>
  s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

async function uploadPhoto(file: File, userId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('rabbit-photos')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from('rabbit-photos').getPublicUrl(path).data.publicUrl
}

function PhotoUploader({
  photos,
  userId,
  onChange,
}: {
  photos: string[]
  userId: string
  onChange: (next: string[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) urls.push(await uploadPhoto(f, userId))
      onChange([...photos, ...urls])
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <span className="text-sm font-semibold text-slate-700">Photos</span>
      {photos.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p} className="relative">
              <img
                src={p}
                alt={`Photo ${i + 1}`}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
              />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-brand-blue px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange([p, ...photos.filter((x) => x !== p)])}
                  className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-brand-blue shadow"
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x !== p))}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label
        className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-bold text-brand-blue hover:bg-slate-50 ${
          busy ? 'opacity-60' : ''
        }`}
      >
        <Icon name="heart" size={15} />
        {busy ? 'Uploading…' : photos.length ? 'Add more photos' : 'Upload photos'}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      <FormError>{error}</FormError>
    </div>
  )
}

function RabbitForm({
  initial,
  userId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  userId: string
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
  const check =
    (k: keyof Draft) =>
    (e: { target: { checked: boolean } }) =>
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
      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Name
          <input className={staffInput} required value={draft.name} onChange={set('name')} />
        </label>
        <label className="block w-32 text-sm font-semibold text-slate-700">
          Status
          <select className={staffInput} value={draft.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Age
          <select className={staffInput} value={draft.age} onChange={set('age')}>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a || '—'}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Sex
          <select className={staffInput} value={draft.sex} onChange={set('sex')}>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Size
          <select className={staffInput} value={draft.size} onChange={set('size')}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s || '—'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Breed
        <input className={staffInput} value={draft.breed} onChange={set('breed')} />
      </label>

      <PhotoUploader
        photos={draft.photos}
        userId={userId}
        onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
      />

      <label className="block text-sm font-semibold text-slate-700">
        About this rabbit
        <textarea
          className={staffInput}
          rows={4}
          value={draft.description}
          onChange={set('description')}
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Traits (comma-separated)
        <input
          className={staffInput}
          value={draft.tags}
          onChange={set('tags')}
          placeholder="Friendly, Litter-trained, Bonded pair"
        />
      </label>

      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={draft.spayed_neutered} onChange={check('spayed_neutered')} className="h-4 w-4 rounded border-slate-300 text-brand-blue" />
          Spayed / neutered
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={draft.house_trained} onChange={check('house_trained')} className="h-4 w-4 rounded border-slate-300 text-brand-blue" />
          Litter-trained
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={draft.bonded} onChange={check('bonded')} className="h-4 w-4 rounded border-slate-300 text-brand-blue" />
          Bonded pair
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={draft.is_published} onChange={check('is_published')} className="h-4 w-4 rounded border-slate-300 text-brand-blue" />
          Show in the app
        </label>
      </div>

      <FormError>{error}</FormError>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || draft.name.trim().length === 0}
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

function RabbitCard({
  item,
  userId,
  canEdit,
  canStatus,
  onChanged,
}: {
  item: Rabbit
  userId: string
  canEdit: boolean
  canStatus: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toDraftPatch = (d: Draft) => ({
    name: d.name.trim(),
    status: d.status,
    sex: d.sex || null,
    age: d.age || null,
    breed: d.breed.trim() || null,
    size: d.size || null,
    spayed_neutered: d.spayed_neutered,
    house_trained: d.house_trained,
    bonded: d.bonded,
    description: d.description.trim() || null,
    tags: splitTags(d.tags),
    photos: d.photos,
    is_published: d.is_published,
  })

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('rabbits').update(toDraftPatch(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const changeStatus = async (status: string) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('set_rabbit_status', { p_id: item.id, p_status: status })
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('rabbits').delete().eq('id', item.id)
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
        <RabbitForm
          initial={draftFrom(item)}
          userId={userId}
          submitLabel="Save changes"
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  return (
    <Card className="space-y-2">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {item.photos?.[0] ? (
            <img src={item.photos[0]} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Icon name="heart" size={22} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.name}</h3>
            {!item.is_published && <Badge tone="slate">Hidden</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.age && <Badge tone="slate">{item.age}</Badge>}
            {item.sex && <Badge tone="slate">{item.sex}</Badge>}
            {item.breed && <Badge tone="slate">{item.breed}</Badge>}
          </div>
        </div>
      </div>

      {canStatus && (
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Status
          <select
            value={item.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-ink"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      {(canEdit || canStatus) && (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
          {canEdit &&
            (confirmDelete ? (
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
            ))}
        </div>
      )}
      <FormError>{error}</FormError>
    </Card>
  )
}

export default function StaffAdopt() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const canCreate = can('adoptions.listings.create')
  const canEdit = can('adoptions.listings.edit')
  const canStatus = can('adoptions.status.change')
  const allowed = canCreate || canEdit || canStatus

  const [items, setItems] = useState<Rabbit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('rabbits')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order')
      .order('created_at', { ascending: false })
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

  const create = async (d: Draft) => {
    const { error } = await supabase.from('rabbits').insert({
      org_id: orgId,
      name: d.name.trim(),
      status: d.status,
      sex: d.sex || null,
      age: d.age || null,
      breed: d.breed.trim() || null,
      size: d.size || null,
      spayed_neutered: d.spayed_neutered,
      house_trained: d.house_trained,
      bonded: d.bonded,
      description: d.description.trim() || null,
      tags: splitTags(d.tags),
      photos: d.photos,
      is_published: d.is_published,
      sort_order: items.length,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Adoptable rabbits</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to manage adoptable rabbits. An owner or admin can grant the
            Adoptions capabilities.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Adoptable rabbits</h1>
          <p className="mt-1 text-sm text-slate-600">
            These appear on the public Adopt page. Upload photos and set each rabbit’s status.
          </p>
        </div>
        {canCreate && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${btn.primary} shrink-0 !px-4 !py-2.5`}
          >
            <Icon name="heart" size={15} /> Add
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New rabbit</p>
          <RabbitForm
            initial={emptyDraft}
            userId={userId}
            submitLabel="Add rabbit"
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading rabbits…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No rabbits yet.{canCreate ? ' Tap “Add” to post the first adoptable rabbit.' : ''} Until
            you add one, the Adopt page shows the built-in samples.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <RabbitCard
              key={item.id}
              item={item}
              userId={userId}
              canEdit={canEdit}
              canStatus={canStatus}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </Screen>
  )
}
