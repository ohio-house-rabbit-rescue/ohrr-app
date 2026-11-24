// A small "Goes with this" row at the foot of a staff page: one to three links
// to the pages that carry on from it (OHRR, 2026-11-24: "the process and
// outcomes need to be within the flow and connected"). A link shows only when
// the signed-in person may open that page: it must be one of their own
// dashboard tiles (the same permission check the tile uses), so nothing is
// ever offered that would turn them away.
import { Link } from 'react-router-dom'
import { useStaffTiles } from '../features/staff/staffTiles'

export interface GoesWithLink {
  /** The tile's `to`, exactly as it is in staffTiles.ts. */
  to: string
  label: string
}

export function GoesWith({ links, className = '' }: { links: GoesWithLink[]; className?: string }) {
  const { tiles } = useStaffTiles()
  const shown = links.filter((l) => tiles.some((t) => t.to === l.to))
  if (shown.length === 0) return null
  return (
    <nav aria-label="Goes with this" className={`pt-2 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Goes with this</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shown.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-brand-blue hover:border-brand-blue hover:text-brand-blue-dark"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
