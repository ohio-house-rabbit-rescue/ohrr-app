// The Inbox — everything people send through the app's and the website's
// forms (appointments, bonding/clinic sign-ups, surrender intakes, volunteer
// sign-ups, Happy Tails, mailing-list joins, …). New first; tap one to see
// every answer, call or email them in one tap, add a note, mark it done.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase, errMessage } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { Screen, Card, Badge, btn } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { exportCsv, toCsv } from '../lib/exportFile'
import { publishHappyTail } from '../features/tails/api'
import { TAIL_STATUS, type TailStatus } from '../data/tails'
import { kindLabel } from '../features/volunteers/approval'

type Row = Database['public']['Tables']['requests']['Row']
type Status = Row['status']

const KIND: Record<string, { label: string; icon: IconName }> = {
  'appointment-request': { label: 'Appointment', icon: 'calendar' },
  'service-signup': { label: 'Bonding / clinic', icon: 'heart' },
  'surrender-intake': { label: 'Surrender', icon: 'mappin' },
  'volunteer-signup': { label: 'Volunteer', icon: 'users' },
  'volunteer-application': { label: 'Volunteer application', icon: 'users' },
  'happy-tail': { label: 'Happy Tail', icon: 'sparkles' },
  'raffle-request': { label: 'Raffle tickets', icon: 'ticket' },
  'reserve-session': { label: 'BunFest session', icon: 'clock' },
  'mailing-list': { label: 'Mailing list', icon: 'mail' },
  supporter: { label: 'New supporter', icon: 'heart' },
  'foster-application': { label: 'Foster interest', icon: 'home' },
  'found-rabbit': { label: 'Found rabbit', icon: 'mappin' },
  'notify-me': { label: 'Tell me when', icon: 'clock' },
  'legacy-info': { label: 'Legacy Fund', icon: 'gift' },
  'contact': { label: 'Message', icon: 'mail' },
  'adoption-application': { label: 'Adoption application', icon: 'heart' },
  'booking': { label: 'Booking', icon: 'calendar' },
}
const kindMeta = (k: string) => KIND[k] ?? { label: k.replace(/-/g, ' '), icon: 'mail' as IconName }

const STATUS: { value: Status; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

function when(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Yesterday ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`
}

/**
 * A payload value as text. Most are strings; a volunteer application's
 * `kinds` is a list ("socialization", "buncare" → "Bunny Socialization, Buncare").
 */
function valueText(key: string, v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((x) => (key === 'kinds' ? kindLabel(String(x)) : String(x))).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** "bunnyName" → "Bunny name", "agreementDate" → "Agreement date". */
function labelOf(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export default function StaffInbox() {
  const { membership, user } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Status | 'open'>('open')
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) setError(errMessage(error))
    else setRows((data ?? []) as Row[])
  }, [orgId])

  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  const shown = useMemo(
    () => (rows ?? []).filter((r) => (filter === 'open' ? r.status === 'new' || r.status === 'in_progress' : r.status === filter)),
    [rows, filter],
  )
  const counts = useMemo(() => {
    const c = { open: 0, new: 0, in_progress: 0, done: 0, archived: 0 }
    for (const r of rows ?? []) {
      c[r.status]++
      if (r.status === 'new' || r.status === 'in_progress') c.open++
    }
    return c
  }, [rows])

  const setStatus = async (r: Row, status: Status, notes?: string) => {
    setError(null)
    const { error } = await supabase.rpc('set_request_status', { p_id: r.id, p_status: status, p_notes: notes ?? null })
    if (error) {
      setError(errMessage(error))
      return
    }
    setRows((list) =>
      (list ?? []).map((x) =>
        x.id === r.id
          ? { ...x, status, staff_notes: notes ?? x.staff_notes, handled_by: status === 'done' ? (user?.id ?? null) : x.handled_by }
          : x,
      ),
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Inbox</h1>
        <p className="mt-1 text-sm text-slate-600">Requests and sign-ups sent from the app and the website.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([{ value: 'open', label: 'To do' }, ...STATUS.filter((s) => s.value !== 'new' && s.value !== 'in_progress')] as { value: Status | 'open'; label: string }[]).map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilter(s.value)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${filter === s.value ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {s.label} ({counts[s.value]})
          </button>
        ))}
      </div>

      {shown.length > 0 && (
        <button
          type="button"
          onClick={() =>
            exportCsv(
              `ohrr-inbox-${filter}-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(
                ['Received', 'Kind', 'Name', 'Email', 'Phone', 'Subject', 'Status', 'Details', 'Staff notes'],
                shown.map((r) => [
                  new Date(r.created_at).toLocaleString(),
                  kindMeta(r.kind).label,
                  r.name ?? '',
                  r.email ?? '',
                  r.phone ?? '',
                  r.subject ?? '',
                  r.status,
                  Object.entries((r.payload ?? {}) as Record<string, unknown>)
                    .map(([k, v]) => `${labelOf(k)}: ${valueText(k, v)}`)
                    .join(' | '),
                  r.staff_notes ?? '',
                ]),
              ),
            )
          }
          className={`${btn.outline} w-full`}
        >
          <Icon name="mail" size={16} /> Export these {shown.length} (CSV)
        </button>
      )}
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          {filter === 'open' ? 'Nothing waiting. 🎉' : 'Nothing here.'}
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((r) => {
          const k = kindMeta(r.kind)
          const open = openId === r.id
          const payload = (r.payload ?? {}) as Record<string, string>
          return (
            <li key={r.id}>
              <Card className={`space-y-3 ${r.status === 'new' ? 'border-brand-orange/40' : ''}`}>
                <button type="button" onClick={() => setOpenId(open ? null : r.id)} className="flex w-full items-start gap-3 text-left">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                    <Icon name={k.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-display text-[15px] font-extrabold text-ink">{r.name || 'No name'}</span>
                      {r.status === 'new' && <Badge tone="orange">New</Badge>}
                      {r.status === 'in_progress' && <Badge tone="blue">In progress</Badge>}
                      {r.source === 'website' && <Badge tone="slate">website</Badge>}
                    </span>
                    <span className="block text-sm text-slate-700">
                      {k.label}
                      {r.subject && r.subject !== k.label ? ` · ${r.subject}` : ''}
                    </span>
                    <span className="block text-xs text-slate-400">{when(r.created_at)}</span>
                  </span>
                  <Icon name="chevron" size={18} className={`mt-1 shrink-0 text-slate-300 transition ${open ? 'rotate-90' : ''}`} />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {r.phone && (
                        <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-bold text-white">
                          <Icon name="phone" size={16} /> Call {r.phone}
                        </a>
                      )}
                      {r.email && (
                        <a
                          href={`mailto:${r.email}?subject=${encodeURIComponent(`OHRR — ${k.label}${r.subject ? `: ${r.subject}` : ''}`)}`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-blue-50 px-4 text-sm font-bold text-brand-blue"
                        >
                          <Icon name="mail" size={16} /> Email
                        </a>
                      )}
                    </div>
                    <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                      {r.email && <Field label="Email" value={r.email} />}
                      {Object.entries(payload).map(([key, value]) => (
                        <Field key={key} label={labelOf(key)} value={valueText(key, value)} />
                      ))}
                    </dl>
                    {r.kind === 'volunteer-application' && (
                      <Link
                        to="/staff/volunteers"
                        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue"
                      >
                        Approve or decline in Volunteers <Icon name="chevron" size={14} />
                      </Link>
                    )}
                    {r.kind === 'happy-tail' && <PublishTail row={r} payload={payload} onPublished={() => void setStatus(r, 'done')} />}
                    <Notes row={r} onSave={(n) => setStatus(r, r.status, n)} />
                    <div className="grid grid-cols-2 gap-2">
                      {r.status !== 'done' ? (
                        <button type="button" onClick={() => void setStatus(r, 'done')} className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-brand-orange font-display text-base font-extrabold text-white">
                          <Icon name="check" size={18} /> Done
                        </button>
                      ) : (
                        <button type="button" onClick={() => void setStatus(r, 'new')} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-100 font-display text-base font-extrabold text-ink">
                          Reopen
                        </button>
                      )}
                      {r.status === 'new' ? (
                        <button type="button" onClick={() => void setStatus(r, 'in_progress')} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-brand-blue/40 font-display text-base font-extrabold text-brand-blue">
                          I’m on it
                        </button>
                      ) : r.status !== 'archived' ? (
                        <button type="button" onClick={() => void setStatus(r, 'archived')} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-slate-200 font-display text-base font-extrabold text-slate-600">
                          Archive
                        </button>
                      ) : (
                        <button type="button" onClick={() => void setStatus(r, 'done')} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-slate-200 font-display text-base font-extrabold text-slate-600">
                          Unarchive
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}

function isPhoto(value: string): boolean {
  return /^https?:\/\/\S+\.(jpe?g|png|webp|heic)(\?|$)/i.test(value.trim())
}

function Field({ label, value }: { label: string; value: string }) {
  // A photo sent with the form (found rabbit, surrender, Happy Tail) is worth
  // seeing, not reading as a URL.
  if (isPhoto(value)) {
    return (
      <div className="px-3.5 py-2">
        <dt className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd>
          <a href={value} target="_blank" rel="noopener noreferrer">
            <img src={value} alt={label} className="max-h-64 w-full rounded-xl object-cover" loading="lazy" />
          </a>
        </dd>
      </div>
    )
  }
  const isLong = value.length > 80 || value.includes('\n')
  return (
    <div className={`px-3.5 py-2 ${isLong ? '' : 'flex items-baseline gap-3'}`}>
      <dt className={`shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400 ${isLong ? 'mb-0.5' : 'w-28'}`}>{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-sm text-ink">{value}</dd>
    </div>
  )
}

function Notes({ row, onSave }: { row: Row; onSave: (notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState(row.staff_notes ?? '')
  const dirty = notes !== (row.staff_notes ?? '')
  return (
    <label className="block text-sm font-semibold text-slate-700">
      Notes for the team
      <textarea className={staffInput} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Called back Tue, confirmed for Sat 1 pm" />
      {dirty && (
        <button type="button" onClick={() => void onSave(notes)} className="mt-2 rounded-full bg-brand-blue-50 px-4 py-2 text-sm font-bold text-brand-blue">
          Save note
        </button>
      )}
    </label>
  )
}

/**
 * Inbox → Happy Tails. Pre-filled from what the adopter sent, because the whole
 * point is one tap: before this, a story could arrive and never reach the page.
 */
function PublishTail({
  row,
  payload,
  onPublished,
}: {
  row: Row
  payload: Record<string, string>
  onPublished: () => void
}) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({
    bunny: payload.bunny ?? '',
    family: row.name ? `${row.name.split(' ').slice(-1)[0]} family` : '',
    status: 'going-strong' as TailStatus,
    since: payload.since ?? '',
    summary: (payload.story ?? '').slice(0, 140),
    story: payload.story ?? '',
    photoUrl: payload.photo ?? payload.photoUrl ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  if (done) {
    return (
      <p className="rounded-2xl border border-green-200 bg-green-50/70 px-3.5 py-2.5 text-sm font-bold text-green-800">
        Published to Happy Tails.{' '}
        <Link to="/staff/tails" className="underline">
          Edit it
        </Link>
      </p>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn.outline} w-full`}>
        <Icon name="sparkles" size={16} /> Publish as a Happy Tail
      </button>
    )
  }

  const publish = async () => {
    setBusy(true)
    setError(null)
    try {
      await publishHappyTail({
        requestId: row.id,
        bunny: d.bunny.trim(),
        summary: d.summary.trim() || d.story.slice(0, 140),
        family: d.family.trim() || undefined,
        status: d.status,
        since: d.since.trim() || undefined,
        story: d.story.trim() || undefined,
        photoUrl: d.photoUrl.trim() || undefined,
      })
      setDone(true)
      onPublished()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-blue/25 bg-brand-blue-50/40 p-3">
      <p className="font-display text-[15px] font-extrabold text-ink">Publish as a Happy Tail</p>
      {d.photoUrl && <img src={d.photoUrl} alt="" className="max-h-48 w-full rounded-xl object-cover" />}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Bunny
          <input className={staffInput} value={d.bunny} onChange={txt('bunny')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Family
          <input className={staffInput} value={d.family} onChange={txt('family')} placeholder="Patel family" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          How they’re doing
          <select className={staffInput} value={d.status} onChange={txt('status')}>
            {Object.entries(TAIL_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Since
          <input className={staffInput} value={d.since} onChange={txt('since')} placeholder="Adopted Mar 2025" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        One-line summary (on the card)
        <input className={staffInput} value={d.summary} onChange={txt('summary')} maxLength={160} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        The story
        <textarea className={staffInput} rows={4} value={d.story} onChange={txt('story')} />
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="button" onClick={publish} disabled={busy || !d.bunny.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500">
          Not yet
        </button>
      </div>
    </div>
  )
}
