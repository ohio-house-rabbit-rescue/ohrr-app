import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { StaffTitle } from '../components/StaffTitle'
import { CardActions, EditorForm, Field, Needed, Optional, StepButton, pill } from '../components/StaffJob'
import { CheckRow, PartBox, byName, confirmRemove, useCardAction, useSaving } from '../components/ContentEditorBits'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { isNative } from '../native/platform'
import { pickPhoto } from '../native/camera'
import type { Database, Json } from '../lib/database.types'
import BreedInput from '../components/BreedInput'

type Rabbit = Database['public']['Tables']['rabbits']['Row']
type JobRun = Pick<Database['public']['Tables']['job_runs']['Row'], 'finished_at' | 'ok' | 'detail'>

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

/* ------------------------------------------- the RescueGroups check */
// Update 32: every morning (and on "Check RescueGroups now") the ohrr-jobs
// function reads OHRR's RescueGroups listing. New rabbits are added; one no
// longer listed is hidden (auto_hidden) — never marked adopted, staff decide —
// and shown again by itself if it comes back. Each check leaves a job_runs row.

/** What the last check said. */
interface RabbitCheck {
  at: string
  ok: boolean
  listed: number | null
  added: string[]
  back: string[]
  hidden: string[]
  error: string | null
}

function readCheck(r: JobRun): RabbitCheck {
  const d = r.detail && typeof r.detail === 'object' && !Array.isArray(r.detail) ? r.detail : {}
  const names = (v: Json | undefined) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    at: r.finished_at,
    ok: r.ok,
    listed: typeof d.listed === 'number' ? d.listed : null,
    added: names(d.added),
    back: names(d.back),
    hidden: names(d.hidden),
    error: typeof d.error === 'string' ? d.error : null,
  }
}

/** PostgREST: the table or function isn't there (update 32 not run yet). */
function update32Missing(e: { code?: string; message?: string }) {
  return (
    e.code === 'PGRST205' ||
    e.code === 'PGRST202' ||
    e.code === '42P01' ||
    /schema cache|does not exist|could not find the (table|function)/i.test(e.message ?? '')
  )
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** "today 7:15 AM", "yesterday 7:15 AM", "Mon, Sep 21 7:15 AM". */
function checkedWhen(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return `today ${time}`
  if (sameDay(d, yesterday)) return `yesterday ${time}`
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`
}

/** "Sep 24, 2026" */
const usDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function checkSummary(c: RabbitCheck): string {
  if (!c.ok) return `The RescueGroups check ${checkedWhen(c.at)} didn’t work${c.error ? `: ${c.error}` : ''}. Nothing was changed.`
  const parts = [`${c.listed ?? '?'} listed`]
  if (c.added.length) parts.push(`added ${c.added.join(', ')}`)
  if (c.back.length) parts.push(`back ${c.back.join(', ')}`)
  if (c.hidden.length) parts.push(`hidden ${c.hidden.join(', ')}`)
  if (parts.length === 1) parts.push('no changes')
  return `Checked RescueGroups ${checkedWhen(c.at)}: ${parts.join(' · ')}`
}

/**
 * The line at the top of the list: when RescueGroups was last checked and what
 * changed, and "Check RescueGroups now" (the check runs in the background, so
 * it looks again after about 20 seconds).
 */
function RescueGroupsCheck({ orgId, canRefresh, onRefreshed }: { orgId: string; canRefresh: boolean; onRefreshed: () => void }) {
  const [check, setCheck] = useState<RabbitCheck | null | 'missing' | 'loading'>('loading')
  const [phase, setPhase] = useState<'idle' | 'asking' | 'waiting' | 'late'>('idle')
  const [error, setError] = useState<string | null>(null)
  const askedAt = useRef(0)

  const load = useCallback(async (): Promise<RabbitCheck | null> => {
    const { data, error } = await supabase
      .from('job_runs')
      .select('finished_at, ok, detail')
      .eq('job', 'rabbits')
      .order('finished_at', { ascending: false })
      .limit(1)
    if (error) {
      setCheck(update32Missing(error) ? 'missing' : null)
      return null
    }
    const c = data?.[0] ? readCheck(data[0]) : null
    setCheck(c)
    return c
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const lookAgain = useCallback(async () => {
    const c = await load()
    onRefreshed()
    setPhase(c && new Date(c.at).getTime() >= askedAt.current ? 'idle' : 'late')
  }, [load, onRefreshed])

  // After asking: look again in about 20 seconds.
  useEffect(() => {
    if (phase !== 'waiting') return
    const t = setTimeout(() => void lookAgain(), 20_000)
    return () => clearTimeout(t)
  }, [phase, lookAgain])

  const ask = async () => {
    setError(null)
    setPhase('asking')
    const { error } = await supabase.rpc('request_rabbit_refresh', { p_org: orgId })
    if (error) {
      if (update32Missing(error)) setCheck('missing')
      else setError(errMessage(error))
      setPhase('idle')
      return
    }
    // A few seconds' grace between the phone's clock and the database's.
    askedAt.current = Date.now() - 5_000
    setPhase('waiting')
  }

  if (check === 'loading') return null
  if (check === 'missing')
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-[15px] leading-relaxed text-slate-600">
        Keeping this list up to date from RescueGroups every morning isn’t switched on yet — ask an admin.
      </p>
    )

  return (
    <Card className="space-y-2 !py-3">
      <p className="text-[15px] leading-relaxed text-slate-700">
        {check ? checkSummary(check) : 'RescueGroups hasn’t been checked yet.'}{' '}
        <span className="text-slate-500">It’s checked every morning.</span>
      </p>
      {phase === 'waiting' && (
        <p className="text-[15px] font-semibold text-brand-blue">Checking RescueGroups — this takes about 20 seconds…</p>
      )}
      {phase === 'late' && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] text-slate-600">Not finished yet.</p>
          <button type="button" onClick={() => void lookAgain()} className={pill.outline}>
            Check again
          </button>
        </div>
      )}
      <FormError>{error}</FormError>
      {canRefresh && phase !== 'waiting' && (
        <button type="button" disabled={phase === 'asking'} onClick={() => void ask()} className={pill.outline}>
          {phase === 'asking' ? 'Asking…' : 'Check RescueGroups now'}
        </button>
      )}
    </Card>
  )
}

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
  needed,
}: {
  photos: string[]
  userId: string
  onChange: (next: string[]) => void
  /** A new rabbit needs at least one photo; an existing one may not have any. */
  needed: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inside the app, "Take a photo" opens the camera itself — a plain file
  // input opens a file browser on Android, which is no use standing in front
  // of a rabbit.
  const takePhoto = async () => {
    setError(null)
    try {
      const dataUrl = await pickPhoto('camera')
      if (!dataUrl) return
      setBusy(true)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `rabbit-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onChange([...photos, await uploadPhoto(file, userId)])
    } catch (e) {
      setError(e instanceof Error ? e.message : errMessage(e))
    } finally {
      setBusy(false)
    }
  }

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
      <p className="text-sm font-semibold text-slate-700">
        Photos
        {needed ? <Needed /> : <Optional />}
      </p>
      <p className="text-sm text-slate-500">The first photo is the one on the card.</p>
      {photos.length > 0 && (
        <ul className="mt-2 space-y-2">
          {photos.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
              <img src={p} alt={`Photo ${i + 1}`} className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
              <div className="flex flex-wrap items-center gap-2">
                {i === 0 ? (
                  <Badge tone="blue">Cover photo</Badge>
                ) : (
                  <button type="button" onClick={() => onChange([p, ...photos.filter((x) => x !== p)])} className={pill.soft}>
                    Make cover
                  </button>
                )}
                <button type="button" onClick={() => onChange(photos.filter((x) => x !== p))} className={pill.red}>
                  <Icon name="trash" size={16} /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isNative && (
          <button type="button" onClick={() => void takePhoto()} disabled={busy} className={pill.blue}>
            <Icon name="camera" size={17} /> {busy ? 'Uploading…' : 'Take a photo'}
          </button>
        )}
        <label className={`${pill.outline} cursor-pointer ${busy ? 'opacity-60' : ''}`}>
          <Icon name="camera" size={17} />
          {busy && !isNative ? 'Uploading…' : photos.length ? 'Add from photos' : isNative ? 'Choose from photos' : 'Upload photos'}
          <input type="file" accept="image/*" multiple disabled={busy} className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </label>
      </div>
      <FormError>{error}</FormError>
    </div>
  )
}

function RabbitForm({
  initial,
  userId,
  title,
  saveLabel,
  isNew,
  onSubmit,
  onCancel,
  onRemove,
}: {
  initial: Draft
  userId: string
  title: string
  saveLabel: string
  isNew: boolean
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
  const check = (k: keyof Draft) => (v: boolean) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <EditorForm
      title={title}
      hint="Needed parts are marked. Save puts the rabbit on the Adopt page right away if it is shown."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      saveLabel={saveLabel}
      canSave={draft.name.trim().length > 0}
      error={error}
      remove={
        onRemove
          ? { label: 'Remove this rabbit', confirm: 'Remove this rabbit? This can’t be undone.', onRemove: guard(onRemove) }
          : undefined
      }
    >
      <PartBox n="A" title="Who" hint="needed">
        <Field label="Name" needed>
          <input className={staffInput} required value={draft.name} onChange={set('name')} />
        </Field>
        {/* A photo can come later (the card shows a placeholder until then), so it never blocks Save. */}
        <PhotoUploader photos={draft.photos} userId={userId} needed={false} onChange={(photos) => setDraft((d) => ({ ...d, photos }))} />
      </PartBox>

      <PartBox n="B" title="About them" hint="optional">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Age">
            <select className={staffInput} value={draft.age} onChange={set('age')}>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {a || '—'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sex">
            <select className={staffInput} value={draft.sex} onChange={set('sex')}>
              {SEXES.map((s) => (
                <option key={s} value={s}>
                  {s || '—'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Size">
            <select className={staffInput} value={draft.size} onChange={set('size')}>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s || '—'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Breed">
          <BreedInput className={staffInput} value={draft.breed} onChange={(v) => setDraft((d) => ({ ...d, breed: v }))} />
        </Field>
        <Field label="About this rabbit">
          <textarea className={staffInput} rows={4} value={draft.description} onChange={set('description')} />
        </Field>
        <Field label="Traits (separate with commas)">
          <input className={staffInput} value={draft.tags} onChange={set('tags')} placeholder="Friendly, Litter-trained, Bonded pair" />
        </Field>
        <div>
          <CheckRow label="Spayed or neutered" checked={draft.spayed_neutered} onChange={check('spayed_neutered')} />
          <CheckRow label="Litter-trained" checked={draft.house_trained} onChange={check('house_trained')} />
          <CheckRow label="Part of a bonded pair" checked={draft.bonded} onChange={check('bonded')} />
        </div>
      </PartBox>

      <PartBox n="C" title="Status and showing" hint="needed">
        <Field label="Status" needed>
          <select className={staffInput} value={draft.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <CheckRow label="Show on the Adopt page (leave unchecked to keep it hidden)" checked={draft.is_published} onChange={check('is_published')} />
      </PartBox>
    </EditorForm>
  )
}

const statusTone = (s: string): 'blue' | 'orange' | 'slate' => (s === 'Available' ? 'blue' : s === 'Pending' ? 'orange' : 'slate')

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
  const { busy, error, run } = useCardAction()

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

  const changeStatus = (status: string) =>
    run(async () => {
      const { error } = await supabase.rpc('set_rabbit_status', { p_id: item.id, p_status: status })
      if (error) throw error
      onChanged()
    })

  // Hidden by the RescueGroups check: show it until tomorrow's check (which
  // hides it again if it still isn't listed).
  const showAgain = () =>
    run(async () => {
      const { error } = await supabase.from('rabbits').update({ is_published: true, auto_hidden: false }).eq('id', item.id)
      if (error) throw error
      onChanged()
    })

  const hide = () =>
    run(async () => {
      const { error } = await supabase.from('rabbits').update({ is_published: false }).eq('id', item.id)
      if (error) throw error
      onChanged()
    })

  const doDelete = async () => {
    const { error } = await supabase.from('rabbits').delete().eq('id', item.id)
    if (error) throw error
    onChanged()
  }

  if (editing) {
    return (
      <RabbitForm
        initial={draftFrom(item)}
        userId={userId}
        title={`Edit ${item.name}`}
        saveLabel="Save changes"
        isNew={false}
        onSubmit={saveEdit}
        onCancel={() => setEditing(false)}
        onRemove={canEdit ? doDelete : undefined}
      />
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
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 font-display text-base font-extrabold text-ink">{item.name}</h3>
            <Badge tone={statusTone(item.status)}>{item.status}</Badge>
            {!item.is_published && <Badge tone="slate">Hidden</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.age && <Badge tone="slate">{item.age}</Badge>}
            {item.sex && <Badge tone="slate">{item.sex}</Badge>}
            {item.breed && <Badge tone="slate">{item.breed}</Badge>}
          </div>
        </div>
      </div>

      {/* Update 32: no longer on RescueGroups — adopted, or listed again? Staff decide. */}
      {item.auto_hidden && item.status !== 'Adopted' && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[15px] font-bold text-amber-900">
            Hidden — no longer on RescueGroups{item.source_missing_since ? ` since ${usDate(item.source_missing_since)}` : ''}
          </p>
          <p className="text-sm leading-relaxed text-amber-900/80">
            Adopted? Mark it so. Still here? Show it again — until tomorrow’s check, which hides it again if RescueGroups
            still doesn’t list it.
          </p>
          {(canStatus || canEdit) && (
            <CardActions>
              {canStatus && (
                <button type="button" disabled={busy} onClick={() => void changeStatus('Adopted')} className={pill.blue}>
                  Mark adopted
                </button>
              )}
              {canEdit && (
                <button type="button" disabled={busy} onClick={() => void showAgain()} className={pill.outline}>
                  Show it again
                </button>
              )}
            </CardActions>
          )}
        </div>
      )}

      {(canEdit || canStatus) && (
        <CardActions className="pt-1">
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className={pill.blue}>
              Edit
            </button>
          )}
          {canEdit &&
            (item.is_published ? (
              <button type="button" disabled={busy} onClick={() => void hide()} className={pill.outline}>
                <Icon name="eyeOff" size={16} /> Hide
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void showAgain()} className={pill.outline}>
                <Icon name="eye" size={16} /> Show
              </button>
            ))}
          {canStatus &&
            STATUSES.filter((s) => s !== item.status).map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => void changeStatus(s)} className={pill.soft}>
                Mark {s.toLowerCase()}
              </button>
            ))}
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirmRemove(item.name)) void run(doDelete)
              }}
              className={pill.red}
            >
              <Icon name="trash" size={16} /> Remove
            </button>
          )}
        </CardActions>
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
  // Stable, so the RescueGroups line's timer isn't reset by every render.
  const reload = useCallback(() => void load(), [load])

  const sorted = useMemo(() => [...items].sort(byName((r: Rabbit) => r.name)), [items])

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
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to manage adoptable rabbits. An owner or admin can grant the
            Adoptions capabilities.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Adoptable rabbits">
        <p>
          These appear on the public Adopt page, listed A to Z. Add photos, set each rabbit’s status, and hide one you
          don’t want people to see yet. Rabbits from RescueGroups are added by themselves every morning.
        </p>
      </StaffTitle>

      {canCreate && !creating && (
        <div>
          <StepButton tone="orange" icon="plus" onClick={() => setCreating(true)}>
            Add a rabbit
          </StepButton>
        </div>
      )}

      {creating && (
        <RabbitForm
          initial={emptyDraft}
          userId={userId}
          title="New rabbit"
          saveLabel="Add rabbit"
          isNew
          onSubmit={create}
          onCancel={() => setCreating(false)}
        />
      )}

      {orgId && <RescueGroupsCheck orgId={orgId} canRefresh={canCreate || canEdit} onRefreshed={reload} />}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading rabbits…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No rabbits yet.{canCreate ? ' Tap “Add a rabbit” to post the first adoptable rabbit.' : ''} Until you add
            one, the Adopt page shows the built-in samples.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sorted.map((item) => (
            <RabbitCard key={item.id} item={item} userId={userId} canEdit={canEdit} canStatus={canStatus} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
