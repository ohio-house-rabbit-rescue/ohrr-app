// /volunteer/hours/:token — a volunteer's own record of what they've given.
//
// No account: the private link (handed over by staff as a link or a QR code) is
// the key, the same way a booking's cancel link works. The phone remembers it,
// so afterwards it's just "My hours" on the Volunteer page.
//
// Totals for today, this week, this month, this year and every year — and a
// tidy summary they can share or print, which is what a school, an employer or
// a scholarship actually asks for.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner } from '../../../components/staffui'
import { inputClass } from '../../../components/SchemaField'
import { errMessage } from '../../../lib/supabase'
import { ohrr } from '../../../data/ohrr'
import { useOrgProfile } from '../../../lib/orgProfile'
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
        {/* The headline numbers */}
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
              Need it on letterhead? Ask OHRR for a signed service-hours letter — they print it from the same record.
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
                      {e.source === 'checkin' ? ' · from a booked shift' : e.source === 'staff' ? ' · added by OHRR' : ''}
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
