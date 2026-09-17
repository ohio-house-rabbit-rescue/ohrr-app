// Staff editor for Bunny Help topics (the "My bunny is…" search). Same shape
// as StaffLearn: list / create / edit / publish / delete, gated on
// content.education.edit (RLS enforces it regardless of what the UI shows).
import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Database } from '../lib/database.types'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
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

const checkbox = 'h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30'

function TopicForm({
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
        Title
        <input className={staffInput} required value={draft.title} onChange={set('title')} placeholder="e.g. Stopped using the litter box" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Also matches (comma-separated)
        <input
          className={staffInput}
          value={draft.aliases}
          onChange={set('aliases')}
          placeholder="peeing outside the box, accidents, marking"
        />
        <span className="mt-1 block text-xs font-normal text-slate-400">
          The words people actually type. Search matches title, these, and the summary.
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Category
          <select className={staffInput} value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as TopicCategory }))}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Urgency
          <select className={staffInput} value={draft.urgency} onChange={(e) => setDraft((d) => ({ ...d, urgency: e.target.value as TopicUrgency }))}>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABEL[u]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Summary
        <input className={staffInput} value={draft.summary} onChange={set('summary')} placeholder="One line shown in results" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        What to do
        <textarea className={`${staffInput} font-mono text-[13px]`} rows={10} value={draft.what_to_do} onChange={set('what_to_do')} />
        <span className="mt-1 block text-xs font-normal text-slate-400">
          Leave a blank line between paragraphs. Start a line with <code>##</code> for a heading, or <code>-</code> for a
          bullet. Health topics: keep to “call a rabbit-savvy vet” — no diagnoses.
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Learn article slug
          <input className={staffInput} value={draft.article_slug} onChange={set('article_slug')} placeholder="e.g. litter" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Hop Shop note
          <input className={staffInput} value={draft.hopshop_note} onChange={set('hopshop_note')} placeholder="e.g. Litter and hay — see the shop" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Reviewed by
          <input className={staffInput} value={draft.reviewed_by} onChange={set('reviewed_by')} placeholder="Dr. … / clinic" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Reviewed on
          <input type="date" className={staffInput} value={draft.reviewed_at} onChange={set('reviewed_at')} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className={checkbox} checked={draft.show_vets} onChange={(e) => setDraft((d) => ({ ...d, show_vets: e.target.checked }))} />
        Show “Find a rabbit-savvy vet”
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className={checkbox} checked={draft.is_published} onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))} />
        Show in the app (uncheck for a draft)
      </label>

      <FormError>{error}</FormError>

      <div className="flex gap-2">
        <button type="submit" disabled={busy || draft.title.trim().length === 0} className={`${btn.primary} flex-1 disabled:opacity-60`}>
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

function TopicCard({ item, onChanged }: { item: TopicRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('care_topics').update(rowFromDraft(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = async () => {
    setBusy(true)
    const { error } = await supabase.from('care_topics').update({ is_published: !item.is_published }).eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('care_topics').delete().eq('id', item.id)
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
        <TopicForm initial={draftFrom(item)} submitLabel="Save changes" onSubmit={saveEdit} onCancel={() => setEditing(false)} />
      </Card>
    )
  }

  const needsReview = item.category === 'health' && !item.reviewed_by

  return (
    <Card className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
        <div className="flex shrink-0 gap-1.5">
          {item.is_published ? <Badge tone="blue">Live</Badge> : <Badge tone="slate">Draft</Badge>}
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
      {item.summary && <p className="text-sm text-slate-600">{item.summary}</p>}
      {item.aliases?.length > 0 && (
        <p className="text-xs text-slate-400">Matches: {item.aliases.join(', ')}</p>
      )}

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
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to edit care content. An owner or admin can grant the “Edit education / care
            content” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  const needsReview = items.filter((t) => t.category === 'health' && !t.reviewed_by).length

  return (
    <Screen className="space-y-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Bunny Help topics</h1>
          <p className="mt-1 text-sm text-slate-600">
            What the “My bunny is…” search in My Bunny answers with. Health topics should only say “call a
            rabbit-savvy vet”.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className={`${btn.primary} shrink-0 !px-4 !py-2.5`}>
            <Icon name="help" size={15} /> New
          </button>
        )}
      </div>

      {needsReview > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-[13px] leading-relaxed text-amber-900">
            <strong className="font-bold">{needsReview} health topic{needsReview === 1 ? '' : 's'}</strong> show “Not yet
            vet-reviewed” in the app. Fill in “Reviewed by” and “Reviewed on” once a rabbit-savvy vet has looked them
            over.
          </p>
        </Card>
      )}

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New topic</p>
          <TopicForm initial={emptyDraft} submitLabel="Add topic" onSubmit={create} onCancel={() => setCreating(false)} />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No topics in the database yet — the app is showing the built-in set drawn from OHRR’s care resources.
            Import them to edit from there, or write your own with “New”.
          </p>
          <button type="button" onClick={importSeed} disabled={importing} className={`${btn.blue} mx-auto disabled:opacity-60`}>
            {importing ? 'Importing…' : `Import the ${SEED_TOPICS.length} built-in topics`}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <TopicCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
