import { Link } from 'react-router-dom'
import { Icon, type IconName } from './icons'

// Sponsor rule: a card that stands for a FUNCTION (find a vet, volunteer, events…)
// shows a fixed line icon so people see and remember its purpose; a photo is only
// for things that ARE content — real rabbits, auction items, artwork, the BunFest
// logo. PhotoCard is the photo version; IconPhotoTile is the same tile shape with
// a large brand-blue icon on a brand-blue-50 tile. Both take `variant="tile"` for
// the Home quick-actions grid, and both put the title bottom-left at the same size.

const shape = (tile: boolean) =>
  `group relative block ${tile ? 'aspect-square' : 'aspect-[5/4]'} overflow-hidden rounded-2xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0`

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
    <Link to={to} className={`${shape(tile)} bg-slate-200`}>
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

// The icon twin of PhotoCard: same size and shape, a large single-colour line icon
// centred on a brand-tinted tile (blue by default), title bottom-left like the photo
// tiles. The icon never changes, so the card is recognisable at a glance.
export function IconPhotoTile({
  to,
  title,
  subtitle,
  icon,
  tone = 'blue',
  variant = 'card',
}: {
  to: string
  title: string
  subtitle?: string
  icon: IconName
  tone?: 'blue' | 'orange'
  variant?: 'card' | 'tile'
}) {
  const tile = variant === 'tile'
  const colors =
    tone === 'orange'
      ? 'bg-brand-orange-50 text-brand-orange-dark ring-brand-orange/10'
      : 'bg-brand-blue-50 text-brand-blue ring-brand-blue/10'
  return (
    <Link to={to} className={`${shape(tile)} ring-1 ring-inset ${colors}`}>
      {/* icon: centred in the space above the label */}
      <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center ${tile ? 'pb-7' : 'pb-10'}`}>
        <Icon
          name={icon}
          size={64}
          className={`${tile ? 'h-[38%] w-[38%]' : 'h-[34%] w-[34%]'} transition duration-300 group-hover:scale-[1.06]`}
        />
      </span>
      <span className={`absolute inset-x-0 bottom-0 ${tile ? 'px-2.5 pb-2' : 'px-3 pb-2.5'}`}>
        <span className={`block font-display ${tile ? 'text-[13px]' : 'text-[15px]'} font-extrabold leading-tight text-ink`}>{title}</span>
        {subtitle && !tile && (
          <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-slate-500">{subtitle}</span>
        )}
      </span>
    </Link>
  )
}
