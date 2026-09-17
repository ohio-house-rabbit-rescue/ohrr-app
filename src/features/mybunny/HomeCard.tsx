// The top-of-Home strip for My Bunny: photo (the user's own, or a rotating
// bundled sample until they add one), a greeting by name, the next reminder or
// due badge, and a one-line daily tip drawn from OHRR's care topics — a small
// reason to glance every day. Compact on purpose so BunFest and the quick
// actions still show above the fold. Screens themselves are lazy-loaded.
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { CountBadge } from './ui'
import { useBunnyPhoto } from './photos'
import { useMyBunny, dueCount, nextReminder, describeDue, todayIso, activeBunnies, collectionTitle } from './storage'
import { useCareTopics } from '../bunnyhelp/useTopics'
import type { CareTopic } from '../bunnyhelp/types'

const SAMPLE_PHOTOS = [
  '/sample-bunnies/bunny-lop-caramel.jpg',
  '/sample-bunnies/bunny-grey-lop.jpg',
  '/sample-bunnies/bunny-lionhead-white.jpg',
  '/sample-bunnies/bunny-spotted.jpg',
  '/sample-bunnies/bunny-brown.jpg',
  '/sample-bunnies/bunny-silver.jpg',
]

function dayOfYear(d = new Date()): number {
  const start = Date.UTC(d.getFullYear(), 0, 0)
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86_400_000)
}

function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(' & ')
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`
}

/** A different everyday-care topic each day — never the emergency ones. */
function tipOfTheDay(topics: CareTopic[]): CareTopic | null {
  const pool = topics.filter(
    (t) => t.is_published && (t.urgency === 'tip' || t.urgency === 'watch') && t.category !== 'health',
  )
  return pool.length ? pool[dayOfYear() % pool.length] : null
}

export default function MyBunnyHomeCard() {
  const data = useMyBunny()
  const { topics } = useCareTopics()
  const today = todayIso()
  const counts = dueCount(data, today)
  const bunnies = activeBunnies(data)
  const hasBunny = bunnies.length > 0
  const tip = tipOfTheDay(topics)
  const first = bunnies.find((b) => b.hasPhoto)
  const ownPhoto = useBunnyPhoto(first?.id, first?.hasPhoto)
  const photo = ownPhoto ?? SAMPLE_PHOTOS[dayOfYear() % SAMPLE_PHOTOS.length]

  let headline: string
  let status: string
  let statusTone = 'text-slate-500'
  if (!hasBunny) {
    headline = 'Meet My Bunny'
    status = 'Reminders on your phone, a weight log & quick answers.'
  } else {
    headline = `${greeting()}, ${nameList(bunnies.map((b) => b.name))}`
    if (counts.total > 0) {
      status = `${counts.total} reminder${counts.total === 1 ? '' : 's'} need${counts.total === 1 ? 's' : ''} attention`
      statusTone = 'text-brand-orange'
    } else {
      const next = bunnies
        .map((b) => nextReminder(data, b.id))
        .filter(Boolean)
        .sort((a, b) => (a!.nextDue < b!.nextDue ? -1 : 1))[0]
      status = next
        ? `Next: ${next.title} · ${describeDue(next.nextDue, today).toLowerCase()}`
        : 'All caught up — nothing due'
    }
  }

  return (
    <div className="space-y-2">
      <Link
        to={hasBunny ? '/my-bunny' : '/my-bunny/new'}
        className="group flex items-center gap-3.5 rounded-3xl border border-brand-blue/15 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md active:translate-y-0"
      >
        <img
          src={photo}
          alt={hasBunny ? bunnies[0].name : ''}
          className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-blue">
              {collectionTitle(bunnies.length)}
            </span>
            <CountBadge overdue={counts.overdue} today={counts.today} />
          </span>
          <span className="mt-0.5 block truncate font-display text-[17px] font-black leading-tight text-ink">
            {headline}
          </span>
          <span className={`mt-0.5 block text-[13px] leading-snug ${statusTone}`}>{status}</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand-orange px-3.5 py-2 text-[13px] font-extrabold text-white shadow-sm transition group-hover:bg-brand-orange-dark">
          {hasBunny ? 'Open' : 'Add'}
        </span>
      </Link>

      {tip && (
        <Link
          to={`/my-bunny/help/${tip.slug}`}
          className="group flex items-center gap-2.5 rounded-2xl bg-brand-blue-50/60 px-3.5 py-2.5 transition hover:bg-brand-blue-50"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-ink">
            <span className="font-extrabold text-brand-blue">Today's tip · </span>
            <span className="font-semibold">{tip.title}</span>
          </span>
          <Icon name="chevron" size={16} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
        </Link>
      )}
    </div>
  )
}
