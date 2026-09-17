import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const onSignOut = async () => {
    await signOut()
    navigate('/staff/signin', { replace: true })
  }

  // The section menu. Adding a section later = one line here; the dropdown never
  // overflows or needs a scrolling tab strip, however many sections there are.
  const navItems = [
    { to: '/staff', label: 'Dashboard', end: true, show: true },
    {
      to: '/staff/adopt',
      label: 'Adoptable rabbits',
      show:
        can('adoptions.listings.create') ||
        can('adoptions.listings.edit') ||
        can('adoptions.status.change'),
    },
    { to: '/staff/hopshop', label: 'Hop Shop', show: Boolean(membership) },
    { to: '/staff/announcements', label: 'Announcements', show: can('announcements.post') },
    { to: '/staff/volunteer', label: 'Volunteer opportunities', show: can('volunteers.shifts.manage') },
    { to: '/staff/learn', label: 'Care guides', show: can('content.education.edit') },
    { to: '/staff/vets', label: 'Vet directory', show: can('content.education.edit') },
    { to: '/staff/events', label: 'Events', show: can('events.bunfest.manage') },
    { to: '/staff/raffle', label: 'Silent Auction', show: can('events.bunfest.manage') },
    { to: '/staff/sponsors', label: 'Sponsors & partners', show: can('events.bunfest.manage') },
    {
      to: '/staff/team',
      label: 'Team',
      show: can('staff.invite') || can('staff.permissions.manage'),
    },
    { to: '/staff/activity', label: 'Activity', show: can('audit.view') },
    { to: '/staff/settings', label: 'Settings', show: can('settings.manage') },
  ].filter((i) => i.show)

  // Which section are we in (for the menu button label)?
  const current =
    navItems.find((i) => i.to !== '/staff' && pathname.startsWith(i.to)) ?? navItems[0]

  return (
    <div className="min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />

        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/staff" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
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

            <div className="flex items-center gap-2">
              {/* Always-available way back to the public app (kept signed in). */}
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
              >
                <Icon name="arrowLeft" size={13} /> App
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

          {/* Section menu — one compact line; opens a dropdown of all sections */}
          {membership && (
            <div className="relative border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-bold text-ink transition hover:bg-slate-50"
                aria-expanded={menuOpen}
              >
                <span className="flex items-center gap-2">
                  <Icon name="home" size={15} className="text-brand-blue" />
                  {current?.label ?? 'Menu'}
                </span>
                <Icon
                  name="chevron"
                  size={16}
                  className={`text-slate-400 transition-transform ${
                    menuOpen ? '-rotate-90' : 'rotate-90'
                  }`}
                />
              </button>

              {menuOpen && (
                <>
                  {/* backdrop to close on outside tap */}
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-30 cursor-default"
                  />
                  <nav className="absolute left-0 right-0 top-full z-40 max-h-[70vh] overflow-y-auto border-b border-slate-200 bg-white py-1 shadow-lg">
                    {navItems.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={i.end}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          [
                            'block px-4 py-2.5 text-sm font-semibold transition',
                            isActive
                              ? 'bg-brand-blue-50 text-brand-blue'
                              : 'text-slate-600 hover:bg-slate-50',
                          ].join(' ')
                        }
                      >
                        {i.label}
                      </NavLink>
                    ))}
                  </nav>
                </>
              )}
            </div>
          )}
        </header>

        <main className="flex-1 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
