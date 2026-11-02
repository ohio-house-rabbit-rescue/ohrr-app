// One group of staff pages (/staff/g/:group) — a short list, opened from a
// group tile on the dashboard. "Me" also shows this person's access and the
// delete-account section (they used to sit at the bottom of the dashboard).
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner } from '../components/staffui'
import { PERMISSION_CATALOG } from '../lib/capabilities'
import { DeleteAccount } from '../components/DeleteAccount'
import { useStaffTiles, type StaffTile } from '../features/staff/staffTiles'

function TileList({ tiles, groupKey }: { tiles: StaffTile[]; groupKey: string }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {tiles.map((t, i) => (
        <li key={t.to} className={i > 0 ? 'border-t border-slate-100' : ''}>
          <Link to={t.to} className="flex min-h-[64px] items-center gap-3.5 px-4 py-3 transition hover:bg-slate-50">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${groupKey === 'volunteers' ? 'bg-brand-orange-50 text-brand-orange-dark' : 'bg-brand-blue-50 text-brand-blue-dark'}`}>
              <Icon name={t.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-extrabold leading-tight text-ink">{t.title}</span>
              <span className="mt-0.5 block text-sm text-slate-500">{t.hint}</span>
            </span>
            {(t.badge ?? 0) > 0 && (
              <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-black text-ink">
                {(t.badge ?? 0) > 99 ? '99+' : t.badge}
              </span>
            )}
            <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function StaffGroup() {
  const { group } = useParams()
  const { loading, user, membership, capabilities } = useAuth()
  const { groups, isAdminish } = useStaffTiles({ counts: true })
  const [showMore, setShowMore] = useState(false)

  if (loading) return <Spinner />
  if (!membership) return <Navigate to="/staff" replace />
  const g = groups.find((x) => x.key === group)
  if (!g) return <Navigate to="/staff" replace />

  // A short list first; pages a hub inside the group already leads to wait under "More".
  const moreTiles = g.tiles.some((t) => !t.more) ? g.tiles.filter((t) => t.more) : []
  const mainTiles = g.tiles.filter((t) => !moreTiles.includes(t))

  const granted = PERMISSION_CATALOG.filter((p) => capabilities.has(p.key))

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">{g.title}</h1>
        {g.key === 'me' && user?.email && <p className="mt-1 break-all text-sm text-slate-600">Signed in as {user.email}</p>}
      </div>

      <TileList tiles={mainTiles} groupKey={g.key} />
      {moreTiles.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowMore((o) => !o)}
            aria-expanded={showMore}
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-1 text-base font-bold text-brand-blue"
          >
            <Icon name="chevron" size={18} className={showMore ? 'rotate-90' : ''} />
            {showMore ? 'Hide the rest' : `More in this group (${moreTiles.length})`}
          </button>
          {showMore && <TileList tiles={moreTiles} groupKey={g.key} />}
        </div>
      )}

      {g.key === 'me' && !isAdminish && (
        <div className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-slate-500">Your access</h2>
          {granted.length === 0 ? (
            <p className="px-1 text-sm text-slate-500">No tasks switched on yet.</p>
          ) : (
            <Card className="space-y-2">
              {granted.map((p) => (
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
      {g.key === 'me' && <DeleteAccount />}
    </Screen>
  )
}
