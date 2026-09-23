import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBunfestSessions } from '../features/bunfest/content'
import { event } from '../data/event'
import type { Session } from '../data/sessions'
import { PageHeader, Screen, Card, SampleNote, SegTabs, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { useSavedSessions, toggleSavedSession } from '../lib/savedSessions'
import CalendarSheet from '../components/CalendarSheet'

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const SAVED = 'Saved'
const ALL = 'All'

/** "Special Interest Sessions" is too long for a tab on a phone. */
const shortTrack = (t: string) => t.replace(/\s*Sessions$/i, '')

export default function Schedule() {
  const [calOpen, setCalOpen] = useState(false)
  const saved = useSavedSessions()
  const { items: sessions, source } = useBunfestSessions()

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => toMin(a.start) - toMin(b.start)),
    [sessions],
  )

  // BunFest runs more than one track at a time. When it does, the tracks are
  // the tabs — showing both in one timeline made talks look like clashes.
  const tracks = useMemo(() => {
    const seen: string[] = []
    for (const s of sorted) if (s.track && !seen.includes(s.track)) seen.push(s.track)
    return seen
  }, [sorted])

  const tabs = useMemo(
    () => (tracks.length > 1 ? [...tracks.map(shortTrack), SAVED] : [ALL, SAVED]),
    [tracks],
  )
  const [tab, setTab] = useState<string>(tabs[0])
  // The programme can arrive after the first render and change the tabs.
  const current = tabs.includes(tab) ? tab : tabs[0]

  const savedTalks = sorted.filter((s) => !s.isBreak && saved.has(s.id))
  const list =
    current === SAVED
      ? savedTalks
      : current === ALL
        ? sorted
        : sorted.filter((s) => s.track && shortTrack(s.track) === current)

  return (
    <>
      <PageHeader
        icon="calendar"
        title="Schedule"
        subtitle={`Education sessions · ${event.timeLabel}`}
      />
      <Screen className="space-y-3">
        {source === 'seed' && (
          <SampleNote>
            This year’s programme appears here as soon as OHRR adds it (Staff → BunFest) — no app
            update needed.
          </SampleNote>
        )}

        <Link
          to="/bunfest/speakers"
          className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-bold text-ink shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="users" size={17} className="text-brand-blue" /> Meet the speakers
          </span>
          <Icon name="chevron" size={17} className="text-slate-300" />
        </Link>

        <div className="flex items-center justify-between gap-3">
          <SegTabs options={tabs} value={current} onChange={setTab} />
          {savedTalks.length > 0 && (
            <button
              type="button"
              onClick={() => setCalOpen(true)}
              className={`${btn.outline} shrink-0 px-4 py-2`}
            >
              <Icon name="calendar" size={16} />
              Add to calendar
            </button>
          )}
        </div>

        {current === SAVED && savedTalks.length === 0 ? (
          <Card className="text-center">
            <p className="font-display text-base font-extrabold text-ink">No saved sessions yet</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Tap the <Icon name="star" size={15} className="-mt-0.5 inline text-slate-400" /> on any
              session to build your day — then add them all to your calendar.
            </p>
          </Card>
        ) : (
          list.map((s) =>
            s.isBreak ? (
              <BreakRow key={s.id} session={s} />
            ) : (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-brand-orange">{s.time}</span>
                  <SaveButton id={s.id} title={s.title} saved={saved.has(s.id)} />
                </div>
                <h3 className="mt-1 font-display text-base font-extrabold text-ink">{s.title}</h3>
                {s.presenterIds && s.presenterIds.length > 0 ? (
                  <Link
                    to={`/bunfest/speakers#${s.presenterIds[0]}`}
                    className="mt-0.5 inline-flex items-start gap-1 text-xs font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
                  >
                    {s.presenter}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-xs font-semibold text-brand-blue">{s.presenter}</p>
                )}
                {/* On the Saved tab the two tracks are mixed together, so say which. */}
                {current === SAVED && tracks.length > 1 && s.track && (
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {shortTrack(s.track)}
                  </p>
                )}
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
              </Card>
            ),
          )
        )}
      </Screen>

      {calOpen && <CalendarSheet sessions={savedTalks} onClose={() => setCalOpen(false)} />}
    </>
  )
}

function BreakRow({ session }: { session: Session }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      {session.time} · Break
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  )
}

function SaveButton({ id, title, saved }: { id: string; title: string; saved: boolean }) {
  return (
    <button
      type="button"
      onClick={() => toggleSavedSession(id)}
      aria-pressed={saved}
      aria-label={saved ? `Remove “${title}” from your schedule` : `Save “${title}” to your schedule`}
      className={[
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition active:scale-95',
        saved
          ? 'border-brand-orange/30 bg-brand-orange-50'
          : 'border-slate-200 bg-white hover:bg-slate-50',
      ].join(' ')}
    >
      <Icon
        name="star"
        size={18}
        className={saved ? 'fill-current text-brand-orange' : 'text-slate-400'}
      />
    </button>
  )
}
