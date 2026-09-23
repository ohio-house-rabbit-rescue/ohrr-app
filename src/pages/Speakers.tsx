// BunFest → Speakers: who is giving this year's talks, and what else they're
// giving. One long page rather than a page each — easier to read through and
// to print, and the schedule links straight to a person's paragraph.
import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useBunfestPresenters, useBunfestSessions, presenterName } from '../features/bunfest/content'
import { PageHeader, Screen, Card, SampleNote, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Speakers() {
  const { items: presenters, loading } = useBunfestPresenters()
  const { items: sessions } = useBunfestSessions()
  const { hash } = useLocation()

  // Each speaker's talks this year, and only speakers who have one.
  const talksBy = useMemo(() => {
    const m = new Map<string, typeof sessions>()
    for (const s of sessions) for (const id of s.presenterIds ?? []) m.set(id, [...(m.get(id) ?? []), s])
    return m
  }, [sessions])
  const speaking = presenters.filter((p) => talksBy.has(p.id))
  const list = speaking.length > 0 ? speaking : presenters

  // The schedule links to /bunfest/speakers#<id>.
  useEffect(() => {
    if (!hash || list.length === 0) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, list.length])

  return (
    <>
      <PageHeader icon="users" title="Speakers" subtitle="The vets, rescuers and rabbit people giving this year’s talks." />
      <Screen className="space-y-3">
        {!loading && list.length === 0 && (
          <SampleNote>The speakers appear here as soon as OHRR adds them (Staff → BunFest → Schedule).</SampleNote>
        )}

        {list.map((p) => {
          const talks = talksBy.get(p.id) ?? []
          return (
            <div key={p.id} id={p.id} className="scroll-mt-24">
              <Card>
                <h2 className="font-display text-lg font-extrabold leading-tight text-ink">{presenterName(p)}</h2>
                {p.affiliation && <p className="mt-0.5 text-sm font-semibold text-brand-blue">{p.affiliation}</p>}
                {p.bio && <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{p.bio}</p>}
                {talks.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      {talks.length > 1 ? 'Talks' : 'Talk'}
                    </p>
                    {talks.map((t) => (
                      <Link
                        key={t.id}
                        to="/bunfest/schedule"
                        className="flex items-start gap-2 text-sm leading-snug text-ink hover:text-brand-blue"
                      >
                        <span className="shrink-0 font-bold text-brand-orange">{t.time}</span>
                        <span className="min-w-0">
                          <span className="font-semibold">{t.title}</span>
                          {t.track && <span className="block text-xs text-slate-500">{t.track}</span>}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )
        })}

        <Link to="/bunfest/schedule" className={`${btn.outline} w-full`}>
          <Icon name="calendar" size={16} /> The full schedule
        </Link>
      </Screen>
    </>
  )
}
