// Building blocks for the scan flow, sized for someone who finds ordinary
// forms hard: one question per screen, 60px+ targets, plain words, the main
// button always in the same place at the bottom, Back always top-left.
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../components/icons'
import { KIND_META, formatMoney, statusLabel, type TaggedItem } from './types'

type BigTone = 'orange' | 'blue' | 'outline' | 'plain' | 'danger'

const bigTones: Record<BigTone, string> = {
  orange: 'bg-brand-orange text-white shadow-sm hover:bg-brand-orange-dark',
  blue: 'bg-brand-blue text-white shadow-sm hover:bg-brand-blue-dark',
  outline: 'border-2 border-brand-blue/50 bg-white text-brand-blue hover:bg-brand-blue-50',
  plain: 'bg-slate-100 text-ink hover:bg-slate-200',
  danger: 'border-2 border-red-200 bg-white text-red-700 hover:bg-red-50',
}

export function BigButton({
  children,
  onClick,
  tone = 'orange',
  icon,
  disabled = false,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  tone?: BigTone
  icon?: IconName
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3 font-display text-lg font-extrabold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${bigTones[tone]} ${className}`}
    >
      {icon && <Icon name={icon} size={22} />}
      {children}
    </button>
  )
}

/** Header + body + sticky footer. `step`/`of` show "Step 2 of 5" and the dots. */
export function StepShell({
  title,
  help,
  step,
  of,
  onBack,
  backLabel = 'Back',
  children,
  footer,
}: {
  title: string
  help?: string
  step?: number
  of?: number
  onBack?: () => void
  backLabel?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="px-5 pt-3">
        <div className="flex min-h-[44px] items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-base font-bold text-brand-blue hover:bg-brand-blue-50"
            >
              <Icon name="arrowLeft" size={20} /> {backLabel}
            </button>
          ) : (
            <span />
          )}
          {step && of ? (
            <span className="flex items-center gap-2 text-sm font-bold text-slate-500" aria-label={`Step ${step} of ${of}`}>
              Step {step} of {of}
              <span className="flex gap-1" aria-hidden="true">
                {Array.from({ length: of }, (_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${i < step ? 'bg-brand-orange' : 'bg-slate-200'}`} />
                ))}
              </span>
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 font-display text-[26px] font-black leading-tight text-ink">{title}</h1>
        {help && <p className="mt-1.5 text-base leading-snug text-slate-600">{help}</p>}
      </div>
      <div className="flex-1 px-5 pb-6 pt-5">{children}</div>
      {footer && (
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  )
}

/** One of the three "What is it?" choices. */
export function KindTile({
  kind,
  selected,
  onSelect,
}: {
  kind: keyof typeof KIND_META
  selected: boolean
  onSelect: () => void
}) {
  const m = KIND_META[kind]
  const tile = m.tone === 'orange' ? 'bg-brand-orange-50 text-brand-orange' : 'bg-brand-blue-50 text-brand-blue'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition active:scale-[.99] ${
        selected ? 'border-brand-orange shadow-md' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <span className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${tile}`}>
        <Icon name={m.icon} size={32} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-extrabold text-ink">{m.label}</span>
        <span className="mt-0.5 block text-[15px] leading-snug text-slate-600">{m.hint}</span>
      </span>
      {selected && (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white">
          <Icon name="check" size={18} />
        </span>
      )}
    </button>
  )
}

/** The item as one card: photo, name, what it is, where it stands. */
export function ItemCard({ item, big = false }: { item: TaggedItem; big?: boolean }) {
  const m = KIND_META[item.kind]
  const tile = m.tone === 'orange' ? 'bg-brand-orange-50 text-brand-orange' : 'bg-brand-blue-50 text-brand-blue'
  const money = item.kind === 'stock' ? formatMoney(item.price_cents) : formatMoney(item.value_cents)
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {item.photo_url ? (
        <img src={item.photo_url} alt="" className={`w-full object-cover ${big ? 'h-56' : 'h-40'}`} />
      ) : (
        <div className={`flex items-center justify-center ${big ? 'h-40' : 'h-28'} ${tile}`}>
          <Icon name={m.icon} size={48} />
        </div>
      )}
      <div className="space-y-2 p-4">
        <p className="font-display text-[22px] font-black leading-tight text-ink">{item.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-slate-600">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${tile}`}>
            <Icon name={m.icon} size={15} /> {m.label}
          </span>
          <span className="font-semibold">{statusLabel(item)}</span>
        </p>
        {(item.donated_by || money) && (
          <p className="text-[15px] text-slate-600">
            {item.donated_by && <span>From {item.donated_by}</span>}
            {item.donated_by && money && <span> · </span>}
            {money && <span>{item.kind === 'stock' ? `${money} each` : `Worth ${money}`}</span>}
          </p>
        )}
        <p className="font-mono text-sm font-bold tracking-widest text-slate-400">{item.code}</p>
      </div>
    </div>
  )
}

/** Big text input for one answer. */
export function BigInput({
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus,
  ariaLabel,
  mono = false,
  onEnter,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  autoFocus?: boolean
  ariaLabel: string
  mono?: boolean
  onEnter?: () => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault()
          onEnter()
        }
      }}
      placeholder={placeholder}
      inputMode={inputMode}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      autoComplete="off"
      autoCapitalize={mono ? 'characters' : 'sentences'}
      enterKeyHint={onEnter ? 'next' : 'done'}
      className={`w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-xl text-ink outline-none transition placeholder:text-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15 ${mono ? 'font-mono uppercase tracking-[0.2em]' : ''}`}
    />
  )
}

/** "$ [ 25 ]" — dollars, numeric keypad. */
export function MoneyInput({
  value,
  onChange,
  ariaLabel,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  autoFocus?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 transition focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/15">
      <span className="font-display text-2xl font-black text-slate-400">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder="0"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoComplete="off"
        className="w-full bg-transparent py-4 text-2xl text-ink outline-none placeholder:text-slate-300"
      />
    </div>
  )
}

/** − [ 12 ] +  — never below zero. */
export function Stepper({ value, onChange, ariaLabel }: { value: number; onChange: (v: number) => void; ariaLabel: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="One fewer"
        className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-ink transition hover:bg-slate-200 active:scale-95"
      >
        <Icon name="minus" size={28} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        aria-label={ariaLabel}
        className="h-16 w-full rounded-2xl border-2 border-slate-200 bg-white text-center font-display text-3xl font-black text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="One more"
        className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-white transition hover:bg-brand-blue-dark active:scale-95"
      >
        <Icon name="plus" size={28} />
      </button>
    </div>
  )
}

export function ErrorBox({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-semibold text-red-700">
      {children}
    </div>
  )
}

export function Busy({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-500">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-orange" />
      <span className="font-display text-lg font-extrabold">{label}</span>
    </div>
  )
}
