// The pieces a staff job is built from, taken from the Receive items redesign
// (OHRR 2026-10-27) so every job in the staff section reads the same way:
//
//   - StepRows / StepRow: where a job starts, its steps listed in order, each
//     with its own buttons ("I see step one and I see step two, but what I
//     don't see is 3, 4, and 5").
//   - WorkingOn: the bar at the top of a screen that says what you're working
//     on right now (the donor, the box, the call, this year's BunFest), with
//     Change.
//   - Part / PartBadge: the lettered heading over each part of one step —
//     lettered so it never reads as the job's own step number ("under number
//     one being received, then it would be subset ABCDE").
//   - StepButton and pill: full-size buttons for the actions on a card. Text
//     links and 28px pills are hard to hit on a phone.
//   - NotOnYet: the one plain line shown when a database update hasn't been
//     run. Volunteers never need to see an update number.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './icons'

/* ------------------------------------------------------------- the steps */

/** The steps of a job, listed where it starts. */
export function StepRows({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <ol className={`divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white ${className}`} aria-label={label}>
      {children}
    </ol>
  )
}

/** One step, with its buttons beside it. `done` greys the number once the step is behind you. */
export function StepRow({ n, name, hint, done = false, children }: { n: number; name: string; hint?: string; done?: boolean; children?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span
        className={`mt-2.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${done ? 'bg-green-600 text-white' : 'bg-brand-blue text-white'}`}
        aria-label={done ? `Step ${n}, done` : `Step ${n}`}
      >
        {done ? <Icon name="check" size={14} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="pt-2.5 text-[15px] font-extrabold leading-none text-ink">
          {name}
          {hint && <span className="ml-2 text-sm font-semibold text-slate-500">{hint}</span>}
        </p>
        {children && <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </li>
  )
}

type StepTone = 'orange' | 'outline' | 'blue'
const stepTones: Record<StepTone, string> = {
  orange: 'bg-brand-orange text-ink shadow-sm hover:bg-brand-orange-dark',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300',
  blue: 'bg-brand-blue text-white shadow-sm hover:bg-brand-blue-dark',
}

/** A button in a step row: a link (`to`) or an action (`onClick`). Orange is the one to tap first. */
export function StepButton({
  to,
  onClick,
  icon,
  tone = 'outline',
  count,
  disabled = false,
  children,
  className = '',
}: {
  to?: string
  onClick?: () => void
  icon?: IconName
  tone?: StepTone
  /** "(3)" after the words, e.g. how many are waiting. Hidden when 0 or undefined. */
  count?: number
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  const cls = `inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold transition active:scale-[.98] disabled:opacity-40 ${stepTones[tone]} ${tone === 'orange' ? 'px-4 font-extrabold' : ''} ${className}`
  const body = (
    <>
      {icon && <Icon name={icon} size={tone === 'orange' ? 18 : 17} />}
      {children}
      {count ? <span className="opacity-80">({count})</span> : null}
    </>
  )
  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  )
}

/* ----------------------------------------------------------- working on */

/**
 * "Receiving from Jane Smith · item 3 of this drop-off · Change". One bar at
 * the top of every screen in a batch, so nobody wonders which donor, box or
 * call they're still on. Orange for the thing being received or sold, blue
 * for the thing being set up (a call, a year).
 */
export function WorkingOn({
  icon,
  label,
  name,
  line,
  tone = 'orange',
  onChange,
  changeTo,
  changeLabel = 'Change',
}: {
  icon: IconName
  /** Small words over the name: "Receiving from", "Filling", "Working on". */
  label: string
  name: ReactNode
  /** Under the name: "3 items so far", "Sunday, October 25 · 8 of 12 places filled". */
  line?: ReactNode
  tone?: 'orange' | 'blue'
  onChange?: () => void
  /** A page to go to instead of a handler. */
  changeTo?: string
  changeLabel?: string
}) {
  const box = tone === 'orange' ? 'border-brand-orange/50 bg-brand-orange-50' : 'border-brand-blue/40 bg-brand-blue-50'
  const ink = tone === 'orange' ? 'text-brand-orange' : 'text-brand-blue'
  const change = 'min-h-[44px] shrink-0 px-1 text-[15px] font-bold text-brand-blue'
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${box}`}>
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ${ink}`}>
        <Icon name={icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
        <span className="block truncate font-display text-lg font-black leading-tight text-ink">{name}</span>
        {line && <span className="block text-sm text-slate-600">{line}</span>}
      </span>
      {changeTo ? (
        <Link to={changeTo} className={change}>
          {changeLabel}
        </Link>
      ) : onChange ? (
        <button type="button" onClick={onChange} className={change}>
          {changeLabel}
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------- lettered parts */

/** The letter over each part of a step: A, B, C … */
export const PartBadge = ({ n }: { n: string }) => (
  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-brand-blue font-display text-sm font-black text-brand-blue">
    {n}
  </span>
)

/** The heading over one lettered part of a step. `hint`: "needed", "optional", "if you know". */
export const Part = ({ n, children, hint }: { n: string; children: string; hint?: string }) => (
  <p className="flex items-center gap-2 border-b border-slate-200 pb-1 font-display text-base font-black uppercase tracking-wide text-slate-500">
    <PartBadge n={n} />
    {children}
    {hint && <span className="font-sans text-sm font-bold normal-case tracking-normal text-slate-400">{hint}</span>}
  </p>
)

/** "needed" / "optional" after a field's label. */
export const Needed = () => <span className="ml-1.5 text-xs font-bold text-brand-orange">needed</span>
export const Optional = () => <span className="ml-1.5 text-xs font-semibold text-slate-400">optional</span>

/* -------------------------------------------------------- card actions */

/**
 * The buttons on a list card (Edit, Hide, Remove …): 40px tall, 15px words.
 * `red` is for taking something away, and should ask first.
 */
export const pill = {
  blue: 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-brand-blue px-4 text-[15px] font-bold text-white transition hover:bg-brand-blue-dark active:scale-[.98] disabled:opacity-40',
  orange: 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 text-[15px] font-extrabold text-ink transition hover:bg-brand-orange-dark active:scale-[.98] disabled:opacity-40',
  outline: 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-[15px] font-bold text-slate-700 transition hover:border-slate-400 active:scale-[.98] disabled:opacity-40',
  soft: 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-brand-blue-50 px-4 text-[15px] font-bold text-brand-blue transition hover:bg-brand-blue/15 active:scale-[.98] disabled:opacity-40',
  red: 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-[15px] font-bold text-red-700 transition hover:bg-red-50 active:scale-[.98] disabled:opacity-40',
  green: 'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-green-600 px-4 text-[15px] font-bold text-white transition hover:bg-green-700 active:scale-[.98] disabled:opacity-40',
}

/** The row of pills under a card. */
export function CardActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}

/* ------------------------------------------------------------ the editor */

/**
 * The form every content page shares (a rabbit, a guide, a vet, a sponsor, a
 * notice …): a short title, the lettered parts as children, and Save / Cancel
 * always at the bottom in the same place. `remove` adds a red "Remove" that
 * asks first.
 */
export function EditorForm({
  title,
  hint,
  onSubmit,
  onCancel,
  busy = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  canSave = true,
  error,
  remove,
  children,
}: {
  title: string
  /** One line under the title: what saving does, or what's needed. */
  hint?: ReactNode
  onSubmit: () => void | Promise<void>
  onCancel?: () => void
  busy?: boolean
  saveLabel?: string
  cancelLabel?: string
  canSave?: boolean
  error?: ReactNode
  /** "Remove this rabbit" — shown as a red pill that asks first. */
  remove?: { label: string; confirm: string; onRemove: () => void | Promise<void> }
  children: ReactNode
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void onSubmit()
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div>
        <p className="font-display text-xl font-black leading-tight text-ink">{title}</p>
        {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
      </div>
      {children}
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={busy || !canSave}
          className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-brand-orange px-5 font-display text-base font-extrabold text-ink shadow-sm transition hover:bg-brand-orange-dark active:scale-[.98] disabled:opacity-50"
        >
          {busy ? 'Saving…' : saveLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 text-base font-bold text-slate-700 disabled:opacity-50">
            {cancelLabel}
          </button>
        )}
        {remove && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(remove.confirm)) void remove.onRemove()
            }}
            className={`${pill.red} ml-auto`}
          >
            <Icon name="trash" size={16} /> {remove.label}
          </button>
        )}
      </div>
    </form>
  )
}

/** A short field label with its needed/optional mark, for inside an EditorForm part. */
export function Field({ label, needed = false, hint, children }: { label: string; needed?: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {needed ? <Needed /> : <Optional />}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  )
}

/* ------------------------------------------------------------- not yet */

/**
 * Shown instead of a feature whose database update hasn't been run. The
 * update number is kept for whoever runs it, out of the way in `title`.
 */
export function NotOnYet({ what, update, children }: { what: string; update?: number; children?: ReactNode }) {
  return (
    <p
      title={update ? `Needs database update ${update} (RUN-THIS-IN-SUPABASE.sql)` : undefined}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-600"
    >
      {what} isn’t switched on yet — ask an admin. {children}
    </p>
  )
}
