import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import {
  CARE_ICONS,
  asIconName,
  slugify,
  starterArticles,
  type CareArticle,
} from '../lib/careContent'

type Section = 'care' | 'give' | 'about' | 'adopt'
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'care', label: 'Care guide (Learn)' },
  { value: 'give', label: 'Give page' },
  { value: 'adopt', label: 'Adopt page' },
  { value: 'about', label: 'About page' },
]

interface Draft {
  section: Section
  title: string
  icon: string
  summary: string
  body: string
  tip: string
  is_published: boolean
}

const emptyDraft: Draft = { section: 'care', title: '', icon: 'book', summary: '', body: '', tip: '', is_published: true }

function draftFrom(a: CareArticle): Draft {
  return {
    title: a.title,
    section: a.section ?? 'care',
    icon: a.icon,
    summary: a.summary,
    body: a.body,
    tip: a.tip ?? '',
    is_published: a.is_published,
  }
}

function ArticleForm({
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
        Where it shows
        <select className={staffInput} value={draft.section} onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value as Section }))}>
          {SECTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Title
          <input className={staffInput} required value={draft.title} onChange={set('title')} />
        </label>
        <label className="block w-28 text-sm font-semibold text-slate-700">
          Icon
          <select
            className={staffInput}
            value={draft.icon}
            onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
          >
            {CARE_ICONS.map((ic) => (
              <option key={ic} value={ic}>
                {ic}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Short summary
        <input
          className={staffInput}
          value={draft.summary}
          onChange={set('summary')}
          placeholder="One line shown in the list"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Article text
        <textarea
          className={`${staffInput} font-mono text-[13px]`}
          rows={8}
          value={draft.body}
          onChange={set('body')}
        />
        <span className="mt-1 block text-xs font-normal text-slate-400">
          Leave a blank line between paragraphs. Start a line with <code>##</code> for a heading, or{' '}
          <code>-</code> for a bullet.
        </span>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Highlighted tip (optional)
        <input className={staffInput} value={draft.tip} onChange={set('tip')} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
          checked={draft.is_published}
          onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
        />
        Show in the app (uncheck for a draft)
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

function ArticleCard({ item, onChanged }: { item: CareArticle; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase
      .from('care_articles')
      .update({
        ...(d.section !== 'care' || item.section ? { section: d.section } : {}),
        title: d.title.trim(),
        icon: d.icon,
        summary: d.summary.trim(),
        body: d.body,
        tip: d.tip.trim() || null,
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
      .from('care_articles')
      .update({ is_published: !item.is_published })
      .eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('care_articles').delete().eq('id', item.id)
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
        <ArticleForm
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
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={asIconName(item.icon)} size={18} className="shrink-0 text-brand-blue" />
          <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {item.section && item.section !== 'care' && <Badge tone="orange">{item.section}</Badge>}
          {item.is_published ? <Badge tone="blue">Live</Badge> : <Badge tone="slate">Draft</Badge>}
        </span>
      </div>
      {item.summary && <p className="text-sm text-slate-600">{item.summary}</p>}

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

export default function StaffLearn() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('content.education.edit')

  const [items, setItems] = useState<CareArticle[]>([])
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
      .from('care_articles')
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
    const { error } = await supabase.from('care_articles').insert({
      org_id: orgId,
      slug: slugify(d.title),
      ...(d.section !== 'care' ? { section: d.section } : {}),
      title: d.title.trim(),
      icon: d.icon,
      summary: d.summary.trim(),
      body: d.body,
      tip: d.tip.trim() || null,
      sort_order: items.length,
      is_published: d.is_published,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  const importStarters = async () => {
    setImporting(true)
    setError(null)
    const rows = starterArticles().map((a) => ({ ...a, org_id: orgId, created_by: userId }))
    const { error } = await supabase.from('care_articles').insert(rows)
    if (error) setError(errMessage(error))
    setImporting(false)
    if (!error) await load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Care guides</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to edit care content. An owner or admin can grant the “Edit
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
          <h1 className="font-display text-2xl font-black text-ink">Care guides</h1>
          <p className="mt-1 text-sm text-slate-600">The Rabbit Care articles shown in Learn.</p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${btn.primary} shrink-0 !px-4 !py-2.5`}
          >
            <Icon name="book" size={15} /> New
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New care guide</p>
          <ArticleForm
            initial={emptyDraft}
            submitLabel="Add guide"
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No care guides yet. Start from OHRR’s built-in guides (diet, housing, bonding, and more),
            then edit them — or write your own with “New”.
          </p>
          <button
            type="button"
            onClick={importStarters}
            disabled={importing}
            className={`${btn.blue} mx-auto disabled:opacity-60`}
          >
            {importing ? 'Importing…' : 'Import the built-in guides'}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <ArticleCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
