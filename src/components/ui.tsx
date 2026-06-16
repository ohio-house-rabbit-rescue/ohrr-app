import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './icons'
import { SAMPLE_DATA_NOTE } from '../data/content'

type Tone = 'blue' | 'orange'

/* ---- buttons (pill style, like the reference apps) ---- */
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-orange-dark active:scale-[.98]',
  blue: 'inline-flex items-center justify-center gap-2 rounded-full bg-brand-blue px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-blue-dark active:scale-[.98]',
  white:
    'inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-brand-blue shadow-sm transition hover:bg-brand-blue-50 active:scale-[.98]',
  outline:
    'inline-flex items-center justify-center gap-2 rounded-full border border-brand-orange/60 px-5 py-2.5 text-sm font-bold text-brand-orange transition hover:bg-brand-orange-50 active:scale-[.98]',
}

/* ---- layout ---- */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-5 ${className}`}>{children}</div>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">{children}</p>
  )
}

/* ---- in-app page header (compact blue band) ---- */
export function PageHeader({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle?: string
  icon?: IconName
}) {
  return (
    <div className="bg-gradient-to-b from-brand-blue to-brand-blue-dark px-5 pb-6 pt-5 text-white">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
            <Icon name={icon} size={20} />
          </span>
        )}
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/85">{subtitle}</p>}
    </div>
  )
}

/* ---- cards ---- */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function IconTile({
  name,
  tone = 'blue',
  className = '',
}: {
  name: IconName
  tone?: Tone
  className?: string
}) {
  const tones: Record<Tone, string> = {
    blue: 'bg-brand-blue-50 text-brand-blue',
    orange: 'bg-brand-orange-50 text-brand-orange',
  }
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]} ${className}`}
    >
      <Icon name={name} size={22} />
    </span>
  )
}

/* tappable navigation card with icon tile + chevron */
export function ActionCard({
  to,
  title,
  subtitle,
  icon,
  tone = 'blue',
}: {
  to: string
  title: string
  subtitle: string
  icon: IconName
  tone?: Tone
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      <IconTile name={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
    </Link>
  )
}

/* outbound link card (opens an OHRR/BunFest web page) */
export function ExternalCard({
  href,
  title,
  description,
  icon,
  tone = 'blue',
}: {
  href: string
  title: string
  description: string
  icon: IconName
  tone?: Tone
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <IconTile name={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
      </span>
      <Icon name="external" size={16} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
    </a>
  )
}

/* ---- badges ---- */
export function Badge({
  children,
  tone = 'blue',
}: {
  children: ReactNode
  tone?: Tone | 'slate'
}) {
  const tones = {
    blue: 'bg-brand-blue-50 text-brand-blue',
    orange: 'bg-brand-orange-50 text-brand-orange',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/* ---- segmented control (filter pills) ---- */
export function SegTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={[
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition',
              active
                ? 'bg-brand-blue text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
            ].join(' ')}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/* ---- sample-data honesty note ---- */
export function SampleNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
      <span aria-hidden className="mt-0.5">ℹ️</span>
      <p>
        <strong className="font-bold">Heads up:</strong> {children ?? SAMPLE_DATA_NOTE}
      </p>
    </div>
  )
}
