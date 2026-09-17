import { Link } from 'react-router-dom'

// A tappable quick-action card fronted by a real photo (no icons) — used for
// the home screen's quick actions. The photo fills the card; the label sits on
// a gradient so it stays readable over any image.
export function PhotoCard({
  to,
  title,
  subtitle,
  photo,
  variant = 'card',
}: {
  to: string
  title: string
  subtitle?: string
  photo: string
  /** `tile` = square, title only — for dense grids */
  variant?: 'card' | 'tile'
}) {
  const tile = variant === 'tile'
  return (
    <Link
      to={to}
      className={`group relative block ${tile ? 'aspect-square' : 'aspect-[5/4]'} overflow-hidden rounded-2xl bg-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0`}
    >
      <img
        src={photo}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      />
      <span className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent ${tile ? 'px-2.5 pb-2 pt-6' : 'px-3 pb-2.5 pt-8'}`}>
        <span className={`block font-display ${tile ? 'text-[13px]' : 'text-[15px]'} font-extrabold leading-tight text-white`}>{title}</span>
        {subtitle && !tile && (
          <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-white/85">{subtitle}</span>
        )}
      </span>
    </Link>
  )
}
