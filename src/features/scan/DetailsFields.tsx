// The extra details a person cataloging can add to an item (update 39):
// how many, a possible price, what it's worth, its condition, what sort of
// thing it is, where it's kept, and notes. Shared by Catalog donations and
// Scan an item → Details. All optional; "where it's kept" usually stays the
// same for a whole box, so the catalog keeps it from one item to the next.
// Update 47 adds the receiving details (donation or purchase, what was paid
// and where) and the use from OHRR's own list ("What is it for?").
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Icon } from '../../components/icons'
import { BigInput, MoneyInput, Stepper } from './ScanUI'
import { canEditItemPurposes, catalogSuggestions, listItemPurposes, saveItemPurpose, type CatalogSuggestions } from './api'
import {
  CONDITIONS,
  DEFAULT_PURPOSES,
  EVENT_USES,
  HEADED_FOR,
  PURPOSE_USES,
  conditionLabel,
  dollarsToCents,
  formatMoney,
  headedForUse,
  valueLine,
  type HeadedFor,
  type ItemPurpose,
  type PurposeUse,
} from './types'

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
  /** Update 40: the value is for one ('each') or for the whole lot ('all'). */
  valueBasis: 'each' | 'all'
  /** Update 40: where a donation is headed; '' = not sure yet. */
  headedFor: HeadedFor | ''
  size: string
  /** YYYY-MM-DD, or ''. */
  useBy: string
  condition: string
  category: string
  location: string
  notes: string
  /** Update 47: how it came in. */
  source: 'donation' | 'purchase'
  /** A purchase: what was paid (dollars as typed), for one or for the lot, and where. */
  cost: string
  costBasis: 'each' | 'all'
  boughtFrom: string
  /** Its use from OHRR's list ('' = not sorted yet). */
  purpose: string
}

export const emptyExtras = (location = ''): Extras => ({
  quantity: 1,
  price: '',
  value: '',
  valueBasis: 'each',
  headedFor: '',
  size: '',
  useBy: '',
  condition: '',
  category: '',
  location,
  notes: '',
  source: 'donation',
  cost: '',
  costBasis: 'all',
  boughtFrom: '',
  purpose: '',
})

/** What was paid for the whole lot, in cents (null when nothing was typed). */
export function costCents(v: Pick<Extras, 'cost' | 'costBasis' | 'quantity'>): number | null {
  const c = dollarsToCents(v.cost)
  if (c == null) return null
  return v.costBasis === 'each' ? c * Math.max(1, v.quantity) : c
}

/** Recent places, categories and stores for the lists (empty before update 39). */
export function useCatalogSuggestions(orgId: string): CatalogSuggestions {
  const [s, setS] = useState<CatalogSuggestions>({ locations: [], categories: [], stores: [] })
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

/** How many, on its own (donations: the price lives under More details). */
export function QuantityField({ v, set }: { v: Extras; set: (p: Partial<Extras>) => void }) {
  return (
    <div>
      <Label>How many?</Label>
      <Stepper value={v.quantity} onChange={(n) => set({ quantity: Math.max(1, n) })} ariaLabel="How many" />
    </div>
  )
}

/** What it's worth, for one or for the whole lot, with the other worked out. */
export function ValueFields({ v, set }: { v: Extras; set: (p: Partial<Extras>) => void }) {
  const cents = dollarsToCents(v.value)
  const line = cents != null ? valueLine({ value_cents: cents, value_basis: v.valueBasis, quantity: v.quantity }) : ''
  const lot = v.quantity > 1
  return (
    <div>
      <Label hint="optional">What is it worth?</Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[9rem] flex-1">
          <MoneyInput value={v.value} onChange={(p) => set({ value: p })} ariaLabel="What it is worth, in dollars" />
        </div>
        <div className="inline-flex rounded-2xl border-2 border-slate-200 bg-white p-1" role="group" aria-label="The value is for">
          {(['each', 'all'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => set({ valueBasis: b })}
              aria-pressed={v.valueBasis === b}
              className={`min-h-[44px] rounded-xl px-4 text-[15px] font-bold transition ${v.valueBasis === b ? 'bg-brand-blue text-white' : 'text-slate-600'}`}
            >
              {b === 'each' ? 'Each' : lot ? `For all ${v.quantity}` : 'For all'}
            </button>
          ))}
        </div>
      </div>
      {line && <p className="mt-1.5 text-[15px] font-bold text-slate-600">{line}</p>}
    </div>
  )
}

/** Where a donation is headed — tick one, or leave it "Not sure yet". */
export function HeadedForChips({ v, set }: { v: Extras; set: (p: Partial<Extras>) => void }) {
  return (
    <div>
      <Label>Where is it headed?</Label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Where it is headed">
        {HEADED_FOR.map((h) => {
          const on = v.headedFor === h.value
          return (
            <button
              key={h.value || 'unsure'}
              type="button"
              onClick={() => set({ headedFor: h.value })}
              aria-pressed={on}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition ${
                on ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {on && <Icon name="check" size={16} />}
              {h.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Worth, size, condition, sort of thing, where it's kept, use-by, price, notes — each optional. */
export function MoreDetailsFields({
  v,
  set,
  suggestions,
  show = { value: true, condition: true, category: true, location: true, notes: true },
  // OHRR 2026-10-27: "Price for one" → "more of a starting bid or sale price".
  priceLabel = 'Sale price or starting bid',
  priceHint = 'if it may be sold or auctioned',
}: {
  v: Extras
  set: (p: Partial<Extras>) => void
  suggestions: Pick<CatalogSuggestions, 'locations' | 'categories'>
  show?: { value?: boolean; size?: boolean; condition?: boolean; category?: boolean; location?: boolean; useBy?: boolean; price?: boolean; notes?: boolean }
  priceLabel?: string
  priceHint?: string
}) {
  const categories = [...new Set([...suggestions.categories, ...CATEGORY_IDEAS])].slice(0, 12)
  return (
    <>
      {show.size && (
        <div>
          <Label hint="e.g. 24×36">Size</Label>
          <BigInput value={v.size} onChange={(x) => set({ size: x })} placeholder="24×36" ariaLabel="Size" />
        </div>
      )}
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
      {show.location && <LocationField v={v} set={set} places={suggestions.locations} />}
      {show.useBy && (
        <div>
          <Label hint="food, hay, medicine">Use by</Label>
          <input
            type="date"
            value={v.useBy}
            onChange={(e) => set({ useBy: e.target.value })}
            aria-label="Use by"
            className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
          />
        </div>
      )}
      {show.price && (
        <div>
          <Label hint={priceHint}>{v.quantity > 1 ? `${priceLabel}, each` : priceLabel}</Label>
          <MoneyInput value={v.price} onChange={(p) => set({ price: p })} ariaLabel={`${priceLabel}, in dollars`} />
        </div>
      )}
      {show.notes && (
        <div>
          <Label>Notes</Label>
          <textarea
            value={v.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            placeholder="Size, color, anything a buyer or bidder would want to know"
            aria-label="Notes"
            className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg text-ink outline-none transition placeholder:text-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
          />
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------- update 47 */

/**
 * A box to type in with a drop-down of what's been used before, narrowing as
 * you type; anything new is added with "+ Add". Sponsor (2026-10-27):
 * "locations we need to add as we go and have a drop down list as i type a
 * new one".
 */
export function ComboField({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const typed = value.trim()
  const matches = useMemo(() => {
    const t = typed.toLowerCase()
    const all = [...new Set(options.map((o) => o.trim()).filter(Boolean))]
    return (t ? all.filter((o) => o.toLowerCase().includes(t)) : all).slice(0, 8)
  }, [options, typed])
  const isNew = typed !== '' && !options.some((o) => o.trim().toLowerCase() === typed.toLowerCase())
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter') {
            e.preventDefault()
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-ink outline-none transition placeholder:text-slate-300 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
      />
      {open && (matches.length > 0 || isNew) && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-2xl border-2 border-slate-200 bg-white py-1 shadow-lg"
        >
          {isNew && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(typed)}
                className="flex min-h-[48px] w-full items-center gap-2 px-4 text-left text-base font-bold text-brand-blue"
              >
                <Icon name="plus" size={18} />
                Add “{typed}”
              </button>
            </li>
          )}
          {matches.map((o) => (
            <li key={o} role="option" aria-selected={o.toLowerCase() === typed.toLowerCase()}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className="flex min-h-[48px] w-full items-center px-4 text-left text-base text-ink hover:bg-slate-50"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Where it's kept: a drop-down of the places used so far, and "+ Add a new
 * place…" for one that isn't there yet, which joins the list once an item is
 * saved with it. Sponsor (2026-10-27): "on the where it's kept, let's have a
 * drop-down list of the items as they're added in. so much like you did the
 * what it's for … if we want to add a new location, like in a car or something
 * like that, then we can do that."
 */
export function LocationField({
  v,
  set,
  places,
  label = 'Where is it kept?',
}: {
  v: Pick<Extras, 'location'>
  set: (p: Partial<Extras>) => void
  places: string[]
  label?: string
}) {
  const list = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of places) {
      const t = p.trim()
      if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [places])
  const cur = v.location.trim()
  const listed = list.find((p) => p.toLowerCase() === cur.toLowerCase())
  // With nothing on the list yet, the new-place box is simply open.
  const [adding, setAdding] = useState(false)
  const typing = adding || (list.length === 0 && !listed)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {list.length > 0 && (
        <select
          value={typing ? '__add' : (listed ?? cur)}
          onChange={(e) => {
            if (e.target.value === '__add') {
              setAdding(true)
              set({ location: '' })
            } else {
              setAdding(false)
              set({ location: e.target.value })
            }
          }}
          aria-label={label}
          className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg font-bold text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
        >
          <option value="">Choose a place…</option>
          {/* A place from before that isn't on the recent list (an older item's). */}
          {cur && !listed && !typing && <option value={cur}>{cur}</option>}
          {list.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="__add">+ Add a new place…</option>
        </select>
      )}
      {typing && (
        <div className={list.length > 0 ? 'rounded-2xl border-2 border-brand-blue/30 bg-brand-blue-50/40 p-3' : ''}>
          {list.length > 0 && <p className="mb-2 text-[15px] font-bold text-slate-600">The new place</p>}
          <BigInput value={v.location} onChange={(l) => set({ location: l })} placeholder="Storage shed, OHRR" ariaLabel={`${label} — a new place`} autoFocus={adding} />
          <p className="mt-1.5 text-sm text-slate-500">Room or building, then the shelf or bin. It joins the list when the item is saved.</p>
        </div>
      )}
    </div>
  )
}

/** Donation or purchase. */
export function ReceivedAsField({ v, set }: { v: Pick<Extras, 'source'>; set: (p: Partial<Extras>) => void }) {
  return (
    <div>
      <Label>How did it come in?</Label>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="How it came in">
        {(
          [
            ['donation', 'Donation', 'gift'],
            ['purchase', 'We bought it', 'bag'],
          ] as const
        ).map(([value, text, icon]) => {
          const on = v.source === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => set({ source: value })}
              aria-pressed={on}
              className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 font-display text-base font-extrabold transition ${
                on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <Icon name={icon} size={20} />
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A purchase: what we paid (each or for all of them) and where it was bought. */
export function CostFields({ v, set, stores }: { v: Extras; set: (p: Partial<Extras>) => void; stores: string[] }) {
  const lot = v.quantity > 1
  const total = costCents(v)
  return (
    <>
      <div>
        <Label hint="optional">What did we pay?</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[9rem] flex-1">
            <MoneyInput value={v.cost} onChange={(c) => set({ cost: c })} ariaLabel="What we paid, in dollars" />
          </div>
          {lot && (
            <div className="inline-flex rounded-2xl border-2 border-slate-200 bg-white p-1" role="group" aria-label="What we paid is for">
              {(['all', 'each'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set({ costBasis: b })}
                  aria-pressed={v.costBasis === b}
                  className={`min-h-[44px] rounded-xl px-4 text-[15px] font-bold transition ${v.costBasis === b ? 'bg-brand-blue text-white' : 'text-slate-600'}`}
                >
                  {b === 'each' ? 'Each' : `For all ${v.quantity}`}
                </button>
              ))}
            </div>
          )}
        </div>
        {lot && total != null && v.costBasis === 'each' && <p className="mt-1.5 text-[15px] font-bold text-slate-600">{formatMoney(total)} in all</p>}
      </div>
      <div>
        <Label hint="optional">Where was it bought?</Label>
        <ComboField value={v.boughtFrom} onChange={(b) => set({ boughtFrom: b })} options={stores} placeholder="Tractor Supply" ariaLabel="Where it was bought" />
      </div>
    </>
  )
}

/** OHRR's uses, and whether this person may add to them (Admin 1 and up). */
export function useItemPurposes(orgId: string) {
  const [purposes, setPurposes] = useState<ItemPurpose[]>(DEFAULT_PURPOSES)
  const [ready, setReady] = useState(false)
  const [canAdd, setCanAdd] = useState(false)
  const reload = useCallback(async () => {
    if (!orgId) return
    const [list, can] = await Promise.all([listItemPurposes(orgId), canEditItemPurposes(orgId)])
    setPurposes(list.purposes)
    setReady(list.ready)
    setCanAdd(list.ready && can)
  }, [orgId])
  useEffect(() => {
    void reload()
  }, [reload])
  const add = useCallback(
    async (name: string, use: PurposeUse) => {
      const p = await saveItemPurpose(orgId, { name, use })
      setPurposes((list) => [...list.filter((x) => x.id !== p.id), p])
      return p
    },
    [orgId],
  )
  return { purposes, ready, canAdd, reload, add }
}

/** The use a name stands for (the list's, or an old one no longer listed). */
export function purposeUseOf(name: string, purposes: ItemPurpose[]): PurposeUse | null {
  if (!name) return null
  return purposes.find((p) => p.name.toLowerCase() === name.toLowerCase())?.use ?? null
}

/**
 * "What is it for?" — a drop-down of OHRR's uses (sponsor 2026-10-27:
 * "MidWest BunFest, Guardians Event, Special Event, HOP Shop, Bunny Care …
 * they should be a drop down but have a add to from authorized levels of
 * user"). An event then asks how it's used there. Picking one sets the
 * purpose and where it lands (headedFor).
 */
export function PurposeField({
  v,
  set,
  list,
}: {
  v: Pick<Extras, 'purpose' | 'headedFor'>
  set: (p: Partial<Extras>) => void
  list: ReturnType<typeof useItemPurposes>
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [use, setUse] = useState<PurposeUse>('event')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = list.purposes.filter((p) => p.is_active)
  const current = list.purposes.find((p) => p.name.toLowerCase() === v.purpose.toLowerCase())
  const kind = current?.use ?? null
  const choose = (pname: string) => {
    if (pname === '__add') {
      setAdding(true)
      return
    }
    const p = list.purposes.find((x) => x.name === pname)
    set({ purpose: pname, headedFor: p ? headedForUse(p.use) : '' })
  }
  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const p = await list.add(name, use)
      set({ purpose: p.name, headedFor: headedForUse(p.use) })
      setAdding(false)
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <Label>What is it for?</Label>
        <select
          value={current ? current.name : v.purpose}
          onChange={(e) => choose(e.target.value)}
          aria-label="What it is for"
          className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg font-bold text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
        >
          <option value="">Not sorted yet</option>
          {active.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
          {v.purpose && !current && <option value={v.purpose}>{v.purpose}</option>}
          {list.canAdd && <option value="__add">+ Add a use…</option>}
        </select>
      </div>
      {adding && (
        <div className="space-y-3 rounded-2xl border-2 border-brand-blue/30 bg-brand-blue-50/40 p-4">
          <p className="text-base font-bold text-ink">Add a use to the list</p>
          <BigInput value={name} onChange={setName} placeholder="Christmas event" ariaLabel="Name of the use" autoFocus />
          <div className="space-y-2" role="radiogroup" aria-label="What kind of use">
            {PURPOSE_USES.map((u) => (
              <button
                key={u.value}
                type="button"
                role="radio"
                aria-checked={use === u.value}
                onClick={() => setUse(u.value)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${
                  use === u.value ? 'border-brand-blue bg-white' : 'border-slate-200 bg-white/70'
                }`}
              >
                <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${use === u.value ? 'border-brand-blue bg-brand-blue' : 'border-slate-300'}`}>
                  {use === u.value && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span>
                  <span className="block font-bold text-ink">{u.label}</span>
                  <span className="block text-sm text-slate-500">{u.hint}</span>
                </span>
              </button>
            ))}
          </div>
          {error && <p className="text-[15px] font-bold text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void add()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-blue px-4 font-display font-extrabold text-white disabled:opacity-40"
            >
              <Icon name="check" size={18} />
              Save to the list
            </button>
            <button type="button" onClick={() => setAdding(false)} className="min-h-[48px] rounded-2xl px-4 font-bold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
      {kind === 'event' && (
        <div>
          <Label>How will it be used there?</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="How it will be used at the event">
            {EVENT_USES.map((h) => {
              const on = v.headedFor === h.value
              return (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => set({ headedFor: h.value })}
                  aria-pressed={on}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition ${
                    on ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {on && <Icon name="check" size={16} />}
                  {h.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
