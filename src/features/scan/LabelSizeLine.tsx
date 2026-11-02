// One line that says which label size is going to print, with a Change that opens a list of the
// common sizes. Used where a label prints without the full Print labels page: the item label
// in Receive into boxes, and the box labels (which start on 4 × 6 every time).
import { useState } from 'react'
import { LABEL_SIZES, type LabelSize } from './labels'

export default function LabelSizeLine({
  title,
  size,
  onChange,
  hint,
}: {
  /** "Item labels", "Box labels". */
  title: string
  size: LabelSize
  onChange: (s: LabelSize) => void
  /** Small print under the line. */
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const listed = LABEL_SIZES.some((s) => s.key === size.key)
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
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
    </div>
  )
}
