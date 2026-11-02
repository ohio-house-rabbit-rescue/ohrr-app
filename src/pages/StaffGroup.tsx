// One group of staff pages (/staff/g/:group), opened from a group card on the
// staff home. One decision per screen (OHRR, 2026-11-02: "too many options will
// confuse"): a few big cards — a page, or a section of pages (?do=<section>).
// "Me" also shows this person's access and the delete-account section (they
// used to sit at the bottom of the dashboard).
import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner } from '../components/staffui'
import { ChoiceCard } from '../components/StaffJob'
import { PERMISSION_CATALOG } from '../lib/capabilities'
import { DeleteAccount } from '../components/DeleteAccount'
import { useStaffTiles, type StaffTile } from '../features/staff/staffTiles'

const backLink = '-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-base font-bold text-brand-blue hover:bg-brand-blue-50'

const waiting = (n: number) => (n > 0 ? `${n > 99 ? '99+' : n} waiting` : undefined)

// A page with something waiting says so in the orange badge ("2 to confirm"), in place of its usual hint.
function TileCard({ t, groupKey }: { t: StaffTile; groupKey: string }) {
  const has = (t.badge ?? 0) > 0
  return <ChoiceCard to={t.to} icon={t.icon} title={t.title} text={has ? undefined : t.hint} badge={has ? t.hint : undefined} accent={groupKey === 'volunteers' ? 'orange' : 'blue'} />
}

function TileList({ tiles, groupKey }: { tiles: StaffTile[]; groupKey: string }) {
  return (
    <ul className="space-y-3">
      {tiles.map((t) => (
        <li key={t.to}>
          <TileCard t={t} groupKey={groupKey} />
        </li>
      ))}
    </ul>
  )
}

export default function StaffGroup() {
  const { group } = useParams()
  const [params] = useSearchParams()
  const { loading, user, membership, capabilities } = useAuth()
  const { groups, isAdminish } = useStaffTiles({ counts: true })
  const [showMore, setShowMore] = useState(false)

  if (loading) return <Spinner />
  if (!membership) return <Navigate to="/staff" replace />
  const g = groups.find((x) => x.key === group)
  if (!g) return <Navigate to="/staff" replace />

  // A section of pages: its own screen, a few cards.
  const doKey = params.get('do')
  const sec = doKey ? g.entries.find((e) => e.kind === 'section' && e.section.key === doKey) : undefined
  if (sec && sec.kind === 'section') {
    return (
      <Screen className="space-y-4">
        <Link to={`/staff/g/${g.key}`} className={backLink}>
          <Icon name="arrowLeft" size={20} /> {g.title}
        </Link>
        <div>
          <h1 className="font-display text-[26px] font-black leading-tight text-ink">{sec.section.title}</h1>
          <p className="mt-1 text-lg text-slate-700">What would you like to open?</p>
        </div>
        <TileList tiles={sec.tiles} groupKey={g.key} />
      </Screen>
    )
  }

  // A short list first; pages a hub inside the group already leads to wait under "More".
  const moreTiles = g.tiles.some((t) => !t.more) ? g.tiles.filter((t) => t.more) : []
  const entries = g.entries.filter((e) => e.kind !== 'tile' || !moreTiles.includes(e.tile))

  const granted = PERMISSION_CATALOG.filter((p) => capabilities.has(p.key))

  return (
    <Screen className="space-y-4">
      <div>
        <Link to="/staff" className={backLink}>
          <Icon name="arrowLeft" size={20} /> Staff
        </Link>
        <h1 className="font-display text-[26px] font-black leading-tight text-ink">{g.title}</h1>
        {g.key === 'me' && user?.email && <p className="mt-1 break-all text-base text-slate-600">Signed in as {user.email}</p>}
        {g.key !== 'me' && <p className="mt-1 text-lg text-slate-700">What would you like to open?</p>}
      </div>

      <ul className="space-y-3">
        {entries.map((e) =>
          e.kind === 'tile' ? (
            <li key={e.tile.to}>
              <TileCard t={e.tile} groupKey={g.key} />
            </li>
          ) : (
            <li key={e.section.key}>
              <ChoiceCard
                to={`/staff/g/${g.key}?do=${e.section.key}`}
                icon={e.section.icon}
                title={e.section.title}
                text={e.tiles.map((t) => t.title).join(', ')}
                badge={waiting(e.badge)}
                accent={g.key === 'volunteers' ? 'orange' : 'blue'}
              />
            </li>
          ),
        )}
      </ul>
      {moreTiles.length > 0 && (
        <div className="space-y-3">
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
          <h2 className="px-1 text-base font-bold text-slate-600">Your access</h2>
          {granted.length === 0 ? (
            <p className="px-1 text-base text-slate-600">No tasks switched on yet.</p>
          ) : (
            <Card className="space-y-2">
              {granted.map((p) => (
                <div key={p.key} className="flex items-start gap-2 text-base">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
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
