import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ActionCard, Badge, Card, Screen } from '../components/ui'
import { Spinner, NotConfigured } from '../components/staffui'
import { PERMISSION_CATALOG } from '../lib/capabilities'

const roleBadge: Record<string, { label: string; tone: 'blue' | 'orange' | 'slate' }> = {
  owner: { label: 'Owner', tone: 'blue' },
  admin: { label: 'Admin', tone: 'blue' },
  staff: { label: 'Staff', tone: 'slate' },
}

export default function StaffHome() {
  const { configured, loading, user, membership, can, capabilities } = useAuth()

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/staff/signin" replace />
  if (!membership) return <Navigate to="/staff/start" replace />

  const isAdminish = membership.role === 'owner' || membership.role === 'admin'
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
  const canManageTeam = can('staff.invite') || can('staff.permissions.manage')
  const canViewActivity = can('audit.view')
  const showTiles =
    canSeeHopShop ||
    canManageAdopt ||
    canPostAnnouncements ||
    canManageVolunteer ||
    canEditCare ||
    canManageEvents ||
    canManageAuction ||
    canManageTeam ||
    canViewActivity

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

      {showTiles ? (
        <div className="space-y-3">
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
              title="Hop Shop manager"
              subtitle={
                isAdminish
                  ? 'Add, edit & remove products; update stock'
                  : hopshopCaps.map((c) => c.description).join(' · ')
              }
              icon="bag"
              tone="orange"
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
              title="Care guides"
              subtitle="Edit the Rabbit Care articles in Learn"
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
          {canManageAuction && (
            <ActionCard
              to="/staff/raffle"
              title="Silent Auction"
              subtitle="BunFest auction items, photos & won status"
              icon="award"
              tone="orange"
            />
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
    </Screen>
  )
}
