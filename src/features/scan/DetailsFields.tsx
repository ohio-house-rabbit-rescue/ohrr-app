// The extra details a person cataloging can add to an item (update 39):
// how many, a possible price, what it's worth, its condition, what sort of
// thing it is, where it's kept, and notes. Shared by Catalog donations and
// Scan an item → Details. All optional; "where it's kept" usually stays the
// same for a whole box, so the catalog keeps it from one item to the next.
import { useEffect, useState } from 'react'
import { BigInput, MoneyInput, Stepper } from './ScanUI'
import { catalogSuggestions } from './api'
import { CONDITIONS, conditionLabel } from './types'

export { CONDITIONS, conditionLabel, extrasSummary } from './types'

/** Starting ideas for "What sort of thing?"; anything else can be typed. */
export const CATEGORY_IDEAS = [
  'Food & hay',
  'Toys & chews',
  'Houses & pens',
  'Litter & supplies',
  'Grooming',
  'Gift basket',
  'Art & decor',
  'Clothing & accessories',
  'Gift card',
]

export interface Extras {
  quantity: number
  /** Dollars as typed. */
  price: string
  value: string
  condition: string
  category: string
  location: string
  notes: string
}

export const emptyExtras = (location = ''): Extras => ({ quantity: 1, price: '', value: '', condition: '', category: '', location, notes: '' })

/** Recent places and categories for the chips (empty before update 39). */
export function useCatalogSuggestions(orgId: string): { locations: string[]; categories: string[] } {
  const [s, setS] = useState<{ locations: string[]; categories: string[] }>({ locations: [], categories: [] })
  useEffect(() => {
    if (!orgId) return
    let alive = true
    catalogSuggestions(orgId).then((r) => alive && setS(r))
    return () => {
      alive = false
    }
  }, [orgId])
  return s
}

function Chips({ options, value, onPick, label }: { options: string[]; value: string; onPick: (v: string) => void; label: string }) {
  if (options.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.trim().toLowerCase() === o.toLowerCase()
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(on ? '' : o)}
            aria-pressed={on}
            className={`min-h-[44px] rounded-full px-3.5 text-[15px] font-bold transition ${
              on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

const Label = ({ children, hint }: { children: string; hint?: string }) => (
  <p className="mb-2 text-base font-bold text-ink">
    {children} {hint && <span className="font-normal text-slate-500">({hint})</span>}
  </p>
)

/** How many, and a price for one. */
export function QuantityPriceFields({ v, set, priceHint = 'if it may be sold' }: { v: Extras; set: (p: Partial<Extras>) => void; priceHint?: string }) {
  return (
    <>
      <div>
        <Label>How many?</Label>
        <Stepper value={v.quantity} onChange={(n) => set({ quantity: Math.max(1, n) })} ariaLabel="How many" />
      </div>
      <div>
        <Label hint={priceHint}>Price for one</Label>
        <MoneyInput value={v.price} onChange={(p) => set({ price: p })} ariaLabel="Price for one, in dollars" />
      </div>
    </>
  )
}

/** Worth, condition, sort of thing, where it's kept, notes — each optional. */
export function MoreDetailsFields({
  v,
  set,
  suggestions,
  show = { value: true, condition: true, category: true, location: true, notes: true },
}: {
  v: Extras
  set: (p: Partial<Extras>) => void
  suggestions: { locations: string[]; categories: string[] }
  show?: { value?: boolean; condition?: boolean; category?: boolean; location?: boolean; notes?: boolean }
}) {
  const categories = [...new Set([...suggestions.categories, ...CATEGORY_IDEAS])].slice(0, 12)
  return (
    <>
      {show.value && (
        <div>
          <Label hint="for one">What is it worth?</Label>
          <MoneyInput value={v.value} onChange={(p) => set({ value: p })} ariaLabel="What one is worth, in dollars" />
        </div>
      )}
      {show.condition && (
        <div>
          <Label>Condition</Label>
          <Chips options={CONDITIONS.map((c) => c.label)} value={conditionLabel(v.condition)} onPick={(l) => set({ condition: CONDITIONS.find((c) => c.label === l)?.value ?? '' })} label="Condition" />
        </div>
      )}
      {show.category && (
        <div>
          <Label>What sort of thing?</Label>
          <Chips options={categories} value={v.category} onPick={(c) => set({ category: c })} label="Ideas for the sort of thing" />
          <BigInput value={v.category} onChange={(c) => set({ category: c })} placeholder="Or type one" ariaLabel="What sort of thing it is" />
        </div>
      )}
      {show.location && (
        <div>
          <Label hint="a bin, shelf or closet">Where is it kept?</Label>
          <Chips options={suggestions.locations} value={v.location} onPick={(l) => set({ location: l })} label="Places used lately" />
          <BigInput value={v.location} onChange={(l) => set({ location: l })} placeholder="Bin 3, back closet" ariaLabel="Where it is kept" />
        </div>
      )}
      {show.notes && (
        <div>
          <Label>Notes</Label>
          <textarea
            value={v.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            placeholder="Size, colour, anything a buyer or bidder would want to know"
            aria-label="Notes"
            className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-ink outline-none transition placeholder:text-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
          />
        </div>
      )}
    </>
  )
}
