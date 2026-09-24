// "Three sponsorships end this month" — on the staff dashboard.
//
// A sponsorship quietly disappears from the app on its end date, which is right
// but leaves nobody to ask for a renewal. This says it early enough to do
// something: the window is each sponsor's own `remind_days`.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'

interface Row {
  id: string
  name: string
  tier: string
  term_end: string
  days_left: number
  is_active: boolean
}

export default function ExpiringNotice({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    if (!orgId) return
    let alive = true
    supabase
      .rpc('sponsors_expiring', { p_org: orgId })
      .then(({ data, error }) => {
        if (!alive || error) return
        setRows(Array.isArray(data) ? (data as unknown as Row[]) : [])
      })
    return () => {
      alive = false
    }
  }, [orgId])

  if (rows.length === 0) return null
  const ended = rows.filter((r) => r.days_left < 0)

  return (
    <Card className="border-brand-orange/40 bg-brand-orange-50/50">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange-dark">
          <Icon name="award" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-extrabold text-ink">
            {ended.length === rows.length
              ? `${rows.length} sponsorship${rows.length === 1 ? ' has' : 's have'} ended`
              : `${rows.length} sponsorship${rows.length === 1 ? '' : 's'} need${rows.length === 1 ? 's' : ''} a renewal`}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
            {rows.slice(0, 4).map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong> ·{' '}
                {r.days_left < 0
                  ? `ended ${Math.abs(r.days_left)} day${Math.abs(r.days_left) === 1 ? '' : 's'} ago`
                  : r.days_left === 0
                    ? 'ends today'
                    : `ends in ${r.days_left} day${r.days_left === 1 ? '' : 's'}`}
              </li>
            ))}
          </ul>
          {rows.length > 4 && <p className="mt-0.5 text-xs text-slate-500">+{rows.length - 4} more</p>}
          <div className="mt-1 flex flex-wrap gap-x-4">
            <Link
              to="/staff/sponsors/renewals"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue"
            >
              Open the renewals list <Icon name="chevron" size={15} />
            </Link>
            <Link
              to="/staff/sponsors"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-slate-500"
            >
              Open Sponsors
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}
