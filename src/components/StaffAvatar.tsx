// A staff member's picture — or, when there isn't one, a bunny with an opinion.
//
// Photos are optional (not everyone wants one, and nobody should be blocked
// from the team list for it), so the fallback has to be something OHRR is happy
// to show: a drawn rabbit with a caption picked from the person's own name, so
// it's stable — the same volunteer gets the same bunny every time.
import { Icon } from './icons'

const BUNNIES = [
  { emoji: '🥕', caption: 'Out inspecting carrots', bg: 'bg-brand-orange-50', fg: 'text-brand-orange-dark' },
  { emoji: '🌿', caption: 'Away eating the parsley', bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  { emoji: '💨', caption: 'Mid-zoomies, no photo', bg: 'bg-brand-blue-50', fg: 'text-brand-blue' },
  { emoji: '😴', caption: 'Flopped, do not disturb', bg: 'bg-violet-50', fg: 'text-violet-700' },
  { emoji: '📦', caption: 'Hiding in a cardboard box', bg: 'bg-amber-50', fg: 'text-amber-700' },
  { emoji: '🧺', caption: 'Rearranging the hay', bg: 'bg-rose-50', fg: 'text-rose-700' },
  { emoji: '👀', caption: 'Camera-shy bun', bg: 'bg-slate-100', fg: 'text-slate-600' },
]

/** Same name → same bunny, every time. */
export function bunnyFor(name: string) {
  let h = 0
  for (const ch of name || 'bunny') h = (h * 31 + ch.charCodeAt(0)) % 9973
  return BUNNIES[h % BUNNIES.length]
}

export default function StaffAvatar({
  name,
  photoUrl,
  size = 56,
  showCaption = false,
  className = '',
}: {
  name: string
  photoUrl?: string | null
  size?: number
  /** Print the bunny's excuse under the tile (the team list does). */
  showCaption?: boolean
  className?: string
}) {
  const bunny = bunnyFor(name)
  return (
    <span className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ${photoUrl ? 'bg-slate-100' : bunny.bg}`}
        style={{ width: size, height: size }}
        title={photoUrl ? name : `${name} — ${bunny.caption}`}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden="true" className={bunny.fg} style={{ fontSize: size * 0.46, lineHeight: 1 }}>
            {bunny.emoji}
          </span>
        )}
      </span>
      {showCaption && !photoUrl && (
        <span className="max-w-[96px] text-center text-[10px] leading-tight text-slate-400">{bunny.caption}</span>
      )}
    </span>
  )
}

/** The "add a photo" prompt used on the member's own row. */
export function AvatarHint({ hasPhoto }: { hasPhoto: boolean }) {
  if (hasPhoto) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <Icon name="camera" size={13} /> No photo — a bunny is standing in
    </span>
  )
}
