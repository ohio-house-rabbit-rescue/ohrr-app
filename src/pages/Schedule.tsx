import { useState } from 'react'
import { sessions } from '../data/sessions'
import { event } from '../data/event'
import { PageHeader, Screen, Card, SampleNote, SegTabs, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { useSavedSessions, toggleSavedSession } from '../lib/savedSessions'
import CalendarSheet from '../components/CalendarSheet'

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const FILTERS = ['All', 'Saved'] as const
type Filter = (typeof FILTERS)[number]

export default function Schedule() {
  const [filter, setFilter] = useState<Filter>('All')
  const [calOpen, setCalOpen] = useState(false)
  const saved = useSavedSessions()

  const sorted = [...sessions].sort((a, b) => toMin(a.start) - toMin(b.start))
  const savedTalks = sorted.filter((s) => !s.isBreak && saved.has(s.id))
  const list = filter === 'Saved' ? savedTalks : sorted

  return (
    <>
      <PageHeader
        icon="calendar"
        title="Schedule"
        subtitle={`Education sessions · ${event.timeLabel}`}
      />
      <Screen className="space-y-3">
        <SampleNote>
          Showing the 2025 sessions. The 2026 program is announced closer to the event.
        </SampleNote>

        <div className="flex items-center justify-between gap-3">
          <SegTabs options={FILTERS} value={filter} onChange={setFilter} />
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

        {filter === 'Saved' && savedTalks.length === 0 ? (
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
              <div
                key={s.id}
                className="flex items-center gap-3 px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-400"
              >
                <span className="h-px flex-1 bg-slate-200" />
                {s.time} · Break
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            ) : (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-brand-orange">{s.time}</span>
                  <SaveButton id={s.id} title={s.title} saved={saved.has(s.id)} />
                </div>
                <h3 className="mt-1 font-display text-base font-extrabold text-ink">{s.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-brand-blue">{s.presenter}</p>
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
