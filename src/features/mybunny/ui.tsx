// Shared building blocks for the My Bunny screens. Reuses the app's primitives
// (Card, btn, Badge …) and adds the few things this feature needs: a photo /
// initial avatar, due-status pills, the emergency card, the weight trend line,
// and a couple of form helpers.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { MbIcon } from './icons'
import { EMERGENCY_VET, VET_DIRECTORY } from './links'
import {
  dueStatus,
  describeDue,
  formatDate,
  formatWeight,
  todayIso,
  useSaveError,
  type Bunny,
  type DueStatus,
  type WeightEntry,
  type WeightUnit,
} from './storage'

export const mbInput =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export const VET_NOTE = 'Typical starting points — confirm what’s right for your bunny with your vet.'

/* ---------------------------------------------------------------- avatar */

/**
 * The rabbit's own photo, or — with no photo — a neutral circle carrying the
 * rabbit's initial. Deliberately no cartoon / emoji placeholder.
 */
export function BunnyAvatar({
  bunny,
  size = 56,
  className = '',
}: {
  bunny: Pick<Bunny, 'name' | 'photoDataUrl'>
  size?: number
  className?: string
}) {
  const style = { width: size, height: size }
  if (bunny.photoDataUrl) {
    return (
      <img
        src={bunny.photoDataUrl}
        alt={bunny.name}
        style={style}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm ${className}`}
      />
    )
  }
  const initial = (bunny.name.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      role="img"
      aria-label={`${bunny.name} (no photo yet)`}
      style={{ ...style, fontSize: Math.round(size * 0.42) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-display font-black text-slate-600 ring-2 ring-white shadow-sm ${className}`}
    >
      {initial}
    </span>
  )
}

/* ------------------------------------------------------------- due pills */

const dueTone: Record<DueStatus, string> = {
  overdue: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  today: 'bg-brand-orange-50 text-brand-orange ring-1 ring-brand-orange/30',
  soon: 'bg-brand-blue-50 text-brand-blue',
  later: 'bg-slate-100 text-slate-600',
}

export const dueText: Record<DueStatus, string> = {
  overdue: 'text-red-700',
  today: 'text-brand-orange',
  soon: 'text-brand-blue',
  later: 'text-slate-500',
}

export function DuePill({ nextDue, today = todayIso() }: { nextDue: string; today?: string }) {
  const s = dueStatus(nextDue, today)
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${dueTone[s]}`}
    >
      {describeDue(nextDue, today)}
    </span>
  )
}

/** Small red/orange count badge, e.g. on the Home card. */
export function CountBadge({ overdue, today }: { overdue: number; today: number }) {
  const total = overdue + today
  if (total === 0) return null
  const tone = overdue > 0 ? 'bg-red-600 text-white' : 'bg-brand-orange text-white'
  return (
    <span
      className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none ${tone}`}
      aria-label={`${total} reminder${total === 1 ? '' : 's'} due`}
    >
      {total} due
    </span>
  )
}

/* ------------------------------------------------------------ emergency */

const WARNING_SIGNS = [
  'Not eating, or no poops, for around 12 hours',
  'Lethargy, or hiding more than usual',
  'Laboured or open-mouth breathing',
  'Head tilt',
  'Bleeding',
  'Unable to move',
]

/** "Is this an emergency?" — warning signs, tap-to-call, and the vet directory. */
export function EmergencyCard() {
  return (
    <Card className="border-red-200 bg-red-50/60">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <MbIcon name="alert" size={20} />
        </span>
        <h2 className="font-display text-[15px] font-extrabold text-ink">Is this an emergency?</h2>
      </div>
      <ul className="mt-3 space-y-1.5">
        {WARNING_SIGNS.map((s) => (
          <li key={s} className="flex items-start gap-2 text-sm text-slate-700">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-bold leading-relaxed text-red-800">
        These can be life-threatening for rabbits; call a rabbit-savvy vet right away.
      </p>

      <a
        href={EMERGENCY_VET.phoneHref}
        className={`${btn.primary} mt-3 w-full bg-red-600 hover:bg-red-700`}
      >
        <Icon name="phone" size={16} /> Call {EMERGENCY_VET.name} · {EMERGENCY_VET.phone}
      </a>
      <p className="mt-1.5 text-center text-xs text-slate-500">
        {EMERGENCY_VET.note} · after-hours option
      </p>

      <VetDirectoryLink className="mt-3 w-full" label="Find a rabbit-savvy vet" />

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        This is general guidance, not a diagnosis — confirm with your vet.
      </p>
    </Card>
  )
}

/** Vet directory — in-app route when the app has one, OHRR's website otherwise. */
export function VetDirectoryLink({ className = '', label }: { className?: string; label: string }) {
  if (VET_DIRECTORY.to) {
    return (
      <Link to={VET_DIRECTORY.to} className={`${btn.outline} ${className}`}>
        {label} <Icon name="chevron" size={14} />
      </Link>
    )
  }
  return (
    <a
      href={VET_DIRECTORY.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${btn.outline} ${className}`}
    >
      {label} <Icon name="external" size={14} />
    </a>
  )
}

/* ------------------------------------------------------------ weight chart */

/**
 * Inline SVG trend line for the last 12 weight entries. Scales to the card
 * width via viewBox; labels the first/last dates and the min/max values.
 */
export function WeightChart({ entries, unit }: { entries: WeightEntry[]; unit: WeightUnit }) {
  const pts = entries.slice(-12)
  if (pts.length < 2) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
        Log a second weight to see the trend line.
      </p>
    )
  }
  const W = 320
  const H = 110
  const padX = 8
  const padTop = 14
  const padBottom = 22
  const values = pts.map((p) => p.grams)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max === min) {
    min -= 50
    max += 50
  }
  const span = max - min
  const x = (i: number) => padX + (i * (W - padX * 2)) / (pts.length - 1)
  const y = (g: number) => padTop + ((max - g) / span) * (H - padTop - padBottom)
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.grams).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const today = todayIso()

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Weight trend: ${pts.length} entries from ${formatDate(first.date, today)} to ${formatDate(last.date, today)}, ${formatWeight(min, unit)} to ${formatWeight(max, unit)}`}
    >
      {/* gridlines at min / max */}
      <line x1={padX} x2={W - padX} y1={y(max)} y2={y(max)} stroke="#e2e8f0" strokeDasharray="3 3" />
      <line x1={padX} x2={W - padX} y1={y(min)} y2={y(min)} stroke="#e2e8f0" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="#0669ac" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle
          key={p.date}
          cx={x(i)}
          cy={y(p.grams)}
          r={i === pts.length - 1 ? 4 : 2.5}
          fill={i === pts.length - 1 ? '#eb891c' : '#0669ac'}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}
      <text x={padX} y={y(max) - 4} fontSize={9} fill="#94a3b8">
        {formatWeight(max, unit)}
      </text>
      <text x={padX} y={y(min) + 10} fontSize={9} fill="#94a3b8">
        {formatWeight(min, unit)}
      </text>
      <text x={padX} y={H - 6} fontSize={9} fill="#64748b">
        {formatDate(first.date, today)}
      </text>
      <text x={W - padX} y={H - 6} fontSize={9} fill="#64748b" textAnchor="end">
        {formatDate(last.date, today)}
      </text>
    </svg>
  )
}

/* ----------------------------------------------------------- form bits */

export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string
  hint?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {optional && <span className="ml-1 text-xs font-semibold text-slate-400">(optional)</span>}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-400">{hint}</span>}
    </label>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
    >
      <Icon name="arrowLeft" size={16} /> {label}
    </Link>
  )
}

/** Sentence that appears wherever a "typical" care interval is suggested. */
export function VetNote({ className = '' }: { className?: string }) {
  return <p className={`text-xs leading-relaxed text-slate-500 ${className}`}>{VET_NOTE}</p>
}

/** The one-line privacy promise, with a lock icon. */
export function PrivacyLine({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-xs leading-relaxed text-slate-500 ${className}`}>
      <MbIcon name="lock" size={14} className="mt-0.5 shrink-0 text-slate-400" />
      <span>
        Everything in My Bunny stays on this phone — nothing is uploaded or shared. Use Backup to
        keep a copy.
      </span>
    </p>
  )
}

/** Amber note when the phone refused to persist the last change. */
export function SaveWarning() {
  const err = useSaveError()
  if (!err) return null
  return (
    <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
      <MbIcon name="alert" size={16} className="mt-0.5 shrink-0" />
      <p>{err}</p>
    </div>
  )
}

/** Hint shown under every "Add to calendar" button. */
export function CalendarHint({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-slate-400 ${className}`}>
      Downloads a calendar (.ics) file — on iPhone, tap it to add to Calendar; on Android it opens
      your calendar app. Once added, your phone alerts you even if you never open this app.
    </p>
  )
}
