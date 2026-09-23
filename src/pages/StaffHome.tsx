import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ActionCard, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, NotConfigured } from '../components/staffui'
import { PERMISSION_CATALOG } from '../lib/capabilities'
import { DeleteAccount } from '../components/DeleteAccount'
import ExpiringNotice from '../features/sponsors/ExpiringNotice'

const roleBadge: Record<string, { label: string; tone: 'blue' | 'orange' | 'slate' }> = {
  owner: { label: 'Owner', tone: 'blue' },
  admin: { label: 'Admin', tone: 'blue' },
  staff: { label: 'Staff', tone: 'slate' },
}

export default function StaffHome() {
  const { configured, loading, user, membership, can, capabilities } = useAuth()
  // Hooks before any early return: the Inbox badge count (0 when not allowed).
  const newCount = useNewRequestCount(membership && can('inbox.manage') ? membership.orgId : null)
  const pendingCount = usePendingBookingCount(membership && can('bookings.manage') ? membership.orgId : null)
  const readyPosts = useReadyPostCount(membership && (can('announcements.post') || can('social.publish')) ? membership.orgId : null)

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/staff/signin" replace />
  if (!membership) return <Navigate to="/staff/start" replace />

  const isAdminish = membership.role === 'owner' || membership.role === 'admin'
  const canInbox = can('inbox.manage')
  const canBookings = can('bookings.manage')
  const canQueue = can('announcements.post') || can('social.publish')
  const badge = roleBadge[membership.role] ?? roleBadge.staff

  // What this person can do in the Hop Shop (drives the dashboard subtitle).
  const hopshopCaps = PERMISSION_CATALOG.filter(
    (p) => p.area === 'Hop Shop' && can(p.key),
  )
  const canSeeHopShop = isAdminish || hopshopCaps.length > 0
  const canManageAdopt =
    can('adoptions.listings.create') ||
    can('adoptions.listings.edit') ||
    can('adoptions.status.change')
  const canPostAnnouncements = can('announcements.post')
  const canManageVolunteer = can('volunteers.shifts.manage')
  const canEditCare = can('content.education.edit')
  const canManageEvents = can('events.bunfest.manage')
  const canManageAuction = can('events.bunfest.manage')
  const canManageSponsors = can('events.bunfest.manage')
  const canManageTeam = can('staff.invite') || can('staff.permissions.manage')
  const canViewActivity = can('audit.view')
  const canManageSettings = can('settings.manage')
  const canScan = can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.products.edit') || can('hopshop.inventory.update')
  const showTiles =
    canQueue ||
    canInbox ||
    canBookings ||
    canScan ||
    canSeeHopShop ||
    canManageAdopt ||
    canPostAnnouncements ||
    canManageVolunteer ||
    canEditCare ||
    canManageEvents ||
    canManageAuction ||
    canManageSponsors ||
    canManageTeam ||
    canViewActivity ||
    canManageSettings

  // For a staff member, list the granted capabilities so they know their access.
  const grantedList = PERMISSION_CATALOG.filter((p) => capabilities.has(p.key))

  return (
    <Screen className="space-y-5">
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-black text-ink">Staff dashboard</h1>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <strong>{user.email}</strong>
        </p>
      </div>

      {canManageSponsors && <ExpiringNotice orgId={membership.orgId} />}

      {showTiles ? (
        <div className="space-y-3">
          {canInbox && (
            <Link
              to="/staff/inbox"
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                <Icon name="mail" size={22} />
                {newCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-black text-white">
                    {newCount > 99 ? '99+' : newCount}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold text-ink">Inbox</span>
                <span className="mt-0.5 block text-sm text-slate-500">
                  {newCount > 0 ? `${newCount} new request${newCount === 1 ? '' : 's'} waiting` : 'Appointments, sign-ups, surrenders & messages'}
                </span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
            </Link>
          )}
          {canBookings && (
            <ActionCard
              to="/staff/bookings"
              title={pendingCount > 0 ? `Bookings · ${pendingCount} to confirm` : 'Bookings'}
              subtitle="Volunteer shifts & appointments: who’s coming, make times"
              icon="calendar"
              tone="blue"
            />
          )}
          {canScan && (
            <Link
              to="/staff/scan"
              className="flex items-center gap-4 rounded-2xl bg-brand-orange p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:bg-brand-orange-dark active:translate-y-0"
            >
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Icon name="scan" size={30} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-black">Scan an item</span>
                <span className="mt-0.5 block text-sm text-white/90">Silent Auction, raffle prizes & Hop Shop stock — point the camera at the tag</span>
              </span>
              <Icon name="chevron" size={20} className="shrink-0 text-white/80" />
            </Link>
          )}
          {canScan && (
            <ActionCard to="/staff/items" title="Scanned items" subtitle="Everything with a tag · print new tags" icon="printer" tone="orange" />
          )}
          {canManageAdopt && (
            <ActionCard
              to="/staff/adopt"
              title="Adoptable rabbits"
              subtitle="Add rabbits, photos & adoption status"
              icon="heart"
              tone="orange"
            />
          )}
          {canSeeHopShop && (
            <ActionCard
              to="/staff/hopshop"
              title="Hop Shop"
              subtitle={
                isAdminish
                  ? 'Items with photos & codes, stock counts, the reorder list, suppliers'
                  : hopshopCaps.map((c) => c.description).join(' · ')
              }
              icon="bag"
              tone="orange"
            />
          )}
          {canQueue && (
            <ActionCard
              to="/staff/posts"
              title={readyPosts > 0 ? `Post queue · ${readyPosts} ready` : 'Post queue'}
              subtitle="Premade posts, released with one tap by whoever posts as OHRR"
              icon="mail"
              tone="orange"
            />
          )}
          {canPostAnnouncements && (
            <ActionCard
              to="/staff/share"
              title="Share kit"
              subtitle="Ready-made posts for Instagram, Facebook & TikTok — pick, tap Share"
              icon="sparkles"
              tone="orange"
            />
          )}
          {canPostAnnouncements && (
            <ActionCard
              to="/staff/flyers"
              title="Flyers"
              subtitle="QR posters for vets, campus boards and pet stores — share, save or print"
              icon="printer"
              tone="blue"
            />
          )}
          {canPostAnnouncements && (
            <ActionCard
              to="/staff/outreach"
              title="Outreach letters"
              subtitle="Ready-to-send emails to campus offices, vets, stores, schools & media"
              icon="mail"
              tone="blue"
            />
          )}
          {canPostAnnouncements && (
            <ActionCard
              to="/staff/impact"
              title="Impact numbers"
              subtitle="The year in numbers for donors & sponsors — shown at /impact"
              icon="star"
              tone="blue"
            />
          )}
          {canPostAnnouncements && (
            <ActionCard
              to="/staff/announcements"
              title="Announcements"
              subtitle="Post notices that show on the app home"
              icon="gift"
              tone="orange"
            />
          )}
          {(canManageVolunteer || canBookings) && (
            <ActionCard
              to="/staff/calls"
              title="Volunteer calls"
              subtitle="Put out a need, share it everywhere, check people in, thank them"
              icon="heart"
              tone="orange"
            />
          )}
          {(canManageVolunteer || canBookings) && (
            <ActionCard
              to="/staff/volunteers"
              title="Volunteers"
              subtitle="The roster, their hours, and each person's private hours link"
              icon="users"
              tone="blue"
            />
          )}
          {canManageVolunteer && (
            <ActionCard
              to="/staff/volunteer"
              title="Volunteer opportunities"
              subtitle="Shifts, transport runs & events"
              icon="heart"
              tone="orange"
            />
          )}
          {canEditCare && (
            <ActionCard
              to="/staff/learn"
              title="Care guides & pages"
              subtitle="Rabbit Care articles in Learn, plus the Give / Adopt / About pages"
              icon="book"
              tone="blue"
            />
          )}
          {canEditCare && (
            <ActionCard
              to="/staff/vets"
              title="Vet directory"
              subtitle="Rabbit-savvy vets shown in Find a vet"
              icon="phone"
              tone="blue"
            />
          )}
          {canManageEvents && (
            <ActionCard
              to="/staff/events"
              title="Events"
              subtitle="Midwest BunFest & OHRR hoppenings"
              icon="calendar"
              tone="orange"
            />
          )}
          {canManageEvents && (
            <ActionCard
              to="/staff/bunfest"
              title="BunFest content"
              subtitle="The education schedule, vendors & booths, rescue partners"
              icon="star"
              tone="orange"
            />
          )}
          {canPostAnnouncements && (
            <ActionCard
              to="/staff/home-screen"
              title="Home screen"
              subtitle="The big cards the app opens on (and the website's home page)"
              icon="home"
              tone="blue"
            />
          )}
          {(canEditCare || canInbox) && (
            <ActionCard
              to="/staff/tails"
              title="Happy Tails"
              subtitle="Publish and edit adopters’ stories"
              icon="sparkles"
              tone="blue"
            />
          )}
          {canManageAuction && (
            <ActionCard
              to="/staff/raffle"
              title="Silent Auction"
              subtitle="BunFest auction items, photos & won status"
              icon="award"
              tone="orange"
            />
          )}
          {canManageAuction && (
            <ActionCard
              to="/staff/raffle-tickets"
              title="Raffle tickets"
              subtitle="The raffle table: mark paid, sell at the table, draw winners"
              icon="ticket"
              tone="orange"
            />
          )}
          {canManageSponsors && (
            <ActionCard
              to="/staff/sponsors"
              title="Sponsors & partners"
              subtitle="Partner roster, perks & “Presented by” placements"
              icon="award"
              tone="blue"
            />
          )}
          {canEditCare && (
            <ActionCard to="/staff/bunny-help" title="Bunny Help topics" subtitle="What “My bunny is…” answers with" icon="help" tone="blue" />
          )}
          {canManageTeam && (
            <ActionCard
              to="/staff/team"
              title="Team"
              subtitle="Invite staff and manage who can do what"
              icon="users"
              tone="blue"
            />
          )}
          {canViewActivity && (
            <ActionCard
              to="/staff/activity"
              title="Activity"
              subtitle="Who changed what, and when"
              icon="clock"
              tone="blue"
            />
          )}
          {canManageSettings && (
            <ActionCard
              to="/staff/features"
              title="Features"
              subtitle="Turn parts of the app on and off for everyone"
              icon="settings"
              tone="blue"
            />
          )}
          {canManageSettings && (
            <ActionCard
              to="/staff/details"
              title="OHRR details"
              subtitle="Hours, phone, address and a notice — shown everywhere"
              icon="mappin"
              tone="blue"
            />
          )}
        </div>
      ) : (
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You're set up as staff, but no features have been turned on for you yet. An owner or
            admin can grant you access from the Team screen.
          </p>
        </Card>
      )}

      {!isAdminish && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Your access
          </p>
          {grantedList.length === 0 ? (
            <p className="px-1 text-sm text-slate-500">No capabilities granted yet.</p>
          ) : (
            <Card className="space-y-2">
              {grantedList.map((p) => (
                <div key={p.key} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="text-slate-700">
                    <span className="font-semibold">{p.area}</span> — {p.description}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      <DeleteAccount />
    </Screen>
  )
}

// How many requests are waiting — refreshed each time the dashboard opens.
function useNewRequestCount(orgId: string | null): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!orgId) return
    let alive = true
    supabase
      .rpc('count_new_requests', { p_org: orgId })
      .then(({ data }) => alive && typeof data === 'number' && setN(data))
    return () => {
      alive = false
    }
  }, [orgId])
  return n
}

// Appointments waiting for a staff confirmation.
function usePendingBookingCount(orgId: string | null): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!orgId) return
    let alive = true
    supabase
      .rpc('count_pending_bookings', { p_org: orgId })
      .then(({ data }) => alive && typeof data === 'number' && setN(data))
    return () => {
      alive = false
    }
  }, [orgId])
  return n
}

// Approved posts whose day has come.
function useReadyPostCount(orgId: string | null): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!orgId) return
    let alive = true
    supabase
      .rpc('count_ready_posts', { p_org: orgId })
      .then(({ data }) => alive && typeof data === 'number' && setN(data))
    return () => {
      alive = false
    }
  }, [orgId])
  return n
}
