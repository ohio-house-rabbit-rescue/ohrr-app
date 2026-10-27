// A staff member's picture — or, when there isn't one, their initials in a
// colored circle. Photos are optional (not everyone wants one, and nobody
// should be blocked from the team list for it). The color is picked from the
// person's name, so the same volunteer gets the same color every time.
// No cartoons or emoji: OHRR's rule is line icons and real photos only.
import { Icon } from './icons'

const COLORS = [
  { bg: 'bg-brand-blue-50', fg: 'text-brand-blue' },
  { bg: 'bg-brand-orange-50', fg: 'text-brand-orange-dark' },
  { bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  { bg: 'bg-violet-50', fg: 'text-violet-700' },
  { bg: 'bg-amber-50', fg: 'text-amber-700' },
  { bg: 'bg-rose-50', fg: 'text-rose-700' },
  { bg: 'bg-slate-100', fg: 'text-slate-600' },
]

/** Same name → same color, every time. */
export function colorFor(name: string) {
  let h = 0
  for (const ch of name || 'ohrr') h = (h * 31 + ch.charCodeAt(0)) % 9973
  return COLORS[h % COLORS.length]
}

/** "Jane Smith" → "JS"; "jane@example.org" → "J"; "" → "?" */
export function initialsFor(name: string): string {
  const words = (name || '')
    .split('@')[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export default function StaffAvatar({
  name,
  photoUrl,
  size = 56,
  className = '',
}: {
  name: string
  photoUrl?: string | null
  size?: number
  /** Kept for callers that still pass it; initials never need a caption. */
  showCaption?: boolean
  className?: string
}) {
  const color = colorFor(name)
  return (
    <span className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${photoUrl ? 'bg-slate-100' : color.bg}`}
        style={{ width: size, height: size }}
        title={name}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden="true" className={`font-bold ${color.fg}`} style={{ fontSize: size * 0.38, lineHeight: 1 }}>
            {initialsFor(name)}
          </span>
        )}
      </span>
    </span>
  )
}

/** The "add a photo" prompt used on the member's own row. */
export function AvatarHint({ hasPhoto }: { hasPhoto: boolean }) {
  if (hasPhoto) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <Icon name="camera" size={13} /> No photo yet — your initials show instead
    </span>
  )
}
