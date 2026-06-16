import { sessions } from '../data/sessions'
import { event } from '../data/event'
import { PageHeader, Screen, Card, SampleNote } from '../components/ui'

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function Schedule() {
  const list = [...sessions].sort((a, b) => toMin(a.start) - toMin(b.start))

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

        {list.map((s) =>
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
              <span className="text-sm font-bold text-brand-orange">{s.time}</span>
              <h3 className="mt-1 font-display text-base font-extrabold text-ink">{s.title}</h3>
              <p className="mt-0.5 text-xs font-semibold text-brand-blue">{s.presenter}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
            </Card>
          ),
        )}
      </Screen>
    </>
  )
}
