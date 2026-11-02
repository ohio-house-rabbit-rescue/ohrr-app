// Staff → Adoptions: the one place for everything about a rabbit going home (OHRR, 2026-11-02: "bookings should be
// predominantly the adoption options — we may want to combine them"). Big cards, one decision: the visits people
// book, the rabbits, the applications. Volunteer shifts and the vet clinic live under Volunteers.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Screen } from '../components/ui'
import { Spinner } from '../components/staffui'
import { ChoiceCard } from '../components/StaffJob'
import { StaffTitle } from '../components/StaffTitle'
import { roster as loadRoster } from '../features/bookings/api'

const ADOPTION_SLUGS = ['adoption-visit', 'bonding-session']

export default function StaffAdoptions() {
  const { loading, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [waiting, setWaiting] = useState(0)

  // How many adoption visits are waiting for a yes (the next 60 days).
  useEffect(() => {
    if (!orgId) return
    let alive = true
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    loadRoster(orgId, from, new Date(from.getTime() + 60 * 86_400_000))
      .then((rows) => alive && setWaiting(rows.filter((r) => r.status === 'requested' && ADOPTION_SLUGS.includes(r.type_slug)).length))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [orgId])

  if (loading) return <Spinner />
  if (!membership) return <Navigate to="/staff" replace />

  const canBookings = can('bookings.manage')
  const canAdopt = can('adoptions.listings.create') || can('adoptions.listings.edit') || can('adoptions.status.change')
  const canInbox = can('inbox.manage')

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Adoptions">
        <p>Everything about a rabbit going home: the visits people book, the rabbits, and the applications.</p>
      </StaffTitle>
      <h2 className="font-display text-xl font-extrabold text-ink">What would you like to open?</h2>
      <ul className="space-y-3">
        {canBookings && (
          <li>
            <ChoiceCard
              to="/staff/bookings?scope=adopt"
              icon="calendar"
              title="Adoption visits"
              text="Adoption appointments and bonding sessions."
              tone={waiting > 0 ? 'orange' : 'white'}
              badge={waiting > 0 ? `${waiting} to confirm` : undefined}
            />
          </li>
        )}
        {canAdopt && (
          <li>
            <ChoiceCard to="/staff/adopt" icon="heart" title="Adoptable rabbits" text="Rabbits, photos and adoption status." />
          </li>
        )}
        {canInbox && (
          <li>
            <ChoiceCard to="/staff/inbox" icon="mail" title="Applications" text="Adoption applications arrive in the Inbox." />
          </li>
        )}
      </ul>
    </Screen>
  )
}
