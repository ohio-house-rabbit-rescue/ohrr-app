import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { ArticleBody, RichText } from '../components/ArticleBody'
import {
  useEvents,
  eventDate,
  eventTime,
  isUpcoming,
  mapsUrl,
  eventCalendarUrl,
} from '../lib/events'
import { BUNFEST_EVENT_SLUG, type EventItem } from '../data/events'
import { ohrr } from '../data/ohrr'
import PresentedBy from '../features/sponsors/PresentedBy'

function EventCard({ event: e, past = false }: { event: EventItem; past?: boolean }) {
  const [open, setOpen] = useState(false)
  const isBunfest = e.slug === BUNFEST_EVENT_SLUG
  const day = new Date(e.startsAt)
  return (
    <Card className={past ? 'opacity-75' : ''}>
      <div className="flex gap-3.5">
        {/* date tile */}
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-blue-50 leading-none text-brand-blue">
          <span className="text-[10px] font-bold uppercase">
            {day.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' })}
          </span>
          <span className="font-display text-2xl font-black">
            {day.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' })}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-extrabold leading-tight text-ink">{e.title}</h3>
            {e.theme && <Badge tone="orange">{e.theme}</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <Icon name="calendar" size={14} className="shrink-0 text-brand-blue" />
            {eventDate(e)}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-600">
            <Icon name="clock" size={14} className="shrink-0 text-brand-blue" />
            {eventTime(e)}
          </p>
          {(e.venue || e.address) && (
            <p className="mt-0.5 flex items-start gap-2 text-sm text-slate-600">
              <Icon name="mappin" size={14} className="mt-0.5 shrink-0 text-brand-blue" />
              <span>
                {e.venue && <span className="font-semibold text-ink">{e.venue}</span>}
                {e.venue && e.address && <span> · </span>}
                {e.address && (
                  <a
                    href={mapsUrl(e.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
                  >
                    {e.address}
                  </a>
                )}
              </span>
            </p>
          )}
        </div>
      </div>

      {e.summary && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          <RichText text={e.summary} />
        </p>
      )}

      {e.body && open && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ArticleBody body={e.body} compact />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isBunfest && (
          <Link to="/bunfest" className={`${btn.primary} px-4 py-2`}>
            Open BunFest <Icon name="chevron" size={15} />
          </Link>
        )}
        {e.body && (
          <button type="button" onClick={() => setOpen((o) => !o)} className={`${btn.outline} px-4 py-2`}>
            {open ? 'Show less' : 'Read more'}
          </button>
        )}
        {!past && (
          <a
            href={eventCalendarUrl(e)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            <Icon name="calendar" size={14} /> Add to calendar
          </a>
        )}
        {e.url && (
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Event site <Icon name="external" size={13} />
          </a>
        )}
      </div>
    </Card>
  )
}

export default function Events() {
  const { events, source } = useEvents()
  const upcoming = events.filter((e) => isUpcoming(e))
  const past = events.filter((e) => !isUpcoming(e)).reverse()

  return (
    <>
      <PageHeader
        icon="calendar"
        title="Events"
        subtitle="OHRR hoppenings — Midwest BunFest and everything else on the calendar."
      />
      <Screen className="space-y-6">
        <PresentedBy surface="events" />
        <section className="space-y-2.5">
          <SectionLabel>Upcoming</SectionLabel>
          {upcoming.length === 0 ? (
            <Card className="border-slate-200 bg-slate-50/80 text-center">
              <p className="text-sm leading-relaxed text-slate-600">
                Nothing scheduled right now — check back soon, or follow OHRR on Facebook and Instagram
                for the next hoppening.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>Past events</SectionLabel>
            <div className="space-y-3">
              {past.map((e) => (
                <EventCard key={e.id} event={e} past />
              ))}
            </div>
          </section>
        )}

        <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
          {source === 'live' ? 'Kept up to date by OHRR staff.' : 'From ohiohouserabbitrescue.org.'}{' '}
          Questions? Email{' '}
          <a href={`mailto:${ohrr.email}`} className="font-semibold text-brand-blue">
            {ohrr.email}
          </a>
          .
        </p>
      </Screen>
    </>
  )
}
