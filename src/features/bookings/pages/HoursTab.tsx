// Staff → Bookings → Hours: who volunteered how much (checked-in shifts plus
// hours added by hand), and a service-hours letter per person.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Card, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { addHours, deleteHours, hoursHistory, hoursSummary, type HoursLine, type HoursSummaryRow } from '../api'

export type Period = 'ytd' | '12m' | 'lastyear'

export function periodRange(p: Period): { from: string; to: string; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (p === 'lastyear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `${y - 1}` }
  if (p === '12m') {
    const from = new Date(now)
    from.setFullYear(from.getFullYear() - 1)
    return { from: iso(from), to: iso(now), label: 'the last 12 months' }
  }
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` }
}

export const fmtHours = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1))
export const fmtDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function HoursTab() {
  const { membership, user } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [period, setPeriod] = useState<Period>('ytd')
  const [rows, setRows] = useState<HoursSummaryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<HoursSummaryRow | null>(null)
  const [adding, setAdding] = useState(false)
  const range = useMemo(() => periodRange(period), [period])

  const load = useCallback(async () => {
    try {
      setRows(await hoursSummary(orgId, range.from, range.to))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, range])
  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => !n || (r.name ?? '').toLowerCase().includes(n) || r.email.includes(n))
  }, [rows, q])
  const total = useMemo(() => (rows ?? []).reduce((s, r) => s + r.total_hours, 0), [rows])

  if (open) return <Person row={open} orgId={orgId} userId={user?.id ?? ''} range={range} onBack={() => setOpen(null)} onChanged={load} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['ytd', 'This year'],
            ['12m', 'Last 12 months'],
            ['lastyear', 'Last year'],
          ] as [Period, string][]
        ).map(([p, label]) => (
          <button key={p} type="button" onClick={() => setPeriod(p)} className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${period === p ? 'bg-brand-orange text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Volunteer hours, {range.label}</p>
          <p className="font-display text-3xl font-black text-ink">{fmtHours(total)}</p>
          <p className="text-xs text-slate-500">{(rows ?? []).length} people · checked-in shifts + hours added by hand</p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className={`${btn.blue} px-4 py-2`}>
          <Icon name="plus" size={14} /> Add hours
        </button>
      </Card>
      {adding && (
        <AddHours
          orgId={orgId}
          userId={user?.id ?? ''}
          onDone={async () => {
            setAdding(false)
            await load()
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a volunteer" aria-label="Find a volunteer" className={staffInput} />
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && shown.length === 0 && <p className="text-sm text-slate-500">No hours recorded in this period yet. Check people in on the roster, or add hours by hand.</p>}
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.email}>
            <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] font-extrabold text-ink">{r.name || r.email}</span>
                <span className="block text-xs text-slate-500">
                  {r.shifts} entr{r.shifts === 1 ? 'y' : 'ies'} · last {fmtDate(r.last_date)}
                </span>
              </span>
              <span className="font-display text-xl font-black text-brand-blue">{fmtHours(r.total_hours)} h</span>
              <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Person({ row, orgId, userId, range, onBack, onChanged }: { row: HoursSummaryRow; orgId: string; userId: string; range: { from: string; to: string; label: string }; onBack: () => void; onChanged: () => Promise<void> }) {
  const [lines, setLines] = useState<HoursLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const load = useCallback(async () => {
    try {
      setLines(await hoursHistory(orgId, row.email, range.from, range.to))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, row.email, range])
  useEffect(() => {
    void load()
  }, [load])
  const total = (lines ?? []).reduce((s, l) => s + l.hours, 0)
  const letterHref = `/staff/hours-letter?email=${encodeURIComponent(row.email)}&name=${encodeURIComponent(row.name ?? '')}&from=${range.from}&to=${range.to}`

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        <Icon name="arrowLeft" size={20} /> Everyone
      </button>
      <Card className="space-y-1">
        <p className="font-display text-xl font-black text-ink">{row.name || row.email}</p>
        <p className="text-sm text-slate-600">{row.email}</p>
        <p className="font-display text-3xl font-black text-brand-blue">
          {fmtHours(total)} h <span className="text-sm font-bold text-slate-400">in {range.label}</span>
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Link to={letterHref} className={`${btn.primary} w-full`}>
          <Icon name="printer" size={16} /> Service letter
        </Link>
        <button type="button" onClick={() => setAdding(true)} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add hours
        </button>
      </div>
      {adding && (
        <AddHours
          orgId={orgId}
          userId={userId}
          preset={{ email: row.email, name: row.name ?? '' }}
          onDone={async () => {
            setAdding(false)
            await load()
            await onChanged()
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <FormError>{error}</FormError>
      {lines === null && !error && <Spinner />}
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {(lines ?? []).map((l) => (
          <li key={`${l.source}:${l.ref_id}`} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
            <span className="w-24 shrink-0 text-slate-500">{fmtDate(l.on_date)}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{l.activity}</span>
            <span className="font-bold text-ink">{fmtHours(l.hours)} h</span>
            {l.source === 'manual' && (
              <button
                type="button"
                onClick={() => window.confirm('Remove these hours?') && deleteHours(l.ref_id).then(load).then(onChanged).catch((e) => setError(errMessage(e)))}
                className="text-red-600"
                aria-label="Remove"
              >
                <Icon name="trash" size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function AddHours({ orgId, userId, preset, onDone, onCancel }: { orgId: string; userId: string; preset?: { email: string; name: string }; onDone: () => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({ email: preset?.email ?? '', name: preset?.name ?? '', on_date: new Date().toISOString().slice(0, 10), hours: '2', activity: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await addHours(orgId, userId, { email: f.email, name: f.name, on_date: f.on_date, hours: Number(f.hours), activity: f.activity.trim() || 'Volunteering' })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <Card className="space-y-3">
        <p className="font-display text-[15px] font-extrabold text-ink">Add hours by hand</p>
        <p className="text-xs text-slate-500">For anything that wasn’t booked as a shift — transport runs, events, orientation.</p>
        {!preset && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              Name
              <input className={staffInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input className={staffInput} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">
            Date
            <input className={staffInput} type="date" value={f.on_date} onChange={(e) => setF({ ...f, on_date: e.target.value })} required />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Hours
            <input className={staffInput} inputMode="decimal" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value.replace(/[^0-9.]/g, '') })} required />
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          What they did
          <input className={staffInput} value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} placeholder="Vet transport · BunFest set-up · Buncare orientation" />
        </label>
        <FormError>{error}</FormError>
        <div className="flex gap-2">
          <button type="submit" disabled={busy || !f.email || !Number(f.hours)} className={`${btn.primary} px-5 disabled:opacity-60`}>
            Save
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600">
            Cancel
          </button>
        </div>
      </Card>
    </form>
  )
}
