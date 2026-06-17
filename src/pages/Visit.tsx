import { Link } from 'react-router-dom'
import { event } from '../data/event'
import { ohrr } from '../data/ohrr'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Visit() {
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
              <p className="font-bold text-ink">{event.date}</p>
              <p className="text-sm text-slate-500">{event.timeLabel}</p>
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
              <p className="font-bold text-ink">{event.venue.name}</p>
              <p className="text-sm text-slate-500">{event.venue.address}</p>
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
            {event.admission.map((a) => (
              <div key={a.who} className="flex items-center justify-between text-sm">
                <dt className="text-slate-600">{a.who}</dt>
                <dd className="font-bold text-ink">{a.price}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500">{event.admissionNote}</p>
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
            <li>🅿️ {event.venue.parking}</li>
            <li>💳 Cash & cards accepted for vendors, the auction, and raffle.</li>
            <li>🐰 Bringing your rabbit? Read the Rabbit Attendance Agreement first.</li>
            <li>👟 Comfortable shoes — it’s a full day of browsing and talks.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm font-bold text-brand-blue">
            <a href={event.links.bringingBunny} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
              Bringing your bunny <Icon name="external" size={13} />
            </a>
            <a href={event.links.attendanceAgreement} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
              Attendance agreement <Icon name="external" size={13} />
            </a>
            <a href={event.links.accommodations} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-blue-dark">
              Accommodations <Icon name="external" size={13} />
            </a>
          </div>
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
