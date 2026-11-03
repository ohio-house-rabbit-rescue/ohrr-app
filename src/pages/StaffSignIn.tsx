// /staff/signin — staff sign in with the same account as everyone else (update
// 31), so this only forwards to My OHRR's sign-in with a `next` that comes back
// to the staff area (or wherever they were heading: a scanned tag, the Counter,
// an invite link's /staff/join?code=…). A notice (e.g. "Your account has been
// deleted.") travels with it.
import { Link, Navigate, useLocation } from 'react-router-dom'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'

export default function StaffSignIn() {
  const location = useLocation()
  const state = location.state as { from?: string; notice?: string } | null
  const from = state?.from
  const dest = from && from.startsWith('/staff') ? from : '/staff'
  // Someone opened /staff itself (a typed address, a bookmark): tell them what this is first.
  // Staff heading somewhere particular (a scanned tag, the Counter) go straight on to sign in.
  if (dest === '/staff' && !state?.notice) {
    return (
      <Screen className="space-y-4 pt-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
          <Icon name="users" size={22} />
        </span>
        <h1 className="font-display text-2xl font-black text-ink">This area is for OHRR staff and volunteers</h1>
        <Card className="space-y-3">
          <p className="text-base leading-relaxed text-slate-700">
            If you work or volunteer with OHRR and were given an account, please sign in.
          </p>
          <Link to={`/account?next=${encodeURIComponent('/staff')}`} className={`${btn.primary} w-full`}>
            Sign in
          </Link>
        </Card>
        <p className="text-base leading-relaxed text-slate-700">
          If you don’t have an account, there’s nothing for you here. Thank you for stopping by, and for caring about rabbits.
        </p>
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={16} /> Back to the app
        </Link>
      </Screen>
    )
  }
  return (
    <Navigate
      to={`/account?next=${encodeURIComponent(dest)}`}
      replace
      state={state?.notice ? { notice: state.notice } : null}
    />
  )
}
