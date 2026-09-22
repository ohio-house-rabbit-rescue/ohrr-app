import { Link } from 'react-router-dom'
import { event } from '../data/event'
import { useEventInfo } from '../features/bunfest/thisYear'
import { ohrr } from '../data/ohrr'
import { useBunfestEvent, eventDate, eventTime, mapsUrl } from '../lib/events'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Visit() {
  // Admission, parking and the links OHRR keeps up to date (Staff → BunFest)
  const info = useEventInfo()
  const bunfest = useBunfestEvent()
  return (
    <>
      <PageHeader
        icon="mappin"
        title="Plan Your Visit"
        subtitle="Everything you need to know before you go."
      />
      <Screen className="space-y-4">
        {/* When */}
        <Card>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
              <Icon name="calendar" size={20} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">When</p>
              <p className="font-bold text-ink">{eventDate(bunfest)}</p>
              <p className="text-sm text-slate-500">{eventTime(bunfest)}</p>
            </div>
          </div>
        </Card>

        {/* Where */}
        <Card>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
              <Icon name="mappin" size={20} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Where</p>
              <p className="font-bold text-ink">{bunfest.venue}</p>
              {bunfest.address && (
                <a
                  href={mapsUrl(bunfest.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
                >
                  {bunfest.address}
                </a>
              )}
            </div>
          </div>
          <Link
            to="/bunfest/map"
            className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            View event map <Icon name="chevron" size={14} />
          </Link>
        </Card>

        {/* Admission */}
        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Admission</h3>
          <dl className="mt-3 space-y-1.5">
            {info.admission.map((a) => (
              <div key={a.who} className="flex items-center justify-between text-sm">
                <dt className="text-slate-600">{a.who}</dt>
                <dd className="font-bold text-ink">{a.price}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500">{info.admissionNote}</p>
          <a
            href={event.links.tickets}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.primary} mt-4 w-full`}
          >
            Buy tickets
          </a>
        </Card>

        {/* Good to know */}
        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Good to know</h3>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
            <li>{info.parking}</li>
            <li>Cash & cards accepted for vendors, the auction, and raffle.</li>
            <li>Bringing your rabbit? Read the Rabbit Attendance Agreement first.</li>
            <li>Comfortable shoes — it’s a full day of browsing and talks.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-brand-blue">
            <Link to="/bunfest/p/bringing-bunny" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
              Bringing your bunny <Icon name="chevron" size={13} />
            </Link>
            <Link to="/bunfest/p/attendance-agreement" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
              Attendance agreement <Icon name="chevron" size={13} />
            </Link>
            <Link to="/bunfest/p/accommodations" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
              Accommodations <Icon name="chevron" size={13} />
            </Link>
            {/* Links OHRR keeps current for the year (Staff → BunFest) */}
            {info.hotelUrl && (
              <a href={info.hotelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
                Hotel information <Icon name="external" size={12} />
              </a>
            )}
            {info.volunteerUrl && (
              <a href={info.volunteerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
                Volunteer at BunFest <Icon name="external" size={12} />
              </a>
            )}
            {info.merchUrl && (
              <a href={info.merchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
                BunFest merch <Icon name="external" size={12} />
              </a>
            )}
          </div>
          {info.rabbitRule && (
            <p className="mt-3 rounded-xl bg-brand-orange-50 px-3 py-2 text-xs leading-relaxed text-brand-orange-dark">
              {info.rabbitRule}
            </p>
          )}
          {info.logoCredit && <p className="mt-2 text-xs text-slate-400">{info.logoCredit}</p>}
        </Card>

        {/* Host */}
        <Card className="border-brand-blue/20 bg-brand-blue-50/60">
          <h3 className="font-display text-base font-extrabold text-ink">About the host</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Midwest BunFest is presented by Ohio House Rabbit Rescue — all proceeds support the
            rescue’s adoption center, education, and foster rabbits.
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Icon name="mappin" size={15} className="shrink-0 text-brand-blue" />
              <span className="text-slate-600">{ohrr.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="phone" size={15} className="shrink-0 text-brand-blue" />
              <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
                {ohrr.phone}
              </a>
            </div>
          </dl>
        </Card>
      </Screen>
    </>
  )
}
