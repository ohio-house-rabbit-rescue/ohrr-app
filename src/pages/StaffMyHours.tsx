// Staff → My volunteer hours (update 28). OHRR: "a person that is a volunteer
// but not covering a shift of some type can still log in hours." Staff
// volunteer too, so this opens their own volunteer page — the same one any
// volunteer uses to log time that isn't a shift — made for them the first time.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { errMessage } from '../lib/supabase'
import { isMissingFunction, myStaffVolunteerToken } from '../lib/staffLevels'
import { Card, Screen } from '../components/ui'
import { Spinner } from '../components/staffui'

export default function StaffMyHours() {
  const { user, membership } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const userId = user?.id
  const orgId = membership?.orgId

  useEffect(() => {
    if (!userId || !orgId) return
    let alive = true
    myStaffVolunteerToken(userId, orgId)
      .then((token) => {
        if (alive) navigate(`/volunteer/hours/${token}`, { replace: true })
      })
      .catch((e) => {
        if (!alive) return
        setError(
          isMissingFunction(e)
            ? 'This needs database update 28 (staff levels and volunteer hours), which isn’t in yet.'
            : errMessage(e),
        )
      })
    return () => {
      alive = false
    }
  }, [userId, orgId, navigate])

  if (!error) return <Spinner label="Opening your volunteer page…" />
  return (
    <Screen className="space-y-3 pt-2">
      <h1 className="font-display text-2xl font-black text-ink">My volunteer hours</h1>
      <Card className="space-y-3">
        <p className="text-sm leading-relaxed text-slate-600">Your volunteer page couldn’t be opened. {error}</p>
        <Link to="/staff" className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600">
          Back to the dashboard
        </Link>
      </Card>
    </Screen>
  )
}
