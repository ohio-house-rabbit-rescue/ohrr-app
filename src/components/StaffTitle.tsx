// The top of a staff screen: the title, a short "how it flows" strip, and the
// explanation folded away behind a "How it works" button.
//
// OHRR (2026-10-27): "all the explanations are taking up a lot of room on a
// screen so collapse them but make it easy to see that there is an explanation
// available. do this for all screens where there is input etc in the staff
// sections." The button is always in the same place, next to the title, with
// the info sign and a chevron, so it reads as "there's more here". None of the
// help prints: a printed report keeps just its title.
import { useId, useState, type ReactNode } from 'react'
import { Icon } from './icons'

export function StaffTitle({
  title,
  children,
  flow,
  actions,
  label = 'How it works',
  className = '',
}: {
  title: ReactNode
  /** The explanation; folded away until "How it works" is tapped. */
  children?: ReactNode
  /** The steps in order, shown as one short line under the title. */
  flow?: string[]
  /** Buttons at the right of the title (New, Add …). */
  actions?: ReactNode
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={`pt-1 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-black text-ink">{title}</h1>
          {children && <ExplainButton open={open} onToggle={() => setOpen((o) => !o)} controls={id} label={label} />}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>}
      </div>
      {flow && flow.length > 0 && <FlowStrip steps={flow} />}
      {children && open && <ExplainPanel id={id}>{children}</ExplainPanel>}
    </div>
  )
}

/** A longer note inside a screen or a form, folded the same way as the page's. */
export function Explain({ children, label = 'How this works', className = '' }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={className}>
      <ExplainButton open={open} onToggle={() => setOpen((o) => !o)} controls={id} label={label} />
      {open && <ExplainPanel id={id}>{children}</ExplainPanel>}
    </div>
  )
}

/** Numbered steps on one line: 1 Receive › 2 Label › 3 Put away › 4 Use. */
export function FlowStrip({ steps }: { steps: string[] }) {
  return (
    <ol aria-label="How it flows" className="mt-2 flex print:hidden flex-wrap items-center gap-x-1 gap-y-1.5 text-[13px] font-bold text-slate-600">
      {steps.map((s, i) => (
        <li key={s} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden className="px-0.5 text-slate-300">
              ›
            </span>
          )}
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-blue text-[11px] font-extrabold text-white">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function ExplainButton({ open, onToggle, controls, label }: { open: boolean; onToggle: () => void; controls: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="inline-flex min-h-[36px] print:hidden items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-blue-50 px-3 text-[13px] font-bold text-brand-blue transition hover:border-brand-blue/60"
    >
      <Icon name="info" size={15} />
      {open ? 'Hide' : label}
      <Icon name="chevron" size={14} className={`transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
    </button>
  )
}

function ExplainPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="mt-2 space-y-2 print:hidden rounded-2xl border border-brand-blue/15 bg-brand-blue-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
      {children}
    </div>
  )
}
