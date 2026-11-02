// What is going to print, in one box: the label size (with a Change that opens a list of the common
// sizes) and, under it, how many copies of each label (− / + with the number in between). Used where
// a label prints without the full Print labels page: the item label in Receive into boxes and
// Receive items, and the box labels (which start on 4 × 6 every time).
import { useState } from 'react'
import { LABEL_SIZES, type LabelSize } from './labels'
import { MAX_DEFAULT_COPIES } from './copies'

export default function LabelSizeLine({
  title,
  size,
  onChange,
  hint,
  copies,
  onCopies,
}: {
  /** "Item labels", "Box labels". */
  title: string
  size: LabelSize
  onChange: (s: LabelSize) => void
  /** Small print under the line. */
  hint?: string
  /** How many of each label print; shown with − / + when given. */
  copies?: number
  onCopies?: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const listed = LABEL_SIZES.some((s) => s.key === size.key)
  const step = 'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-2xl font-bold text-ink disabled:opacity-40'
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[15px] font-bold text-ink">
          {title}: <span className="font-semibold text-slate-700">{size.label}</span>
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-h-[44px] shrink-0 px-2 text-[15px] font-bold text-brand-blue">
          {open ? 'Close' : 'Change'}
        </button>
      </div>
      {open && (
        <select
          aria-label={`${title} size`}
          value={size.key}
          onChange={(e) => {
            const s = LABEL_SIZES.find((x) => x.key === e.target.value)
            if (s) {
              onChange({ ...s, photo: size.photo })
              setOpen(false)
            }
          }}
          className="mt-1 min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-ink"
        >
          {!listed && <option value={size.key}>{size.label}</option>}
          {LABEL_SIZES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      {copies != null && onCopies && (
        <div className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[15px] font-bold text-ink">
            Copies of each: <span className="text-lg font-extrabold">{copies}</span>
          </span>
          <button type="button" onClick={() => onCopies(copies - 1)} disabled={copies <= 1} aria-label={`One fewer ${title.toLowerCase()} copy`} className={step}>
            −
          </button>
          <button type="button" onClick={() => onCopies(copies + 1)} disabled={copies >= MAX_DEFAULT_COPIES} aria-label={`One more ${title.toLowerCase()} copy`} className={step}>
            +
          </button>
        </div>
      )}
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}
