// Pretend screens for the guided start. They look like the real thing and save NOTHING: no database call,
// no import of any real page's data code. Every one says so at the top. (Money and anything the public can see
// are only ever practiced here.) Identical in the app and the website.
import { useState } from 'react'
import type { PracticeKey } from './walkthrough'
import { ORANGE_BTN } from './guideUi'

const field = 'min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30'

function PracticeFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-brand-orange/60 bg-brand-orange-50/50 p-3">
      <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-brand-orange-dark">Practice — nothing is saved</p>
      {children}
    </div>
  )
}

function PracticeHours() {
  const [date, setDate] = useState('')
  const [hours, setHours] = useState('')
  const [what, setWhat] = useState('')
  const [logged, setLogged] = useState<string | null>(null)
  const ready = hours.trim() !== '' && Number(hours) > 0
  return (
    <PracticeFrame>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          setLogged(`${Number(hours)} hour${Number(hours) === 1 ? '' : 's'}${what.trim() ? ` — ${what.trim()}` : ''}`)
        }}
      >
        <label className="block text-sm font-bold text-ink">
          Which day
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-sm font-bold text-ink">
          How many hours
          <input type="number" inputMode="decimal" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} className={`${field} mt-1`} placeholder="2" />
        </label>
        <label className="block text-sm font-bold text-ink">
          What did you do?
          <input type="text" value={what} onChange={(e) => setWhat(e.target.value)} className={`${field} mt-1`} placeholder="Cleaned pens at the foster home" />
        </label>
        <button type="submit" disabled={!ready} className={`${ORANGE_BTN} disabled:opacity-50`}>
          Log it
        </button>
      </form>
      {logged && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
          Practice hours logged: {logged}. (Pretend — nothing was saved.)
        </p>
      )}
    </PracticeFrame>
  )
}

function PracticeAnnouncement() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [posted, setPosted] = useState<{ title: string; message: string } | null>(null)
  const ready = title.trim() !== ''
  return (
    <PracticeFrame>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) setPosted({ title: title.trim(), message: message.trim() })
        }}
      >
        <label className="block text-sm font-bold text-ink">
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} placeholder="Foster home open house Saturday" />
        </label>
        <label className="block text-sm font-bold text-ink">
          Message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={`${field} mt-1 py-2`} placeholder="Come meet the bunnies, 10 to noon." />
        </label>
        <button type="submit" disabled={!ready} className={`${ORANGE_BTN} disabled:opacity-50`}>
          Post announcement
        </button>
      </form>
      {posted && (
        <div className="mt-3 space-y-2">
          <p role="status" className="text-sm font-bold text-emerald-800">
            Posted “{posted.title}”. It would be showing on the home screen now. (Pretend — nothing was posted.)
          </p>
          <div className="mx-auto max-w-[260px] rounded-[1.75rem] border-4 border-slate-800 bg-slate-50 p-3 shadow-md" aria-label="A pretend phone home screen">
            <div className="mb-2 h-1.5 w-12 rounded-full bg-slate-300 mx-auto" />
            <div className="rounded-xl border border-brand-orange/50 bg-white p-3 shadow-sm">
              <p className="text-sm font-extrabold text-ink">{posted.title}</p>
              {posted.message && <p className="mt-1 text-xs leading-snug text-slate-600">{posted.message}</p>}
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-8 rounded-xl bg-brand-blue-50" />
              <div className="h-8 rounded-xl bg-brand-blue-50" />
            </div>
          </div>
        </div>
      )}
    </PracticeFrame>
  )
}

function PracticeReceive() {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const ready = name.trim() !== ''
  return (
    <PracticeFrame>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) setSaved(name.trim())
        }}
      >
        <label className="block text-sm font-bold text-ink">
          What is it called?
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} placeholder="Stuffed bunny" />
        </label>
        <button type="submit" disabled={!ready} className={`${ORANGE_BTN} disabled:opacity-50`}>
          Save
        </button>
      </form>
      {saved && (
        <div className="mt-3 space-y-2">
          <p role="status" className="text-sm font-bold text-emerald-800">
            Saved! (Pretend — nothing was saved.)
          </p>
          <div className="mx-auto max-w-[260px] rounded-xl border border-slate-300 bg-white p-3 text-center shadow-sm" aria-label="A pretend label">
            <p className="font-mono text-lg font-black tracking-widest text-ink">DON-00000</p>
            <p className="text-sm font-bold text-slate-700">{saved}</p>
            <p className="mt-1 text-xs text-slate-500">A pretend number. Real ones are made for you.</p>
          </div>
        </div>
      )}
    </PracticeFrame>
  )
}

function PracticeScan() {
  const [found, setFound] = useState(false)
  return (
    <PracticeFrame>
      <div className="mx-auto max-w-[260px] space-y-3 text-center">
        <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm" aria-label="A pretend label on an item">
          <p className="font-mono text-lg font-black tracking-widest text-ink">DON-00000</p>
          <p className="text-sm font-bold text-slate-700">Stuffed bunny</p>
        </div>
        {found ? (
          <div role="status" className="rounded-xl bg-emerald-50 px-3 py-3 text-left">
            <p className="font-display text-lg font-extrabold text-emerald-900">Found it</p>
            <p className="text-sm text-emerald-900">DON-00000 · Stuffed bunny</p>
            <p className="mt-1 text-xs text-emerald-800">(Pretend — nothing was looked up.)</p>
          </div>
        ) : (
          <button type="button" onClick={() => setFound(true)} className={ORANGE_BTN}>
            Scan the label
          </button>
        )}
      </div>
    </PracticeFrame>
  )
}

const cash = (cents: number) => `$${(cents / 100).toFixed(2)}`
const SELL_ITEMS = [
  { id: 'hay', name: 'Hay, small bag', cents: 800 },
  { id: 'toy', name: 'Carrot toy', cents: 350 },
  { id: 'treat', name: 'Treat jar', cents: 600 },
  { id: 'tag', name: 'Bunny bandana', cents: 1200 },
]
const stepper = 'inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg font-black text-ink'

function PracticeSellBasket() {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [asked, setAsked] = useState(false)
  const lines = SELL_ITEMS.filter((i) => (qty[i.id] ?? 0) > 0)
  const total = lines.reduce((n, i) => n + i.cents * (qty[i.id] ?? 0), 0)
  const bump = (id: string, d: number) => setQty((m) => ({ ...m, [id]: Math.max(0, (m[id] ?? 0) + d) }))
  return (
    <PracticeFrame>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Pretend items and prices. Tap one to add it.</p>
        <div className="grid grid-cols-2 gap-2">
          {SELL_ITEMS.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => {
                bump(i.id, 1)
                setAsked(false)
              }}
              className="rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-left active:scale-[.97]"
            >
              <span className="block text-sm font-bold leading-snug text-ink">{i.name}</span>
              <span className="font-display text-base font-black text-brand-blue">{cash(i.cents)}</span>
            </button>
          ))}
        </div>
        {lines.length > 0 && (
          <div className="divide-y divide-slate-100 rounded-2xl border-2 border-brand-orange/40 bg-white" aria-label="The pretend basket">
            {lines.map((i) => (
              <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{i.name}</span>
                  <span className="text-sm text-slate-500">
                    {cash(i.cents)} each · {cash(i.cents * (qty[i.id] ?? 0))}
                  </span>
                </span>
                <button type="button" aria-label={`One fewer ${i.name}`} onClick={() => bump(i.id, -1)} className={stepper}>
                  −
                </button>
                <span className="w-6 text-center font-display text-lg font-black">{qty[i.id]}</span>
                <button type="button" aria-label={`One more ${i.name}`} onClick={() => bump(i.id, 1)} className={stepper}>
                  +
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" disabled={lines.length === 0} onClick={() => setAsked(true)} className={`${ORANGE_BTN} w-full disabled:opacity-50`}>
          {lines.length ? `Take payment · ${cash(total)}` : 'Add something first'}
        </button>
        {asked && (
          <p role="status" className="text-sm font-bold text-emerald-800">
            In the real app this opens the payment screen. You practice that in the next step. (Pretend — nothing was recorded.)
          </p>
        )}
      </div>
    </PracticeFrame>
  )
}

const PAY_TOTAL = 800 + 350

function PracticePay() {
  const [given, setGiven] = useState('')
  const [done, setDone] = useState<{ method: 'card' | 'cash'; change: number | null } | null>(null)
  const g = given.trim() === '' || Number.isNaN(Number(given)) ? null : Math.round(Number(given) * 100)
  const pay = (method: 'card' | 'cash') => setDone({ method, change: method === 'cash' && g !== null && g >= PAY_TOTAL ? g - PAY_TOTAL : null })
  if (done)
    return (
      <PracticeFrame>
        <div className="space-y-2 text-center" role="status">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700" aria-hidden="true">
            ✓
          </span>
          <p className="font-display text-xl font-black text-ink">Sale recorded</p>
          <p className="font-display text-2xl font-black text-ink">{cash(PAY_TOTAL)}</p>
          <p className="text-base text-slate-600">{done.method === 'card' ? 'Paid by card' : 'Paid cash'}</p>
          {done.change !== null && <p className="font-display text-xl font-black text-emerald-700">Change: {cash(done.change)}</p>}
          <p className="text-sm text-slate-500">(Pretend — nothing was recorded and no stock changed.)</p>
          <button
            type="button"
            onClick={() => {
              setDone(null)
              setGiven('')
            }}
            className={ORANGE_BTN}
          >
            Practice again
          </button>
        </div>
      </PracticeFrame>
    )
  return (
    <PracticeFrame>
      <div className="space-y-3">
        <p className="font-display text-xl font-black text-ink">Total {cash(PAY_TOTAL)}</p>
        <p className="text-sm text-slate-600">2 items: Hay, small bag and Carrot toy. Take the money, then tap how they paid.</p>
        <button type="button" onClick={() => pay('card')} className={`${ORANGE_BTN} w-full`}>
          Paid by card
        </button>
        <div className="space-y-2 rounded-2xl border-2 border-slate-200 bg-white p-3">
          <label className="block text-sm font-semibold text-slate-600">
            Cash? How much did they give you? (optional)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={given} onChange={(e) => setGiven(e.target.value)} className={`${field} mt-1`} placeholder="20.00" />
          </label>
          {g !== null && g >= PAY_TOTAL && <p className="font-display text-lg font-black text-emerald-700">Change: {cash(g - PAY_TOTAL)}</p>}
          {g !== null && g < PAY_TOTAL && <p className="text-sm font-bold text-red-700">That’s {cash(PAY_TOTAL - g)} short.</p>}
          <button type="button" onClick={() => pay('cash')} className={`${ORANGE_BTN} w-full`}>
            Paid cash
          </button>
        </div>
        <p className="text-center text-sm text-slate-500">Card payments go through the card reader, as now.</p>
      </div>
    </PracticeFrame>
  )
}

export function PracticeScreen({ kind }: { kind: PracticeKey }) {
  if (kind === 'sell-basket') return <PracticeSellBasket />
  if (kind === 'sell-pay') return <PracticePay />
  if (kind === 'hours') return <PracticeHours />
  if (kind === 'receive') return <PracticeReceive />
  if (kind === 'scan') return <PracticeScan />
  return <PracticeAnnouncement />
}
