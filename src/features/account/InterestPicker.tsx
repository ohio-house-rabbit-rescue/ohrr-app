// The six things OHRR emails about, as tick boxes, with the consent line under
// them — the same wording on the website's form.
import { CONSENT_LINE, INTERESTS, type Interest } from './emailList'

export default function InterestPicker({
  value,
  onChange,
  disabled = false,
  legend = 'Email me about',
}: {
  value: Interest[]
  onChange: (next: Interest[]) => void
  disabled?: boolean
  legend?: string
}) {
  const toggle = (k: Interest) =>
    onChange(value.includes(k) ? value.filter((x) => x !== k) : INTERESTS.map((i) => i.key).filter((x) => x === k || value.includes(x)))
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="text-sm font-semibold text-slate-700">{legend}</legend>
      <div className="grid gap-x-3 sm:grid-cols-2">
        {INTERESTS.map((i) => (
          <label key={i.key} className="flex min-h-[44px] items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue"
              checked={value.includes(i.key)}
              onChange={() => toggle(i.key)}
            />
            {i.label}
          </label>
        ))}
      </div>
      <p className="pt-1 text-xs leading-relaxed text-slate-500">{CONSENT_LINE}</p>
    </fieldset>
  )
}
