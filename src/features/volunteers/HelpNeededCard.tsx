// Home: "Volunteers needed". Shown only while a volunteer call is open with places left, so it
// is always true. It goes straight to the soonest call; more calls and the general ways to help
// are one tap further on the Volunteer page. Reads the same list as Volunteer → "Help needed now".
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listOpenCalls, type OpenCall } from './callsApi'
import { fmtClock, fmtDay } from './calls'

export default function HelpNeededCard() {
  const [calls, setCalls] = useState<OpenCall[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let live = true
    listOpenCalls()
      .then((c) => live && setCalls(c.filter((x) => x.places - x.taken > 0)))
      .catch(() => live && setCalls([]))
    return () => {
      live = false
    }
  }, [])

  const first = calls[0]
  if (!first) return null
  const left = first.places - first.taken
  const more = calls.length - 1

  return (
    <div className="space-y-2 rounded-2xl border border-brand-orange/40 bg-brand-orange-50 p-4">
      <p className="text-[13px] font-extrabold uppercase tracking-wide text-brand-orange-dark">Volunteers needed</p>
      <Link to={`/volunteer/call/${first.slug}`} className="block min-h-[44px]">
        <p className="font-display text-lg font-extrabold leading-snug text-ink">{first.title}</p>
        <p className="mt-0.5 text-[15px] text-slate-700">
          {fmtDay(first.on_date)} · {fmtClock(first.starts_at)}–{fmtClock(first.ends_at)}
        </p>
        <p className="mt-1 text-[15px] font-bold text-brand-orange-dark">
          {left} {left === 1 ? 'place' : 'places'} left — sign up
        </p>
      </Link>
      <Link to="/volunteer" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-blue">
        {more > 0 ? `${more} more ${more === 1 ? 'way' : 'ways'} to help` : 'All the ways to volunteer'}
        <Icon name="chevron" size={16} />
      </Link>
    </div>
  )
}
