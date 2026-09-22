// Staff → Volunteers: the roster, and the hours people log for themselves.
//
// Until now a volunteer was an email address on a booking and nothing more —
// no record of who they are, what they're cleared for, or whether they've done
// their orientation. This is that record, plus the private link (and QR code)
// each person uses to see and log their own hours.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import QrCode from '../../../components/QrCode'
import { copyText, shareText } from '../../share/share'
import { bccMailto, exportCsv, toCsv } from '../../../lib/exportFile'
import {
  deleteHoursEntry,
  deleteVolunteer,
  hoursLabel,
  hoursUrl,
  listVolunteers,
  saveVolunteer,
  setHoursStatus,
  statusLabel,
  unconfirmedHours,
  volunteerHours,
  VOLUNTEER_ROLES,
  VOLUNTEER_STATUS,
  type HoursRow,
  type VolunteerRow,
} from '../api'

type Tab = 'roster' | 'hours'

export default function StaffVolunteers() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('roster')
  const [rows, setRows] = useState<VolunteerRow[] | null>(null)
  const [pending, setPending] = useState<HoursRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [list, unconfirmed] = await Promise.all([listVolunteers(orgId), unconfirmedHours(orgId)])
      setRows(list)
      setPending(unconfirmed)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Volunteers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Who volunteers, what they’re cleared for, and the hours they’ve given. Each person gets a private link to log
          their own.
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['roster', `Roster${rows ? ` (${rows.length})` : ''}`],
            ['hours', `To confirm${pending.length ? ` (${pending.length})` : ''}`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[44px] flex-1 rounded-full px-2 text-[13px] font-bold ${
              tab === t ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && tab === 'roster' && <Roster orgId={orgId} rows={rows} onChanged={load} />}
      {rows && tab === 'hours' && <ToConfirm rows={rows} pending={pending} onChanged={load} />}
    </Screen>
  )
}

/* ================================================================ roster */

function Roster({ orgId, rows, onChanged }: { orgId: string; rows: VolunteerRow[]; onChanged: () => Promise<void> }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter((r) => `${r.name} ${r.email ?? ''} ${r.phone ?? ''} ${r.roles.join(' ')}`.toLowerCase().includes(t))
  }, [rows, q])

  const active = rows.filter((r) => r.status === 'active')

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find by name, email or role"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none focus:border-brand-blue"
          />
        </div>
        {editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')} className={`${btn.primary} shrink-0 !px-4 !py-2.5`}>
            <Icon name="plus" size={16} /> Add
          </button>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <a
            href={bccMailto(active.map((r) => r.email ?? '').filter(Boolean), 'OHRR volunteers')}
            className="rounded-full bg-brand-blue-50 px-3.5 py-2 text-xs font-bold text-brand-blue"
          >
            <Icon name="mail" size={14} className="mr-1 inline" /> Email all active
          </a>
          <button
            type="button"
            onClick={() =>
              exportCsv(
                `ohrr-volunteers-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(
                  ['Name', 'Status', 'Email', 'Phone', 'Roles', 'Started', 'Orientation', 'Notes'],
                  rows.map((r) => [
                    r.name,
                    statusLabel(r.status),
                    r.email ?? '',
                    r.phone ?? '',
                    r.roles.join('; '),
                    r.started_on ?? '',
                    r.orientation_on ?? '',
                    r.notes ?? '',
                  ]),
                ),
              )
            }
            className="rounded-full border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600"
          >
            Export the roster (CSV)
          </button>
        </div>
      )}

      {editing === 'new' && (
        <Card>
          <VolunteerForm
            orgId={orgId}
            initial={null}
            onDone={async () => {
              setEditing(null)
              await onChanged()
            }}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      {rows.length === 0 && (
        <Card className="text-sm text-slate-600">
          Nobody on the roster yet. Add the people who volunteer regularly — the hours they’ve already logged against
          their email address will attach themselves.
        </Card>
      )}

      {shown.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <VolunteerForm
              orgId={orgId}
              initial={r}
              onDone={async () => {
                setEditing(null)
                await onChanged()
              }}
              onCancel={() => setEditing(null)}
            />
          </Card>
        ) : (
          <Card key={r.id} className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.name}</span>
                  {r.status !== 'active' && <Badge tone="slate">{statusLabel(r.status)}</Badge>}
                  {r.orientation_on && <Badge tone="blue">Orientation done</Badge>}
                </span>
                {r.roles.length > 0 && <span className="block text-xs text-slate-500">{r.roles.join(' · ')}</span>}
                <span className="block text-xs text-slate-400">
                  {[r.email, r.phone].filter(Boolean).join(' · ') || 'No contact details'}
                </span>
              </span>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button type="button" onClick={() => setEditing(r.id)} className="text-sm font-bold text-brand-blue">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  className="text-xs font-bold text-slate-500"
                >
                  {openId === r.id ? 'Hide' : 'Hours & link'}
                </button>
              </div>
            </div>
            {openId === r.id && <VolunteerDetail v={r} onChanged={onChanged} />}
          </Card>
        ),
      )}
    </div>
  )
}

/** The private link + QR, and every hour on this person's record. */
function VolunteerDetail({ v, onChanged }: { v: VolunteerRow; onChanged: () => Promise<void> }) {
  const [hours, setHours] = useState<HoursRow[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const link = hoursUrl(v.access_token)

  const load = useCallback(async () => {
    try {
      setHours(await volunteerHours(v.id))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [v.id])
  useEffect(() => {
    void load()
  }, [load])

  const total = (hours ?? []).reduce((n, h) => n + Number(h.hours), 0)
  const confirmed = (hours ?? []).filter((h) => h.status === 'confirmed').reduce((n, h) => n + Number(h.hours), 0)

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-brand-blue-50/50 p-3">
        <p className="text-center text-sm font-bold text-ink">Their private hours link</p>
        <QrCode value={link} size={168} alt={`QR code to ${v.name}'s hours`} />
        <p className="break-all text-center text-[11px] text-slate-500">{link}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => copyText(link).then((ok) => setNote(ok ? 'Link copied.' : null))}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600"
          >
            Copy link
          </button>
          {v.email && (
            <a
              href={`mailto:${v.email}?subject=${encodeURIComponent('Your OHRR volunteer hours')}&body=${encodeURIComponent(
                `Hi ${v.name.split(' ')[0]},\n\nThis link opens your own volunteer-hours record in the OHRR app — you can see your totals and log hours yourself:\n\n${link}\n\nKeep it private to you.\n\nThank you for everything you do,\nOhio House Rabbit Rescue`,
              )}`}
              className="rounded-full bg-brand-blue px-3.5 py-2 text-xs font-bold text-white"
            >
              Email it to them
            </a>
          )}
          <button
            type="button"
            onClick={() => shareText(link, `${v.name} — volunteer hours`)}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600"
          >
            Share
          </button>
        </div>
        {note && <p className="text-xs font-bold text-green-700">{note}</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-ink">
          {hoursLabel(total)} total{confirmed !== total ? ` · ${hoursLabel(confirmed)} confirmed` : ''}
        </span>
        <Link to="/staff/hours-letter" className="text-xs font-bold text-brand-blue">
          Service letter →
        </Link>
      </div>

      <FormError>{error}</FormError>
      {hours === null && <Spinner />}
      {hours && hours.length === 0 && <p className="text-sm text-slate-500">No hours recorded yet.</p>}
      {hours && hours.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {hours.slice(0, 12).map((h) => (
            <li key={h.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">
                  {hoursLabel(Number(h.hours))} · {h.activity}
                </span>
                <span className="block text-xs text-slate-500">
                  {new Date(`${h.on_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {h.source === 'self' ? ' · logged by them' : h.source === 'checkin' ? ' · from a shift' : ' · added by staff'}
                  {h.note ? ` · ${h.note}` : ''}
                </span>
              </span>
              {h.status === 'logged' ? (
                <button
                  type="button"
                  onClick={() => setHoursStatus(h.id, 'confirmed').then(load).then(onChanged).catch((e) => setError(errMessage(e)))}
                  className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Confirm
                </button>
              ) : (
                <Badge tone="blue">Confirmed</Badge>
              )}
              <button
                type="button"
                onClick={() => deleteHoursEntry(h.id).then(load).then(onChanged).catch((e) => setError(errMessage(e)))}
                aria-label="Delete this entry"
                className="shrink-0 text-red-600"
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VolunteerForm({
  orgId,
  initial,
  onDone,
  onCancel,
}: {
  orgId: string
  initial: VolunteerRow | null
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    status: initial?.status ?? ('active' as VolunteerRow['status']),
    roles: initial?.roles ?? [],
    started_on: initial?.started_on ?? '',
    orientation_on: initial?.orientation_on ?? '',
    notes: initial?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const toggleRole = (r: string) =>
    setD((x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveVolunteer({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        name: d.name.trim(),
        email: d.email.trim() || null,
        phone: d.phone.trim() || null,
        status: d.status,
        roles: d.roles,
        started_on: d.started_on || null,
        orientation_on: d.orientation_on || null,
        notes: d.notes.trim() || null,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Name
        <input className={staffInput} required value={d.name} onChange={txt('name')} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input className={staffInput} type="email" value={d.email} onChange={txt('email')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Phone
          <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        The email matters: hours already recorded against it attach to this person automatically.
      </p>
      <label className="block text-sm font-semibold text-slate-700">
        Where they’re at
        <select className={staffInput} value={d.status} onChange={txt('status')}>
          {VOLUNTEER_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="text-sm font-semibold text-slate-700">What they do</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {VOLUNTEER_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${
                d.roles.includes(r) ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Started
          <input type="date" className={staffInput} value={d.started_on} onChange={txt('started_on')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Buncare orientation
          <input type="date" className={staffInput} value={d.orientation_on} onChange={txt('orientation_on')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Notes <span className="font-normal text-slate-400">(staff only)</span>
        <textarea className={staffInput} rows={2} value={d.notes} onChange={txt('notes')} />
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.name.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deleteVolunteer(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
        <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ============================================================ to confirm */

function ToConfirm({
  rows,
  pending,
  onChanged,
}: {
  rows: VolunteerRow[]
  pending: HoursRow[]
  onChanged: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const nameOf = (id: string | null) => rows.find((r) => r.id === id)?.name ?? 'Someone'

  if (pending.length === 0) {
    return (
      <Card className="space-y-2 text-sm text-slate-600">
        <p className="font-bold text-ink">Nothing waiting.</p>
        <p>Hours a volunteer logs for themselves appear here so you can confirm or correct them before they count on a service letter.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <FormError>{error}</FormError>
      <button
        type="button"
        onClick={async () => {
          try {
            await Promise.all(pending.map((h) => setHoursStatus(h.id, 'confirmed')))
            await onChanged()
          } catch (e) {
            setError(errMessage(e))
          }
        }}
        className={`${btn.primary} w-full`}
      >
        <Icon name="check" size={17} /> Confirm all {pending.length}
      </button>
      {pending.map((h) => (
        <Card key={h.id} className="space-y-1">
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">
                {nameOf(h.volunteer_id)} · {hoursLabel(Number(h.hours))}
              </span>
              <span className="block text-sm text-slate-600">{h.activity}</span>
              <span className="block text-xs text-slate-400">
                {new Date(`${h.on_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {h.note ? ` · ${h.note}` : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setHoursStatus(h.id, 'confirmed').then(onChanged).catch((e) => setError(errMessage(e)))}
              className="shrink-0 rounded-full bg-green-600 px-3.5 py-2 text-xs font-bold text-white"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => deleteHoursEntry(h.id).then(onChanged).catch((e) => setError(errMessage(e)))}
              aria-label="Delete"
              className="shrink-0 self-center text-red-600"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
