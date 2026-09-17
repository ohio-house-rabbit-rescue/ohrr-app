// A raffle item's own photo. With no photo (or if the image fails to load) it
// shows a neutral block carrying the item's initial — real photos only, no
// stand-in illustrations.
import { useState } from 'react'
import { itemInitial } from './types'

export function RafflePhoto({
  title,
  photo,
  className = '',
  initialClassName = 'text-4xl',
}: {
  title: string
  photo?: string | null
  className?: string
  initialClassName?: string
}) {
  const [failed, setFailed] = useState(false)

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-slate-100 ${className}`}
      role="img"
      aria-label={`${title} (no photo yet)`}
    >
      <span
        className={`font-display font-black leading-none text-slate-300 ${initialClassName}`}
        aria-hidden
      >
        {itemInitial(title)}
      </span>
    </div>
  )
}
