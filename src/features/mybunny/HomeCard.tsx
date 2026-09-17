// The Home-screen entry to My Bunny. Lives in the main bundle (it's tiny) so
// the due/overdue badge is visible the moment the app opens; the screens
// themselves are lazy-loaded from routes.tsx.
import { Link } from 'react-router-dom'
import { SectionLabel, IconTile } from '../../components/ui'
import { Icon } from '../../components/icons'
import { BunnyAvatar, CountBadge } from './ui'
import { useMyBunny, dueCount, nextReminder, describeDue, todayIso } from './storage'

export default function MyBunnyHomeCard() {
  const data = useMyBunny()
  const today = todayIso()
  const counts = dueCount(data, today)
  const bunnies = data.bunnies

  let subtitle: string
  if (bunnies.length === 0) {
    subtitle = 'Care reminders, a weight log & a profile for your own rabbit'
  } else if (counts.total > 0) {
    subtitle = `${counts.total} reminder${counts.total === 1 ? '' : 's'} need${counts.total === 1 ? 's' : ''} attention`
  } else {
    const names = bunnies.map((b) => b.name).join(', ')
    const next = bunnies.map((b) => nextReminder(data, b.id)).filter(Boolean).sort((a, b) => (a!.nextDue < b!.nextDue ? -1 : 1))[0]
    subtitle = next ? `${names} · next: ${next.title}, ${describeDue(next.nextDue, today).toLowerCase()}` : `${names} · all caught up`
  }

  return (
    <div className="space-y-2.5">
      <SectionLabel>Your bunny</SectionLabel>
      <Link
        to="/my-bunny"
        className="group flex items-center gap-4 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/40 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md active:translate-y-0"
      >
        {bunnies.length > 0 ? (
          <span className="flex shrink-0 -space-x-3">
            {bunnies.slice(0, 3).map((b) => (
              <BunnyAvatar key={b.id} bunny={b} size={44} />
            ))}
          </span>
        ) : (
          <IconTile name="heart" tone="orange" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-[15px] font-extrabold text-ink">My Bunny</span>
            <CountBadge overdue={counts.overdue} today={counts.today} />
          </span>
          <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
        </span>
        <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
      </Link>
    </div>
  )
}
