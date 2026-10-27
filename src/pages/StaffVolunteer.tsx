import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Explain, StaffTitle } from '../components/StaffTitle'
import { CardActions, EditorForm, Field, StepButton, pill } from '../components/StaffJob'
import { CheckRow, PartBox, confirmRemove, useCardAction, useSaving } from '../components/ContentEditorBits'
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

  return (
    <EditorForm
      title={title}
      hint="Needed parts are marked. Save puts it on the Volunteer pages right away if it is shown."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      saveLabel={saveLabel}
      canSave={draft.title.trim().length > 0}
      error={error}
      remove={
        onRemove
          ? { label: 'Remove this opportunity', confirm: 'Remove this opportunity? This can’t be undone.', onRemove: guard(onRemove) }
          : undefined
      }
    >
      <PartBox n="A" title="What it is" hint="needed">
        <Field label="Type" needed>
          <select className={staffInput} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
            {OPP_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
            {/* Tolerate a category that isn't in the catalog (e.g. added in the DB). */}
            {!OPP_CATEGORIES.some((c) => c.value === draft.category) && <option value={draft.category}>{draft.category}</option>}
          </select>
        </Field>
        <Field label="Title" needed>
          <input className={staffInput} required value={draft.title} onChange={set('title')} placeholder="e.g. Saturday socialization · 12–1 PM" />
        </Field>
      </PartBox>

      <PartBox n="B" title="When and where" hint="optional">
        <Field label="When">
          <input className={staffInput} value={draft.when_text} onChange={set('when_text')} placeholder="Sat, Jul 12 · 12–1 PM" />
        </Field>
        <Field label="Where">
          <input className={staffInput} value={draft.where_text} onChange={set('where_text')} placeholder="OHRR Adoption Center · or  Center → MedVet" />
        </Field>
        <Field label="Note on the card">
          <input className={staffInput} value={draft.spots} onChange={set('spots')} placeholder="Bring water" />
        </Field>
      </PartBox>

      {/* How much help this needs — a headcount, or hours to cover. */}
      <PartBox n="C" title="How much help it needs" hint="optional">
        <Field label="How is it limited?">
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
        </Field>
        {draft.limit_kind === 'people' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="People needed">
              <input inputMode="numeric" className={staffInput} value={draft.limit_people} onChange={set('limit_people')} placeholder="6" />
            </Field>
            <Field label="Already signed up">
              <input inputMode="numeric" className={staffInput} value={draft.filled_people} onChange={set('filled_people')} />
            </Field>
          </div>
        )}
        {draft.limit_kind === 'hours' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Hours to cover">
              <input inputMode="decimal" className={staffInput} value={draft.limit_hours} onChange={set('limit_hours')} placeholder="30" />
            </Field>
            <Field label="Covered so far">
              <input inputMode="decimal" className={staffInput} value={draft.filled_hours} onChange={set('filled_hours')} />
            </Field>
          </div>
        )}
        {draft.limit_kind !== 'none' && (
          <Explain label="What the card shows">
            <p>The card shows what’s left and says “Full” when it’s covered — nobody has to remember to take it down.</p>
          </Explain>
        )}
        <Field label="Who to ask">
          <input className={staffInput} type="email" value={draft.contact_email} onChange={set('contact_email')} placeholder="bev@…" />
        </Field>
      </PartBox>

      <PartBox n="D" title="Details and showing" hint="optional">
        <Field label="Details">
          <textarea className={staffInput} rows={3} value={draft.detail} onChange={set('detail')} placeholder="Anything else a volunteer should know" />
        </Field>
        <CheckRow label="Show in the app now (leave unchecked to keep it as a draft)" checked={draft.is_published} onChange={(v) => setDraft((d) => ({ ...d, is_published: v }))} />
      </PartBox>
    </EditorForm>
  )
}

function OppCard({ item, onChanged }: { item: VolunteerOpp; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const { busy, error, run } = useCardAction()

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

  const togglePublish = () =>
    run(async () => {
      const { error } = await supabase.from('volunteer_opportunities').update({ is_published: !item.is_published }).eq('id', item.id)
      if (error) throw error
      onChanged()
    })

  const doDelete = async () => {
    const { error } = await supabase.from('volunteer_opportunities').delete().eq('id', item.id)
    if (error) throw error
    onChanged()
  }

  if (editing) {
    return (
      <OppForm
        initial={draftFrom(item)}
        title={`Edit ${item.title}`}
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
        <h3 className="min-w-0 font-display text-base font-extrabold text-ink">{item.title}</h3>
        {item.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="slate">Hidden</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-slate-600">
        <Badge tone="orange">{categoryLabel(item.category)}</Badge>
        {remainingLabel(item) && <Badge tone="blue">{remainingLabel(item)}</Badge>}
        {item.when_text && <span>{item.when_text}</span>}
        {item.spots && <span className="font-semibold text-brand-orange">{item.spots}</span>}
      </div>
      {item.where_text && <p className="text-[15px] text-slate-500">{item.where_text}</p>}
      {item.detail && <p className="text-[15px] leading-relaxed text-slate-600">{item.detail}</p>}

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
            if (confirmRemove(`“${item.title}”`)) void run(doDelete)
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

  // By type, then A to Z by title.
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          categoryLabel(a.category).localeCompare(categoryLabel(b.category), 'en', { sensitivity: 'base' }) ||
          a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
      ),
    [items],
  )

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
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to manage volunteer opportunities. An owner or admin can grant the
            “Create/manage volunteer shifts” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Volunteer opportunities">
        <p>
          Open shifts for each volunteer position (and events needing hands) shown on the Volunteer pages. They are
          grouped by type, then A to Z.
        </p>
      </StaffTitle>

      {!creating && (
        <div>
          <StepButton tone="orange" icon="plus" onClick={() => setCreating(true)}>
            Add an opportunity
          </StepButton>
        </div>
      )}

      {creating && (
        <OppForm
          initial={emptyDraft}
          title="New opportunity"
          saveLabel="Add opportunity"
          onSubmit={create}
          onCancel={() => setCreating(false)}
        />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No opportunities yet. Tap “Add an opportunity” — it replaces the sample listing on that Volunteer page.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sorted.map((item) => (
            <OppCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
