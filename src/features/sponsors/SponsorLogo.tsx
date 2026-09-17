// A sponsor's logo (real brand image) — or, when there isn't one yet / it fails
// to load, a neutral block with the sponsor's initial. No illustrations, no emoji.
import { useState } from 'react'

const SIZES = {
  sm: { box: 'h-9 w-9 rounded-lg', text: 'text-sm' },
  md: { box: 'h-14 w-14 rounded-xl', text: 'text-lg' },
  lg: { box: 'h-20 w-full max-w-[200px] rounded-xl', text: 'text-2xl' },
  xl: { box: 'h-28 w-full max-w-[280px] rounded-2xl', text: 'text-3xl' },
} as const

export type LogoSize = keyof typeof SIZES

export function initialOf(name: string): string {
  const first = name.trim().charAt(0)
  return first ? first.toUpperCase() : '?'
}

export function SponsorLogo({
  name,
  logoUrl,
  size = 'md',
  className = '',
}: {
  name: string
  logoUrl?: string
  size?: LogoSize
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const s = SIZES[size]

  if (logoUrl && !failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-white p-1.5 ring-1 ring-slate-200 ${s.box} ${className}`}
      >
        <img
          src={logoUrl}
          alt={`${name} logo`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </span>
    )
  }

  return (
    <span
      role="img"
      aria-label={`${name} (no logo yet)`}
      className={`inline-flex shrink-0 items-center justify-center bg-slate-100 font-display font-extrabold text-slate-500 ring-1 ring-slate-200 ${s.box} ${s.text} ${className}`}
    >
      {initialOf(name)}
    </span>
  )
}
