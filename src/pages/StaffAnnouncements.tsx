import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { StaffTitle } from '../components/StaffTitle'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { CardActions, EditorForm, Field, Part, StepButton, pill } from '../components/StaffJob'
import StaffImageField from '../components/StaffImageField'
import BringIn from '../components/BringIn'
import { putKeyboardAway } from '../lib/bringIntoView'
import { StatusNote } from '../features/scan/ScanUI'
import type { Database } from '../lib/database.types'

type Announcement = Database['public']['Tables']['announcements']['Row']

interface Draft {
  title: string
  body: string
  image_url: string
  is_published: boolean
}

const emptyDraft: Draft = { title: '', body: '', image_url: '', is_published: true }

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
  heading,
  initial,
  userId,
  saveLabel,
  onSubmit,
  onCancel,
  onRemove,
}: {
  heading: string
  initial: Draft
  userId: string
  saveLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
  onRemove?: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    putKeyboardAway()
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <BringIn>
    <EditorForm
      title={heading}
      hint="Notices show on the app’s home screen and the website."
      onSubmit={() => run(() => onSubmit(draft))}
      onCancel={onCancel}
      busy={busy || imageBusy}
      saveLabel={saveLabel}
      canSave={draft.title.trim().length > 0 && draft.body.trim().length > 0}
      error={error}
      remove={onRemove ? { label: 'Remove', confirm: `Remove “${initial.title}”? This can’t be undone.`, onRemove: () => run(onRemove) } : undefined}
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">
          What it says
        </Part>
        <Field label="Title" needed>
          <input
            className={staffInput}
            required
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Closed this Saturday for BunFest"
          />
        </Field>
        <Field label="Message" needed>
          <textarea
            className={staffInput}
            rows={3}
            required
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            placeholder="What do visitors need to know?"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">
          A picture
        </Part>
        <StaffImageField
          label="Picture"
          hint="Shown with the notice on the app’s home screen and the website."
          value={draft.image_url}
          userId={userId}
          onChange={(url) => setDraft((d) => ({ ...d, image_url: url }))}
          onBusyChange={setImageBusy}
        />
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">
          Showing
        </Part>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-6 w-6 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
            checked={draft.is_published}
            onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
          />
          Show it now (leave unchecked to keep it as a draft)
        </label>
      </div>
    </EditorForm>
    </BringIn>
  )
}

function AnnouncementCard({
  item,
  userId,
  onChanged,
}: {
  item: Announcement
  userId: string
  onChanged: (note?: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase
      .from('announcements')
      .update({ title: d.title.trim(), body: d.body.trim(), image_url: d.image_url.trim() || null, is_published: d.is_published })
      .eq('id', item.id)
    if (error) throw error
    setEditing(false)
    setSaved(true)
    onChanged()
  }

  const togglePublish = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    const { error } = await supabase
      .from('announcements')
      .update({ is_published: !item.is_published })
      .eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    const { error } = await supabase.from('announcements').delete().eq('id', item.id)
    if (error) throw error
    onChanged(`Removed “${item.title}”.`)
  }

  if (editing) {
    return (
      <AnnouncementForm
        heading="Edit this notice"
        initial={{ title: item.title, body: item.body, image_url: item.image_url ?? '', is_published: item.is_published }}
        userId={userId}
        saveLabel="Save"
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
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{item.body}</p>
      <p className="text-sm text-slate-500">Updated {fmtDate(item.updated_at)}</p>

      <CardActions className="pt-1">
        <button
          type="button"
          onClick={() => {
            setSaved(false)
            setEditing(true)
          }}
          className={pill.blue}
        >
          Edit
        </button>
        <button type="button" onClick={togglePublish} disabled={busy} className={pill.outline}>
          {item.is_published ? 'Hide' : 'Show'}
        </button>
      </CardActions>
      <FormError>{error}</FormError>
      {saved && <StatusNote className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Saved.</StatusNote>}
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
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    // Newest first.
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
      image_url: d.image_url.trim() || null,
      is_published: d.is_published,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    setNote(d.is_published ? `Posted “${d.title.trim()}”. It is showing on the home screen now.` : `Saved “${d.title.trim()}” as a draft. It is hidden until you tap Show.`)
    await load()
  }

  // A card changed (saved, hidden, removed): reload; a removed card says so up here, since it is gone from the list.
  const changed = (text?: string) => {
    if (text) setNote(text)
    void load()
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Announcements</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-base leading-relaxed text-slate-600">
            You don’t have access to post announcements. An owner or admin can grant the “Post
            announcements” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Announcements">
        <p>Short notices that appear on the app’s home screen for visitors. The newest is first.</p>
        <p>Tap Hide to take a notice down without losing it, and Show to bring it back. To remove one for good, tap Edit, then Remove.</p>
      </StaffTitle>

      {!creating && (
        <StepButton
          tone="orange"
          icon="plus"
          onClick={() => {
            setNote(null)
            setCreating(true)
          }}
        >
          New announcement
        </StepButton>
      )}

      {creating && (
        <AnnouncementForm
          heading="New announcement"
          initial={emptyDraft}
          userId={userId}
          saveLabel="Post announcement"
          onSubmit={create}
          onCancel={() => setCreating(false)}
        />
      )}

      {note && !creating && (
        <StatusNote key={note} className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          {note}
        </StatusNote>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-base leading-relaxed text-slate-600">
            No announcements yet. Tap “New announcement” to post one — it’ll show on the app’s home screen.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} userId={userId} onChanged={changed} />
          ))}
        </div>
      )}
    </Screen>
  )
}
