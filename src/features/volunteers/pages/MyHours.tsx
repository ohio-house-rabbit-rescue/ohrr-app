// /volunteer/hours/:token — a volunteer's own record of what they've given.
//
// No account: the private link (handed over by staff as a link or a QR code) is
// the key, the same way a booking's cancel link works. The phone remembers it,
// so afterwards it's just "My hours" on the Volunteer page.
//
// Totals for today, this week, this month, this year and every year — and a
// tidy summary they can share or print, which is what a school, an employer or
// a scholarship actually asks for.
//
// From update 25 it also shows what they're signed up for and what they're
// approved for, and makes their hours letter itself: a PDF with OHRR's
// signature and a code a school or employer can check, built from the hours
// OHRR has confirmed — so the rescue doesn't have to write it for them.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner } from '../../../components/staffui'
import { inputClass } from '../../../components/SchemaField'
import { errMessage } from '../../../lib/supabase'
import { ohrr } from '../../../data/ohrr'
import { useOrgProfile } from '../../../lib/orgProfile'
import { canvasToPdf } from '../../../lib/pdf'
import { exportBlob } from '../../../lib/exportFile'
import { isNative } from '../../../native/platform'
import { downloadBookingIcs, scheduleBookingReminders } from '../../bookings/calendar'
import { fmtDayShort, fmtRange, type BookingReceipt } from '../../bookings/types'
import {
  approvedText,
  EVERYTHING,
  issueMyLetter,
  SELF_SERVE_KINDS,
  verifyLine,
  VERIFY_BASE,
  type IssuedLetter,
  type UpcomingItem,
} from '../approval'
import { LETTER_KINDS, buildLetter, longDate, type LetterKind } from '../letters'
import { paintLetter } from '../paint'
import { useOrgBits } from '../orgBits'
import { sharePng, shareText } from '../../share/share'
import { useFeatureFlag } from '../../settings/useSetting'
import { VOLUNTEER_HOURS_FLAG } from '../../settings/features'
import { renderHoursCard } from '../hoursCard'
import {
  deleteMyHours,
  forgetToken,
  hoursLabel,
  HOURS_ACTIVITIES,
  logMyHours,
  myRecord,
  rememberToken,
  savedToken,
  type MyRecord,
} from '../api'

const todayISO = () => new Date().toISOString().slice(0, 10)

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function MyHours() {
  const { token: param } = useParams()
  const navigate = useNavigate()
  const token = param || savedToken() || ''
  const [rec, setRec] = useState<MyRecord | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const org = useOrgProfile()

  const load = useCallback(async () => {
    if (!token) {
      setRec(null)
      return
    }
    try {
      const r = await myRecord(token)
      setRec(r)
      if (r) rememberToken(token)
    } catch (e) {
      setError(errMessage(e))
      setRec(null)
    }
  }, [token])
  useEffect(() => {
    void load()
  }, [load])

  // Opened from a link: keep the address clean afterwards.
  useEffect(() => {
    if (param && rec) navigate('/volunteer/hours', { replace: true })
  }, [param, rec, navigate])

  if (rec === undefined) return <Spinner label="Opening your record…" />

  if (!rec) {
    return (
      <>
        <PageHeader icon="clock" title="My volunteer hours" subtitle="Your own record of the time you've given OHRR." />
        <Screen className="space-y-4">
          <Card className="space-y-3 text-sm text-slate-600">
            <p className="font-bold text-ink">This link isn’t working.</p>
            <p>
              Your hours open from a private link OHRR gives you — ask any staff member for it, or for the QR code to
              scan. It keeps your record to you.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${org.email}?subject=${encodeURIComponent('My volunteer hours link')}`} className={`${btn.primary} px-4 py-2`}>
                <Icon name="mail" size={15} /> Ask OHRR for my link
              </a>
              <Link to="/volunteer" className={`${btn.outline} px-4 py-2`}>
                Back to Volunteer
              </Link>
            </div>
          </Card>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        </Screen>
      </>
    )
  }

  return <Record rec={rec} onChanged={load} />
}

function Record({ rec, onChanged }: { rec: MyRecord; onChanged: () => Promise<void> }) {
  const token = savedToken() ?? ''
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selfLogging = useFeatureFlag(VOLUNTEER_HOURS_FLAG, true)
  const pending = rec.entries.filter((e) => e.status === 'logged').length
  const years = rec.by_year

  const share = async () => {
    setNote(null)
    try {
      const canvas = document.createElement('canvas')
      await renderHoursCard(canvas, rec)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('Could not make the summary.')
      const r = await sharePng(
        blob,
        `ohrr-volunteer-hours-${rec.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        `${rec.name} — ${hoursLabel(rec.totals.confirmed || rec.totals.all)} volunteering with Ohio House Rabbit Rescue`,
      )
      setNote(r === 'saved' ? 'Saved to your downloads.' : r === 'shared' ? null : 'Couldn’t share that here.')
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const shareWords = async () => {
    const lines = [
      `${rec.name} — volunteer hours with Ohio House Rabbit Rescue`,
      `Total: ${hoursLabel(rec.totals.confirmed)} confirmed${rec.totals.all > rec.totals.confirmed ? ` (${hoursLabel(rec.totals.all)} logged)` : ''}`,
      ...years.map((y) => `${y.year}: ${hoursLabel(y.hours)}`),
      '',
      'ohiohouserabbitrescue.org',
    ]
    await shareText(lines.join('\n'), 'My volunteer hours')
  }

  return (
    <>
      <PageHeader
        icon="clock"
        title="My volunteer hours"
        subtitle={`${rec.name} · ${hoursLabel(rec.totals.all)} for the bunnies`}
      />
      <Screen className="space-y-5">
        {/* What they're signed up for, then what they may sign up for (update 25). */}
        {rec.upcoming && <ComingUp items={rec.upcoming} />}
        {rec.approved_for && <ApprovedFor rec={rec} />}

        {/* The headline numbers */}
        {rec.upcoming && <SectionLabel>Your hours</SectionLabel>}
        <div className="grid grid-cols-2 gap-2.5">
          <Total label="This week" value={rec.totals.this_week} />
          <Total label="This month" value={rec.totals.this_month} />
          <Total label="This year" value={rec.totals.this_year} />
          <Total label="All time" value={rec.totals.all} tone="orange" />
        </div>

        {pending > 0 && (
          <p className="rounded-2xl bg-brand-orange-50 px-3.5 py-2.5 text-sm font-semibold text-brand-orange-dark">
            {pending} {pending === 1 ? 'entry is' : 'entries are'} waiting for OHRR to confirm. They still count in your
            totals; a service letter uses the confirmed ones.
          </p>
        )}

        {/* Log some — unless OHRR has turned self-logging off. */}
        {!selfLogging.loading && !selfLogging.value ? (
          <Card className="text-sm text-slate-600">
            OHRR records hours for volunteers at the moment — ask a staff member to add any that are missing.
          </Card>
        ) : adding ? (
          <Card>
            <LogForm
              token={token}
              busy={busy}
              setBusy={setBusy}
              onDone={async () => {
                setAdding(false)
                await onChanged()
              }}
              onCancel={() => setAdding(false)}
            />
          </Card>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={`${btn.primary} w-full`}>
            <Icon name="plus" size={17} /> Log hours
          </button>
        )}

        {/* By year */}
        {years.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>Year by year</SectionLabel>
            <Card className="divide-y divide-slate-100">
              {years.map((y) => (
                <div key={y.year} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-bold text-ink">{y.year}</span>
                  <span className="font-display text-base font-black text-brand-blue">{hoursLabel(y.hours)}</span>
                </div>
              ))}
            </Card>
          </section>
        )}

        {/* Share / keep */}
        <section className="space-y-2.5">
          <SectionLabel>Show what you’ve given</SectionLabel>
          <Card className="space-y-2">
            <p className="text-sm text-slate-600">
              A tidy summary with OHRR’s name on it — for a school, an employer, or your own satisfaction.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={share} className={`${btn.blue} w-full`}>
                <Icon name="award" size={17} /> Save the card
              </button>
              <button type="button" onClick={shareWords} className={`${btn.outline} w-full`}>
                <Icon name="mail" size={16} /> Send the numbers
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {rec.approved_for
                ? 'Need it on letterhead? Make a signed hours letter below.'
                : 'Need it on letterhead? Ask OHRR for a signed service-hours letter — they print it from the same record.'}
            </p>
            {note && <p className="text-sm font-bold text-green-700">{note}</p>}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          </Card>
        </section>

        {/* Every entry */}
        <section className="space-y-2.5">
          <SectionLabel>Every entry</SectionLabel>
          {rec.entries.length === 0 && (
            <Card className="text-sm text-slate-600">Nothing yet — log your first hours above.</Card>
          )}
          {rec.entries.length > 0 && (
            <Card className="divide-y divide-slate-100">
              {rec.entries.map((e) => (
                <div key={e.id} className="flex items-start gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display text-[15px] font-extrabold text-ink">{hoursLabel(e.hours)}</span>
                      <span className="text-sm text-slate-600">{e.activity}</span>
                      {e.status === 'logged' && <Badge tone="orange">Waiting</Badge>}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {fmtDay(e.on_date)}
                      {e.note ? ` · ${e.note}` : ''}
                      {e.source === 'checkin' || e.source === 'shift'
                        ? ' · from a booked shift'
                        : e.source === 'staff'
                          ? ' · added by OHRR'
                          : ''}
                    </span>
                  </span>
                  {e.source === 'self' && e.status === 'logged' && (
                    <button
                      type="button"
                      onClick={() =>
                        deleteMyHours(token, e.id)
                          .then(onChanged)
                          .catch((err) => setError(errMessage(err)))
                      }
                      aria-label="Remove this entry"
                      className="shrink-0 self-center text-red-600"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* Their own signed letter (update 25). */}
        {rec.approved_for && <LetterMaker rec={rec} token={token} />}

        <Card className="space-y-2 text-xs text-slate-500">
          <p>
            This record lives with OHRR and opens from a private link on this phone. Not you?{' '}
            <button
              type="button"
              onClick={() => {
                forgetToken()
                window.location.reload()
              }}
              className="font-bold text-brand-blue"
            >
              Forget it on this device
            </button>
            .
          </p>
          <p>
            Questions about your hours: {ohrr.email}
          </p>
        </Card>
      </Screen>
    </>
  )
}

/* ------------------------------------------------ what they're signed up for */

function ComingUp({ items }: { items: UpcomingItem[] }) {
  return (
    <section className="space-y-2.5">
      <SectionLabel>Coming up</SectionLabel>
      {items.length === 0 ? (
        <Card className="text-sm text-slate-600">
          <p>Nothing booked right now.</p>
          <Link to="/volunteer" className="inline-flex min-h-[44px] items-center gap-1 font-bold text-brand-blue">
            Find a shift <Icon name="chevron" size={14} />
          </Link>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100 !py-1">
          {items.map((u) => (
            <UpcomingRow key={u.id} u={u} />
          ))}
        </Card>
      )}
    </section>
  )
}

function UpcomingRow({ u }: { u: UpcomingItem }) {
  const [reminder, setReminder] = useState<'idle' | 'scheduled' | 'denied'>('idle')
  const receipt: BookingReceipt = {
    booking_id: u.id,
    status: u.status,
    cancel_token: u.cancel_token,
    type_name: u.what,
    kind: u.kind,
    location: u.location,
    starts_at: u.starts_at,
    ends_at: u.ends_at,
    party_size: 1,
  }
  return (
    <div className="space-y-1.5 py-3">
      <p className="font-display text-[15px] font-extrabold text-ink">{u.what}</p>
      <p className="text-sm font-semibold text-slate-700">
        {fmtDayShort(u.starts_at)} · {fmtRange(u.starts_at, u.ends_at)}
      </p>
      {u.area && <p className="text-sm text-slate-600">{u.area}</p>}
      {u.location && <p className="text-xs text-slate-500">{u.location}</p>}
      {u.status === 'requested' && <p className="text-xs font-bold text-brand-orange-dark">Waiting for OHRR to confirm</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {isNative ? (
          <button
            type="button"
            disabled={reminder === 'scheduled'}
            onClick={() => scheduleBookingReminders(receipt).then((r) => setReminder(r === 'scheduled' ? 'scheduled' : 'denied'))}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-brand-blue"
          >
            <Icon name="calendar" size={15} /> {reminder === 'scheduled' ? 'Reminders set' : 'Remind me'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => downloadBookingIcs(receipt)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-brand-blue"
          >
            <Icon name="calendar" size={15} /> Add to calendar
          </button>
        )}
        <Link
          to={`/book/cancel/${u.cancel_token}`}
          className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-slate-600 underline underline-offset-2"
        >
          Cancel
        </Link>
      </div>
      {reminder === 'denied' && (
        <p className="text-xs text-slate-500">Notifications are off for the OHRR app — turn them on in your phone’s Settings.</p>
      )}
    </div>
  )
}

/* ------------------------------------------------ what they may sign up for */

function ApprovedFor({ rec }: { rec: MyRecord }) {
  const list = rec.approved_for ?? []
  const everything = list.includes(EVERYTHING)
  return (
    <section className="space-y-2.5">
      <SectionLabel>Approved for</SectionLabel>
      <Card className="space-y-2">
        <p className="font-display text-base font-extrabold text-ink">{approvedText(list)}</p>
        {rec.review_status === 'pending' ? (
          <p className="rounded-xl bg-brand-orange-50 px-3 py-2 text-sm font-semibold text-brand-orange-dark">
            Your application is being reviewed. OHRR will email you once someone has looked at it.
          </p>
        ) : (
          list.length > 0 &&
          rec.email && (
            <p className="text-sm text-slate-600">Sign up on the Volunteer page with {rec.email} — the email OHRR has for you.</p>
          )
        )}
        {!everything && rec.review_status !== 'pending' && (
          <Link to="/volunteer/apply" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue">
            {list.length > 0 ? 'Apply for something else' : 'Apply to volunteer'} <Icon name="chevron" size={14} />
          </Link>
        )}
      </Card>
    </section>
  )
}

/* ------------------------------------------------ their own hours letter */

const nyDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

function periodFor(p: 'year' | '12' | 'all'): { from: string; to: string } {
  const now = new Date()
  if (p === '12') {
    const a = new Date(now)
    a.setFullYear(now.getFullYear() - 1)
    a.setDate(a.getDate() + 1)
    return { from: nyDate(a), to: nyDate(now) }
  }
  if (p === 'all') return { from: '2009-01-01', to: nyDate(now) }
  return { from: `${now.getFullYear()}-01-01`, to: nyDate(now) }
}

// A certificate is OHRR's to give (they're told when someone makes a letter),
// so a volunteer makes only the letters.
const MY_KINDS = LETTER_KINDS.filter((k) => (SELF_SERVE_KINDS as readonly string[]).includes(k.value))
const KIND_FOR: Record<string, LetterKind> = { school: 'school', military: 'military', workplace: 'workplace', community: 'general', other: 'general' }

const PERIODS: [p: 'year' | '12' | 'all' | 'custom', label: string][] = [
  ['year', 'This year'],
  ['12', 'Last 12 months'],
  ['all', 'All time'],
  ['custom', 'Choose dates'],
]

function LetterMaker({ rec, token }: { rec: MyRecord; token: string }) {
  const org = useOrgBits()
  const [kind, setKind] = useState<LetterKind>((rec.hours_for && KIND_FOR[rec.hours_for]) || 'general')
  const [period, setPeriod] = useState<'year' | '12' | 'all' | 'custom'>('year')
  const [from, setFrom] = useState(() => periodFor('year').from)
  const [to, setTo] = useState(() => periodFor('year').to)
  const [details, setDetails] = useState<Record<string, string>>(() => ({ ...(rec.letter_details ?? {}) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<{ issued: IssuedLetter; pdf: Blob; filename: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const meta = MY_KINDS.find((k) => k.value === kind) ?? MY_KINDS[MY_KINDS.length - 1]

  const save = async (pdf: Blob, filename: string) => {
    const r = await exportBlob(filename, pdf)
    setNote(r === 'saved' ? 'Saved to your downloads.' : r === 'failed' ? 'Couldn’t save it here — try “Save it again”.' : null)
  }

  const make = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    setMade(null)
    try {
      // Only what this kind of letter asks for (the database keeps it for next time).
      const asked: Record<string, string> = {}
      for (const q of meta.ask) if ((details[q.key] ?? '').trim()) asked[q.key] = details[q.key].trim()
      const issued = await issueMyLetter(token, meta.value, from, to, asked)
      const today = longDate(issued.issuedOn)
      // Written from what the database returned — the hours OHRR has confirmed, never this phone's numbers.
      const letter = buildLetter({ kind: meta.value, name: issued.name, details: asked, from: issued.from, to: issued.to, lines: issued.lines, org, today })
      const canvas = document.createElement('canvas')
      await paintLetter(canvas, {
        date: today,
        recipient: letter.recipient,
        title: letter.title,
        salutation: letter.salutation,
        paragraphs: letter.paragraphs,
        table: letter.table ? { lines: issued.lines, total: issued.total } : undefined,
        closing: letter.closing,
        signer: letter.signer,
        signed: true,
        verify: verifyLine(issued.code),
        footer: letter.footer,
        org,
      })
      const pdf = await canvasToPdf(canvas, `${letter.title} - ${issued.name}`)
      const filename = `ohrr-hours-letter-${issued.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${issued.code}.pdf`
      setMade({ issued, pdf, filename })
      await save(pdf, filename)
    } catch (e) {
      const m = errMessage(e)
      setError(/issue_my_letter|schema cache/i.test(m) ? `Letters can’t be made here just yet — email ${org.email} and OHRR will send you one.` : m)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2.5">
      <SectionLabel>Your hours letter</SectionLabel>
      <Card className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">
          A letter on OHRR’s letterhead, signed by {org.signerName || 'OHRR'}, listing the hours OHRR has confirmed — for a
          school, the military, an employer or anyone else. Make one whenever you need it.
        </p>

        <div>
          <p className="text-sm font-semibold text-slate-700">Who it’s for</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {MY_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${kind === k.value ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{meta.hint}</p>
        </div>

        {meta.ask.length > 0 && (
          <div className="space-y-2">
            {meta.ask.map((q) => (
              <label key={q.key} className="block text-sm font-semibold text-slate-700">
                {q.label}
                <input
                  className={inputClass}
                  placeholder={q.placeholder}
                  value={details[q.key] ?? ''}
                  onChange={(e) => setDetails({ ...details, [q.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-slate-700">Which hours</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PERIODS.map(([p, label]) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => {
                  setPeriod(p)
                  if (p !== 'custom') {
                    const r = periodFor(p)
                    setFrom(r.from)
                    setTo(r.to)
                  }
                }}
                className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${period === p ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                From
                <input type="date" className={inputClass} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                To
                <input type="date" className={inputClass} value={to} min={from} max={nyDate(new Date())} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <button type="button" onClick={() => void make()} disabled={busy || !from || !to} className={`${btn.primary} w-full disabled:opacity-60`}>
          <Icon name="printer" size={17} /> {busy ? 'Making your letter…' : 'Make my letter (PDF)'}
        </button>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        {made && (
          <div className="space-y-2 rounded-2xl bg-green-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-display text-base font-extrabold text-green-800">Your letter is ready</p>
            <p>
              {hoursLabel(made.issued.total)} confirmed, {longDate(made.issued.from)} to {longDate(made.issued.to)}. Its code is{' '}
              <strong className="whitespace-nowrap text-ink">{made.issued.code}</strong>.
            </p>
            <p>A school or employer can check it at {VERIFY_BASE.replace(/^https:\/\//, '')}.</p>
            {made.issued.pending > 0 && (
              <p className="font-semibold text-brand-orange-dark">
                {hoursLabel(made.issued.pending)} you logged {made.issued.pending === 1 ? 'is' : 'are'} waiting for OHRR to confirm;
                they’ll be on your letter once confirmed.
              </p>
            )}
            <button
              type="button"
              onClick={() => void save(made.pdf, made.filename)}
              className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-brand-blue"
            >
              <Icon name="printer" size={15} /> Save it again
            </button>
            {note && <p className="font-bold text-green-700">{note}</p>}
          </div>
        )}
      </Card>
    </section>
  )
}

function Total({ label, value, tone = 'blue' }: { label: string; value: number; tone?: 'blue' | 'orange' }) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        tone === 'orange' ? 'border-brand-orange/30 bg-brand-orange-50/60' : 'border-slate-200/80 bg-white'
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 font-display text-2xl font-black ${tone === 'orange' ? 'text-brand-orange-dark' : 'text-brand-blue'}`}>
        {value % 1 === 0 ? value : value.toFixed(1)}
        <span className="ml-1 text-sm font-bold text-slate-400">{value === 1 ? 'hour' : 'hours'}</span>
      </p>
    </div>
  )
}

function LogForm({
  token,
  busy,
  setBusy,
  onDone,
  onCancel,
}: {
  token: string
  busy: boolean
  setBusy: (b: boolean) => void
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState({ onDate: todayISO(), hours: '', activity: HOURS_ACTIVITIES[0], note: '' })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const quick = useMemo(() => ['1', '1.5', '2', '3', '4'], [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await logMyHours(token, {
        onDate: d.onDate,
        hours: Number(d.hours),
        activity: d.activity,
        note: d.note.trim() || undefined,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="font-display text-[15px] font-extrabold text-ink">Log hours</p>
      <label className="block text-sm font-semibold text-slate-700">
        Which day
        <input type="date" className={inputClass} required max={todayISO()} value={d.onDate} onChange={set('onDate')} />
      </label>
      <div>
        <label className="block text-sm font-semibold text-slate-700">
          How many hours
          <input
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            inputMode="decimal"
            className={inputClass}
            required
            value={d.hours}
            onChange={set('hours')}
            placeholder="2"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {quick.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setD({ ...d, hours: h })}
              className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${
                d.hours === h ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {h} h
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        What did you do?
        <input className={inputClass} required list="ohrr-activities" value={d.activity} onChange={set('activity')} />
        <datalist id="ohrr-activities">
          {HOURS_ACTIVITIES.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Anything to remember? <span className="font-normal text-slate-400">(optional)</span>
        <input className={inputClass} value={d.note} onChange={set('note')} placeholder="Covered for Bev" />
      </label>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.hours} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Log it'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500">
          Cancel
        </button>
      </div>
      <p className="text-xs text-slate-500">OHRR sees what you log and confirms it — they can fix anything that’s off.</p>
    </form>
  )
}
