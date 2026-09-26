// /staff/signin — staff sign in with the same account as everyone else (update
// 31), so this only forwards to My OHRR's sign-in with a `next` that comes back
// to the staff area (or wherever they were heading: a scanned tag, the Counter,
// an invite link's /staff/join?code=…). A notice (e.g. "Your account has been
// deleted.") travels with it.
import { Navigate, useLocation } from 'react-router-dom'

export default function StaffSignIn() {
  const location = useLocation()
  const state = location.state as { from?: string; notice?: string } | null
  const from = state?.from
  const dest = from && from.startsWith('/staff') ? from : '/staff'
  return (
    <Navigate
      to={`/account?next=${encodeURIComponent(dest)}`}
      replace
      state={state?.notice ? { notice: state.notice } : null}
    />
  )
}
