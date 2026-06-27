import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import {
  OPP_CATEGORIES,
  categoryLabel,
  type OppCategory,
  type VolunteerOpp,
} from '../lib/volunteerOpps'

interface Draft {
  category: OppCategory
  title: string
  when_text: string
  where_text: string
  spots: string
  detail: string
  is_published: boolean
}

const emptyDraft: Draft = {
  category: 'socialization',
  title: '',
  when_text: '',
  where_text: '',
  spots: '',
  detail: '',
  is_published: true,
}

function draftFrom(o: VolunteerOpp): Draft {
  return {
    category: (o.category as OppCategory) ?? 'socialization',
    title: o.title,
    when_text: o.when_text ?? '',
    where_text: o.where_text ?? '',
    spots: o.spots ?? '',
    detail: o.detail ?? '',
    is_published: o.is_published,
  }
}

function OppForm({
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
        Type
        <select
          className={staffInput}
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as OppCategory }))}
        >
          {OPP_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Title
        <input
          className={staffInput}
          required
          value={draft.title}
          onChange={set('title')}
          placeholder="e.g. Saturday socialization · 12–1 PM"
        />
      </label>
      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          When
          <input
            className={staffInput}
            value={draft.when_text}
            onChange={set('when_text')}
            placeholder="Sat, Jul 12 · 12–1 PM"
          />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Spots / need
          <input
            className={staffInput}
            value={draft.spots}
            onChange={set('spots')}
            placeholder="2 open"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Where
        <input
          className={staffInput}
          value={draft.where_text}
          onChange={set('where_text')}
          placeholder="OHRR Adoption Center · or  Center → MedVet"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Details
        <textarea
          className={staffInput}
          rows={2}
          value={draft.detail}
          onChange={set('detail')}
          placeholder="Anything else a volunteer should know"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
          checked={draft.is_published}
          onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
        />
        Show in the app now (uncheck for a draft)
      </label>

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
          className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function OppCard({ item, onChanged }: { item: VolunteerOpp; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase
      .from('volunteer_opportunities')
      .update({
        category: d.category,
        title: d.title.trim(),
        when_text: d.when_text.trim() || null,
        where_text: d.where_text.trim() || null,
        spots: d.spots.trim() || null,
        detail: d.detail.trim() || null,
        is_published: d.is_published,
      })
      .eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('volunteer_opportunities')
      .update({ is_published: !item.is_published })
      .eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('volunteer_opportunities').delete().eq('id', item.id)
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
        <OppForm
          initial={draftFrom(item)}
          submitLabel="Save changes"
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  return (
    <Card className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
        {item.is_published ? <Badge tone="blue">Live</Badge> : <Badge tone="slate">Draft</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-600">
        <Badge tone="orange">{categoryLabel(item.category)}</Badge>
        {item.when_text && <span>{item.when_text}</span>}
        {item.spots && <span className="font-semibold text-brand-orange">{item.spots}</span>}
      </div>
      {item.where_text && <p className="text-sm text-slate-500">{item.where_text}</p>}
      {item.detail && <p className="text-sm leading-relaxed text-slate-600">{item.detail}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={togglePublish}
          disabled={busy}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {item.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
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

export default function StaffVolunteer() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('volunteers.shifts.manage')

  const [items, setItems] = useState<VolunteerOpp[]>([])
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
      .from('volunteer_opportunities')
      .select('*')
      .eq('org_id', orgId)
      .order('category')
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

  const create = async (d: Draft) => {
    const { error } = await supabase.from('volunteer_opportunities').insert({
      org_id: orgId,
      category: d.category,
      title: d.title.trim(),
      when_text: d.when_text.trim() || null,
      where_text: d.where_text.trim() || null,
      spots: d.spots.trim() || null,
      detail: d.detail.trim() || null,
      is_published: d.is_published,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Volunteer opportunities</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to manage volunteer opportunities. An owner or admin can grant the
            “Create/manage volunteer shifts” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Volunteer opportunities</h1>
          <p className="mt-1 text-sm text-slate-600">
            Shifts, transport runs, and events that show on the Volunteer pages.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${btn.primary} shrink-0 !px-4 !py-2.5`}
          >
            <Icon name="heart" size={15} /> New
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New opportunity</p>
          <OppForm
            initial={emptyDraft}
            submitLabel="Add opportunity"
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No opportunities yet. Tap “New” to add one — it replaces the sample listing on that
            Volunteer page.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <OppCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
