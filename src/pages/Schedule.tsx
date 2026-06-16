import { useMemo, useState } from 'react'
import { sessions, type Track } from '../data/sessions'
import { event } from '../data/event'
import { PageHeader, Container, Card, Badge, SampleBanner } from '../components/ui'

const TRACKS: (Track | 'All')[] = ['All', 'Main Stage', 'Education Room', 'Hands-On']

export default function Schedule() {
  const [track, setTrack] = useState<Track | 'All'>('All')

  const list = useMemo(() => {
    const filtered = track === 'All' ? sessions : sessions.filter((s) => s.track === track)
    return [...filtered].sort((a, b) => a.start.localeCompare(b.start))
  }, [track])

  return (
    <>
      <PageHeader
        title="Education Schedule"
        subtitle={`Talks led by rabbit experts and veterinarians — ${event.timeLabel}.`}
      />
      <Container className="py-8">
        <SampleBanner />

        {/* Track filter */}
        <div className="mt-6 flex flex-wrap gap-2">
          {TRACKS.map((t) => {
            const active = t === track
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTrack(t)}
                className={[
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-100',
                ].join(' ')}
              >
                {t}
              </button>
            )
          })}
        </div>

        {/* Sessions */}
        <div className="mt-6 space-y-4">
          {list.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-stone-900">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-stone-500">{s.speaker}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge>{s.track}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-emerald-700">{s.time}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </>
  )
}
