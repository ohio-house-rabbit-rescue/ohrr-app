// Counter → Today at the till: what sold, and how much in cash and on card —
// to check against the cash box and the card reader at closing.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errMessage } from '../../../lib/supabase'
import { staffInput } from '../../../components/staffui'
import { ErrorBox, StepShell } from '../../scan/ScanUI'
import { money } from '../local'
import { counterDay, useTill, type CounterDay } from '../sales'
import { SyncPill, useCounterOrg } from '../CounterShell'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

export default function CounterToday() {
  const navigate = useNavigate()
  const { orgId, offline } = useCounterOrg()
  const till = useTill(orgId)
  const [day, setDay] = useState(today())
  const [data, setData] = useState<CounterDay | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId || offline) return
    setData(undefined)
    setError(null)
    counterDay(orgId, day)
      .then(setData)
      .catch((e) => setError(errMessage(e)))
  }, [orgId, offline, day, till.waiting])

  return (
    <StepShell title="Today at the till" onBack={() => navigate('/staff/counter')} backLabel="Counter">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <SyncPill waiting={till.waiting} online={till.online} error={till.error} />
          <input type="date" className={`${staffInput} !mt-0 !w-auto`} value={day} onChange={(e) => setDay(e.target.value || today())} aria-label="Which day" />
        </div>
        {till.waiting > 0 && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {till.waiting} {till.waiting === 1 ? 'sale on this phone hasn’t' : 'sales on this phone haven’t'} been sent yet, so {till.waiting === 1 ? 'it isn’t' : 'they aren’t'} counted below. They’ll send when there’s signal.
          </p>
        )}
        {offline && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">The totals need signal.</p>}
        <ErrorBox>{error}</ErrorBox>
        {data === undefined && !error && !offline && <p className="text-center text-sm text-slate-500">Adding it up…</p>}
        {data === null && <p className="text-sm text-slate-600">You don’t have access to the till totals.</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tot label="Cash" cents={data.cash_cents} />
              <Tot label="Card" cents={data.card_cents} />
              <Tot label="Sales" text={String(data.sales)} />
              <Tot label="Total" cents={data.cash_cents + data.card_cents + data.other_cents} strong />
            </div>
            {data.items.length === 0 ? (
              <p className="text-center text-sm text-slate-500">Nothing sold on this day.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {data.items.map((i) => (
                  <div key={i.name} className="flex items-center justify-between gap-2 px-4 py-2.5 text-base">
                    <span className="min-w-0 truncate text-ink">{i.name}</span>
                    <span className="shrink-0 text-slate-600">
                      {i.qty} · <strong className="text-ink">{money(i.cents)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </StepShell>
  )
}

function Tot({ label, cents, text, strong }: { label: string; cents?: number; text?: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${strong ? 'bg-ink text-white' : 'border border-slate-200 bg-white'}`}>
      <p className={`text-xs font-extrabold uppercase tracking-wider ${strong ? 'text-white/70' : 'text-slate-500'}`}>{label}</p>
      <p className="font-display text-2xl font-black">{text ?? money(cents ?? 0)}</p>
    </div>
  )
}
