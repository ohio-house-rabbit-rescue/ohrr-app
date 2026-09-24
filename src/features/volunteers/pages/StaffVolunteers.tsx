// Staff → Volunteers: the roster, and the hours people log for themselves.
//
// Until now a volunteer was an email address on a booking and nothing more —
// no record of who they are, what they're cleared for, or whether they've done
// their orientation. This is that record, plus the private link (and QR code)
// each person uses to see and log their own hours.
//
// Update 25: new volunteers apply (/volunteer/apply) and wait here, at the top,
// until someone approves them — for everything, or for certain kinds of
// volunteering — or declines them. Each roster entry says what the person is
// approved for; the certificate hours (for whoever makes certificates) are at
// the foot.
//
// Update 28: a volunteer can be Trusted. Hours a trusted volunteer logs count
// straight away (still marked self-reported); "To confirm" lists them under
// "Counted straight away" so staff can un-confirm any that look wrong.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import QrCode from '../../../components/QrCode'
import { copyText, shareText } from '../../share/share'
import { bccMailto, exportCsv, toCsv } from '../../../lib/exportFile'
import {
  approveVolunteer,
  declineVolunteer,
  deleteHoursEntry,
  deleteVolunteer,
  hoursLabel,
  hoursUrl,
  listVolunteers,
  recentSelfReported,
  saveVolunteer,
  setHoursStatus,
  statusLabel,
  unconfirmedHours,
  volunteerHours,
  volunteerPageUrl,
  VOLUNTEER_ROLES,
  VOLUNTEER_STATUS,
  type HoursRow,
  type VolunteerRow,
} from '../api'
import { APPROVAL_KINDS, approvedText, EVERYTHING, kindLabel } from '../approval'

type Tab = 'roster' | 'hours'

export default function StaffVolunteers() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('roster')
  const [rows, setRows] = useState<VolunteerRow[] | null>(null)
  const [pending, setPending] = useState<HoursRow[]>([])
  const [selfReported, setSelfReported] = useState<HoursRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [list, unconfirmed, recent] = await Promise.all([
        listVolunteers(orgId),
        unconfirmedHours(orgId),
        recentSelfReported(orgId).catch(() => [] as HoursRow[]),
      ])
      setRows(list)
      setPending(unconfirmed)
      setSelfReported(recent)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])

  // A trusted volunteer's own hours that already count (update 28).
  const counted = useMemo(() => {
    const trusted = new Set((rows ?? []).filter((r) => r.trust_level === 'trusted').map((r) => r.id))
    return selfReported.filter((h) => h.volunteer_id && trusted.has(h.volunteer_id))
  }, [rows, selfReported])

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

      {rows && <Applications rows={rows} userId={user?.id ?? null} onChanged={load} />}

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
      {rows && tab === 'hours' && <ToConfirm rows={rows} pending={pending} counted={counted} onChanged={load} />}
      {orgId && can('volunteers.certificates') && <CertificateHours orgId={orgId} />}
    </Screen>
  )
}

/* ========================================================= applications */

type Decision = { kind: 'approved'; approvedFor: string[] } | { kind: 'declined' }

const firstName = (v: VolunteerRow) => v.name.trim().split(/\s+/)[0] || v.name

function mailto(v: VolunteerRow, subject: string, body: string): string {
  return `mailto:${v.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** What they're approved for, their private page, and how to sign up. */
function approvedMail(v: VolunteerRow, approvedFor: string[]): string {
  const what = approvedFor.includes(EVERYTHING) ? 'every kind of volunteering we do' : approvedText(approvedFor)
  return mailto(
    v,
    'You’re approved to volunteer with OHRR',
    [
      `Hi ${firstName(v)},`,
      '',
      `Thank you for applying to volunteer with Ohio House Rabbit Rescue. You’re approved for ${what}.`,
      '',
      'This link opens your own volunteer page. It shows what you’re signed up for and the hours you’ve given, and it makes a signed hours letter whenever you need one. Please keep it to yourself:',
      hoursUrl(v.access_token),
      '',
      `To sign up for a shift, open the Volunteer page in the OHRR app (${volunteerPageUrl()}), pick a shift, and enter this email address — ${v.email ?? ''} — when it asks for the email you applied with.`,
      '',
      'Thank you for giving your time to the rabbits. We’re so glad to have you.',
      '',
      'Ohio House Rabbit Rescue',
    ].join('\n'),
  )
}

/** A kind note for someone OHRR can't take on. */
function declinedMail(v: VolunteerRow): string {
  return mailto(
    v,
    'Your OHRR volunteer application',
    [
      `Hi ${firstName(v)},`,
      '',
      'Thank you so much for applying to volunteer with Ohio House Rabbit Rescue, and for thinking of the rabbits.',
      '',
      'We’re not able to offer you a volunteer place right now. We’re a small, volunteer-run rescue and can only welcome so many new people at a time, so please don’t take it as a reflection on you.',
      '',
      'There are still lots of ways to help — sharing our adoptable rabbits, coming along to Midwest BunFest, or visiting the Hop Shop — and you’re welcome to apply again in the future.',
      '',
      'With thanks,',
      'Ohio House Rabbit Rescue',
    ].join('\n'),
  )
}

// Their answers, in the order the form asks them; anything else after.
const ANSWER_ORDER: [key: string, label: string][] = [
  ['age', 'Age'],
  ['guardianName', 'Parent or guardian'],
  ['guardianEmail', 'Guardian’s email'],
  ['availability', 'Usually free'],
  ['experience', 'With rabbits'],
  ['hoursFor', 'Needs hours for'],
  ['anythingElse', 'Anything else'],
]

function answerText(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function answersOf(v: VolunteerRow): { wanted: string[]; lines: [string, string][] } {
  const app = (v.application ?? {}) as Record<string, unknown>
  const wanted = Array.isArray(app.kinds) ? app.kinds.map(String) : []
  const known = new Set(ANSWER_ORDER.map(([k]) => k))
  const lines: [string, string][] = []
  for (const [k, label] of ANSWER_ORDER) if (answerText(app[k]).trim()) lines.push([label, answerText(app[k])])
  for (const [k, val] of Object.entries(app)) {
    if (k === 'kinds' || known.has(k) || !answerText(val).trim()) continue
    const label = k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
    lines.push([label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(), answerText(val)])
  }
  return { wanted, lines }
}

function appliedWhen(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Waiting for approval (N)" — new applicants, newest first. */
function Applications({ rows, userId, onChanged }: { rows: VolunteerRow[]; userId: string | null; onChanged: () => Promise<void> }) {
  // Decided here just now: kept on screen so staff can send the email.
  const [decided, setDecided] = useState<Record<string, Decision>>({})
  const waiting = rows
    .filter((r) => r.review_status === 'pending')
    .sort((a, b) => (b.applied_at ?? '').localeCompare(a.applied_at ?? ''))
  const recent = rows.filter((r) => decided[r.id] && r.review_status !== 'pending')
  if (waiting.length === 0 && recent.length === 0) return null

  return (
    <section id="applications" className="space-y-2.5">
      <p className="px-1 font-display text-lg font-extrabold text-ink">Waiting for approval ({waiting.length})</p>
      {recent.map((r) => (
        <Decided
          key={r.id}
          v={r}
          d={decided[r.id]}
          onHide={() =>
            setDecided((x) => {
              const next = { ...x }
              delete next[r.id]
              return next
            })
          }
        />
      ))}
      {waiting.map((r) => (
        <Applicant
          key={r.id}
          v={r}
          userId={userId}
          onDecided={async (d) => {
            setDecided((x) => ({ ...x, [r.id]: d }))
            await onChanged()
          }}
        />
      ))}
    </section>
  )
}

function Applicant({ v, userId, onDecided }: { v: VolunteerRow; userId: string | null; onDecided: (d: Decision) => Promise<void> }) {
  const { wanted, lines } = answersOf(v)
  const [mode, setMode] = useState<'idle' | 'pick' | 'decline'>('idle')
  const [pick, setPick] = useState<string[]>(() => wanted.filter((k) => APPROVAL_KINDS.some((a) => a.value === k)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>, d: Decision) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await onDecided(d)
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }
  const approve = (list: string[]) => run(() => approveVolunteer(v.id, userId, list), { kind: 'approved', approvedFor: list })

  return (
    <Card className="space-y-3 border-brand-orange/40">
      <div>
        <p className="font-display text-[15px] font-extrabold text-ink">{v.name}</p>
        <p className="text-xs text-slate-500">
          {[v.applied_at ? `Applied ${appliedWhen(v.applied_at)}` : '', v.email, v.phone].filter(Boolean).join(' · ')}
        </p>
      </div>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        <div className="flex items-baseline gap-3 px-3 py-2">
          <dt className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">Would like</dt>
          <dd className="min-w-0 text-ink">{wanted.length ? wanted.map(kindLabel).join(', ') : 'Didn’t say'}</dd>
        </div>
        {lines.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-3 px-3 py-2">
            <dt className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {mode === 'pick' && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-700">Approve {firstName(v)} for</p>
          <KindChips value={pick} onChange={setPick} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || pick.length === 0}
              onClick={() => void approve(pick)}
              className="min-h-[44px] flex-1 rounded-full bg-green-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setMode('idle')} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'decline' && (
        <div className="space-y-2 rounded-xl bg-red-50 p-3">
          <p className="text-sm text-red-800">Decline {firstName(v)}’s application? They stay on the roster, marked declined.</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => declineVolunteer(v.id, userId), { kind: 'declined' })}
              className="min-h-[44px] flex-1 rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Yes, decline'}
            </button>
            <button type="button" onClick={() => setMode('idle')} className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500">
              Keep it
            </button>
          </div>
        </div>
      )}

      {mode === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void approve([EVERYTHING])}
            className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-green-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Icon name="check" size={16} /> {busy ? 'Saving…' : 'Approve for everything'}
          </button>
          <button type="button" onClick={() => setMode('pick')} className="min-h-[44px] rounded-full border border-green-600 px-3 text-sm font-bold text-green-700">
            Approve for…
          </button>
          <button type="button" onClick={() => setMode('decline')} className="min-h-[44px] rounded-full border border-red-200 px-3 text-sm font-bold text-red-600">
            Decline
          </button>
          {v.email && (
            <a
              href={mailto(v, 'Your OHRR volunteer application', `Hi ${firstName(v)},\n\nThank you for applying to volunteer with Ohio House Rabbit Rescue.\n\n`)}
              className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-brand-blue-50 px-4 text-sm font-bold text-brand-blue"
            >
              <Icon name="mail" size={16} /> Email them
            </a>
          )}
        </div>
      )}
      <FormError>{error}</FormError>
    </Card>
  )
}

/** Just approved or declined: the email to send them. */
function Decided({ v, d, onHide }: { v: VolunteerRow; d: Decision; onHide: () => void }) {
  const approved = d.kind === 'approved'
  return (
    <Card className={`space-y-2 ${approved ? 'border-green-200 bg-green-50/60' : 'bg-slate-50'}`}>
      <p className="font-display text-[15px] font-extrabold text-ink">
        {v.name} —{' '}
        {approved ? `approved for ${d.approvedFor.includes(EVERYTHING) ? 'everything' : approvedText(d.approvedFor)}` : 'declined'}
      </p>
      <p className="text-sm text-slate-600">
        {!v.email
          ? 'There’s no email on their record, so let them know another way.'
          : approved
            ? 'Let them know: the email has their private volunteer page and how to sign up for a shift.'
            : 'A kind note is ready to send.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {v.email && (
          <a href={approved ? approvedMail(v, d.approvedFor) : declinedMail(v)} className={`${btn.blue} !py-2.5`}>
            <Icon name="mail" size={16} /> Email them
          </a>
        )}
        <button type="button" onClick={onHide} className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">
          Done
        </button>
      </div>
    </Card>
  )
}

/** Tick the kinds of volunteering. */
function KindChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {APPROVAL_KINDS.map((k) => {
        const on = value.includes(k.value)
        return (
          <button
            key={k.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== k.value) : [...value, k.value])}
            className={`min-h-[44px] rounded-full px-3.5 text-sm font-bold ${on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {k.label}
          </button>
        )
      })}
    </div>
  )
}

/* ==================================================== certificate hours */

/**
 * The hours that earn a certificate (e.g. 25, 50, 100, 250). When a
 * volunteer's confirmed hours pass one, they appear in "Certificates to
 * consider" on the staff home. Hidden until update 25 adds the table.
 */
function CertificateHours({ orgId }: { orgId: string }) {
  const [saved, setSaved] = useState<number[] | null>(null)
  const [draft, setDraft] = useState<number[]>([])
  const [add, setAdd] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('volunteer_settings')
      .select('certificate_hours')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error) return
        const marks = [...(data?.certificate_hours ?? [])].sort((a, b) => a - b)
        setSaved(marks)
        setDraft(marks)
      })
    return () => {
      alive = false
    }
  }, [orgId])

  if (!saved) return null
  const dirty = draft.join(',') !== saved.join(',')
  const put = (list: number[]) => setDraft([...new Set(list)].filter((h) => h > 0 && h <= 100000).sort((a, b) => a - b))
  const addMark = () => {
    const h = Math.round(Number(add))
    if (h > 0) put([...draft, h])
    setAdd('')
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    const { data, error } = await supabase.rpc('set_certificate_hours', { p_org: orgId, p_hours: draft })
    setBusy(false)
    if (error) return setError(errMessage(error))
    setSaved(draft)
    const n = Number(data ?? 0)
    setNote(
      n > 0
        ? `${n} ${n === 1 ? 'volunteer has' : 'volunteers have'} already passed one; they’re in Certificates to consider.`
        : 'Saved.',
    )
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-display text-[15px] font-extrabold text-ink">Certificate hours</p>
        <p className="text-sm text-slate-600">
          When a volunteer’s confirmed hours pass one of these, they appear in Certificates to consider on the staff home.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {draft.map((h) => (
          <span key={h} className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-brand-blue-50 pl-4 pr-1 text-sm font-bold text-brand-blue">
            {h} hours
            <button
              type="button"
              aria-label={`Remove ${h} hours`}
              onClick={() => put(draft.filter((x) => x !== h))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white"
            >
              <Icon name="x" size={16} />
            </button>
          </span>
        ))}
        {draft.length === 0 && <p className="text-sm text-slate-500">None set yet.</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          aria-label="Hours"
          placeholder="e.g. 50"
          value={add}
          onChange={(e) => setAdd(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addMark()
            }
          }}
          className="h-11 w-28 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-ink outline-none focus:border-brand-blue"
        />
        <button type="button" onClick={addMark} disabled={!add} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600 disabled:opacity-50">
          Add
        </button>
        {draft.length === 0 && (
          <button type="button" onClick={() => put([25, 50, 100, 250])} className="min-h-[44px] px-2 text-sm font-bold text-brand-blue">
            Use 25, 50, 100, 250
          </button>
        )}
      </div>
      {dirty && (
        <button type="button" onClick={() => void save()} disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save the certificate hours'}
        </button>
      )}
      {note && <p className="text-sm font-bold text-green-700">{note}</p>}
      <FormError>{error}</FormError>
    </Card>
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
  // Before update 25 there's nothing to approve with; after it every row has approved_for.
  const approvalReady = rows.length === 0 || rows.some((r) => r.approved_for !== undefined)
  // Likewise trust_level, from update 28.
  const trustReady = rows.length === 0 || rows.some((r) => r.trust_level !== undefined)

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
                  ['Name', 'Status', 'Email', 'Phone', 'Roles', 'Approved for', 'Trust', 'Started', 'Orientation', 'Notes'],
                  rows.map((r) => [
                    r.name,
                    statusLabel(r.status),
                    r.email ?? '',
                    r.phone ?? '',
                    r.roles.join('; '),
                    r.approved_for ? approvedText(r.approved_for) : '',
                    r.trust_level === 'trusted' ? 'Trusted' : r.trust_level ? 'Standard' : '',
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
            approvalReady={approvalReady}
            trustReady={trustReady}
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
              approvalReady={r.approved_for !== undefined}
              trustReady={r.trust_level !== undefined}
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
                  {r.trust_level === 'trusted' && <Badge tone="blue">Trusted</Badge>}
                  {r.review_status === 'pending' && <Badge tone="orange">Waiting for approval</Badge>}
                  {r.review_status === 'declined' && <Badge tone="slate">Declined</Badge>}
                  {r.orientation_on && <Badge tone="blue">Orientation done</Badge>}
                </span>
                {r.roles.length > 0 && <span className="block text-xs text-slate-500">{r.roles.join(' · ')}</span>}
                {r.approved_for && (
                  <span className="block text-xs text-slate-500">
                    Approved for: <span className="font-semibold text-slate-700">{approvedText(r.approved_for)}</span>
                  </span>
                )}
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
        {v.email && (
          <Link
            to={`/staff/hours-letter?email=${encodeURIComponent(v.email)}&name=${encodeURIComponent(v.name)}`}
            className="text-xs font-bold text-brand-blue"
          >
            Hours letter →
          </Link>
        )}
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
                  {h.source === 'self' ? ' · self-reported' : h.source === 'checkin' ? ' · from a shift' : ' · added by staff'}
                  {h.note ? ` · ${h.note}` : ''}
                </span>
              </span>
              {h.status === 'logged' ? (
                <button
                  type="button"
                  onClick={() => setHoursStatus(h.id, 'confirmed').then(load).then(onChanged).catch((e) => setError(errMessage(e)))}
                  className="min-h-[44px] shrink-0 rounded-full bg-green-600 px-3.5 text-xs font-bold text-white"
                >
                  Confirm
                </button>
              ) : h.source === 'self' ? (
                // Their own hours that already count (a trusted volunteer's): staff can still take them back.
                <span className="flex shrink-0 flex-col items-end">
                  <Badge tone="blue">Confirmed</Badge>
                  <button
                    type="button"
                    onClick={() => setHoursStatus(h.id, 'logged').then(load).then(onChanged).catch((e) => setError(errMessage(e)))}
                    className="min-h-[36px] px-1 text-xs font-bold text-slate-500 underline-offset-2 hover:underline"
                  >
                    Un-confirm
                  </button>
                </span>
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
  approvalReady,
  trustReady,
  onDone,
  onCancel,
}: {
  orgId: string
  initial: VolunteerRow | null
  /** The approval columns exist (update 25 has run). */
  approvalReady: boolean
  /** The trust_level column exists (update 28 has run). */
  trustReady: boolean
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [trust, setTrust] = useState<VolunteerRow['trust_level']>(initial?.trust_level ?? 'standard')
  // Someone staff add by hand is approved for everything unless they say otherwise.
  const startApproved = initial ? (initial.approved_for ?? []) : [EVERYTHING]
  const [approval, setApproval] = useState<'all' | 'some' | 'none'>(
    startApproved.includes(EVERYTHING) ? 'all' : startApproved.length > 0 ? 'some' : 'none',
  )
  const [kinds, setKinds] = useState<string[]>(startApproved.filter((k) => k !== EVERYTHING))
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
        ...(approvalReady
          ? { approved_for: approval === 'all' ? [EVERYTHING] : approval === 'some' ? kinds : [] }
          : {}),
        ...(trustReady ? { trust_level: trust } : {}),
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
      {approvalReady && (
        <div>
          <p className="text-sm font-semibold text-slate-700">Approved for</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'Everything'],
                ['some', 'Only some'],
                ['none', 'Nothing yet'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={approval === v}
                onClick={() => setApproval(v)}
                className={`min-h-[44px] rounded-full px-3.5 text-sm font-bold ${
                  approval === v ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {approval === 'some' && (
            <div className="mt-2">
              <KindChips value={kinds} onChange={setKinds} />
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">What they can sign up for with their email. Shifts that anyone can book aren’t affected.</p>
        </div>
      )}
      {trustReady && (
        <div>
          <p className="text-sm font-semibold text-slate-700">Their logged hours</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(
              [
                ['standard', 'Standard'],
                ['trusted', 'Trusted'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={trust === v}
                onClick={() => setTrust(v)}
                className={`min-h-[44px] rounded-full px-3.5 text-sm font-bold ${
                  trust === v ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Trusted volunteers’ logged hours count straight away; you can still un-confirm them.
          </p>
        </div>
      )}
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
  counted,
  onChanged,
}: {
  rows: VolunteerRow[]
  pending: HoursRow[]
  /** Trusted volunteers' self-reported hours that already count (update 28). */
  counted: HoursRow[]
  onChanged: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const nameOf = (id: string | null) => rows.find((r) => r.id === id)?.name ?? 'Someone'

  if (pending.length === 0) {
    return (
      <div className="space-y-3">
        <Card className="space-y-2 text-sm text-slate-600">
          <p className="font-bold text-ink">Nothing waiting.</p>
          <p>Hours a volunteer logs for themselves appear here so you can confirm or correct them before they count on a service letter.</p>
        </Card>
        <FormError>{error}</FormError>
        <CountedStraightAway counted={counted} nameOf={nameOf} onChanged={onChanged} onError={setError} />
      </div>
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
      <CountedStraightAway counted={counted} nameOf={nameOf} onChanged={onChanged} onError={setError} />
    </div>
  )
}

/**
 * Hours trusted volunteers logged themselves, which count straight away
 * (update 28). Listed so staff can still check them: "Un-confirm" sends one
 * back to the list above.
 */
function CountedStraightAway({
  counted,
  nameOf,
  onChanged,
  onError,
}: {
  counted: HoursRow[]
  nameOf: (id: string | null) => string
  onChanged: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  if (counted.length === 0) return null

  const unconfirm = async (id: string) => {
    setBusyId(id)
    try {
      await setHoursStatus(id, 'logged')
      await onChanged()
    } catch (e) {
      onError(errMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-2 pt-2">
      <div className="px-1">
        <p className="font-display text-base font-extrabold text-ink">Counted straight away ({counted.length})</p>
        <p className="text-xs text-slate-500">
          Logged by trusted volunteers in the last 60 days. They already count — un-confirm any that don’t look right.
        </p>
      </div>
      {counted.map((h) => (
        <Card key={h.id} className="space-y-1">
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">
                {nameOf(h.volunteer_id)} · {hoursLabel(Number(h.hours))}
              </span>
              <span className="block text-sm text-slate-600">{h.activity}</span>
              <span className="block text-xs text-slate-400">
                {new Date(`${h.on_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · self-reported'}
                {h.note ? ` · ${h.note}` : ''}
              </span>
            </span>
            <button
              type="button"
              disabled={busyId === h.id}
              onClick={() => void unconfirm(h.id)}
              className="min-h-[44px] shrink-0 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 disabled:opacity-60"
            >
              {busyId === h.id ? '…' : 'Un-confirm'}
            </button>
          </div>
        </Card>
      ))}
    </section>
  )
}
