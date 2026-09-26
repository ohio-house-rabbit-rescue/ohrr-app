// "New for you" — a small card on Home (and at the top of My OHRR) listing
// what's new since they last looked, for the things they ticked. Renders
// nothing at all when there's nothing new. Tapping a line opens that page and
// counts as having looked; "Seen them" clears the lot.
import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { markSeen, useForYou } from './forYouCounts'

export default function ForYou({ className = '' }: { className?: string }) {
  const { items } = useForYou()
  if (items.length === 0) return null
  return (
    <section aria-label="New for you" className={`rounded-2xl border border-brand-blue/25 bg-brand-blue-50/60 px-3.5 py-1 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[15px] font-extrabold text-ink">New for you</p>
        <button
          type="button"
          onClick={() => markSeen(...items.map((i) => i.key))}
          className="-mr-2 min-h-[44px] px-2 text-xs font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          Seen them
        </button>
      </div>
      <ul className="divide-y divide-brand-blue/10 border-t border-brand-blue/10">
        {items.map((i) => (
          <li key={i.key}>
            <Link
              to={i.to}
              onClick={() => markSeen(i.key)}
              className="flex min-h-[44px] items-center gap-2.5 py-1.5 text-sm font-semibold text-ink transition hover:text-brand-blue"
            >
              <Icon name={i.icon} size={18} className="shrink-0 text-brand-blue" />
              <span className="min-w-0 flex-1">{i.label}</span>
              <Icon name="chevron" size={16} className="shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
