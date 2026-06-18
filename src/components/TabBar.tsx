import { NavLink } from 'react-router-dom'
import type { TabItem } from '../data/content'
import { Icon } from './icons'

export default function TabBar({ tabs }: { tabs: TabItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-stretch justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 ${
            t.divider ? 'border-r border-slate-200' : ''
          }`}
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? 'text-brand-blue' : 'text-slate-400'}>
                <Icon name={t.icon} size={23} />
              </span>
              <span
                className={`text-[10px] font-bold ${isActive ? 'text-brand-blue' : 'text-slate-400'}`}
              >
                {t.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
