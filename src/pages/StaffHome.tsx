// The staff dashboard, short (OHRR, 2026-10-01: "too many in the list and you
// have to scroll a long way … bin these into groups and simplify"): a Today
// row (Inbox, Bookings, Counter, Scan) and the groups; each group opens a
// short list (StaffGroup). The pages and who may open them live in
// features/staff/staffTiles.ts.
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, NotConfigured } from '../components/staffui'
import { ChoiceCard } from '../components/StaffJob'
import ExpiringNotice from '../features/sponsors/ExpiringNotice'
import { ApplicationsNotice, CertificatesNotice } from '../features/volunteers/StaffNotices'
import { PostsToApproveNotice } from '../features/share/PostsToApproveNotice'
import { EasterCampaignNotice } from '../features/share/EasterCampaignCard'
import { isFullAccess, levelInfo, useMyLevel } from '../lib/staffLevels'
import { useStaffTiles } from '../features/staff/staffTiles'

const roleBadge: Record<string, { label: string; tone: 'blue' | 'orange' | 'slate' }> = {
  owner: { label: 'Owner', tone: 'blue' },
  admin: { label: 'Admin', tone: 'blue' },
  staff: { label: 'Staff', tone: 'slate' },
}

const count = (n: number) => (n > 99 ? '99+' : String(n))

export default function StaffHome() {
  const { configured, loading, user, membership, can } = useAuth()
  // Hooks before any early return (a hook below one blanked this page once).
  const myLevel = useMyLevel(user?.id, membership?.orgId)
  const { today, groups, counterOnly, nothingYet, isAdminish } = useStaffTiles({ counts: true })

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/staff/signin" replace />
  // Signed in but not on the team yet: the invite code is the next step.
  if (!membership) return <Navigate to="/staff/join" replace />
  // A counter volunteer goes straight to the Counter — the one screen they need.
  if (counterOnly) return <Navigate to="/staff/counter" replace />

  const badge = myLevel.level
    ? { label: levelInfo(myLevel.level).label, tone: isAdminish || isFullAccess(myLevel.level) ? ('blue' as const) : ('slate' as const) }
    : (roleBadge[membership.role] ?? roleBadge.staff)

  return (
    <Screen className="space-y-5">
      <div className="flex items-center gap-2 pt-1">
        <h1 className="font-display text-[26px] font-black text-ink">Staff</h1>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      {can('events.bunfest.manage') && <ExpiringNotice orgId={membership.orgId} />}
      {(can('volunteers.shifts.manage') || can('bookings.manage')) && <ApplicationsNotice orgId={membership.orgId} />}
      {can('volunteers.certificates') && <CertificatesNotice orgId={membership.orgId} />}
      {can('social.approve') && <PostsToApproveNotice />}
      {/* In the weeks before Easter, until this year's Easter posts are planned (Staff → Posts) */}
      {can('announcements.post') && <EasterCampaignNotice />}

      {today.length > 0 && (
        <section aria-labelledby="today-h">
          <h2 id="today-h" className="mb-2 px-1 text-lg font-extrabold text-ink">
            Right now
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {today.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                aria-label={t.badge ? `${t.title}, ${t.badge} waiting` : t.title}
                className="relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 bg-white px-2 py-3 text-center shadow-sm transition hover:border-slate-300 active:scale-[.98]"
              >
                <Icon name={t.icon} size={28} className="text-brand-blue" />
                <span className="font-display text-[17px] font-extrabold leading-tight text-ink">{t.title === 'Scan an item' ? 'Scan' : t.title}</span>
                {(t.badge ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-brand-orange px-1.5 text-sm font-black text-ink">
                    {count(t.badge ?? 0)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="groups-h">
        <h2 id="groups-h" className="mb-2 px-1 text-lg font-extrabold text-ink">
          {today.length > 0 ? 'Or choose a job' : 'What do you need to do?'}
        </h2>
        <ul className="space-y-3">
          {groups.map((g) => {
            // A group with one page opens that page straight away.
            const to = g.tiles.length === 1 ? g.tiles[0].to : `/staff/g/${g.key}`
            return (
              <li key={g.key}>
                <ChoiceCard to={to} icon={g.icon} title={g.title} text={g.hint} badge={g.badge > 0 ? `${count(g.badge)} waiting` : undefined} accent={g.key === 'volunteers' ? 'orange' : 'blue'} />
              </li>
            )
          })}
        </ul>
      </section>

      {nothingYet && (
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-base leading-relaxed text-slate-600">
            You're on the team, but no tasks have been switched on for you yet. Someone above your level can switch them on from
            the Team screen.
          </p>
        </Card>
      )}
    </Screen>
  )
}
