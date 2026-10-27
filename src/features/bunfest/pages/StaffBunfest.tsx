// Staff → BunFest: the festival's own content, editable from a phone.
//
// The year is asked ONCE, at the top ("This year's BunFest · 2026 · Sunday,
// October 25, 2026 · Change"), and every step below works on that year. The
// steps run in the order the work happens:
//
//   1 Start this year          copy last year forward, or start empty
//   2 Venue and floor          the building, its tables, who sits where
//   3 Schedule and speakers    the program and the people giving the talks
//   4 Vendors and partners     the vendor tables and the rescue directory
//   5 Pages and check          the "at the festival" cards, the activity pages,
//                              Plan your visit, and a last look
//
// Each step is its own address (/staff/bunfest, /floor, /schedule, /vendors or
// /partners, /pages), so the dashboard and old links keep working.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { eventDate, eventIsoDay, useBunfestEvent } from '../../../lib/events'
import { Screen, Card, Badge } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { CardActions, EditorForm, Field, Part, WorkingOn, pill } from '../../../components/StaffJob'
import { BigButton } from '../../scan/ScanUI'
import { listSuppliers, type Supplier } from '../../hopshop/api'
import { giftTotals, type GiftTotals } from '../../hopshop/companies'
import { CompanyForm, CompanySummary, CompanyThumb, useVendorRecordsReady } from '../../hopshop/CompanyForm'
import StaffFloor from './StaffFloor'
import StaffSpeakers from './StaffSpeakers'
import {
  copySessions,
  deletePartner,
  deleteSession,
  fromTime,
  listPartners,
  listSessions,
  listPresenters,
  type PresenterRow,
  savePartner,
  saveSession,
  sessionYears,
  toTime,
  SESSION_KINDS,
  deletePage,
  listPages,
  pageYears,
  savePage,
  sectionsFromForm,
  sectionsToForm,
  startBunfestYear,
  venueYears,
  type PageRow,
  type PageSection,
  type PartnerRow,
  type SessionRow,
  deleteFeature,
  type EventFacts,
  FEATURE_ICONS,
  listFeatures,
  loadEventFacts,
  saveEventFacts,
  saveFeature,
  type FeatureRow,
} from '../api'
import { Explain, StaffTitle } from '../../../components/StaffTitle'

type Tab = 'schedule' | 'vendors' | 'partners' | 'year' | 'pages' | 'floor'

/** The steps, in the order the work happens. `tabs` are the addresses that belong to the step. */
const STEPS: { n: number; label: string; path: string; tabs: Tab[] }[] = [
  { n: 1, label: 'Start this year', path: '/staff/bunfest', tabs: ['year'] },
  { n: 2, label: 'Venue and floor', path: '/staff/bunfest/floor', tabs: ['floor'] },
  { n: 3, label: 'Schedule and speakers', path: '/staff/bunfest/schedule', tabs: ['schedule'] },
  { n: 4, label: 'Vendors and partners', path: '/staff/bunfest/vendors', tabs: ['vendors', 'partners'] },
  { n: 5, label: 'Pages and check', path: '/staff/bunfest/pages', tabs: ['pages'] },
]

// The two tracks the festival runs. Free text, so a third one next year needs
// no change here — these are only the suggestions.
const TRACKS = ['Education Sessions', 'Special Interest Sessions']

const REGIONS = ['Midwest', 'Northeast', 'South', 'West'] as const

const YEAR_KEY = 'ohrr-staff-bunfest-year'
function storedYear(): number | null {
  try {
    const n = Number(window.localStorage.getItem(YEAR_KEY))
    return n >= 2000 && n <= 2100 ? n : null
  } catch {
    return null
  }
}

/**
 * Which years a vendor or rescue came. This used to be a single yes/no, so
 * putting this year's roster up meant deleting the record of last year's.
 */
function YearChips({ value, onChange }: { value: number[]; onChange: (years: number[]) => void }) {
  const now = new Date().getFullYear()
  const options = [...new Set([now + 1, now, now - 1, ...value])].sort((a, b) => b - a)
  const toggle = (y: number) =>
    onChange(value.includes(y) ? value.filter((v) => v !== y) : [...value, y].sort((a, b) => a - b))

  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">Years at BunFest</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => toggle(y)}
            aria-pressed={value.includes(y)}
            className={`min-h-[44px] rounded-full px-5 text-[15px] font-bold ${
              value.includes(y) ? 'bg-brand-orange text-ink' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <span className="mt-1 block text-sm text-slate-600">
        {value.length === 0
          ? 'No years ticked — they show on every year’s list until you tick one.'
          : 'They appear on the list for the years ticked here.'}
      </span>
    </div>
  )
}

/** Swap two neighbours in a hand-ordered list, then number the whole list 1, 2, 3 … */
async function moveInList<T extends { sort_order: number }>(
  list: T[],
  i: number,
  by: -1 | 1,
  save: (row: T, order: number) => Promise<unknown>,
): Promise<boolean> {
  const j = i + by
  if (j < 0 || j >= list.length) return false
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  await Promise.all(next.map((r, idx) => (r.sort_order === idx + 1 ? null : save(r, idx + 1))))
  return true
}

/** The Move up / Move down pills under an item in a hand-ordered list. */
function MovePills({ i, count, onMove }: { i: number; count: number; onMove: (by: -1 | 1) => void }) {
  if (count < 2) return null
  return (
    <>
      <button type="button" onClick={() => onMove(-1)} disabled={i === 0} className={pill.outline}>
        Move up
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={i === count - 1} className={pill.outline}>
        Move down
      </button>
    </>
  )
}

interface EventRecord {
  slug: string
  startsAt: string
}

export default function StaffBunfest() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const bunfest = useBunfestEvent()
  const tab: Tab = pathname.endsWith('/vendors')
    ? 'vendors'
    : pathname.endsWith('/partners')
      ? 'partners'
      : pathname.endsWith('/schedule')
        ? 'schedule'
        : pathname.endsWith('/floor')
          ? 'floor'
          : pathname.endsWith('/pages')
            ? 'pages'
            : 'year'
  const step = STEPS.find((s) => s.tabs.includes(tab)) ?? STEPS[0]

  // The year, asked once: the address first (so a link or a refresh keeps it),
  // then the last one chosen on this phone, then the year of the BunFest event.
  const thisYear = new Date().getFullYear()
  const eventYear = Number(eventIsoDay(bunfest).slice(0, 4)) || thisYear
  const asked = Number(params.get('year'))
  const year = asked >= 2000 && asked <= 2100 ? asked : (storedYear() ?? eventYear)
  useEffect(() => {
    try {
      window.localStorage.setItem(YEAR_KEY, String(year))
    } catch {
      /* a convenience only */
    }
  }, [year])

  const go = (path: string, y = year) => navigate(`${path}?year=${y}`)

  // Years that already have content, and the event records (for the date).
  const [known, setKnown] = useState<number[] | null>(null)
  const [records, setRecords] = useState<EventRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const reloadKnown = useCallback(async () => {
    if (!orgId) return
    try {
      const [a, b, c] = await Promise.all([sessionYears(orgId), pageYears(orgId), venueYears(orgId)])
      setKnown([...new Set([...a, ...b, ...c])].sort((x, y) => y - x))
    } catch (e) {
      setError(errMessage(e))
      setKnown([])
    }
  }, [orgId])
  useEffect(() => {
    void reloadKnown()
  }, [reloadKnown])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let live = true
    supabase
      .from('events')
      .select('slug, starts_at')
      .ilike('slug', '%bunfest%')
      .then(({ data }) => {
        if (live && data) setRecords(data.map((r) => ({ slug: r.slug, startsAt: r.starts_at })))
      })
    return () => {
      live = false
    }
  }, [])

  // The event record whose date falls in the chosen year (the shared one counts too).
  const record = useMemo(
    () => [...records, { slug: bunfest.slug, startsAt: bunfest.startsAt }].find((r) => eventIsoDay(r).startsWith(String(year))) ?? null,
    [records, bunfest, year],
  )

  const [choosing, setChoosing] = useState(false)
  const [startedHere, setStartedHere] = useState<number[]>([])
  const [startNote, setStartNote] = useState<string | null>(null)
  const years = useMemo(
    () => [...new Set([thisYear + 1, thisYear, thisYear - 1, eventYear, year, ...(known ?? [])])].sort((a, b) => b - a),
    [thisYear, eventYear, year, known],
  )
  const started = (known ?? []).includes(year) || startedHere.includes(year)
  const next = STEPS.find((s) => s.n === step.n + 1)
  const back = STEPS.find((s) => s.n === step.n - 1)

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Midwest BunFest">
        <p>The program, the vendor tables and the rescue directory — what visitors see in the app and on the website.</p>
        <p>The year is chosen once at the top. The steps run in the order the work happens.</p>
      </StaffTitle>

      <WorkingOn
        icon="star"
        tone="blue"
        label="This year’s BunFest"
        name={year}
        line={record ? eventDate(record) : `No event record for ${year} yet`}
        onChange={() => setChoosing((c) => !c)}
        changeLabel={choosing ? 'Close' : 'Change'}
      />
      {choosing && (
        <Card className="space-y-2">
          <p className="text-base font-bold text-ink">Which year are you working on?</p>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === year}
                onClick={() => {
                  setChoosing(false)
                  setStartNote(null)
                  go(pathname, y)
                }}
                className={`min-h-[48px] rounded-full px-6 text-base font-bold ${y === year ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </Card>
      )}
      <FormError>{error}</FormError>

      {known === null ? (
        <Spinner />
      ) : !started ? (
        <StartYear
          orgId={orgId}
          year={year}
          known={known}
          onStarted={async (note) => {
            setStartedHere((s) => [...s, year])
            setStartNote(note)
            await reloadKnown()
            go('/staff/bunfest')
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="The steps of BunFest content">
            {STEPS.map((s) => {
              const on = s.n === step.n
              return (
                <button
                  key={s.n}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => go(s.path)}
                  className={`inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-2 text-sm font-bold ${on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${on ? 'bg-white text-brand-blue' : 'bg-brand-blue text-white'}`}>{s.n}</span>
                  {s.label}
                </button>
              )
            })}
          </div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-500" aria-label={`Step ${step.n} of ${STEPS.length}`}>
            Step {step.n} of {STEPS.length} · {step.label}
            <span className="flex gap-1" aria-hidden="true">
              {STEPS.map((s) => (
                <span key={s.n} className={`h-2 w-2 rounded-full ${s.n <= step.n ? 'bg-brand-orange' : 'bg-slate-200'}`} />
              ))}
            </span>
          </p>

          {tab === 'year' && (
            <YearStep orgId={orgId} year={year} known={known} record={record} note={startNote} onCopied={reloadKnown} go={go} />
          )}
          {tab === 'floor' && <StaffFloor orgId={orgId} year={year} />}
          {tab === 'schedule' && <ScheduleTab orgId={orgId} year={year} />}
          {(tab === 'vendors' || tab === 'partners') && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={tab === 'vendors'} onClick={() => go('/staff/bunfest/vendors')} className={tab === 'vendors' ? pill.blue : pill.outline}>
                  Vendors
                </button>
                <button type="button" aria-pressed={tab === 'partners'} onClick={() => go('/staff/bunfest/partners')} className={tab === 'partners' ? pill.blue : pill.outline}>
                  Rescues
                </button>
              </div>
              {tab === 'vendors' ? <VendorsTab orgId={orgId} year={year} /> : <PartnersTab orgId={orgId} year={year} />}
            </div>
          )}
          {tab === 'pages' && <PagesStep orgId={orgId} year={year} />}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {back && (
              <button type="button" onClick={() => go(back.path)} className={pill.outline}>
                <Icon name="arrowLeft" size={16} /> Back: {back.label}
              </button>
            )}
            {next && (
              <button type="button" onClick={() => go(next.path)} className={pill.orange}>
                Next: {next.label}
              </button>
            )}
          </div>
        </>
      )}
    </Screen>
  )
}

/* ========================================================== 1 start a year */

/** The chosen year has nothing in it yet: one big button. */
function StartYear({
  orgId,
  year,
  known,
  onStarted,
}: {
  orgId: string
  year: number
  known: number[]
  onStarted: (note: string | null) => Promise<void>
}) {
  const earlier = known.filter((y) => y < year)
  const latest = earlier[0] ?? known.find((y) => y !== year) ?? null
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async (from: number | null) => {
    setBusy(true)
    setError(null)
    try {
      let note: string | null = null
      if (from !== null) note = copySummary(await startBunfestYear(orgId, from, year), from, year)
      await onStarted(note)
    } catch (e) {
      setError(errMessage(e))
    }
    setBusy(false)
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-black text-ink">Start {year}</h2>
        <p className="mt-1 text-base text-slate-700">
          {latest !== null
            ? `Nothing is set up for ${year} yet. Start copies ${latest} into it — the program, cards, pages, rosters and floor plan — so you change what has moved on instead of retyping.`
            : `Nothing is set up for ${year} yet. Start opens the steps so you can fill them in.`}
        </p>
      </div>
      <BigButton tone="orange" icon="sparkles" disabled={busy} onClick={() => void start(latest)}>
        {busy ? 'Starting…' : `Start ${year}`}
      </BigButton>
      <FormError>{error}</FormError>
      {known.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className={pill.soft}>
            {more ? 'Fewer ways to start' : 'More ways to start'}
          </button>
          {more && (
            <CardActions>
              {known
                .filter((y) => y !== year && y !== latest)
                .map((y) => (
                  <button key={y} type="button" disabled={busy} onClick={() => void start(y)} className={pill.outline}>
                    Copy {y} instead
                  </button>
                ))}
              <button type="button" disabled={busy} onClick={() => void start(null)} className={pill.outline}>
                Start with nothing copied
              </button>
            </CardActions>
          )}
        </div>
      )}
    </Card>
  )
}

function copySummary(r: Awaited<ReturnType<typeof startBunfestYear>>, from: number, to: number): string {
  const parts = [
    r.sessions ? `${r.sessions} sessions` : null,
    r.pages ? `${r.pages} pages` : null,
    r.features ? `${r.features} cards` : null,
    r.vendors ? `${r.vendors} vendors` : null,
    r.partners ? `${r.partners} rescues` : null,
    r.venue ? 'the venue design' : null,
    r.tables ? `${r.tables} table places` : null,
  ].filter(Boolean)
  return parts.length === 0
    ? `Nothing to copy — ${to} already has everything ${from} does.`
    : `Copied into ${to}: ${parts.join(', ')}. Go through them and change what has moved on.`
}

interface Counts {
  sessions: number
  hiddenSessions: number
  pages: number
  hiddenPages: number
  cards: number
  hiddenCards: number
}

function useCounts(orgId: string, year: number, bump = 0): Counts | null {
  const [c, setC] = useState<Counts | null>(null)
  useEffect(() => {
    if (!orgId) return
    let live = true
    Promise.all([listSessions(orgId, year), listPages(orgId, year), listFeatures(orgId, year)])
      .then(([s, p, f]) => {
        if (!live) return
        setC({
          sessions: s.length,
          hiddenSessions: s.filter((x) => !x.is_published).length,
          pages: p.length,
          hiddenPages: p.filter((x) => !x.is_published).length,
          cards: f.length,
          hiddenCards: f.filter((x) => !x.is_published).length,
        })
      })
      .catch(() => live && setC(null))
    return () => {
      live = false
    }
  }, [orgId, year, bump])
  return c
}

/** What is in the year, as one short list. */
function CountsLine({ c, year }: { c: Counts | null; year: number }) {
  if (!c) return null
  const hidden = c.hiddenSessions + c.hiddenPages + c.hiddenCards
  return (
    <div className="space-y-1 text-[15px] text-slate-700">
      <p>
        <strong className="text-ink">{year}</strong> has {c.sessions} {c.sessions === 1 ? 'session' : 'sessions'}, {c.pages}{' '}
        {c.pages === 1 ? 'page' : 'pages'} and {c.cards} {c.cards === 1 ? 'card' : 'cards'}.
      </p>
      <p className={hidden > 0 ? 'font-semibold text-brand-orange-dark' : 'text-slate-600'}>
        {hidden > 0
          ? `${hidden} still hidden from visitors (${c.hiddenSessions} sessions, ${c.hiddenPages} pages, ${c.hiddenCards} cards).`
          : 'Nothing is hidden from visitors.'}
      </p>
    </div>
  )
}

function YearStep({
  orgId,
  year,
  known,
  record,
  note,
  onCopied,
  go,
}: {
  orgId: string
  year: number
  known: number[]
  record: EventRecord | null
  note: string | null
  onCopied: () => Promise<void>
  go: (path: string) => void
}) {
  const [bump, setBump] = useState(0)
  const counts = useCounts(orgId, year, bump)
  const others = known.filter((y) => y !== year)
  const [from, setFrom] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(note)
  const [error, setError] = useState<string | null>(null)
  const chosen = from ?? others[0] ?? null

  const run = async () => {
    if (chosen === null) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      setDone(copySummary(await startBunfestYear(orgId, chosen, year), chosen, year))
      await onCopied()
      setBump((b) => b + 1)
    } catch (e) {
      setError(errMessage(e))
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <CountsLine c={counts} year={year} />
        {done && <p className="text-[15px] font-bold text-green-700">{done}</p>}
        <CardActions>
          <button type="button" onClick={() => go('/staff/bunfest/floor')} className={pill.orange}>
            Go to 2 · Venue and floor
          </button>
        </CardActions>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="font-display text-base font-extrabold text-ink">The date and place</h2>
          <p className="mt-1 text-[15px] text-slate-700">
            {record ? `${year}’s event record says ${eventDate(record)}.` : `There is no event record dated ${year}. Add one so visitors see the date.`}
          </p>
        </div>
        <CardActions>
          <Link to="/staff/events" className={pill.outline}>
            <Icon name="calendar" size={16} /> Open Events
          </Link>
        </CardActions>
      </Card>

      {others.length > 0 && (
        <Card className="space-y-3">
          <div>
            <h2 className="font-display text-base font-extrabold text-ink">Copy another year into {year}</h2>
            <p className="mt-1 text-[15px] text-slate-700">Anything already entered for {year} is left alone.</p>
            <Explain label="What gets copied" className="mt-1">
              <p>
                Copies the program, the festival cards, every page, both rosters and the floor plan into {year}, so you
                edit last year’s instead of starting from a blank screen. A new venue can be designed from scratch in step 2.
              </p>
            </Explain>
          </div>
          <div>
            <span className="block text-sm font-semibold text-slate-700">Copy from</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {others.map((y) => (
                <button key={y} type="button" aria-pressed={y === chosen} onClick={() => setFrom(y)} className={y === chosen ? pill.blue : pill.outline}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <FormError>{error}</FormError>
          <button type="button" onClick={() => void run()} disabled={busy || chosen === null} className={pill.soft}>
            {busy ? 'Copying…' : `Copy ${chosen ?? ''} into ${year}`}
          </button>
        </Card>
      )}
    </div>
  )
}

/* ============================================================== schedule */

function ScheduleTab({ orgId, year }: { orgId: string; year: number }) {
  const [view, setView] = useState<'sessions' | 'speakers'>('sessions')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={view === 'sessions'} onClick={() => setView('sessions')} className={view === 'sessions' ? pill.blue : pill.outline}>
          Sessions
        </button>
        <button type="button" aria-pressed={view === 'speakers'} onClick={() => setView('speakers')} className={view === 'speakers' ? pill.blue : pill.outline}>
          Speakers
        </button>
      </div>
      {view === 'sessions' ? <SessionsList orgId={orgId} year={year} /> : <StaffSpeakers orgId={orgId} />}
    </div>
  )
}

function SessionsList({ orgId, year }: { orgId: string; year: number }) {
  const [years, setYears] = useState<number[]>([])
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [presenters, setPresenters] = useState<PresenterRow[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      const [list, ys, ps] = await Promise.all([listSessions(orgId, year), sessionYears(orgId), listPresenters(orgId)])
      setRows(list)
      setPresenters(ps)
      setYears(ys)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year])
  useEffect(() => {
    void load()
  }, [load])

  const copyFrom = async (from: number) => {
    setError(null)
    try {
      const n = await copySessions(orgId, from, year)
      setNote(n === 0 ? `Nothing to copy from ${from}.` : `Copied ${n} sessions from ${from} — they start hidden, so edit then tick “People can see this”.`)
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const older = years.filter((y) => y !== year)
  const done = async () => {
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-3">
      <FormError>{error}</FormError>
      {note && <p className="text-[15px] font-bold text-green-700">{note}</p>}
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="space-y-3">
          <p className="text-[15px] text-slate-700">
            No sessions for {year} yet. Until one is published, visitors see the 2025 program with a note that this
            year’s is coming.
          </p>
          {older.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Start from a previous year</p>
              <CardActions>
                {older.map((y) => (
                  <button key={y} type="button" onClick={() => void copyFrom(y)} className={pill.outline}>
                    Copy {y}
                  </button>
                ))}
              </CardActions>
            </div>
          )}
        </Card>
      )}

      {rows?.map((r) =>
        editing === r.id ? (
          <SessionForm key={r.id} orgId={orgId} year={year} presenters={presenters} initial={r} onDone={done} onCancel={() => setEditing(null)} />
        ) : (
          <Card key={r.id} className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="w-[86px] shrink-0 font-display text-base font-black text-brand-blue">
                {fromTime(r.start_time)}
                {r.end_time ? <span className="block text-sm font-bold text-slate-500">to {fromTime(r.end_time)}</span> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-base font-extrabold text-ink">{r.title}</span>
                  {r.kind !== 'session' && <Badge tone="slate">{r.kind === 'break' ? 'Break' : 'Activity'}</Badge>}
                  {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                </span>
                {r.presenter && <span className="block text-[15px] text-slate-600">{r.presenter}</span>}
                <span className="block text-sm text-slate-500">{[r.track, r.room].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
            <CardActions>
              <button type="button" onClick={() => setEditing(r.id)} className={pill.blue}>
                Edit
              </button>
            </CardActions>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <SessionForm orgId={orgId} year={year} presenters={presenters} initial={null} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add a session
        </button>
      )}
    </div>
  )
}

function SessionForm({
  orgId,
  year,
  initial,
  presenters,
  onDone,
  onCancel,
}: {
  orgId: string
  year: number
  initial: SessionRow | null
  presenters: PresenterRow[]
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState({
    start_time: fromTime(initial?.start_time ?? '10:45:00'),
    end_time: fromTime(initial?.end_time ?? null),
    title: initial?.title ?? '',
    presenter: initial?.presenter ?? '',
    description: initial?.description ?? '',
    room: initial?.room ?? '',
    track: initial?.track ?? TRACKS[0],
    kind: initial?.kind ?? ('session' as SessionRow['kind']),
    is_published: initial?.is_published ?? true,
    presenter_ids: initial?.presenter_ids ?? ([] as string[]),
  })
  const togglePresenter = (id: string) =>
    setD((cur) => ({
      ...cur,
      presenter_ids: cur.presenter_ids.includes(id) ? cur.presenter_ids.filter((x) => x !== id) : [...cur.presenter_ids, id],
    }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveSession({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        start_time: toTime(d.start_time),
        end_time: d.end_time ? toTime(d.end_time) : null,
        title: d.title.trim(),
        // Picked the speakers but left the line blank? Write it from them.
        presenter:
          d.presenter.trim() ||
          d.presenter_ids
            .map((id) => presenters.find((p) => p.id === id))
            .filter((p): p is PresenterRow => !!p)
            .map((p) => (p.credentials ? `${p.name}, ${p.credentials}` : p.name))
            .join(' and ') ||
          null,
        description: d.description.trim() || null,
        room: d.room.trim() || null,
        track: d.track.trim() || TRACKS[0],
        kind: d.kind,
        is_published: d.is_published,
        presenter_ids: d.presenter_ids,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={initial ? `Change ${initial.title}` : `Add a session to ${year}`}
      hint="A is needed. B and C are optional."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      canSave={!!d.title.trim() && !!d.start_time}
      error={error}
      remove={
        initial
          ? {
              label: 'Delete this session',
              confirm: `Delete “${initial.title}”?`,
              onRemove: () => deleteSession(initial.id).then(onDone).catch((e) => setError(errMessage(e))),
            }
          : undefined
      }
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">What it is</Part>
        <Field label="Title" needed>
          <input className={staffInput} required value={d.title} onChange={txt('title')} placeholder="Administering Meds at Home" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" needed>
            <input type="time" className={staffInput} required value={d.start_time} onChange={txt('start_time')} />
          </Field>
          <Field label="Ends">
            <input type="time" className={staffInput} value={d.end_time} onChange={txt('end_time')} />
          </Field>
        </div>
        <Field label="Kind">
          <select className={staffInput} value={d.kind} onChange={txt('kind')}>
            {SESSION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">Who and where</Part>
        <Field label="Who’s presenting">
          <input className={staffInput} value={d.presenter} onChange={txt('presenter')} placeholder="Emily Fagundo, DVM · MedVet Hilliard" />
        </Field>
        {presenters.length > 0 && (
          <div>
            <span className="block text-sm font-semibold text-slate-700">Link to their bios</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {presenters.map((p) => {
                const on = d.presenter_ids.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePresenter(p.id)}
                    aria-pressed={on}
                    className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold ${
                      on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
            <span className="mt-1 block text-sm text-slate-600">
              Their names on the schedule then open the Speakers page. Add people under Speakers.
            </span>
          </div>
        )}
        <Field label="Where">
          <input className={staffInput} value={d.room} onChange={txt('room')} placeholder="Upstairs · Education Room" />
        </Field>
        <Field label="Track" hint="Talks in different tracks run at the same time, and visitors pick a track at the top of the schedule. Type a new name to start another one.">
          <input className={staffInput} list="bunfest-tracks" value={d.track} onChange={txt('track')} placeholder="Education Sessions" />
          <datalist id="bunfest-tracks">
            {TRACKS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">What people read</Part>
        <Field label="What it covers">
          <textarea className={staffInput} rows={3} value={d.description} onChange={txt('description')} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-6 w-6 rounded border-slate-300 text-brand-blue"
            checked={d.is_published}
            onChange={(e) => setD({ ...d, is_published: e.target.checked })}
          />
          People can see this
        </label>
      </div>
    </EditorForm>
  )
}

/* =============================================================== vendors */

function VendorsTab({ orgId, year }: { orgId: string; year: number }) {
  const [rows, setRows] = useState<Supplier[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [onlyYear, setOnlyYear] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows((await listSuppliers(orgId)).filter((s) => s.is_vendor))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  // Gift counts and totals for the summary on each row (update 27).
  const ready = useVendorRecordsReady()
  const [gifts, setGifts] = useState<Map<string, GiftTotals> | null>(null)
  const loadGifts = useCallback(async () => {
    if (!ready || !orgId) return
    try {
      setGifts(await giftTotals(orgId))
    } catch {
      setGifts(null)
    }
  }, [ready, orgId])
  useEffect(() => {
    void loadGifts()
  }, [loadGifts])

  const done = async () => {
    setEditing(null)
    await load()
  }
  const yearPicker = (years: number[], onChange: (years: number[]) => void) => <YearChips value={years} onChange={onChange} />
  const published = (rows ?? []).filter((r) => r.vendor_published).length
  // Same rule as the floor plan: tagged for the year, or not tagged by year at all.
  const inYear = (v: Supplier) => (v.vendor_years.length > 0 ? v.vendor_years.includes(year) : v.vendor_published)
  const sorted = useMemo(
    () => [...(rows ?? [])].filter((r) => !onlyYear || inYear(r)).sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, onlyYear, year],
  )
  const countYear = (rows ?? []).filter(inYear).length

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <p className="text-[15px] text-slate-700">
          Companies from the Hop Shop Suppliers list that are ticked “Vendor”.
          {rows && rows.length > 0 && (
            <span className="mt-1 block font-semibold text-ink">
              {published} of {rows.length} published · {countYear} at {year}.
            </span>
          )}
        </p>
        <Explain label="About vendors">
          <p>
            Visitors see the name, category, <strong>About them</strong> and website; everything else on the card —
            contact, photo, paperwork, fees, what they’ve given — is for the team only.
          </p>
        </Explain>
        <button type="button" aria-pressed={onlyYear} onClick={() => setOnlyYear((o) => !o)} className={onlyYear ? pill.blue : pill.outline}>
          {onlyYear ? `Showing only ${year}` : `Show only ${year}`}
        </button>
      </Card>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-[15px] text-slate-700">
          No vendors yet. Add one below, or tick “Vendor” on a company in Hop Shop → Suppliers.
        </Card>
      )}

      {sorted.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <p className="mb-3 font-display text-lg font-extrabold text-ink">{r.name}</p>
            <CompanyForm
              orgId={orgId}
              initial={r}
              mode="bunfest"
              onSaved={done}
              onCancel={() => setEditing(null)}
              onGiftsChanged={() => void loadGifts()}
              yearPicker={yearPicker}
            />
          </Card>
        ) : (
          <Card key={r.id} className="space-y-2">
            <div className="flex items-start gap-3">
              <CompanyThumb c={r} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-base font-extrabold text-ink">{r.name}</span>
                  {r.vendor_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="orange">Hidden</Badge>}
                  {inYear(r) && <Badge tone="slate">At {year}</Badge>}
                  {r.is_supplier && <Badge tone="slate">Supplier too</Badge>}
                </span>
                <span className="block text-[15px] text-slate-600">
                  {[r.vendor_category, r.vendor_room ? (r.vendor_room === 'burgundy' ? 'Burgundy Room' : 'Emerald Room') : null, r.vendor_booth ? `Booth ${r.vendor_booth}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No booth details yet'}
                </span>
                <CompanySummary c={r} gifts={gifts?.get(r.id)} />
              </span>
            </div>
            <CardActions>
              <button type="button" onClick={() => setEditing(r.id)} className={pill.blue}>
                Open
              </button>
            </CardActions>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <p className="mb-3 font-display text-lg font-extrabold text-ink">New vendor</p>
          <CompanyForm orgId={orgId} initial={null} mode="bunfest" onSaved={done} onCancel={() => setEditing(null)} yearPicker={yearPicker} />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add a vendor
        </button>
      )}
    </div>
  )
}

/* ============================================================== partners */

function PartnersTab({ orgId, year }: { orgId: string; year: number }) {
  const [rows, setRows] = useState<PartnerRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listPartners(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  // A–Z by name: a reference list.
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = [...(rows ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    if (!t) return list
    return list.filter((r) => `${r.name} ${r.city ?? ''} ${r.state ?? ''} ${r.region ?? ''}`.toLowerCase().includes(t))
  }, [rows, q])

  const done = async () => {
    setEditing(null)
    await load()
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-slate-700">BunFest’s rescue partners, and “find a rescue near you”.</p>
      <Explain label="About the rescue directory">
        <p>Leave it empty and the app keeps showing the researched 2026 list.</p>
      </Explain>
      <div className="relative">
        <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find by name or state"
          aria-label="Find a rescue by name or state"
          className="min-h-[48px] w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-base text-ink outline-none focus:border-brand-blue"
        />
      </div>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}

      {shown.map((r) =>
        editing === r.id ? (
          <PartnerForm key={r.id} orgId={orgId} initial={r} onDone={done} onCancel={() => setEditing(null)} />
        ) : (
          <Card key={r.id} className="space-y-2">
            <span className="block min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-base font-extrabold text-ink">{r.name}</span>
                {r.is_host && <Badge tone="blue">Host</Badge>}
                {(r.bunfest_years.length > 0 ? r.bunfest_years.includes(year) : r.at_bunfest) && <Badge tone="orange">At BunFest {year}</Badge>}
                {!r.is_published && <Badge tone="slate">Hidden</Badge>}
              </span>
              <span className="block text-[15px] text-slate-600">
                {r.location || [r.city, r.state].filter(Boolean).join(', ')}
                {r.region ? ` · ${r.region}` : ''}
              </span>
            </span>
            <CardActions>
              <button type="button" onClick={() => setEditing(r.id)} className={pill.blue}>
                Edit
              </button>
            </CardActions>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <PartnerForm orgId={orgId} initial={null} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add a rescue
        </button>
      )}
    </div>
  )
}

function PartnerForm({
  orgId,
  initial,
  onDone,
  onCancel,
}: {
  orgId: string
  initial: PartnerRow | null
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState({
    name: initial?.name ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    region: (initial?.region ?? 'Midwest') as (typeof REGIONS)[number],
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    address: initial?.address ?? '',
    website: initial?.website ?? '',
    blurb: initial?.blurb ?? '',
    is_host: initial?.is_host ?? false,
    years: initial?.bunfest_years ?? [new Date().getFullYear()],
    is_published: initial?.is_published ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      let website = d.website.trim() || null
      if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
      await savePartner({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        name: d.name.trim(),
        city: d.city.trim() || null,
        state: d.state.trim().toUpperCase() || null,
        region: d.region,
        location: [d.city.trim(), d.state.trim().toUpperCase()].filter(Boolean).join(', ') || null,
        phone: d.phone.trim() || null,
        email: d.email.trim() || null,
        address: d.address.trim() || null,
        website,
        blurb: d.blurb.trim() || null,
        is_host: d.is_host,
        bunfest_years: d.years,
        at_bunfest: d.years.length > 0,
        is_published: d.is_published,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={initial ? `Change ${initial.name}` : 'Add a rescue'}
      hint="A is needed. B and C are optional."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      canSave={!!d.name.trim()}
      error={error}
      remove={
        initial
          ? {
              label: 'Delete this rescue',
              confirm: `Delete ${initial.name} from the directory?`,
              onRemove: () => deletePartner(initial.id).then(onDone).catch((e) => setError(errMessage(e))),
            }
          : undefined
      }
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">Who</Part>
        <Field label="Rescue" needed>
          <input className={staffInput} required value={d.name} onChange={txt('name')} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="City">
              <input className={staffInput} value={d.city} onChange={txt('city')} />
            </Field>
          </div>
          <Field label="State">
            <input className={staffInput} maxLength={2} value={d.state} onChange={txt('state')} placeholder="OH" />
          </Field>
        </div>
        <Field label="Region">
          <select className={staffInput} value={d.region} onChange={txt('region')}>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">How to reach them</Part>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
          </Field>
          <Field label="Email">
            <input className={staffInput} type="email" value={d.email} onChange={txt('email')} />
          </Field>
        </div>
        <Field label="Website">
          <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} />
        </Field>
        <Field label="Address">
          <input className={staffInput} value={d.address} onChange={txt('address')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">On the list</Part>
        <Field label="About them">
          <textarea className={staffInput} rows={3} value={d.blurb} onChange={txt('blurb')} />
        </Field>
        <YearChips value={d.years} onChange={(years) => setD({ ...d, years })} />
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input type="checkbox" className="h-6 w-6 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
    </EditorForm>
  )
}

/* ============================================================ 5 pages and check */

// Step 5: the cards on the BunFest home screen, the activity pages behind
// them, the facts on Plan your visit — and, last, a look at what is still hidden.
function PagesStep({ orgId, year }: { orgId: string; year: number }) {
  const [view, setView] = useState<'pages' | 'cards' | 'facts'>('pages')
  const [bump, setBump] = useState(0)
  const counts = useCounts(orgId, year, bump)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['pages', 'Pages'],
            ['cards', 'Home cards'],
            ['facts', 'Plan your visit'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={view === v ? pill.blue : pill.outline}>
            {label}
          </button>
        ))}
      </div>
      {view === 'pages' && <PagesTab orgId={orgId} year={year} onChanged={() => setBump((b) => b + 1)} />}
      {view === 'cards' && <CardsTab orgId={orgId} year={year} onChanged={() => setBump((b) => b + 1)} />}
      {view === 'facts' && <EventFactsCard orgId={orgId} />}

      <Card className="space-y-3 border-brand-blue/30 bg-brand-blue-50/40">
        <h2 className="font-display text-base font-extrabold text-ink">Check before you finish</h2>
        <CountsLine c={counts} year={year} />
        <CardActions>
          <Link to="/bunfest" className={pill.outline}>
            <Icon name="eye" size={16} /> See it as visitors do
          </Link>
        </CardActions>
      </Card>
    </div>
  )
}

/* ============================================================= home cards */

// The "at the festival" cards. Both these and the facts on Plan your visit used
// to be written into the app, so a new year needed a new build.
function CardsTab({ orgId, year, onChanged }: { orgId: string; year: number; onChanged: () => void }) {
  const [rows, setRows] = useState<FeatureRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listFeatures(orgId, year))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year])
  useEffect(() => {
    void load()
  }, [load])

  const done = async () => {
    setEditing(null)
    await load()
    onChanged()
  }
  const move = async (i: number, by: -1 | 1) => {
    if (!rows) return
    setError(null)
    try {
      if (await moveInList(rows, i, by, (r, n) => saveFeature({ ...r, sort_order: n }))) await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }
  const nextOrder = (rows ?? []).reduce((m, r) => Math.max(m, r.sort_order), 0) + 1

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-slate-700">The cards under “At the festival” on the BunFest home screen, in the order shown.</p>
      <Explain label="About these cards">
        <p>Leave a year empty and the app shows the built-in list.</p>
      </Explain>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}

      {rows?.map((r, i) =>
        editing === r.id ? (
          <FeatureForm key={r.id} orgId={orgId} year={year} initial={r} nextOrder={nextOrder} onDone={done} onCancel={() => setEditing(null)} />
        ) : (
          <Card key={r.id} className="space-y-2">
            <span className="block min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-base font-extrabold text-ink">{r.title}</span>
                {!r.is_published && <Badge tone="orange">Hidden</Badge>}
              </span>
              {r.blurb && <span className="block text-[15px] text-slate-600">{r.blurb}</span>}
              <span className="block text-sm text-slate-500">
                {[r.icon ? `icon: ${r.icon}` : null, r.link_url].filter(Boolean).join(' · ') || 'No link'}
              </span>
            </span>
            <CardActions>
              <button type="button" onClick={() => setEditing(r.id)} className={pill.blue}>
                Edit
              </button>
              <MovePills i={i} count={rows.length} onMove={(by) => void move(i, by)} />
            </CardActions>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <FeatureForm orgId={orgId} year={year} initial={null} nextOrder={nextOrder} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add a card
        </button>
      )}
    </div>
  )
}

function FeatureForm({
  orgId,
  year,
  initial,
  nextOrder,
  onDone,
  onCancel,
}: {
  orgId: string
  year: number
  initial: FeatureRow | null
  /** A new card goes at the end; Move up / Move down changes it afterwards. */
  nextOrder: number
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState({
    title: initial?.title ?? '',
    blurb: initial?.blurb ?? '',
    icon: initial?.icon ?? 'star',
    link_url: initial?.link_url ?? '',
    is_published: initial?.is_published ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await saveFeature({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        title: d.title.trim(),
        blurb: d.blurb.trim() || null,
        icon: d.icon.trim() || null,
        link_url: d.link_url.trim() || null,
        is_published: d.is_published,
        sort_order: initial?.sort_order ?? nextOrder,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={initial ? `Change ${initial.title}` : `Add a card to ${year}`}
      hint="A is needed. B and C are optional."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      canSave={!!d.title.trim()}
      error={error}
      remove={
        initial
          ? {
              label: 'Delete this card',
              confirm: `Delete the “${initial.title}” card?`,
              onRemove: () => deleteFeature(initial.id).then(onDone).catch((e) => setError(errMessage(e))),
            }
          : undefined
      }
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">What it is</Part>
        <Field label="What it is" needed>
          <input className={staffInput} required value={d.title} onChange={txt('title')} placeholder="Bunny Spa" />
        </Field>
        <Field label="One line about it">
          <input className={staffInput} value={d.blurb} onChange={txt('blurb')} placeholder="Nail trims and grooming for your rabbit." />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">How it looks and where it goes</Part>
        <Field label="Picture on the card">
          <select className={staffInput} value={d.icon} onChange={txt('icon')}>
            {FEATURE_ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Where it goes">
          <input className={staffInput} value={d.link_url} onChange={txt('link_url')} placeholder="/bunfest/schedule or https://…" />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">Showing it</Part>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input type="checkbox" className="h-6 w-6 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
    </EditorForm>
  )
}

/** Admission, parking, the rabbit rule and this year's links. */
function EventFactsCard({ orgId }: { orgId: string }) {
  const [d, setD] = useState<EventFacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    loadEventFacts(orgId)
      .then(setD)
      .catch((e) => setError(errMessage(e)))
  }, [orgId])

  if (error && !d) return <FormError>{error}</FormError>
  if (!d) return <Spinner />
  const txt = (k: keyof EventFacts) => (e: { target: { value: string } }) => {
    setSaved(false)
    setD({ ...d, [k]: e.target.value })
  }

  return (
    <EditorForm
      title="Plan your visit"
      hint="What the app tells visitors about getting in and getting there. Everything here is optional."
      onSubmit={async () => {
        setBusy(true)
        setError(null)
        try {
          await saveEventFacts(orgId, d)
          setSaved(true)
        } catch (e) {
          setError(errMessage(e))
        } finally {
          setBusy(false)
        }
      }}
      busy={busy}
      saveLabel="Save these facts"
      error={error}
    >
      <div className="space-y-3">
        <Part n="A" hint="optional">Getting in</Part>
        <Field label="Admission — one per line, “who = price”">
          <textarea className={staffInput} rows={3} value={d.admission} onChange={txt('admission')} placeholder={'Adults = $10.00\nAges 5–12 = $5.00\nUnder 5 = Free'} />
        </Field>
        <Field label="Note under the prices">
          <input className={staffInput} value={d.admission_note} onChange={txt('admission_note')} />
        </Field>
        <Field label="Parking">
          <input className={staffInput} value={d.parking} onChange={txt('parking')} />
        </Field>
        <Field label="The rabbit rule">
          <textarea className={staffInput} rows={2} value={d.rabbit_rule} onChange={txt('rabbit_rule')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">Links</Part>
        <Field label="Tickets link">
          <input className={staffInput} value={d.tickets_url} onChange={txt('tickets_url')} />
        </Field>
        <Field label="Hotel link">
          <input className={staffInput} value={d.hotel_url} onChange={txt('hotel_url')} />
        </Field>
        <Field label="BunFest volunteer link">
          <input className={staffInput} value={d.volunteer_url} onChange={txt('volunteer_url')} />
        </Field>
        <Field label="Merch link">
          <input className={staffInput} value={d.merch_url} onChange={txt('merch_url')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">Credit</Part>
        <Field label="Credit line">
          <input className={staffInput} value={d.logo_credit} onChange={txt('logo_credit')} placeholder="Logo design by …" />
        </Field>
        {saved && <p className="text-[15px] font-bold text-green-700">Saved.</p>}
      </div>
    </EditorForm>
  )
}

/* ================================================================= pages */

// Bunny Spa prices, whether advance booking is open, the raffle's drawing
// time, the hotel's group code — this year's version of each activity page.
// It used to be src/data/bunfestPages.ts, so a change meant a new build.
function PagesTab({ orgId, year, onChanged }: { orgId: string; year: number; onChanged: () => void }) {
  const [rows, setRows] = useState<PageRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listPages(orgId, year))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, year])
  useEffect(() => {
    void load()
  }, [load])

  const done = async () => {
    setEditing(null)
    await load()
    onChanged()
  }
  const move = async (i: number, by: -1 | 1) => {
    if (!rows) return
    setError(null)
    try {
      if (await moveInList(rows, i, by, (r, n) => savePage({ ...r, sort_order: n }))) await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }
  const nextOrder = (rows ?? []).reduce((m, r) => Math.max(m, r.sort_order), 0) + 1

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-slate-700">The pages behind the cards on the BunFest home screen, in the order shown.</p>
      <Explain label="About these pages">
        <p>
          The Bunny Spa, Glamour Shots, the raffle, the host hotel and so on. Leave a year empty and the app falls back to
          the built-in copy. Step 1 can copy a whole set forward from another year.
        </p>
      </Explain>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-[15px] text-slate-700">No pages for {year} yet. Copy them forward in step 1, or add one below.</Card>
      )}

      {rows?.map((r, i) =>
        editing === r.id ? (
          <PageForm key={r.id} orgId={orgId} year={year} initial={r} nextOrder={nextOrder} onDone={done} onCancel={() => setEditing(null)} />
        ) : (
          <Card key={r.id} className="space-y-2">
            <span className="block min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-base font-extrabold text-ink">{r.title}</span>
                {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                {r.feature && <Badge tone="blue">{r.feature === 'reserve' ? 'Takes requests' : 'Raffle'}</Badge>}
              </span>
              {r.subtitle && <span className="block text-[15px] text-slate-600">{r.subtitle}</span>}
              <span className="block text-sm text-slate-500">/bunfest/p/{r.slug}</span>
            </span>
            <CardActions>
              <button type="button" onClick={() => setEditing(r.id)} className={pill.blue}>
                Edit
              </button>
              <MovePills i={i} count={rows.length} onMove={(by) => void move(i, by)} />
            </CardActions>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <PageForm orgId={orgId} year={year} initial={null} nextOrder={nextOrder} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add a page
        </button>
      )}
    </div>
  )
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const asString = (v: unknown): string => (typeof v === 'string' ? v : '')

/** "Label | /bunfest/p/spa" per line — readable, and easy to type on a phone. */
function relatedToForm(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return v
    .map((r) => asRecord(r))
    .filter((r) => asString(r.label) && asString(r.to))
    .map((r) => `${asString(r.label)} | ${asString(r.to)}`)
    .join('\n')
}

function relatedFromForm(text: string): { label: string; to: string }[] {
  return text
    .split('\n')
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ label: parts[0].trim(), to: parts.slice(1).join('|').trim() }))
    .filter((r) => r.label && r.to)
}

function PageForm({
  orgId,
  year,
  initial,
  nextOrder,
  onDone,
  onCancel,
}: {
  orgId: string
  year: number
  initial: PageRow | null
  /** A new page goes at the end; Move up / Move down changes it afterwards. */
  nextOrder: number
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const contact = asRecord(initial?.contact)
  const reserve = asRecord(initial?.reserve)
  const [d, setD] = useState({
    slug: initial?.slug ?? '',
    title: initial?.title ?? '',
    subtitle: initial?.subtitle ?? '',
    icon: initial?.icon ?? 'star',
    sponsor_note: initial?.sponsor_note ?? '',
    chips: (initial?.chips ?? []).join(', '),
    note: initial?.note ?? '',
    feature: (initial?.feature ?? '') as '' | 'reserve' | 'raffle',
    reserve_form: asString(reserve.formName),
    reserve_services: Array.isArray(reserve.services)
      ? reserve.services.filter((x): x is string => typeof x === 'string').join(', ')
      : '',
    reserve_slots: Array.isArray(reserve.slots)
      ? reserve.slots.filter((x): x is string => typeof x === 'string').join(', ')
      : '',
    reserve_opens: asString(reserve.opensOn),
    reserve_closes: asString(reserve.closesOn),
    reserve_closed_note: asString(reserve.closedNote),
    email_signup: initial?.email_signup ?? '',
    address: asString(contact.address),
    phone: asString(contact.phone),
    url: asString(contact.url),
    url_label: asString(contact.urlLabel),
    related_label: initial?.related_label ?? '',
    related: relatedToForm(initial?.related),
    is_published: initial?.is_published ?? true,
  })
  const [sections, setSections] = useState<PageSection[]>(
    sectionsToForm(initial?.sections).length > 0
      ? sectionsToForm(initial?.sections)
      : [{ heading: '', body: '', list: '' }],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const setSection = (i: number, patch: Partial<PageSection>) =>
    setSections(sections.map((s, j) => (i === j ? { ...s, ...patch } : s)))

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const hasContact = [d.address, d.phone, d.url].some((v) => v.trim())
      await savePage({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        year,
        slug: d.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''),
        title: d.title.trim(),
        subtitle: d.subtitle.trim() || null,
        icon: d.icon || null,
        sponsor_note: d.sponsor_note.trim() || null,
        chips: d.chips.split(',').map((c) => c.trim()).filter(Boolean),
        note: d.note.trim() || null,
        sections: sectionsFromForm(sections, initial?.sections),
        feature: d.feature || null,
        // Kept even when the form is switched off, so turning it back on next
        // year doesn't mean retyping the services and the times.
        reserve: {
          formName: d.reserve_form.trim() || `${d.slug.trim()}-reservation`,
          services: d.reserve_services.split(',').map((x) => x.trim()).filter(Boolean),
          slots: d.reserve_slots.split(',').map((x) => x.trim()).filter(Boolean),
          opensOn: d.reserve_opens || null,
          closesOn: d.reserve_closes || null,
          closedNote: d.reserve_closed_note.trim() || null,
        },
        email_signup: d.email_signup.trim() || null,
        contact: hasContact
          ? {
              address: d.address.trim(),
              phone: d.phone.trim(),
              url: d.url.trim(),
              urlLabel: d.url_label.trim(),
            }
          : null,
        related_label: d.related_label.trim() || null,
        related: relatedFromForm(d.related),
        is_published: d.is_published,
        sort_order: initial?.sort_order ?? nextOrder,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={initial ? `Change ${initial.title}` : `Add a page to ${year}`}
      hint="A is needed. B to E are optional — fill in what the page should say."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      canSave={!!d.title.trim() && !!d.slug.trim()}
      error={error}
      remove={
        initial
          ? {
              label: 'Delete this page',
              confirm: `Delete the “${initial.title}” page?`,
              onRemove: () => deletePage(initial.id).then(onDone).catch((e) => setError(errMessage(e))),
            }
          : undefined
      }
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">What it is</Part>
        <Field label="Title" needed>
          <input className={staffInput} required value={d.title} onChange={txt('title')} placeholder="Bunny Spa" />
        </Field>
        <Field label="Web address" needed hint={`/bunfest/p/${d.slug || '…'}`}>
          <input className={staffInput} required value={d.slug} onChange={txt('slug')} placeholder="spa" />
        </Field>
        <Field label="One line under the title">
          <input className={staffInput} value={d.subtitle} onChange={txt('subtitle')} placeholder="Grooming and hygiene for your rabbit." />
        </Field>
        <Field label="Icon">
          <select className={staffInput} value={d.icon} onChange={txt('icon')}>
            {FEATURE_ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">What the page says</Part>
        <Field label="Sponsor line">
          <input className={staffInput} value={d.sponsor_note} onChange={txt('sponsor_note')} placeholder="Sponsored by Oxbow" />
        </Field>
        <Field label="Quick facts, separated by commas">
          <input className={staffInput} value={d.chips} onChange={txt('chips')} placeholder="$12 per service, $20 full spa package" />
        </Field>
        <Field label="Highlighted rule at the top">
          <textarea className={staffInput} rows={2} value={d.note} onChange={txt('note')} placeholder="Any rabbit attending must be vaccinated against RHDV2…" />
        </Field>
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          {sections.map((sec, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Section {i + 1}</p>
              <Field label="Heading">
                <input className={staffInput} value={sec.heading} onChange={(e) => setSection(i, { heading: e.target.value })} placeholder="Services" />
              </Field>
              <Field label="Paragraph">
                <textarea className={staffInput} rows={3} value={sec.body} onChange={(e) => setSection(i, { body: e.target.value })} />
              </Field>
              <Field label="Bullet points — one per line">
                <textarea className={staffInput} rows={3} value={sec.list} onChange={(e) => setSection(i, { list: e.target.value })} placeholder={'Nail trims\nLight grooming'} />
              </Field>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => window.confirm(`Remove section ${i + 1}?`) && setSections(sections.filter((_, j) => j !== i))}
                  className={pill.red}
                >
                  <Icon name="trash" size={16} /> Remove this section
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setSections([...sections, { heading: '', body: '', list: '' }])} className={pill.soft}>
            <Icon name="plus" size={16} /> Add a section
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">Anything extra on the page</Part>
        <Field label="Extra">
          <select className={staffInput} value={d.feature} onChange={txt('feature')}>
            <option value="">Nothing extra</option>
            <option value="reserve">A form to request a time</option>
            <option value="raffle">The raffle prizes and tickets</option>
          </select>
        </Field>
        {d.feature === 'reserve' && (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
            <Explain label="About reserving">
              <p>
                Requests arrive in the staff Inbox, and nobody pays until they turn up. Set the last day
                you want to take them and the form takes itself down — you don’t have to remember.
              </p>
            </Explain>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Open requests from" hint="Leave empty to open now.">
                <input type="date" className={staffInput} value={d.reserve_opens} onChange={txt('reserve_opens')} />
              </Field>
              <Field label="Take them until" hint="Leave empty to keep taking them.">
                <input type="date" className={staffInput} value={d.reserve_closes} onChange={txt('reserve_closes')} />
              </Field>
            </div>
            <Field label="Times people can ask for, separated by commas">
              <input className={staffInput} value={d.reserve_slots} onChange={txt('reserve_slots')} placeholder="10:00 AM, 10:30 AM, 11:00 AM" />
            </Field>
            <Field label="Choices offered, separated by commas">
              <input className={staffInput} value={d.reserve_services} onChange={txt('reserve_services')} placeholder="Nail trims, Light grooming, Full spa package" />
            </Field>
            <Field label="What the page says once requests have closed">
              <textarea className={staffInput} rows={2} value={d.reserve_closed_note} onChange={txt('reserve_closed_note')} placeholder="Advance scheduling has closed. Hop by as soon as you arrive to sign up in person." />
            </Field>
            <Field label="Name for the requests">
              <input className={staffInput} value={d.reserve_form} onChange={txt('reserve_form')} placeholder="spa-reservation" />
            </Field>
          </div>
        )}
        <Field label="Email address to sign up with">
          <input className={staffInput} type="email" value={d.email_signup} onChange={txt('email_signup')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="D" hint="optional">Contact on the page</Part>
        <Field label="Address">
          <input className={staffInput} value={d.address} onChange={txt('address')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
          </Field>
          <Field label="Button label">
            <input className={staffInput} value={d.url_label} onChange={txt('url_label')} placeholder="Book the group rate" />
          </Field>
        </div>
        <Field label="Link">
          <input className={staffInput} inputMode="url" value={d.url} onChange={txt('url')} />
        </Field>
        <Field label="Heading over the links at the bottom">
          <input className={staffInput} value={d.related_label} onChange={txt('related_label')} placeholder="Pairs well with" />
        </Field>
        <Field label="Links at the bottom — one per line, “Label | /where/it/goes”">
          <textarea className={staffInput} rows={2} value={d.related} onChange={txt('related')} placeholder={'Glamour Shots | /bunfest/p/glamour'} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="E" hint="optional">Showing it</Part>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input type="checkbox" className="h-6 w-6 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
    </EditorForm>
  )
}
