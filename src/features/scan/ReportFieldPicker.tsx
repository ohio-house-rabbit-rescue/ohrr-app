// What the "Report with photos (PDF)" shows next to each item's photos (sponsor 2026-11-23: "an option of
// what to include in the PDF but limit it to the selections that will fit"). Each line has room for six
// details (notes take two); once the line is full the rest can't be checked until one is unchecked. The
// choice is remembered on this computer. Shared: the app keeps this file in src/features/scan/, the website
// in src/components/ — keep the two the same apart from the import path.
import { useState } from 'react'
import { DEFAULT_REPORT_FIELDS, REPORT_FIELDS, REPORT_SPACES, cleanFields, spacesUsed, type ReportField } from './itemsReportPdf'

const KEY = 'ohrr.itemsReport.fields'

/** The choice saved on this computer, or the usual six. */
export function loadReportFields(): ReportField[] {
  try {
    const raw = localStorage.getItem(KEY)
    return cleanFields(raw ? JSON.parse(raw) : undefined)
  } catch {
    return [...DEFAULT_REPORT_FIELDS]
  }
}

export default function ReportFieldPicker({ value, onChange }: { value: ReportField[]; onChange: (v: ReportField[]) => void }) {
  const [open, setOpen] = useState(false)
  const used = spacesUsed(value)
  const left = REPORT_SPACES - used
  const set = (next: ReportField[]) => {
    const clean = cleanFields(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(clean))
    } catch {
      /* private window: it still works, it just isn't remembered */
    }
    onChange(clean)
  }
  const names = REPORT_FIELDS.filter((f) => value.includes(f.key)).map((f) => f.label)
  const usual = DEFAULT_REPORT_FIELDS.length === value.length && DEFAULT_REPORT_FIELDS.every((k) => value.includes(k))

  return (
    <div className="text-base text-slate-700">
      <p>
        <span className="font-bold text-ink">On each line of the PDF:</span> the photos, name, number and status, plus {names.length ? names.join(', ') : 'nothing else'}.{' '}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-bold text-brand-blue underline">
          {open ? 'Done choosing' : 'Change what it shows'}
        </button>
      </p>
      {open && (
        <fieldset className="mt-2 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 font-bold text-ink">
            Next to the photos: {used} of {REPORT_SPACES} spaces used
          </legend>
          <p className="text-sm text-slate-600">Each line has room for {REPORT_SPACES} things beside its photos. Notes take 2, because they are two full lines.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPORT_FIELDS.map((f) => {
              const on = value.includes(f.key)
              const fits = on || f.spaces <= left
              return (
                <label
                  key={f.key}
                  title={fits ? undefined : 'No room left on the line: uncheck one first'}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 px-4 font-semibold ${
                    on ? 'border-brand-blue bg-blue-50 text-ink' : fits ? 'cursor-pointer border-slate-200 bg-white text-slate-700' : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={on}
                    disabled={!fits}
                    onChange={() => set(on ? value.filter((k) => k !== f.key) : [...value, f.key])}
                  />
                  {f.label}
                </label>
              )
            })}
          </div>
          <p role="status" className={`mt-2 text-sm font-bold ${left === 0 ? 'text-amber-800' : 'text-slate-600'}`}>
            {left === 0 ? 'The line is full. Uncheck one to choose another.' : `${left} space${left === 1 ? '' : 's'} left.`}
          </p>
          {!usual && (
            <button type="button" onClick={() => set([...DEFAULT_REPORT_FIELDS])} className="mt-2 text-sm font-bold text-brand-blue underline">
              Go back to the usual six
            </button>
          )}
        </fieldset>
      )}
    </div>
  )
}
