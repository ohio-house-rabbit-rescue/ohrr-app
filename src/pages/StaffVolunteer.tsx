import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { LIMIT_KINDS, OPP_CATEGORIES, categoryLabel, remainingLabel, type VolunteerOpp } from '../lib/volunteerOpps'

interface Draft {
  category: string
  title: string
  when_text: string
  where_text: string
  spots: string
  detail: string
  is_published: boolean
  // How many can take it on: nothing, a headcount, or hours to cover.
  limit_kind: 'none' | 'people' | 'hours'
  limit_people: string
  limit_hours: string
  filled_people: string
  filled_hours: string
  contact_email: string
}

const emptyDraft: Draft = {
  category: 'socialization',
  title: '',
  when_text: '',
  where_text: '',
  spots: '',
  detail: '',
  is_published: true,
  limit_kind: 'none',
  limit_people: '',
  limit_hours: '',
  filled_people: '0',
  filled_hours: '0',
  contact_email: '',
}

function draftFrom(o: VolunteerOpp): Draft {
  return {
    category: o.category || 'socialization',
    title: o.title,
    when_text: o.when_text ?? '',
    where_text: o.where_text ?? '',
    spots: o.spots ?? '',
    detail: o.detail ?? '',
    is_published: o.is_published,
    limit_kind: o.limit_kind ?? 'none',
    limit_people: o.limit_people == null ? '' : String(o.limit_people),
    limit_hours: o.limit_hours == null ? '' : String(o.limit_hours),
    filled_people: String(o.filled_people ?? 0),
    filled_hours: String(o.filled_hours ?? 0),
    contact_email: o.contact_email ?? '',
  }
}

/** The columns the limit adds, shared by create and edit. */
function limitFields(d: Draft) {
  return {
    limit_kind: d.limit_kind,
    limit_people: d.limit_kind === 'people' && d.limit_people ? Number(d.limit_people) : null,
    limit_hours: d.limit_kind === 'hours' && d.limit_hours ? Number(d.limit_hours) : null,
    filled_people: Number(d.filled_people) || 0,
    filled_hours: Number(d.filled_hours) || 0,
    contact_email: d.contact_email.trim() || null,
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
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
        >
          {OPP_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
          {/* Tolerate a category that isn't in the catalog (e.g. added in the DB). */}
          {!OPP_CATEGORIES.some((c) => c.value === draft.category) && (
            <option value={draft.category}>{draft.category}</option>
          )}
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
          Note on the card <span className="font-normal text-slate-400">(optional)</span>
          <input
            className={staffInput}
            value={draft.spots}
            onChange={set('spots')}
            placeholder="Bring water"
          />
        </label>
      </div>

      {/* How much help this needs — a headcount, or hours to cover. */}
      <div className="space-y-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
        <label className="block text-sm font-semibold text-slate-700">
          How is it limited?
          <select
            className={staffInput}
            value={draft.limit_kind}
            onChange={(e) => setDraft((d) => ({ ...d, limit_kind: e.target.value as Draft['limit_kind'] }))}
          >
            {LIMIT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {draft.limit_kind === 'people' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              People needed
              <input inputMode="numeric" className={staffInput} value={draft.limit_people} onChange={set('limit_people')} placeholder="6" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Already signed up
              <input inputMode="numeric" className={staffInput} value={draft.filled_people} onChange={set('filled_people')} />
            </label>
          </div>
        )}
        {draft.limit_kind === 'hours' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              Hours to cover
              <input inputMode="decimal" className={staffInput} value={draft.limit_hours} onChange={set('limit_hours')} placeholder="30" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Covered so far
              <input inputMode="decimal" className={staffInput} value={draft.filled_hours} onChange={set('filled_hours')} />
            </label>
          </div>
        )}
        {draft.limit_kind !== 'none' && (
          <p className="text-xs text-slate-600">
            The card shows what’s left and says “Full” when it’s covered — nobody has to remember to take it down.
          </p>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Who to ask <span className="font-normal text-slate-400">(optional)</span>
          <input className={staffInput} type="email" value={draft.contact_email} onChange={set('contact_email')} placeholder="bev@…" />
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
        ...limitFields(d),
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
        {remainingLabel(item) && <Badge tone="blue">{remainingLabel(item)}</Badge>}
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
      ...limitFields(d),
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
            Open shifts for each volunteer position (and events needing hands) shown on the
            Volunteer pages.
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
