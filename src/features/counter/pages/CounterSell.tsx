// Counter → Sell. Scan a label or barcode, or tap the item's picture; the
// basket adds up; "Paid cash" or "Paid by card" records the sale and lowers
// the stock. The money goes through the cash box or the card reader as it
// always has. Works with no signal: the sale waits on the phone.
// A line that isn't a vendor's item can have its price changed ("3 towels for
// $30", update 47): for one, or for all of them.
import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/icons'
import { BigButton, BigInput, ErrorBox, MoneyInput, StepShell } from '../../scan/ScanUI'
import { getDevice, money, newId, toCents } from '../local'
import { canChangePrice, findByCode, saleTotal, useTill, type CounterProduct, type PayMethod, type SaleLine } from '../sales'
import { SyncPill, useCounterOrg } from '../CounterShell'

const Scanner = lazy(() => import('../../scan/Scanner'))

type Step = 'basket' | 'scan' | 'other' | 'pay' | 'done'

/** A changed price: for one ('each', kept as the count changes) or for the whole line ('all'). */
interface Adjust {
  mode: 'each' | 'all'
  cents: number
}

/** A basket line; the changed price stays on the screen and goes out as line_cents. */
type BasketLine = SaleLine & { adjust?: Adjust }

/** The line as it is sold: the changed price becomes line_cents. */
function priced({ adjust, ...l }: BasketLine): SaleLine {
  if (!adjust) return l
  return { ...l, line_cents: adjust.mode === 'all' ? adjust.cents : adjust.cents * l.qty }
}

const dollars = (cents: number) => (cents / 100).toFixed(2)

export default function CounterSell() {
  const navigate = useNavigate()
  const { orgId } = useCounterOrg()
  const till = useTill(orgId)
  const [step, setStep] = useState<Step>('basket')
  const [lines, setLines] = useState<BasketLine[]>([])
  const [q, setQ] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [other, setOther] = useState({ name: '', price: '' })
  const [given, setGiven] = useState('')
  const [last, setLast] = useState<{ total: number; method: PayMethod; change: number | null } | null>(null)
  // The line whose price is being changed, and what's typed.
  const [pricing, setPricing] = useState<{ i: number; price: string; mode: 'each' | 'all' } | null>(null)

  const total = saleTotal(lines.map(priced))
  const count = lines.reduce((n, l) => n + l.qty, 0)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const digits = t.replace(/[^0-9a-z]/g, '')
    const list = t
      ? till.products.filter(
          (p) => p.name.toLowerCase().includes(t) || (digits.length >= 4 && p.codes.some((c) => c.toLowerCase().replace(/[^0-9a-z]/g, '').includes(digits))),
        )
      : till.products
    return list.slice(0, 60)
  }, [q, till.products])

  const flash = (text: string, ms = 1500) => {
    setNote(text)
    setTimeout(() => setNote(null), ms)
  }

  /** A new count for a line. A price "for all" was for the old count, so it goes back to the label price. */
  const recount = (l: BasketLine, qty: number): BasketLine => {
    if (l.adjust?.mode !== 'all' || qty === l.qty) return { ...l, qty }
    flash(`Price back to ${money(l.price_cents)} each — ${qty} now`, 3500)
    return { ...l, qty, adjust: undefined }
  }

  const add = (p: CounterProduct) => {
    const i = lines.findIndex((l) => l.product_id === p.id)
    if (i >= 0) {
      if (pricing?.i === i) setPricing(null)
      setLines(lines.map((l, j) => (j === i ? recount(l, l.qty + 1) : l)))
      if (lines[i].adjust?.mode === 'all') return
    } else {
      setLines([...lines, { product_id: p.id, name: p.name, price_cents: p.price_cents, qty: 1 }])
    }
    flash(`Added ${p.name}`)
  }

  const setQty = (i: number, qty: number) => {
    if (pricing) setPricing(null)
    if (qty <= 0) setLines(lines.filter((_, j) => j !== i))
    else setLines(lines.map((l, j) => (j === i ? recount(l, qty) : l)))
  }

  const openPricing = (i: number) => {
    const l = lines[i]
    setPricing({ i, price: l.adjust ? dollars(l.adjust.cents) : '', mode: l.adjust?.mode ?? (l.qty > 1 ? 'all' : 'each') })
  }

  const usePrice = () => {
    if (!pricing) return
    const cents = toCents(pricing.price)
    if (cents === null) return
    setLines(lines.map((l, j) => (j === pricing.i ? { ...l, adjust: { mode: l.qty > 1 ? pricing.mode : 'each', cents } } : l)))
    setPricing(null)
  }

  const labelPrice = (i: number) => {
    setLines(lines.map((l, j) => (j === i ? { ...l, adjust: undefined } : l)))
    setPricing(null)
  }

  /** "3 for $30.00 (was $45.00)", "$12.00 each (was $15.00) · $36.00", or "$15.00 each · $45.00". */
  const lineText = (l: BasketLine) => {
    const was = l.price_cents * l.qty
    if (l.adjust?.mode === 'all') return `${l.qty} for ${money(l.adjust.cents)} (was ${money(was)})`
    if (l.adjust) return `${money(l.adjust.cents)} each (was ${money(l.price_cents)}) · ${money(l.adjust.cents * l.qty)}`
    return `${money(l.price_cents)} each · ${money(was)}`
  }

  const onScan = (raw: string) => {
    const p = findByCode(raw, till.products)
    if (p) {
      add(p)
      setStep('basket')
    } else {
      setError('That code isn’t on any item. Add it in Hop Shop inventory, or sell it as “Something else”.')
      setStep('basket')
    }
  }

  const pay = (method: PayMethod) => {
    const sale = { id: newId(), sold_at: new Date().toISOString(), method, device: getDevice().name || 'Counter', lines: lines.map(priced) }
    till.recordSale(sale)
    const g = toCents(given)
    setLast({ total, method, change: method === 'cash' && g !== null && g >= total ? g - total : null })
    setLines([])
    setPricing(null)
    setGiven('')
    setStep('done')
  }

  const pill = <SyncPill waiting={till.waiting} online={till.online} error={till.error} />

  /* ------------------------------------------------ scan */
  if (step === 'scan') {
    return (
      <StepShell title="Scan the item" help="Hold the phone over the OHRR label or the barcode on the packet." onBack={() => setStep('basket')} backLabel="Basket">
        <Suspense fallback={null}>
          <Scanner onResult={onScan} onTypeInstead={() => setStep('basket')} />
        </Suspense>
      </StepShell>
    )
  }

  /* ------------------------------------------------ something else */
  if (step === 'other') {
    const cents = toCents(other.price)
    return (
      <StepShell
        title="Something else"
        help="For anything without an OHRR number — type what it is and the price."
        onBack={() => setStep('basket')}
        backLabel="Basket"
        footer={
          <BigButton
            disabled={cents === null || cents === 0}
            onClick={() => {
              setLines((ls) => [...ls, { product_id: null, name: other.name.trim() || 'Other item', price_cents: cents ?? 0, qty: 1 }])
              setOther({ name: '', price: '' })
              setStep('basket')
            }}
          >
            Add to the basket
          </BigButton>
        }
      >
        <div className="space-y-4">
          <BigInput value={other.name} onChange={(v) => setOther({ ...other, name: v })} placeholder="What is it? (optional)" ariaLabel="What is it" />
          <MoneyInput value={other.price} onChange={(v) => setOther({ ...other, price: v })} ariaLabel="Price" autoFocus />
        </div>
      </StepShell>
    )
  }

  /* ------------------------------------------------ pay */
  if (step === 'pay') {
    const g = toCents(given)
    return (
      <StepShell title={`Total ${money(total)}`} help={`${count} ${count === 1 ? 'item' : 'items'}. Take the money, then tap how they paid.`} onBack={() => setStep('basket')} backLabel="Basket">
        <div className="space-y-4">
          <BigButton onClick={() => pay('card')} tone="blue" icon="check">
            Paid by card
          </BigButton>
          <div className="space-y-2 rounded-2xl border-2 border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-600">Cash? How much did they give you? (optional)</p>
            <MoneyInput value={given} onChange={setGiven} ariaLabel="Cash given" />
            {g !== null && g >= total && <p className="font-display text-xl font-black text-green-700">Change: {money(g - total)}</p>}
            {g !== null && g < total && <p className="text-sm font-bold text-red-700">That’s {money(total - g)} short.</p>}
            <BigButton onClick={() => pay('cash')} icon="check">
              Paid cash
            </BigButton>
          </div>
          <p className="text-center text-sm text-slate-500">Card payments go through the card reader, as now.</p>
        </div>
      </StepShell>
    )
  }

  /* ------------------------------------------------ done */
  if (step === 'done' && last) {
    return (
      <StepShell
        title="Sale recorded"
        onBack={() => navigate('/staff/counter')}
        backLabel="Counter"
        footer={
          <BigButton onClick={() => setStep('basket')} icon="plus">
            Next customer
          </BigButton>
        }
      >
        <div className="space-y-4 text-center">
          <span className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Icon name="check" size={44} />
          </span>
          <p className="font-display text-3xl font-black text-ink">{money(last.total)}</p>
          <p className="text-lg text-slate-600">{last.method === 'card' ? 'Paid by card' : 'Paid cash'}</p>
          {last.change !== null && <p className="font-display text-2xl font-black text-green-700">Change: {money(last.change)}</p>}
          <div className="flex justify-center">{pill}</div>
        </div>
      </StepShell>
    )
  }

  /* ------------------------------------------------ basket */
  return (
    <StepShell
      title="Sell"
      onBack={() => navigate('/staff/counter')}
      backLabel="Counter"
      footer={
        <BigButton onClick={() => setStep('pay')} disabled={lines.length === 0}>
          {lines.length ? `Take payment · ${money(total)}` : 'Add something first'}
        </BigButton>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          {pill}
          {note && <span className="text-sm font-bold text-green-700">{note}</span>}
        </div>
        <ErrorBox>{error}</ErrorBox>

        {lines.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-2xl border-2 border-brand-orange/40 bg-white">
            {lines.map((l, i) => {
              const editing = pricing?.i === i ? pricing : null
              const typed = editing ? toCents(editing.price) : null
              return (
                <div key={`${l.product_id ?? 'x'}-${i}`} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-ink">{l.name}</span>
                      <span className={`text-sm ${l.adjust ? 'font-bold text-brand-blue' : 'text-slate-500'}`}>{lineText(l)}</span>
                    </span>
                    <button type="button" aria-label={`One fewer ${l.name}`} onClick={() => setQty(i, l.qty - 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                      <Icon name={l.qty === 1 ? 'trash' : 'minus'} size={20} />
                    </button>
                    <span className="w-7 text-center font-display text-lg font-black">{l.qty}</span>
                    <button type="button" aria-label={`One more ${l.name}`} onClick={() => setQty(i, l.qty + 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue text-white">
                      <Icon name="plus" size={20} />
                    </button>
                  </div>
                  {!editing && canChangePrice(l.product_id, till.products) && (
                    <button type="button" onClick={() => openPricing(i)} className="min-h-[44px] text-[15px] font-bold text-brand-blue">
                      Change price
                    </button>
                  )}
                  {editing && (
                    <div className="mt-2 space-y-3 rounded-2xl bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-[9rem] flex-1">
                          <MoneyInput value={editing.price} onChange={(v) => setPricing({ ...editing, price: v })} ariaLabel={`New price for ${l.name}`} autoFocus />
                        </div>
                        {l.qty > 1 && (
                          <div className="inline-flex rounded-2xl border-2 border-slate-200 bg-white p-1" role="group" aria-label="The new price is for">
                            {(['all', 'each'] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setPricing({ ...editing, mode: m })}
                                aria-pressed={editing.mode === m}
                                className={`min-h-[44px] rounded-xl px-4 text-[15px] font-bold transition ${editing.mode === m ? 'bg-brand-blue text-white' : 'text-slate-600'}`}
                              >
                                {m === 'all' ? `For all ${l.qty}` : 'Each'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {typed !== null && (
                        <p className="text-[15px] font-bold text-slate-600">
                          {l.qty > 1 && editing.mode === 'all'
                            ? `${l.qty} for ${money(typed)} (was ${money(l.price_cents * l.qty)})`
                            : `${money(typed)} each${l.qty > 1 ? ` · ${money(typed * l.qty)}` : ''} (was ${money(l.price_cents)})`}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={usePrice}
                          disabled={typed === null}
                          className="min-h-[44px] rounded-xl bg-brand-blue px-4 text-[15px] font-bold text-white disabled:opacity-40"
                        >
                          Use this price
                        </button>
                        <button type="button" onClick={() => labelPrice(i)} className="min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-600">
                          Back to {money(l.price_cents)} each
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <BigButton
            tone="blue"
            icon="scan"
            onClick={() => {
              setError(null)
              setStep('scan')
            }}
          >
            Scan
          </BigButton>
          <BigButton tone="outline" onClick={() => setStep('other')}>
            Something else
          </BigButton>
        </div>

        <input
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-blue"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Or find it by name or barcode number"
          aria-label="Find an item by name"
          autoComplete="off"
        />

        {!till.loaded && <p className="text-center text-sm text-slate-500">Getting the item list…</p>}
        {till.loaded && till.products.length === 0 && (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">No items yet. Add them in Hop Shop inventory, or sell with “Something else”.</p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p)}
              className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white text-left transition active:scale-[.97] hover:border-brand-blue"
            >
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="h-24 w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-24 items-center justify-center bg-slate-50 text-slate-300">
                  <Icon name="bag" size={32} />
                </span>
              )}
              <span className="block px-2.5 py-2">
                <span className="line-clamp-2 block text-sm font-bold leading-snug text-ink">{p.name}</span>
                <span className="mt-0.5 flex items-baseline justify-between gap-1">
                  <span className="font-display text-base font-black text-brand-blue">{money(p.price_cents)}</span>
                  <span className={`text-xs font-bold ${p.quantity === 0 ? 'text-red-600' : 'text-slate-500'}`}>{p.quantity === 0 ? 'None left' : `${p.quantity} left`}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  )
}
