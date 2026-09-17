// The top-of-Home strip for My Bunny — a small reason to glance every day.
// Compact on purpose so BunFest and the quick actions still show above the
// fold. The layout follows how many (active) bunnies are on the phone:
//   0 / 1  photo (the user's own, or a rotating bundled sample), greeting by
//          name, next reminder / due badge, "Open" — the original strip
//   2      greeting line, then two side-by-side photo tiles (name + due pill)
//          that open each bunny directly
//   3+     "fluffle" greeting with the count, then a scrollable row of round
//          avatars (+ an Add tile while there's room)
// Archived bunnies never appear here. A one-line "Today's tip" from OHRR's
// care topics sits under every variant. Screens themselves are lazy-loaded.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { AvatarRow, BunnyPhoto, CountBadge, DuePill, titleTooltip } from './ui'
import { useBunnyPhoto } from './photos'
import {
  useMyBunny,
  dueCount,
  nextReminder,
  describeDue,
  dueStatus,
  todayIso,
  activeBunnies,
  atBunnyLimit,
  collectionTitle,
  type Bunny,
  type MyBunnyData,
} from './storage'
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

/** A different everyday-care topic each day — never the emergency ones. */
function tipOfTheDay(topics: CareTopic[]): CareTopic | null {
  const pool = topics.filter(
    (t) => t.is_published && (t.urgency === 'tip' || t.urgency === 'watch') && t.category !== 'health',
  )
  return pool.length ? pool[dayOfYear() % pool.length] : null
}

function remindersDueText(total: number): string {
  return `${total} reminder${total === 1 ? '' : 's'} due`
}

/** "Next: Nail trim · due in 5 days" across the given bunnies, or the all-clear. */
function nextUpText(data: MyBunnyData, bunnies: Bunny[], today: string): string {
  const next = bunnies
    .map((b) => nextReminder(data, b.id))
    .filter(Boolean)
    .sort((a, b) => (a!.nextDue < b!.nextDue ? -1 : 1))[0]
  return next ? `Next: ${next.title} · ${describeDue(next.nextDue, today).toLowerCase()}` : 'All caught up — nothing due'
}

const card =
  'rounded-3xl border border-brand-blue/15 bg-white p-3 shadow-sm transition hover:border-brand-blue/40 hover:shadow-md'
const label = 'text-[11px] font-extrabold uppercase tracking-wider text-brand-blue'
const openPill =
  'shrink-0 rounded-full bg-brand-orange px-3.5 py-2 text-[13px] font-extrabold text-white shadow-sm transition group-hover:bg-brand-orange-dark hover:bg-brand-orange-dark'

export default function MyBunnyHomeCard() {
  const data = useMyBunny()
  const { topics } = useCareTopics()
  const today = todayIso()
  const counts = dueCount(data, today)
  const bunnies = activeBunnies(data)
  const title = collectionTitle(bunnies.length)
  const tip = tipOfTheDay(topics)
  // The single-bunny strip shows that bunny's own photo when there is one.
  const one = bunnies.length === 1 ? bunnies[0] : undefined
  const onePhoto = useBunnyPhoto(one?.id, one?.hasPhoto)

  let body: ReactNode
  if (bunnies.length >= 3) {
    body = (
      <div className={card}>
        <Header title={title} counts={counts} />
        <p className="mt-0.5 line-clamp-2 font-display text-[17px] font-black leading-tight text-ink">
          {greeting()} — {bunnies.length} in your fluffle
          {counts.total > 0 ? ` · ${remindersDueText(counts.total)}` : ''}
        </p>
        <AvatarRow bunnies={bunnies} showAdd={!atBunnyLimit(data)} className="mt-2.5" />
      </div>
    )
  } else if (bunnies.length === 2) {
    body = (
      <div className={card}>
        <Header title={title} counts={counts} />
        <p className="mt-0.5 truncate font-display text-[17px] font-black leading-tight text-ink">
          {greeting()}, {bunnies[0].name} &amp; {bunnies[1].name}
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          {bunnies.map((b) => (
            <PairTile key={b.id} bunny={b} data={data} today={today} />
          ))}
        </div>
      </div>
    )
  } else {
    const hasBunny = Boolean(one)
    const photo = onePhoto ?? SAMPLE_PHOTOS[dayOfYear() % SAMPLE_PHOTOS.length]
    let headline: string
    let status: string
    let statusTone = 'text-slate-500'
    if (!one) {
      headline = 'Meet My Bunny'
      status = 'Reminders on your phone, a weight log & quick answers.'
    } else {
      headline = `${greeting()}, ${one.name}`
      if (counts.total > 0) {
        status = `${counts.total} reminder${counts.total === 1 ? '' : 's'} need${counts.total === 1 ? 's' : ''} attention`
        statusTone = 'text-brand-orange'
      } else {
        status = nextUpText(data, bunnies, today)
      }
    }
    body = (
      <Link
        to={hasBunny ? '/my-bunny' : '/my-bunny/new'}
        className={`group flex items-center gap-3.5 ${card} hover:-translate-y-0.5 active:translate-y-0`}
      >
        <img src={photo} alt={one ? one.name : ''} className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={label}>{title}</span>
            <CountBadge overdue={counts.overdue} today={counts.today} />
          </span>
          <span className="mt-0.5 block truncate font-display text-[17px] font-black leading-tight text-ink">
            {headline}
          </span>
          <span className={`mt-0.5 block text-[13px] leading-snug ${statusTone}`}>{status}</span>
        </span>
        <span className={openPill}>{hasBunny ? 'Open' : 'Add'}</span>
      </Link>
    )
  }

  return (
    <div className="space-y-2">
      {body}

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

/** Label + due badge on the left, "Open" on the right — the multi-bunny cards' top row. */
function Header({ title, counts }: { title: string; counts: { overdue: number; today: number } }) {
  return (
    <div className="flex items-center gap-2">
      <Link to="/my-bunny" className="flex min-w-0 flex-1 items-center gap-2" title={titleTooltip(title)}>
        <span className={label}>{title}</span>
        <CountBadge overdue={counts.overdue} today={counts.today} />
      </Link>
      <Link to="/my-bunny" className={openPill}>
        Open
      </Link>
    </div>
  )
}

/** One of the two side-by-side tiles: photo, name, and what's next for that bunny. */
function PairTile({ bunny, data, today }: { bunny: Bunny; data: MyBunnyData; today: string }) {
  const next = nextReminder(data, bunny.id)
  const status = next ? dueStatus(next.nextDue, today) : null
  const urgent = status === 'overdue' || status === 'today'
  return (
    <Link
      to={`/my-bunny/${bunny.id}`}
      className="group min-w-0 rounded-2xl transition hover:-translate-y-0.5 active:translate-y-0"
    >
      <BunnyPhoto bunny={bunny} className="aspect-[4/3] h-auto w-full rounded-2xl" />
      <span className="mt-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-display text-[15px] font-extrabold text-ink">{bunny.name}</span>
        {next && urgent && <DuePill nextDue={next.nextDue} today={today} />}
      </span>
      <span className="block truncate text-[12px] leading-snug text-slate-500">
        {next
          ? urgent
            ? next.title
            : `${next.title} · ${describeDue(next.nextDue, today).toLowerCase()}`
          : 'No reminders yet'}
      </span>
    </Link>
  )
}
