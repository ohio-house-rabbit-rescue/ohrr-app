import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import type { Database } from '../lib/database.types'

type Announcement = Database['public']['Tables']['announcements']['Row']

interface Draft {
  title: string
  body: string
  is_published: boolean
}

const emptyDraft: Draft = { title: '', body: '', is_published: true }

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function AnnouncementForm({
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
        <input
          className={staffInput}
          required
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="e.g. Closed this Saturday for BunFest"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Message
        <textarea
          className={staffInput}
          rows={3}
          required
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          placeholder="What do visitors need to know?"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
          checked={draft.is_published}
          onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
        />
        Show in the app now (uncheck to save as a draft)
      </label>

      <FormError>{error}</FormError>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || draft.title.trim().length === 0 || draft.body.trim().length === 0}
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

function AnnouncementCard({
  item,
  onChanged,
}: {
  item: Announcement
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase
      .from('announcements')
      .update({ title: d.title.trim(), body: d.body.trim(), is_published: d.is_published })
      .eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('announcements')
      .update({ is_published: !item.is_published })
      .eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('announcements').delete().eq('id', item.id)
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
        <AnnouncementForm
          initial={{ title: item.title, body: item.body, is_published: item.is_published }}
          submitLabel="Save changes"
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-[15px] font-extrabold text-ink">{item.title}</h3>
        {item.is_published ? (
          <Badge tone="blue">Live</Badge>
        ) : (
          <Badge tone="slate">Draft</Badge>
        )}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.body}</p>
      <p className="text-xs text-slate-400">Updated {fmtDate(item.updated_at)}</p>

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

export default function StaffAnnouncements() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('announcements.post')

  const [items, setItems] = useState<Announcement[]>([])
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
      .from('announcements')
      .select('*')
      .eq('org_id', orgId)
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
    const { error } = await supabase.from('announcements').insert({
      org_id: orgId,
      title: d.title.trim(),
      body: d.body.trim(),
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
        <h1 className="font-display text-2xl font-black text-ink">Announcements</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to post announcements. An owner or admin can grant the “Post
            announcements” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Announcements</h1>
          <p className="mt-1 text-sm text-slate-600">
            Short notices that appear on the app’s home screen for visitors.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${btn.primary} shrink-0 !px-4 !py-2.5`}
          >
            <Icon name="gift" size={15} /> New
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New announcement</p>
          <AnnouncementForm
            initial={emptyDraft}
            submitLabel="Post announcement"
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No announcements yet. Tap “New” to post one — it’ll show on the app’s home screen.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
