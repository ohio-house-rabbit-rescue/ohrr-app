// The frame every Counter screen sits in. It lets a counter or door phone keep
// working with no signal: normally the signed-in membership says which org the
// phone works for, but when the phone can't reach the database (and so can't
// confirm the sign-in) it carries on with the org it last worked for, and
// everything it records waits on the phone until the signal is back.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../../lib/auth'
import { Spinner } from '../../components/staffui'
import { Icon } from '../../components/icons'
import { getDevice, setDevice, clock } from './local'

export function useCounterOrg(): { orgId: string | null; offline: boolean } {
  const { membership } = useAuth()
  const dev = getDevice()
  useEffect(() => {
    if (membership?.orgId && membership.orgId !== dev.orgId) setDevice({ orgId: membership.orgId })
  }, [membership?.orgId, dev.orgId])
  return { orgId: membership?.orgId ?? dev.orgId, offline: !membership }
}

/** Route element: signed-in staff, or a phone that has worked the counter before. */
export function CounterGate() {
  const { configured, loading, user, membership } = useAuth()
  const location = useLocation()
  const dev = getDevice()
  if (!configured) return null
  if (loading) return <Spinner />
  if (membership || (dev.orgId && (!user || !navigator.onLine))) return <Outlet />
  if (!user) return <Navigate to="/staff/signin" replace state={{ from: location.pathname }} />
  return <Navigate to="/staff/start" replace />
}

/** "All sent" / "3 waiting — no signal" — always in sight on counter screens. */
export function SyncPill({ waiting, online, lastSync, error }: { waiting: number; online: boolean; lastSync?: string | null; error?: string | null }) {
  const notSignedIn = error && /not authenticated|jwt|session/i.test(error)
  if (error && !notSignedIn) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700" title={error}>
        <span className="h-2 w-2 rounded-full bg-red-500" /> {waiting ? `${waiting} not sent — ` : ''}
        {error.length > 40 ? 'couldn’t send' : error}
      </span>
    )
  }
  if (!online || notSignedIn) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {notSignedIn ? 'Sign in again to send' : 'No signal'}
        {waiting ? ` · ${waiting} waiting` : ' · still works'}
      </span>
    )
  }
  if (waiting) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue-50 px-3 py-1 text-xs font-bold text-brand-blue">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" /> Sending {waiting}…
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">
      <Icon name="check" size={13} /> All sent{lastSync ? ` · ${clock(lastSync)}` : ''}
    </span>
  )
}
