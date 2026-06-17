import { type MouseEvent as ReactMouseEvent } from 'react'
import { Icon } from './icons'
import { TAIL_STATUS, type TailStatus } from '../data/tails'
import { toggleFollow, useFollowing } from '../lib/follow'

// Bunny photo with a friendly, on-brand placeholder (tinted deterministically
// from the name) for stories that don't have a photo yet.
export function BunnyPhoto({
  name,
  photo,
  className = '',
}: {
  name: string
  photo?: string
  className?: string
}) {
  if (photo) {
    return (
      <img src={photo} alt={name} loading="lazy" className={`h-full w-full object-cover ${className}`} />
    )
  }
  let hue = 0
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360
  const background = `linear-gradient(135deg, hsl(${hue} 68% 90%), hsl(${(hue + 38) % 360} 72% 82%))`
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ background }}
      role="img"
      aria-label={name}
    >
      <span className="text-[2.5rem] leading-none drop-shadow-sm" aria-hidden>
        🐰
      </span>
    </div>
  )
}

// Life-stage status chip (Looking for a home / Just adopted / … / Forever loved).
export function StatusPill({ status, className = '' }: { status: TailStatus; className?: string }) {
  const s = TAIL_STATUS[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${s.cls} ${className}`}
    >
      <span aria-hidden>{s.emoji}</span> {s.label}
    </span>
  )
}

// Account-free follow toggle. `compact` renders a round icon button for cards;
// otherwise a labelled pill for detail pages.
export function FollowButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const following = useFollowing()
  const on = following.has(id)

  const onClick = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFollow(id)
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        aria-label={on ? 'Following' : 'Follow'}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
          on
            ? 'border-brand-orange/30 bg-brand-orange-50 text-brand-orange'
            : 'border-slate-200 bg-white text-slate-400 hover:text-brand-orange'
        }`}
      >
        <Icon name="heart" size={18} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
        on
          ? 'bg-brand-orange-50 text-brand-orange'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-orange/40 hover:text-brand-orange'
      }`}
    >
      <Icon name="heart" size={16} /> {on ? 'Following' : 'Follow'}
    </button>
  )
}
