// "Comes in" — the sizes a Hop Shop product can be ordered in: a single, a box,
// a case of 12 … each with the supplier's item number, what one pack costs and
// the supplier's minimum. OHRR: "on the ordering process we need the case count
// or boxes it can come in." Part of the product form; the product's Save saves
// these too (update 27, `product_packs`).
import { useState } from 'react'
import { Icon } from '../../components/icons'
import { staffInput } from '../../components/staffui'
import { eachFromPack, fromCents, money, toCents, type Pack, type PackInput } from './api'

/** A pack as the form edits it (all text until saved). */
export interface PackRow {
  key: string
  id: string | null
  label: string
  units: string
  cost: string
  supplier_sku: string
  min_packs: string
  is_default: boolean
  notes: string
}

let seq = 0
const newKey = () => `pack-${Date.now().toString(36)}-${(seq += 1)}`

export function packRowsFrom(packs: Pack[] | undefined): PackRow[] {
  return (packs ?? []).map((k) => ({
    key: k.id,
    id: k.id,
    label: k.label,
    units: String(k.units),
    cost: fromCents(k.cost_cents),
    supplier_sku: k.supplier_sku ?? '',
    min_packs: String(k.min_packs || 1),
    is_default: k.is_default,
    notes: k.notes ?? '',
  }))
}

/** Check the rows and turn them into what `syncPacks` saves. Throws a plain message on a problem. */
export function packRowsToInput(rows: PackRow[]): PackInput[] {
  return rows.map((r) => {
    const label = r.label.trim()
    if (!label) throw new Error('Give each pack size a name — Single, Box, Case …')
    const units = Number(r.units)
    if (!Number.isInteger(units) || units < 1 || units > 10000) throw new Error(`Say how many are in one ${label.toLowerCase()}.`)
    const min = r.min_packs === '' ? 1 : Number(r.min_packs)
    if (!Number.isInteger(min) || min < 1 || min > 1000) throw new Error(`The minimum for ${label.toLowerCase()} should be 1 or more.`)
    return {
      id: r.id,
      label,
      units,
      cost_cents: toCents(r.cost),
      supplier_sku: r.supplier_sku.trim() || null,
      min_packs: min,
      is_default: r.is_default,
      notes: r.notes.trim() || null,
    }
  })
}

const LABEL_HINTS = ['Single', 'Box', 'Case', 'Bag', 'Bale', 'Pallet']
const label = 'block text-sm font-semibold text-slate-700'
const smallBtn =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50'

export function PackEditor({ rows, onChange }: { rows: PackRow[]; onChange: (rows: PackRow[]) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const patch = (key: string, p: Partial<PackRow>) =>
    onChange(
      rows.map((r) =>
        r.key === key ? { ...r, ...p } : p.is_default ? { ...r, is_default: false } : r, // only one default
      ),
    )
  const add = () => {
    const key = newKey()
    onChange([
      ...rows,
      {
        key,
        id: null,
        label: rows.length === 0 ? 'Single' : 'Case',
        units: rows.length === 0 ? '1' : '',
        cost: '',
        supplier_sku: '',
        min_packs: '1',
        is_default: rows.length === 0,
        notes: '',
      },
    ])
    setOpen(key)
  }
  const remove = (key: string) => {
    const next = rows.filter((r) => r.key !== key)
    if (next.length > 0 && !next.some((r) => r.is_default) && rows.find((r) => r.key === key)?.is_default) next[0] = { ...next[0], is_default: true }
    onChange(next)
    setOpen(null)
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-bold text-ink">Comes in</p>
        <p className="text-xs text-slate-600">
          The sizes you can order it in — a single, a box, a case of 12. The reorder list suggests whole packs of the default one.
        </p>
      </div>
      <datalist id="hopshop-pack-labels">
        {LABEL_HINTS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {rows.map((r) => {
        const units = Number(r.units) || 0
        const each = units > 0 ? eachFromPack({ cost_cents: toCents(r.cost), units }) : null
        if (open !== r.key) {
          return (
            <div key={r.key} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-bold text-ink">
                  {r.label || 'Pack'}
                  {units > 1 ? ` of ${units}` : ''}
                </span>
                {r.is_default && <span className="ml-1.5 rounded-full bg-brand-blue-50 px-2 py-0.5 text-xs font-bold text-brand-blue">Default</span>}
                <span className="block text-xs text-slate-500">
                  {[
                    r.cost ? `${money(toCents(r.cost))} a ${r.label.toLowerCase() || 'pack'}${each && units > 1 ? ` (${each})` : ''}` : null,
                    r.supplier_sku ? `item ${r.supplier_sku}` : null,
                    Number(r.min_packs) > 1 ? `min ${r.min_packs}` : null,
                    r.notes || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No cost or item number yet'}
                </span>
              </span>
              <button type="button" onClick={() => setOpen(r.key)} className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          )
        }
        return (
          <div key={r.key} className="space-y-3 rounded-xl border border-brand-blue/30 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                Pack
                <input className={staffInput} list="hopshop-pack-labels" value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} placeholder="Case" />
              </label>
              <label className={label}>
                How many in it
                <input className={staffInput} inputMode="numeric" value={r.units} onChange={(e) => patch(r.key, { units: e.target.value.replace(/[^0-9]/g, '') })} placeholder="12" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                Cost per pack ($)
                <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={r.cost} onChange={(e) => patch(r.key, { cost: e.target.value })} placeholder="0.00" />
              </label>
              <label className={label}>
                Their item no.
                <input className={staffInput} value={r.supplier_sku} onChange={(e) => patch(r.key, { supplier_sku: e.target.value })} placeholder="OX-448-C" />
              </label>
            </div>
            {each && <p className="-mt-1 text-xs font-semibold text-slate-600">That works out at {each}.</p>}
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                Minimum to order
                <input className={staffInput} inputMode="numeric" value={r.min_packs} onChange={(e) => patch(r.key, { min_packs: e.target.value.replace(/[^0-9]/g, '') })} placeholder="1" />
              </label>
              <label className="flex min-h-[44px] items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={r.is_default} onChange={(e) => patch(r.key, { is_default: e.target.checked })} />
                Default
              </label>
            </div>
            <label className={label}>
              Notes
              <input className={staffInput} value={r.notes} onChange={(e) => patch(r.key, { notes: e.target.value })} placeholder="10 lb bags · ships on a pallet" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(null)} className={`${smallBtn} flex-1 text-brand-blue`}>
                Done
              </button>
              <button type="button" onClick={() => remove(r.key)} className={`${smallBtn} border-red-200 text-red-600 hover:bg-red-50`}>
                Remove
              </button>
            </div>
          </div>
        )
      })}
      <button type="button" onClick={add} className={`${smallBtn} w-full text-brand-blue`}>
        <Icon name="plus" size={16} /> Add a pack size
      </button>
    </div>
  )
}
