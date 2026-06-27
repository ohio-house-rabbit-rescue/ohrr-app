import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './icons'
import ScrollToTop from './ScrollToTop'

function roleLabel(role: string | undefined) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  return ''
}

export default function StaffLayout() {
  const { user, membership, can, signOut } = useAuth()
  const navigate = useNavigate()

  const onSignOut = async () => {
    await signOut()
    navigate('/staff/signin', { replace: true })
  }

  // Nav appears only once onboarded. Hop Shop is the first gated feature; Team is
  // for those who can invite/manage staff (owners/admins always can).
  const showHopShop = Boolean(membership)
  const showAnnouncements = can('announcements.post')
  const showVolunteer = can('volunteers.shifts.manage')
  const showLearn = can('content.education.edit')
  const showTeam = can('staff.invite') || can('staff.permissions.manage')
  const showActivity = can('audit.view')

  const navClass = ({ isActive }: { isActive: boolean }) =>
    [
      'rounded-full px-3.5 py-1.5 text-sm font-bold transition',
      isActive ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100',
    ].join(' ')

  return (
    <div className="min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />

        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/staff" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-blue text-white">
                <Icon name="settings" size={17} />
              </span>
              <span className="leading-tight">
                <span className="block font-display text-sm font-extrabold text-ink">OHRR Staff</span>
                {membership && (
                  <span className="block text-[11px] font-semibold text-slate-400">
                    {roleLabel(membership.role)}
                  </span>
                )}
              </span>
            </Link>

            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
              >
                Exit to app
              </Link>
            )}
          </div>

          {membership && (
            <nav className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-2">
              <NavLink to="/staff" end className={navClass}>
                Dashboard
              </NavLink>
              {showHopShop && (
                <NavLink to="/staff/hopshop" className={navClass}>
                  Hop Shop
                </NavLink>
              )}
              {showAnnouncements && (
                <NavLink to="/staff/announcements" className={navClass}>
                  News
                </NavLink>
              )}
              {showVolunteer && (
                <NavLink to="/staff/volunteer" className={navClass}>
                  Volunteers
                </NavLink>
              )}
              {showLearn && (
                <NavLink to="/staff/learn" className={navClass}>
                  Care
                </NavLink>
              )}
              {showTeam && (
                <NavLink to="/staff/team" className={navClass}>
                  Team
                </NavLink>
              )}
              {showActivity && (
                <NavLink to="/staff/activity" className={navClass}>
                  Activity
                </NavLink>
              )}
            </nav>
          )}
        </header>

        <main className="flex-1 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
