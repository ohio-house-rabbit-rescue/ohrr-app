// "My hours" on the Volunteer page — shown once this phone has opened a
// volunteer's private hours link, so they never have to hunt for it again.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { hoursLabel, myRecord, savedToken, type MyRecord } from './api'
import { useFeatureFlag } from '../settings/useSetting'
import { VOLUNTEER_HOURS_FLAG } from '../settings/features'

export default function MyHoursCard() {
  const hoursOn = useFeatureFlag(VOLUNTEER_HOURS_FLAG, true)
  const [rec, setRec] = useState<MyRecord | null>(null)
  useEffect(() => {
    const token = savedToken()
    if (!token) return
    let alive = true
    myRecord(token)
      .then((r) => alive && setRec(r))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  if (!rec || !hoursOn.value) return null
  const pending = rec.entries.filter((e) => e.status === 'logged').length

  return (
    <Link to="/volunteer/hours" className="block">
      <Card className="border-brand-blue/20 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
            <Icon name="clock" size={26} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-extrabold text-ink">My volunteer hours</span>
            <span className="block text-sm text-slate-600">
              {hoursLabel(rec.totals.all)} in all · {hoursLabel(rec.totals.this_year)} this year
            </span>
            {pending > 0 && (
              <span className="block text-xs font-bold text-brand-orange-dark">{pending} waiting for OHRR to confirm</span>
            )}
          </span>
          <Icon name="chevron" size={20} className="shrink-0 text-slate-300" />
        </div>
      </Card>
    </Link>
  )
}
