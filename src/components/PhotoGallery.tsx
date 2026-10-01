// An item's photos, in the order staff set them (the first is the cover).
// One photo shows as a plain image; two to four become a swipeable strip with
// a "2 of 4" counter, Previous / Next buttons and a row of thumbnails to jump
// to any one. Used where one item is opened: the auction item page, the staff
// item card, a Hop Shop product. Lists keep showing the cover only.
import { useRef, useState } from 'react'
import { Icon } from './icons'

/** An item's photos, cover first: photo_urls, else the single photo_url. */
export function photoList(item: { photo_url?: string | null; photo_urls?: string[] | null }): string[] {
  const list = (item.photo_urls ?? []).filter(Boolean)
  if (list.length) return list.slice(0, 4)
  return item.photo_url ? [item.photo_url] : []
}

export default function PhotoGallery({
  photos,
  alt,
  frameClassName = 'aspect-[4/3]',
  imgClassName = '',
  thumbs = true,
}: {
  photos: string[]
  alt: string
  /** Size of the photo area (the default is the item pages' 4:3). */
  frameClassName?: string
  imgClassName?: string
  /** Show the thumbnail row under the photo (2+ photos). */
  thumbs?: boolean
}) {
  const strip = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  if (photos.length === 0) return null
  if (photos.length === 1) {
    return (
      <div className={`w-full overflow-hidden bg-slate-100 ${frameClassName}`}>
        <img src={photos[0]} alt={alt} className={`h-full w-full object-cover ${imgClassName}`} />
      </div>
    )
  }

  const go = (i: number) => {
    const el = strip.current
    if (!el) return
    const n = Math.max(0, Math.min(photos.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
    setIndex(n)
  }

  return (
    <div>
      <div className={`relative w-full overflow-hidden bg-slate-100 ${frameClassName}`}>
        <div
          ref={strip}
          onScroll={(e) => {
            const el = e.currentTarget
            if (el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth))
          }}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={`${alt}: ${photos.length} photos`}
        >
          {photos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${alt}, photo ${i + 1} of ${photos.length}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={`h-full w-full shrink-0 snap-center object-cover ${imgClassName}`}
            />
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-bold text-white">
          {index + 1} of {photos.length}
        </span>
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow disabled:opacity-0"
        >
          <Icon name="chevron" size={22} className="rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === photos.length - 1}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow disabled:opacity-0"
        >
          <Icon name="chevron" size={22} />
        </button>
      </div>
      {thumbs && (
        <div className="flex gap-2 px-4 pt-3" role="group" aria-label="All the photos">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => go(i)}
              aria-label={`Photo ${i + 1} of ${photos.length}`}
              aria-current={i === index}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ${i === index ? 'ring-2 ring-brand-blue ring-offset-2' : 'opacity-80'}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
