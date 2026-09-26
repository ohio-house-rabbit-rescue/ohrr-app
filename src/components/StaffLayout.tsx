import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './icons'
import ScrollToTop from './ScrollToTop'
import BackButton from './BackButton'
import { buildLabel } from '../data/version'
import { levelInfo, useMyLevel } from '../lib/staffLevels'

function roleLabel(role: string | undefined) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  return ''
}

export default function StaffLayout() {
  const { user, membership, can, capabilities, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Update 28: show the level (Volunteer 1 … Developer from update 30) once it's in.
  const myLevel = useMyLevel(user?.id, membership?.orgId)

  const onSignOut = async () => {
    await signOut()
    navigate('/staff/signin', { replace: true })
  }

  // The section menu. Adding a section later = one line here; the dropdown never
  // overflows or needs a scrolling tab strip, however many sections there are.
  // A counter volunteer (the till and the door, nothing else) sees only that.
  const counterOnly = can('counter.use') && membership?.role !== 'owner' && membership?.role !== 'admin' && capabilities.size === 1
  const canCounter = can('counter.use') || can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.inventory.update')
  const navItems = [
    { to: '/staff', label: 'Dashboard', end: true, show: !counterOnly },
    // Everyone's own name, photo, email and password — near the top, easy to find.
    { to: '/staff/account', label: 'My account', show: Boolean(membership) },
    { to: '/staff/counter', label: 'Counter — sell, add items, door tickets', show: canCounter },
    { to: '/staff/my-hours', label: 'My volunteer hours', show: myLevel.ready },
    { to: '/staff/inbox', label: 'Inbox', show: can('inbox.manage') },
    // Update 31: who asked for emails, and about what.
    { to: '/staff/supporters', label: 'Supporters — the email list', show: can('supporters.view') },
    { to: '/staff/share', label: 'Share kit', show: can('announcements.post') },
    { to: '/staff/posts', label: 'Post queue', show: can('announcements.post') || can('social.publish') || can('social.approve') },
    { to: '/staff/flyers', label: 'Flyers', show: can('announcements.post') },
    { to: '/staff/outreach', label: 'Outreach letters', show: can('announcements.post') },
    { to: '/staff/impact', label: 'Impact numbers', show: can('announcements.post') },
    { to: '/staff/guardians', label: 'Rescue Rabbit Guardians', show: can('giving.guardians') },
    { to: '/staff/bookings', label: 'Bookings', show: can('bookings.manage') },
    {
      to: '/staff/scan',
      label: 'Scan an item',
      show: can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.products.edit') || can('hopshop.inventory.update'),
    },
    {
      to: '/staff/items',
      label: 'Scanned items',
      show: can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.products.edit') || can('hopshop.inventory.update'),
    },
    {
      to: '/staff/adopt',
      label: 'Adoptable rabbits',
      show:
        can('adoptions.listings.create') ||
        can('adoptions.listings.edit') ||
        can('adoptions.status.change'),
    },
    { to: '/staff/hopshop', label: 'Hop Shop', show: Boolean(membership) && !counterOnly },
    { to: '/staff/announcements', label: 'Announcements', show: can('announcements.post') },
    { to: '/staff/home-screen', label: 'Home screen cards', show: can('announcements.post') },
    { to: '/staff/calls', label: 'Volunteer calls — needs, sign-ups, thanks', show: can('volunteers.shifts.manage') || can('bookings.manage') },
    { to: '/staff/volunteers', label: 'Volunteers — roster & hours', show: can('volunteers.shifts.manage') || can('bookings.manage') },
    { to: '/staff/volunteer', label: 'Volunteer opportunities', show: can('volunteers.shifts.manage') },
    { to: '/staff/learn', label: 'Care guides & pages', show: can('content.education.edit') },
    { to: '/staff/vets', label: 'Vet directory', show: can('content.education.edit') },
    { to: '/staff/events', label: 'Events', show: can('events.bunfest.manage') },
    { to: '/staff/bunfest', label: 'BunFest — schedule, vendors, rescues', show: can('events.bunfest.manage') },
    { to: '/staff/tails', label: 'Happy Tails', show: can('content.education.edit') || can('inbox.manage') },
    { to: '/staff/raffle', label: 'Silent Auction', show: can('events.bunfest.manage') },
    { to: '/staff/raffle-tickets', label: 'Raffle tickets', show: can('events.bunfest.manage') || can('counter.use') },
    { to: '/staff/sponsors', label: 'Sponsors & partners', end: true, show: can('events.bunfest.manage') },
    { to: '/staff/sponsors/renewals', label: 'Sponsor renewals — who to ask next', show: can('events.bunfest.manage') },
    { to: '/staff/bunny-help', label: 'Bunny Help topics', show: can('content.education.edit') },
    {
      to: '/staff/team',
      label: 'Team',
      show: can('staff.invite') || can('staff.permissions.manage'),
    },
    { to: '/staff/activity', label: 'Activity', show: can('audit.view') },
    { to: '/staff/features', label: 'Features — turn things on & off', show: can('settings.manage') },
    { to: '/staff/details', label: 'OHRR details — hours, phone, address', show: can('settings.manage') },
  ].filter((i) => i.show)

  // Which section are we in (for the menu button label)? The longest match
  // wins, so /staff/sponsors/renewals isn't labelled as /staff/sponsors.
  const current =
    navItems
      .filter((i) => i.to !== '/staff' && pathname.startsWith(i.to))
      .sort((a, b) => b.to.length - a.to.length)[0] ?? navItems.find((i) => i.to !== '/staff/account') ?? navItems[0]

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
                <span className="min-w-0 leading-tight">
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

        {/* Which update this is — so a volunteer can report "rev 5" and mean it. */}
        <p className="px-4 pb-4 text-center text-[11px] text-slate-400">
          OHRR staff tools · {buildLabel}
        </p>
      </div>
    </div>
  )
}
