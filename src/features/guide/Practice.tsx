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

export function PracticeScreen({ kind }: { kind: PracticeKey }) {
  if (kind === 'hours') return <PracticeHours />
  if (kind === 'receive') return <PracticeReceive />
  if (kind === 'scan') return <PracticeScan />
  return <PracticeAnnouncement />
}
