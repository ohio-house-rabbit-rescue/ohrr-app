// One question from a schema-driven form (surrender intake, adoption
// application): radio pills, checkbox pills, textarea or a typed input.
import type { FormField } from '../data/surrenderForm'

export type Values = Record<string, string | string[]>

export const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export function SchemaField({
  f,
  values,
  setVal,
  toggle,
}: {
  f: FormField
  values: Values
  setVal: (name: string, v: string | string[]) => void
  toggle: (name: string, opt: string) => void
}) {
  const val = values[f.name]

  if (f.type === 'radio') {
    return (
      <div>
        <span className="block text-sm font-semibold text-slate-700">
          {f.label}
          {f.required && <span className="text-brand-orange"> *</span>}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {f.options!.map((o) => {
            const active = val === o
            return (
              <button
                key={o}
                type="button"
                onClick={() => setVal(f.name, active ? '' : o)}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-bold transition',
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
      </div>
    )
  }

  if (f.type === 'checkboxes') {
    const arr = Array.isArray(val) ? val : []
    return (
      <div>
        <span className="block text-sm font-semibold text-slate-700">{f.label}</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {f.options!.map((o) => {
            const active = arr.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(f.name, o)}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-bold transition',
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
      </div>
    )
  }

  if (f.type === 'textarea') {
    return (
      <label className="block text-sm font-semibold text-slate-700">
        {f.label}
        {f.required && <span className="text-brand-orange"> *</span>}
        <textarea
          name={f.name}
          rows={3}
          required={f.required}
          value={(val as string) ?? ''}
          onChange={(e) => setVal(f.name, e.target.value)}
          className={inputClass}
        />
      </label>
    )
  }

  return (
    <label className="block text-sm font-semibold text-slate-700">
      {f.label}
      {f.required && <span className="text-brand-orange"> *</span>}
      <input
        type={f.type}
        name={f.name}
        required={f.required}
        value={(val as string) ?? ''}
        onChange={(e) => setVal(f.name, e.target.value)}
        placeholder={f.placeholder}
        className={inputClass}
      />
    </label>
  )
}
