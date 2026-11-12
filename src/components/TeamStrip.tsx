// The row under the top bar on the public side. It is for the team only: a visitor never sees it, with one
// exception, the way back to the visitors' tour ("Back to Look around"), which is for everyone.
//
//   a guide step opened this page        "Back to Level 1: Look around" (GuideReturnBar)
//   on the team                          this is the public side, and the way to Staff
//   an invitation is waiting here        the one tap that finishes joining (and, once, it goes there by itself:
//                                        the email-confirm link can land on the home screen instead of the join page)
//   signed out, on a team member's phone the way to sign in to the Staff side
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPendingInvite } from '../lib/pendingInvite'
import { isTeamDevice } from '../lib/teamDevice'
import { readReturn } from '../features/guide/guideReturn'
import GuideReturnBar from '../features/guide/GuideReturnBar'
import { TOUR_PATH } from '../features/guide/walkthrough'
import { Icon } from './icons'

// Kept for this tab only: the invitation was already forwarded to the join page once, so a problem there
// (a different email, say) never turns into a loop.
const FORWARDED = 'ohrr.invite.forwarded'

const row = 'flex min-h-[44px] items-center justify-between gap-3 px-4 text-sm font-bold'
const go = 'inline-flex shrink-0 items-center gap-1'

export default function TeamStrip() {
  const { configured, loading, user, membership, accessOnHold, accessEndedOn } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onAccount = pathname.startsWith('/account')
  const inviteWaiting = configured && !loading && Boolean(user) && !membership && !accessOnHold && !accessEndedOn && Boolean(getPendingInvite())

  useEffect(() => {
    if (!inviteWaiting || onAccount) return
    try {
      if (sessionStorage.getItem(FORWARDED)) return
      sessionStorage.setItem(FORWARDED, '1')
    } catch {
      return
    }
    navigate('/staff/join', { replace: true })
  }, [inviteWaiting, onAccount, navigate])

  // The visitors' tour is for everyone, signed in or not: its way back shows whoever is looking.
  if (readReturn()?.to === TOUR_PATH) return <GuideReturnBar />

  if (!configured || loading) return null

  if (!user) {
    if (onAccount || !isTeamDevice()) return null
    return (
      <Link to={`/account?next=${encodeURIComponent('/staff')}`} className={`${row} bg-brand-blue-dark text-white`}>
        <span className="min-w-0 truncate text-white/85">On the OHRR team?</span>
        <span className={go}>
          Sign in to Staff <Icon name="chevron" size={15} />
        </span>
      </Link>
    )
  }

  if (membership) {
    if (readReturn() && !pathname.startsWith('/welcome')) return <GuideReturnBar />
    return (
      <Link to="/staff" className={`${row} bg-brand-blue-dark text-white`}>
        <span className="min-w-0 truncate text-white/85">Public side: what everyone sees</span>
        <span className={go}>
          Staff <Icon name="chevron" size={15} />
        </span>
      </Link>
    )
  }

  if (inviteWaiting && !onAccount) {
    return (
      <Link to="/staff/join" className={`${row} border-t border-brand-orange/30 bg-brand-orange-50 text-ink`}>
        <span className="min-w-0 truncate">Your invitation is waiting</span>
        <span className={`${go} underline underline-offset-2`}>
          Finish joining <Icon name="chevron" size={15} />
        </span>
      </Link>
    )
  }
  return null
}
