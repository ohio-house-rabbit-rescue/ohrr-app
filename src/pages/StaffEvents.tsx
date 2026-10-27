import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Explain, StaffTitle } from '../components/StaffTitle'
import { CardActions, EditorForm, Field, Part, pill } from '../components/StaffJob'
import { Spinner, FormError, staffInput } from '../components/staffui'
import StaffImageField from '../components/StaffImageField'
import { slugify } from '../lib/careContent'
import { eventDate, eventTime, type EventRow } from '../lib/events'
import { seedEvents } from '../data/events'

interface Draft {
  title: string
  slug: string
  starts_local: string // datetime-local value
  ends_local: string
  image_url: string
  venue: string
  address: string
  city: string
  summary: string
  body: string
  theme: string
  url: string
  is_published: boolean
}

const emptyDraft: Draft = {
  title: '',
  slug: '',
  starts_local: '',
  ends_local: '',
  image_url: '',
  venue: '',
  address: '',
  city: '',
  summary: '',
  body: '',
  theme: '',
  url: '',
  is_published: true,
}

// ISO ↔ <input type="datetime-local"> (the browser's local time zone).
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function draftFrom(e: EventRow): Draft {
  return {
    title: e.title,
    slug: e.slug,
    starts_local: toLocalInput(e.starts_at),
    ends_local: toLocalInput(e.ends_at),
    image_url: e.image_url ?? '',
    venue: e.venue ?? '',
    address: e.address ?? '',
    city: e.city ?? '',
    summary: e.summary ?? '',
    body: e.body ?? '',
    theme: e.theme ?? '',
    url: e.url ?? '',
    is_published: e.is_published,
  }
}

function toRow(d: Draft) {
  const starts = fromLocalInput(d.starts_local)
  if (!starts) throw new Error('Please enter a start date and time.')
  return {
    title: d.title.trim(),
    slug: slugify(d.slug.trim() || d.title),
    starts_at: starts,
    ends_at: fromLocalInput(d.ends_local),
    image_url: d.image_url.trim() || null,
    venue: d.venue.trim() || null,
    address: d.address.trim() || null,
    city: d.city.trim() || null,
    summary: d.summary.trim() || null,
    body: d.body.trim() || null,
    theme: d.theme.trim() || null,
    url: d.url.trim() || null,
    is_published: d.is_published,
  }
}

function EventForm({
  initial,
  userId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  userId: string
  submitLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
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
    <EditorForm
      title={submitLabel === 'Add event' ? 'New event' : 'Change this event'}
      hint="Saving puts it on the app’s Events screen and the website (unless it’s a draft)."
      onSubmit={() => submit({ preventDefault() {} })}
      onCancel={onCancel}
      busy={busy || imageBusy}
      saveLabel={submitLabel}
      canSave={draft.title.trim().length > 0}
      error={error}
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">What it is</Part>
        <Field label="Title" needed>
          <input className={staffInput} required value={draft.title} onChange={set('title')} placeholder="e.g. Midwest BunFest 2026" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Starts" needed>
            <input className={staffInput} type="datetime-local" required value={draft.starts_local} onChange={set('starts_local')} />
          </Field>
          <Field label="Ends">
            <input className={staffInput} type="datetime-local" value={draft.ends_local} onChange={set('ends_local')} />
          </Field>
        </div>
        <p className="text-sm text-slate-600">After it ends, the event moves itself to Past events — nothing to remember.</p>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">Where</Part>
        <Field label="Venue">
          <input className={staffInput} value={draft.venue} onChange={set('venue')} placeholder="The Makoy" />
        </Field>
        <Field label="Address">
          <input className={staffInput} value={draft.address} onChange={set('address')} placeholder="5462 Center St., Hilliard, OH 43026" />
        </Field>
        <Field label="City">
          <input className={staffInput} value={draft.city} onChange={set('city')} placeholder="Hilliard, OH" />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">What people read</Part>
        <StaffImageField
          label="Picture (optional)"
          hint="A photo or the event poster. Shown on the Events screen and the website."
          value={draft.image_url}
          userId={userId}
          onChange={(url) => setDraft((d) => ({ ...d, image_url: url }))}
          onBusyChange={setImageBusy}
        />
        <Field label="Summary" hint="One or two sentences shown on the card.">
          <textarea className={staffInput} rows={2} value={draft.summary} onChange={set('summary')} />
        </Field>
        <Field label="Details">
          <textarea className={`${staffInput} font-mono`} rows={6} value={draft.body} onChange={set('body')} />
        </Field>
        <Explain label="Formatting the details">
          <p>
            Leave a blank line between paragraphs. Start a line with <code>##</code> for a heading, or <code>-</code> for a
            bullet. Web addresses become tappable.
          </p>
        </Explain>
        <Field label="Theme" hint="For example: Binky On!">
          <input className={staffInput} value={draft.theme} onChange={set('theme')} />
        </Field>
        <Field label="Link">
          <input className={staffInput} type="url" value={draft.url} onChange={set('url')} placeholder="https://…" />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="D" hint="optional">In the app</Part>
        <Field label="Web address key" hint="Filled in from the title if you leave it empty.">
          <input className={staffInput} value={draft.slug} onChange={set('slug')} />
        </Field>
        <Explain label="About the BunFest event">
          <p>
            Keep <code>midwest-bunfest-2026</code> for the BunFest event — the BunFest section reads its date, venue and theme
            from that record.
          </p>
        </Explain>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-6 w-6 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
            checked={draft.is_published}
            onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
          />
          Show in the app (untick for a draft)
        </label>
      </div>
    </EditorForm>
  )
}

function EventCard({ item, userId, next = false, onChanged }: { item: EventRow; userId: string; next?: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase.from('events').update(toRow(d)).eq('id', item.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const togglePublish = async () => {
    setBusy(true)
    const { error } = await supabase.from('events').update({ is_published: !item.is_published }).eq('id', item.id)
    if (error) setError(errMessage(error))
    setBusy(false)
    if (!error) onChanged()
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await supabase.from('events').delete().eq('id', item.id)
    if (error) {
      setError(errMessage(error))
      setBusy(false)
      return
    }
    onChanged()
  }

  if (editing) {
    return <EventForm initial={draftFrom(item)} userId={userId} submitLabel="Save changes" onSubmit={saveEdit} onCancel={() => setEditing(false)} />
  }

  const e = { startsAt: item.starts_at, endsAt: item.ends_at ?? undefined }
  return (
    <Card className={`space-y-1.5 ${next ? 'border-brand-orange/60' : ''}`}>
      {next && <p className="text-sm font-extrabold uppercase tracking-wide text-brand-orange-dark">Next up</p>}
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-display text-base font-extrabold text-ink">{item.title}</h3>
        {item.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="slate">Hidden</Badge>}
      </div>
      <p className="text-[15px] text-slate-700">
        {eventDate(e)} · {eventTime(e)}
      </p>
      {(item.venue || item.city) && (
        <p className="text-[15px] text-slate-600">{[item.venue, item.city].filter(Boolean).join(' · ')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {item.theme && <Badge tone="orange">{item.theme}</Badge>}
        <Badge tone="slate">{item.slug}</Badge>
      </div>

      <CardActions className="pt-1">
        <button type="button" onClick={() => setEditing(true)} className={pill.blue}>
          Edit
        </button>
        <button type="button" onClick={togglePublish} disabled={busy} className={pill.outline}>
          {item.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete “${item.title}”? This can’t be undone.`)) void doDelete()
          }}
          disabled={busy}
          className={pill.red}
        >
          <Icon name="trash" size={16} /> {busy ? 'Working…' : 'Delete'}
        </button>
      </CardActions>
      <FormError>{error}</FormError>
    </Card>
  )
}

export default function StaffEvents() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('events.bunfest.manage')

  const [items, setItems] = useState<EventRow[]>([])
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
      .from('events')
      .select('*')
      .eq('org_id', orgId)
      .order('starts_at', { ascending: false })
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
    const { error } = await supabase.from('events').insert({
      org_id: orgId,
      ...toRow(d),
      sort_order: items.length,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  // One tap to seed the bundled BunFest record (same as the SQL seed).
  const importSeed = async () => {
    setImporting(true)
    setError(null)
    const rows = seedEvents.map((e, i) => ({
      org_id: orgId,
      slug: e.slug,
      title: e.title,
      starts_at: e.startsAt,
      ends_at: e.endsAt ?? null,
      venue: e.venue ?? null,
      address: e.address ?? null,
      city: e.city ?? null,
      summary: e.summary ?? null,
      body: e.body ?? null,
      theme: e.theme ?? null,
      url: e.url ?? null,
      is_published: true,
      sort_order: i,
      created_by: userId,
    }))
    const { error } = await supabase.from('events').insert(rows)
    if (error) setError(errMessage(error))
    setImporting(false)
    if (!error) await load()
  }

  // Newest first, with the next event still to come pulled to the top.
  const now = Date.now()
  const upcoming = items
    .filter((i) => new Date(i.ends_at ?? i.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const nextId = upcoming[0]?.id
  const ordered = nextId
    ? [items.find((i) => i.id === nextId)!, ...[...items].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).filter((i) => i.id !== nextId)]
    : [...items].sort((a, b) => b.starts_at.localeCompare(a.starts_at))

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Events</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-[15px] leading-relaxed text-slate-600">
            You don’t have access to manage events. An owner or admin can grant the “Manage Midwest
            BunFest info” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle
        title="Events"
        actions={
          !creating ? (
            <button type="button" onClick={() => setCreating(true)} className={pill.orange}>
              <Icon name="plus" size={16} /> New event
            </button>
          ) : undefined
        }
      >
        <p>Shown on the app’s Events screen and the website.</p>
        <p>
          The BunFest section reads its date, venue and theme from the <code>midwest-bunfest-2026</code> record.
        </p>
      </StaffTitle>

      {creating && (
        <EventForm initial={emptyDraft} userId={userId} submitLabel="Add event" onSubmit={create} onCancel={() => setCreating(false)} />
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <Card className="space-y-3 border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No events yet. Start from the bundled Midwest BunFest 2026 record, then edit it — or
            add your own with “New”.
          </p>
          <button type="button" onClick={importSeed} disabled={importing} className={`${btn.blue} mx-auto min-h-[48px] disabled:opacity-60`}>
            {importing ? 'Adding…' : 'Add Midwest BunFest 2026'}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {ordered.map((item) => (
            <EventCard key={item.id} item={item} userId={userId} next={item.id === nextId} onChanged={load} />
          ))}
        </div>
      )}
    </Screen>
  )
}
