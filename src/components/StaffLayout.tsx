import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './icons'
import ScrollToTop from './ScrollToTop'
import BackButton from './BackButton'
import { buildLabel } from '../data/version'
import { levelInfo, useMyLevel } from '../lib/staffLevels'
import { placeOf, useStaffTiles, type GroupKey } from '../features/staff/staffTiles'

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
  const [menuOpen, setMenuOpen] = useState(false)
  // Update 28: show the level (Volunteer 1 … Developer from update 30) once it's in.
  const myLevel = useMyLevel(user?.id, membership?.orgId)

  const onSignOut = async () => {
    await signOut()
    navigate('/staff/signin', { replace: true })
  }

  // The section menu, short (OHRR, 2026-10-01): Dashboard, the Today row, then
  // one line per group. The pages themselves live in features/staff/staffTiles.ts.
  const { tiles, today, groups, counterOnly } = useStaffTiles()
  const place = placeOf(pathname, tiles)
  const navItems: { to: string; label: string; end?: boolean; group?: GroupKey }[] = [
    ...(counterOnly ? [] : [{ to: '/staff', label: 'Dashboard', end: true }]),
    ...today.map((t) => ({ to: t.to, label: t.title })),
    ...groups.map((g) => ({ to: g.tiles.length === 1 ? g.tiles[0].to : `/staff/g/${g.key}`, label: g.title, group: g.key })),
  ]
  // The menu button says where you are: "Items and Hop Shop › Drop-offs and thank-yous".
  const currentLabel =
    pathname === '/staff'
      ? 'Dashboard'
      : place.tile
        ? place.group
          ? `${place.group.title} › ${place.tile.title}`
          : place.tile.title
        : (place.group?.title ?? 'Menu')

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
              <Link to="/staff" className="flex min-w-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
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
                onClick={() => setMenuOpen(false)}
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

          {/* Section menu — one compact line; opens a dropdown of all sections */}
          {membership && (
            <div className="relative border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-bold text-ink transition hover:bg-slate-50"
                aria-expanded={menuOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon name="home" size={15} className="shrink-0 text-brand-blue" />
                  <span className="truncate">{currentLabel}</span>
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
                            'block min-h-[44px] px-4 py-3 text-[15px] font-semibold transition',
                            isActive || (i.group && place.group?.key === i.group)
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

        {/* Which update this is — so a volunteer can report "rev 5" and mean it. */}
        <p className="px-4 pb-4 text-center text-[11px] text-slate-400">
          OHRR staff tools · {buildLabel}
        </p>
      </div>
    </div>
  )
}
