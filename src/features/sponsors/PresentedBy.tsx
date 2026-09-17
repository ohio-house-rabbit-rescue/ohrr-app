// <PresentedBy surface="bunfest" /> — a small, tasteful "Presented by" strip for
// screens that have an active sponsor placement. Renders NOTHING otherwise, so
// it is always safe to drop into a screen with a one-line insert.
//
// Wired in Phase 1: app Home ('home') and the BunFest home ('bunfest'). Add to
// the silent auction, events, care library, find-a-vet, happy-tails, volunteer,
// hop-shop and my-bunny screens with the matching surface once those land.
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { usePlacements, useSponsors } from './hooks'
import { SponsorLogo } from './SponsorLogo'
import { tierRank, type Surface } from './types'

export default function PresentedBy({ surface }: { surface: Surface }) {
  const placements = usePlacements(surface)
  const sponsors = useSponsors()

  if (!placements || !sponsors || placements.length === 0) return null

  // De-dupe (a sponsor could be placed twice with different windows), keep only
  // sponsors the public can see, and lead with the highest tier.
  const ids = Array.from(new Set(placements.map((p) => p.sponsorId)))
  const shown = ids
    .map((id) => sponsors.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.sortOrder - b.sortOrder)

  if (shown.length === 0) return null

  return (
    <Link
      to="/partners"
      aria-label={`Presented by ${shown.map((s) => s.name).join(', ')} — see all partners`}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 transition hover:border-slate-300 hover:bg-white"
    >
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        Presented by
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        {shown.map((s) => (
          <span key={s.id} className="flex min-w-0 items-center gap-2">
            <SponsorLogo name={s.name} logoUrl={s.logoUrl} size="sm" />
            <span className="truncate font-display text-sm font-extrabold text-ink">{s.name}</span>
          </span>
        ))}
      </span>
      <Icon
        name="chevron"
        size={16}
        className="shrink-0 text-slate-300 transition group-hover:text-brand-orange"
      />
    </Link>
  )
}
