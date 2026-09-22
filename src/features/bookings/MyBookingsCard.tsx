// "You're booked" — the bookings this device made, on Home, Volunteer and
// Services. Without it the only record of a shift was the confirmation screen
// (OHRR sends no confirmation email), so people lost the time, the place and
// their private cancel link the moment they closed the app.
import { Link } from 'react-router-dom'
import { Card, SectionLabel } from '../../components/ui'
import { Icon } from '../../components/icons'
import { fmtDayShort, fmtRange, statusLabel } from './types'
import { useMyBookingsLive, type MyBooking } from './mine'

function Row({ b }: { b: MyBooking }) {
  const soon = new Date(b.startsAt).getTime() - Date.now() < 48 * 60 * 60 * 1000
  const pending = b.status === 'requested'
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          pending ? 'bg-brand-orange-50 text-brand-orange-dark' : 'bg-brand-blue-50 text-brand-blue'
        }`}
      >
        <Icon name={b.kind === 'shift' ? 'users' : 'calendar'} size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-ink">{b.typeName}</span>
        <span className="block text-sm text-slate-600">
          {fmtDayShort(b.startsAt)} · {fmtRange(b.startsAt, b.endsAt)}
        </span>
        {b.location && <span className="block truncate text-xs text-slate-500">{b.location}</span>}
        <span className={`mt-0.5 block text-xs font-bold ${pending ? 'text-brand-orange-dark' : 'text-green-700'}`}>
          {pending ? 'Waiting for OHRR to confirm' : soon ? `${statusLabel(b.status)} · coming up` : statusLabel(b.status)}
        </span>
      </span>
      <Link
        to={`/book/cancel/${b.token}`}
        className="shrink-0 self-center rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
      >
        Details
      </Link>
    </li>
  )
}

/**
 * `compact` (Home) shows the next two; the full version lists everything this
 * device booked. Renders nothing when there are none.
 */
export default function MyBookingsCard({ compact = false }: { compact?: boolean }) {
  const { bookings } = useMyBookingsLive()
  if (bookings.length === 0) return null
  const shown = compact ? bookings.slice(0, 2) : bookings

  return (
    <div className="space-y-2.5">
      {!compact && <SectionLabel>Your bookings</SectionLabel>}
      <Card className="border-brand-blue/20">
        {compact && (
          <p className="font-display text-[15px] font-extrabold text-ink">
            {bookings.length === 1 ? 'Your booking' : 'Your bookings'}
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {shown.map((b) => (
            <Row key={b.token} b={b} />
          ))}
        </ul>
        {compact && bookings.length > shown.length && (
          <p className="pt-1 text-xs text-slate-500">+{bookings.length - shown.length} more on the Volunteer page.</p>
        )}
        <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">
          Kept on this phone so you always have the time and your cancel link.
        </p>
      </Card>
    </div>
  )
}
