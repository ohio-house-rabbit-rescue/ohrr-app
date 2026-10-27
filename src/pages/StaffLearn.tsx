import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Explain, StaffTitle } from '../components/StaffTitle'
import { CardActions, EditorForm, Field, StepButton, pill } from '../components/StaffJob'
import { CheckRow, PartBox, confirmRemove, useCardAction, useSaving } from '../components/ContentEditorBits'
import { Spinner, FormError, staffInput } from '../components/staffui'
import {
  CARE_ICONS,
  asIconName,
  slugify,
  starterArticles,
  type CareArticle,
} from '../lib/careContent'

type Section = 'care' | 'give' | 'about' | 'adopt' | 'volunteer'
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'care', label: 'Care guide (Learn)' },
  { value: 'give', label: 'Give page' },
  { value: 'adopt', label: 'Adopt page' },
  { value: 'volunteer', label: 'Volunteer page' },
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
      hint="Needed parts are marked. Save puts it in Learn (or the page you pick) right away if it is shown."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      saveLabel={saveLabel}
      canSave={draft.title.trim().length > 0 && draft.body.trim().length > 0}
      error={error}
      remove={
        onRemove
          ? { label: 'Remove this guide', confirm: 'Remove this guide? This can’t be undone.', onRemove: guard(onRemove) }
          : undefined
      }
    >
      <PartBox n="A" title="Title and where it shows" hint="needed">
        <Field label="Where it shows" needed>
          <select className={staffInput} value={draft.section} onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value as Section }))}>
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" needed>
          <input className={staffInput} required value={draft.title} onChange={set('title')} />
        </Field>
      </PartBox>

      <PartBox n="B" title="The text" hint="needed">
        <Field label="Short summary" hint="One line shown in the list.">
          <input className={staffInput} value={draft.summary} onChange={set('summary')} />
        </Field>
        <Field label="Article text" needed>
          <textarea className={`${staffInput} font-mono`} rows={8} value={draft.body} onChange={set('body')} />
        </Field>
        <Explain label="How to format the text">
          <p>
            Leave a blank line between paragraphs. Start a line with <code>##</code> for a heading, or <code>-</code> for a
            bullet.
          </p>
        </Explain>
      </PartBox>

      <PartBox n="C" title="Icon, tip and showing" hint="optional">
        <Field label="Icon">
          <select className={staffInput} value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}>
            {CARE_ICONS.map((ic) => (
              <option key={ic} value={ic}>
                {ic}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Highlighted tip">
          <input className={staffInput} value={draft.tip} onChange={set('tip')} />
        </Field>
        <CheckRow label="Show in the app (leave unchecked to keep it as a draft)" checked={draft.is_published} onChange={(v) => setDraft((d) => ({ ...d, is_published: v }))} />
      </PartBox>
    </EditorForm>
  )
}

function ArticleCard({
  item,
  first,
  last,
  onMove,
  onChanged,
}: {
  item: CareArticle
  first: boolean
  last: boolean
  onMove: (dir: -1 | 1) => Promise<void>
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const { busy, error, run } = useCardAction()

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

  const togglePublish = () =>
    run(async () => {
      const { error } = await supabase.from('care_articles').update({ is_published: !item.is_published }).eq('id', item.id)
      if (error) throw error
      onChanged()
    })

  const doDelete = async () => {
    const { error } = await supabase.from('care_articles').delete().eq('id', item.id)
    if (error) throw error
    onChanged()
  }

  if (editing) {
    return (
      <ArticleForm
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
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={asIconName(item.icon)} size={20} className="shrink-0 text-brand-blue" />
          <h3 className="min-w-0 font-display text-base font-extrabold text-ink">{item.title}</h3>
        </div>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {item.section && item.section !== 'care' && <Badge tone="orange">{item.section}</Badge>}
          {item.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="slate">Hidden</Badge>}
        </span>
      </div>
      {item.summary && <p className="text-[15px] text-slate-600">{item.summary}</p>}

      <CardActions className="pt-1">
        <button type="button" onClick={() => setEditing(true)} className={pill.blue}>
          Edit
        </button>
        <button type="button" onClick={() => void togglePublish()} disabled={busy} className={pill.outline}>
          <Icon name={item.is_published ? 'eyeOff' : 'eye'} size={16} /> {item.is_published ? 'Hide' : 'Show'}
        </button>
        <button type="button" onClick={() => void run(() => onMove(-1))} disabled={busy || first} className={pill.outline}>
          Move up
        </button>
        <button type="button" onClick={() => void run(() => onMove(1))} disabled={busy || last} className={pill.outline}>
          Move down
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

  // Guides are shown in this order, so moving one renumbers the list 0, 1, 2 …
  // (only the rows whose number changes are written).
  const move = async (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= items.length) return
    const next = [...items]
    ;[next[index], next[to]] = [next[to], next[index]]
    for (let i = 0; i < next.length; i++) {
      if (next[i].sort_order === i) continue
      const { error } = await supabase.from('care_articles').update({ sort_order: i }).eq('id', next[i].id)
      if (error) throw error
    }
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
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to edit care content. An owner or admin can grant the “Edit
            education / care content” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Care guides">
        <p>
          The Rabbit Care articles shown in Learn, and the text on the Give, Adopt, Volunteer and About pages. They show
          in the order below; use Move up and Move down to change it.
        </p>
      </StaffTitle>

      {!creating && (
        <div>
          <StepButton tone="orange" icon="plus" onClick={() => setCreating(true)}>
            Add a guide
          </StepButton>
        </div>
      )}

      {creating && (
        <ArticleForm
          initial={emptyDraft}
          title="New care guide"
          saveLabel="Add guide"
          onSubmit={create}
          onCancel={() => setCreating(false)}
        />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No care guides yet. Start from OHRR’s built-in guides (diet, housing, bonding, and more), then edit them — or
            write your own with “Add a guide”.
          </p>
          <StepButton tone="blue" onClick={() => void importStarters()} disabled={importing} className="mx-auto">
            {importing ? 'Importing…' : 'Import the built-in guides'}
          </StepButton>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item, i) => (
            <ArticleCard
              key={item.id}
              item={item}
              first={i === 0}
              last={i === items.length - 1}
              onMove={(dir) => move(i, dir)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </Screen>
  )
}
