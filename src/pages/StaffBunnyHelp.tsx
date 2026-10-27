// Staff editor for Bunny Help topics (the "My bunny is…" search). Same shape
// as StaffLearn: list / create / edit / hide / remove, gated on
// content.education.edit (RLS enforces it regardless of what the UI shows).
import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Database } from '../lib/database.types'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Explain, StaffTitle } from '../components/StaffTitle'
import { CardActions, EditorForm, Field, StepButton, pill } from '../components/StaffJob'
import { CheckRow, PartBox, byName, confirmRemove, useCardAction, useSaving } from '../components/ContentEditorBits'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { slugify } from '../lib/careContent'
import { SEED_TOPICS } from '../features/bunnyhelp/seedTopics'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  URGENCIES,
  URGENCY_LABEL,
  isCategory,
  isUrgency,
  type TopicCategory,
  type TopicUrgency,
} from '../features/bunnyhelp/types'

type TopicRow = Database['public']['Tables']['care_topics']['Row']

interface Draft {
  title: string
  aliases: string
  category: TopicCategory
  urgency: TopicUrgency
  summary: string
  what_to_do: string
  article_slug: string
  show_vets: boolean
  hopshop_note: string
  reviewed_by: string
  reviewed_at: string
  is_published: boolean
}

const emptyDraft: Draft = {
  title: '',
  aliases: '',
  category: 'behavior',
  urgency: 'tip',
  summary: '',
  what_to_do: '',
  article_slug: '',
  show_vets: false,
  hopshop_note: '',
  reviewed_by: '',
  reviewed_at: '',
  is_published: true,
}

function draftFrom(t: TopicRow): Draft {
  return {
    title: t.title,
    aliases: (t.aliases ?? []).join(', '),
    category: isCategory(t.category) ? t.category : 'behavior',
    urgency: isUrgency(t.urgency) ? t.urgency : 'tip',
    summary: t.summary ?? '',
    what_to_do: t.what_to_do ?? '',
    article_slug: t.article_slug ?? '',
    show_vets: Boolean(t.show_vets),
    hopshop_note: t.hopshop_note ?? '',
    reviewed_by: t.reviewed_by ?? '',
    reviewed_at: t.reviewed_at ?? '',
    is_published: t.is_published,
  }
}

function splitAliases(s: string): string[] {
  return [...new Set(s.split(',').map((a) => a.trim()).filter(Boolean))]
}

function rowFromDraft(d: Draft) {
  return {
    title: d.title.trim(),
    aliases: splitAliases(d.aliases),
    category: d.category,
    urgency: d.urgency,
    summary: d.summary.trim(),
    what_to_do: d.what_to_do,
    article_slug: d.article_slug.trim() || null,
    show_vets: d.show_vets,
    hopshop_note: d.hopshop_note.trim() || null,
    reviewed_by: d.reviewed_by.trim() || null,
    reviewed_at: d.reviewed_at || null,
    is_published: d.is_published,
  }
}

function TopicForm({
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
      hint="Needed parts are marked. Save puts it in the “My bunny is…” search right away if it is shown."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      saveLabel={saveLabel}
      canSave={draft.title.trim().length > 0}
      error={error}
      remove={
        onRemove
          ? { label: 'Remove this topic', confirm: 'Remove this topic? This can’t be undone.', onRemove: guard(onRemove) }
          : undefined
      }
    >
      <PartBox n="A" title="The topic" hint="needed">
        <Field label="Title" needed>
          <input className={staffInput} required value={draft.title} onChange={set('title')} placeholder="e.g. Stopped using the litter box" />
        </Field>
        <Field label="Also matches (separate with commas)" hint="The words people actually type. Search looks at the title, these, and the summary.">
          <input className={staffInput} value={draft.aliases} onChange={set('aliases')} placeholder="peeing outside the box, accidents, marking" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category" needed>
            <select className={staffInput} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as TopicCategory }))}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="How urgent" needed>
            <select className={staffInput} value={draft.urgency} onChange={(e) => setDraft((d) => ({ ...d, urgency: e.target.value as TopicUrgency }))}>
              {URGENCIES.map((u) => (
                <option key={u} value={u}>
                  {URGENCY_LABEL[u]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </PartBox>

      <PartBox n="B" title="What it says" hint="optional">
        <Field label="Summary" hint="One line shown in results.">
          <input className={staffInput} value={draft.summary} onChange={set('summary')} />
        </Field>
        <Field label="What to do">
          <textarea className={`${staffInput} font-mono`} rows={10} value={draft.what_to_do} onChange={set('what_to_do')} />
        </Field>
        <Explain label="How to format the text">
          <p>
            Leave a blank line between paragraphs. Start a line with <code>##</code> for a heading, or <code>-</code> for a
            bullet. Health topics: keep to “call a rabbit-savvy vet” — no diagnoses.
          </p>
        </Explain>
      </PartBox>

      <PartBox n="C" title="Links and review" hint="optional">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Learn article" hint="The short name of the care guide to link, e.g. litter.">
            <input className={staffInput} value={draft.article_slug} onChange={set('article_slug')} placeholder="e.g. litter" />
          </Field>
          <Field label="Hop Shop note">
            <input className={staffInput} value={draft.hopshop_note} onChange={set('hopshop_note')} placeholder="e.g. Litter and hay — see the shop" />
          </Field>
          <Field label="Reviewed by">
            <input className={staffInput} value={draft.reviewed_by} onChange={set('reviewed_by')} placeholder="Dr. … / clinic" />
          </Field>
          <Field label="Reviewed on">
            <input type="date" className={staffInput} value={draft.reviewed_at} onChange={set('reviewed_at')} />
          </Field>
        </div>
        <CheckRow label="Show “Find a rabbit-savvy vet”" checked={draft.show_vets} onChange={(v) => setDraft((d) => ({ ...d, show_vets: v }))} />
        <CheckRow label="Show in the app (leave unchecked to keep it as a draft)" checked={draft.is_published} onChange={(v) => setDraft((d) => ({ ...d, is_published: v }))} />
      </PartBox>
    </EditorForm>
  )
}

function TopicCard({ item, onChanged }: { item: TopicRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const { busy, error, run } = useCardAction()

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('care_topics').update(rowFromDraft(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = () =>
    run(async () => {
      const { error } = await supabase.from('care_topics').update({ is_published: !item.is_published }).eq('id', item.id)
      if (error) throw error
      onChanged()
    })

  const doDelete = async () => {
    const { error } = await supabase.from('care_topics').delete().eq('id', item.id)
    if (error) throw error
    onChanged()
  }

  if (editing) {
    return (
      <TopicForm
        initial={draftFrom(item)}
        title={`Edit ${item.title}`}
        saveLabel="Save changes"
        onSubmit={saveEdit}
        onCancel={() => setEditing(false)}
        onRemove={doDelete}
      />
    )
  }

  const needsReview = item.category === 'health' && !item.reviewed_by

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-base font-extrabold text-ink">{item.title}</h3>
        <div className="flex shrink-0 gap-1.5">
          {item.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="slate">Hidden</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="slate">{isCategory(item.category) ? CATEGORY_LABEL[item.category] : item.category}</Badge>
        <Badge tone={item.urgency === 'emergency' || item.urgency === 'vet-today' ? 'orange' : 'slate'}>
          {isUrgency(item.urgency) ? URGENCY_LABEL[item.urgency] : item.urgency}
        </Badge>
        {needsReview && <Badge tone="orange">Not yet vet-reviewed</Badge>}
        {item.reviewed_by && <Badge tone="blue">Reviewed · {item.reviewed_by}</Badge>}
      </div>
      {item.summary && <p className="text-[15px] text-slate-600">{item.summary}</p>}
      {item.aliases?.length > 0 && <p className="text-sm text-slate-500">Matches: {item.aliases.join(', ')}</p>}

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

export default function StaffBunnyHelp() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('content.education.edit')

  const [items, setItems] = useState<TopicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const { data, error } = await supabase
      .from('care_topics')
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

  const create = async (d: Draft) => {
    const { error } = await supabase.from('care_topics').insert({
      org_id: orgId,
      slug: slugify(d.title),
      ...rowFromDraft(d),
      sort_order: items.length,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  const importSeed = async () => {
    setImporting(true)
    setError(null)
    const rows = SEED_TOPICS.map((s, i) => ({
      org_id: orgId,
      slug: s.slug,
      title: s.title,
      aliases: s.aliases,
      category: s.category,
      urgency: s.urgency,
      summary: s.summary,
      what_to_do: s.what_to_do,
      article_slug: s.article_slug,
      show_vets: s.show_vets,
      hopshop_note: s.hopshop_note,
      sort_order: i,
      created_by: userId,
    }))
    const { error } = await supabase.from('care_topics').insert(rows)
    if (error) setError(errMessage(error))
    setImporting(false)
    if (!error) await load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Bunny Help topics</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to edit care content. An owner or admin can grant the “Edit education / care
            content” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  const needsReview = items.filter((t) => t.category === 'health' && !t.reviewed_by).length
  const sorted = [...items].sort(byName((t) => t.title))

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Bunny Help topics">
        <p>
          What the “My bunny is…” search in My Bunny answers with. Health topics should only say “call a rabbit-savvy
          vet”. Topics are listed A to Z.
        </p>
      </StaffTitle>

      {!creating && (
        <div>
          <StepButton tone="orange" icon="plus" onClick={() => setCreating(true)}>
            Add a topic
          </StepButton>
        </div>
      )}

      {needsReview > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-[15px] leading-relaxed text-amber-900">
            <strong className="font-bold">
              {needsReview} health topic{needsReview === 1 ? '' : 's'}
            </strong>{' '}
            show “Not yet vet-reviewed” in the app. Fill in “Reviewed by” and “Reviewed on” once a rabbit-savvy vet has
            looked them over.
          </p>
        </Card>
      )}

      {creating && (
        <TopicForm initial={emptyDraft} title="New topic" saveLabel="Add topic" onSubmit={create} onCancel={() => setCreating(false)} />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No topics in the database yet — the app is showing the built-in set drawn from OHRR’s care resources. Import
            them to edit from there, or write your own with “Add a topic”.
          </p>
          <StepButton tone="blue" onClick={() => void importSeed()} disabled={importing} className="mx-auto">
            {importing ? 'Importing…' : `Import the ${SEED_TOPICS.length} built-in topics`}
          </StepButton>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sorted.map((item) => (
            <TopicCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
