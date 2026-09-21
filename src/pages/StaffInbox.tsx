// The Inbox — everything people send through the app's and the website's
// forms (appointments, bonding/clinic sign-ups, surrender intakes, volunteer
// sign-ups, Happy Tails, mailing-list joins, …). New first; tap one to see
// every answer, call or email them in one tap, add a note, mark it done.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, errMessage } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { Screen, Card, Badge } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'

type Row = Database['public']['Tables']['requests']['Row']
type Status = Row['status']

const KIND: Record<string, { label: string; icon: IconName }> = {
  'appointment-request': { label: 'Appointment', icon: 'calendar' },
  'service-signup': { label: 'Bonding / clinic', icon: 'heart' },
  'surrender-intake': { label: 'Surrender', icon: 'mappin' },
  'volunteer-signup': { label: 'Volunteer', icon: 'users' },
  'happy-tail': { label: 'Happy Tail', icon: 'sparkles' },
  'raffle-request': { label: 'Raffle tickets', icon: 'ticket' },
  'reserve-session': { label: 'BunFest session', icon: 'clock' },
  'mailing-list': { label: 'Mailing list', icon: 'mail' },
  supporter: { label: 'New supporter', icon: 'heart' },
  'foster-application': { label: 'Foster interest', icon: 'home' },
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
                      {r.subject ? ` · ${r.subject}` : ''}
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
                        <Field key={key} label={labelOf(key)} value={value} />
                      ))}
                    </dl>
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

function Field({ label, value }: { label: string; value: string }) {
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
