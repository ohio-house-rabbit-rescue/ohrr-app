// "Thank you to our sponsors" — a logo wall for the BunFest home.
//
// OHRR (2026-09-24): the sponsor list "is a mass of words … what about making
// logo links available that each is from the sponsored list and shows a logo if
// one is available." The same sponsors as the "Presented by" strip, each in an
// equal tile: the real logo when there is one, otherwise the sponsor's name, so
// the grid still lines up. A tile opens the sponsor's own website outside the
// app (the native shell hands target="_blank" links to the system browser).
// Renders nothing until there is at least one sponsor to thank.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { useSurfaceSponsors } from './hooks'
import { SPONSOR_INQUIRY_EMAIL } from './PartnersPage'
import { hrefFor, type Sponsor, type Surface } from './types'

function LogoTile({ s, wide = false }: { s: Sponsor; wide?: boolean }) {
  const [failed, setFailed] = useState(false)
  const box = `flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white ${
    wide ? 'aspect-[5/2] px-6 py-4' : 'aspect-[3/2] p-3'
  }`

  const inner =
    s.logoUrl && !failed ? (
      <img
        src={s.logoUrl}
        alt={s.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    ) : (
      <span
        className={`line-clamp-3 text-center font-display font-extrabold leading-tight text-ink ${
          wide ? 'text-xl' : 'text-[15px]'
        }`}
      >
        {s.name}
      </span>
    )

  if (!s.website) return <div className={box}>{inner}</div>

  return (
    <a
      href={hrefFor(s.website)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${s.name} (opens their website)`}
      className={`${box} transition hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue active:scale-[.98]`}
    >
      {inner}
    </a>
  )
}

export default function SponsorWall({ surface, sponsorsTo }: { surface: Surface; sponsorsTo?: string }) {
  const sponsors = useSurfaceSponsors(surface)
  if (!sponsors || sponsors.length === 0) return null

  const presenting = sponsors.filter((s) => s.tier === 'presenting')
  const rest = sponsors.filter((s) => s.tier !== 'presenting')

  return (
    <section aria-labelledby="sponsor-wall-title" className="space-y-2.5">
      <h2 id="sponsor-wall-title" className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">
        Thank you to our sponsors
      </h2>

      {presenting.map((s) => (
        <LogoTile key={s.id} s={s} wide />
      ))}

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {rest.map((s) => (
            <LogoTile key={s.id} s={s} />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center pt-1 text-center text-sm">
        {sponsorsTo && (
          <Link to={sponsorsTo} className="inline-flex min-h-[44px] items-center gap-1 font-bold text-brand-blue">
            More about our sponsors <Icon name="chevron" size={15} />
          </Link>
        )}
        <p className="text-slate-600">
          Want to sponsor next year?{' '}
          <a
            href={`mailto:${SPONSOR_INQUIRY_EMAIL}?subject=${encodeURIComponent('Sponsoring Midwest BunFest')}`}
            className="inline-flex min-h-[44px] items-center font-bold text-brand-blue"
          >
            Email us
          </a>
        </p>
      </div>
    </section>
  )
}
