import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './icons'
import ScrollToTop from './ScrollToTop'
import BackButton from './BackButton'
import { buildLabel } from '../data/version'
import { levelInfo, useMyLevel } from '../lib/staffLevels'
import { placeOf, useStaffTiles } from '../features/staff/staffTiles'

function roleLabel(role: string | undefined) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  return ''
}

export default function StaffLayout() {
  const { user, membership, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Update 28: show the level (Volunteer 1 … Developer from update 30) once it's in.
  const myLevel = useMyLevel(user?.id, membership?.orgId)

  const onSignOut = async () => {
    await signOut()
    navigate('/staff/signin', { replace: true })
  }

  // Where you are, as a path back (OHRR, 2026-10-01: the home button should
  // take you home, not open a list): Staff › Items and Hop Shop › Drop-offs.
  // The grouped dashboard is the menu. Pages live in features/staff/staffTiles.ts.
  const { tiles } = useStaffTiles()
  const place = placeOf(pathname, tiles)

  return (
    <div className="min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />

        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {pathname !== '/staff' ? (
                <BackButton
                  always
                  fallback="/staff"
                  label="Back"
                  className="border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50"
                />
              ) : null}
              <Link to="/staff" className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white">
                  <Icon name="settings" size={20} />
                </span>
                {/* Beside the Back button there's only room for the badge; the name shows on the dashboard. */}
                <span className={`min-w-0 leading-tight ${pathname !== '/staff' ? 'hidden' : ''}`}>
                  <span className="block truncate font-display text-sm font-extrabold text-ink">OHRR Staff</span>
                  {membership && (
                    <span className="block text-[11px] font-semibold text-slate-400">
                      {myLevel.level ? levelInfo(myLevel.level).label : roleLabel(membership.role)}
                    </span>
                  )}
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {/* Always-available way back to the public app (kept signed in). */}
              <Link
                to="/"
               
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-brand-blue/50 px-3 text-sm font-bold text-brand-blue transition hover:bg-brand-blue-50"
              >
                <Icon name="home" size={16} /> App
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>

          {/* The way back home: Staff, then this page's group (not on the dashboard itself).
              The page's own title is just below, so it isn't repeated here. */}
          {membership && pathname !== '/staff' && (
            <nav aria-label="Where you are" className="flex min-w-0 items-center gap-0.5 border-t border-slate-100 px-2 text-[15px] font-bold">
              <Link to="/staff" className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-2 text-brand-blue transition hover:bg-slate-50">
                <Icon name="home" size={17} /> Staff
              </Link>
              {place.group && (
                <>
                  <span aria-hidden="true" className="shrink-0 text-slate-300">
                    ›
                  </span>
                  {place.tile ? (
                    <Link
                      to={`/staff/g/${place.group.key}`}
                      className="inline-flex min-h-[44px] min-w-0 items-center rounded-lg px-2 text-brand-blue transition hover:bg-slate-50"
                    >
                      <span className="truncate">{place.group.title}</span>
                    </Link>
                  ) : (
                    <span aria-current="page" className="min-w-0 truncate px-2 text-ink">
                      {place.group.title}
                    </span>
                  )}
                </>
              )}
            </nav>
          )}
        </header>

        <main className="flex-1 pb-16">
          <Outlet />
        </main>

        {/* Which update this is — so a volunteer can report "rev 5" and mean it. */}
        <p className="px-4 pb-4 text-center text-[11px] text-slate-400">
          OHRR staff tools · {buildLabel}
        </p>
      </div>
    </div>
  )
}
