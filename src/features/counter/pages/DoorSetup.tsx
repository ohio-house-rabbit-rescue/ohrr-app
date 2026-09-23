// Counter → Door setup (before doors open, from a phone or a laptop):
//
//   The ticket list   upload the ticket shop's order export (a CSV file); the
//                     app finds the receipt number, name, item and quantity
//                     columns, asks which items are adult / child / under-5
//                     tickets, and adds each receipt with its party. Or add a
//                     receipt by hand. Loading again only adds or updates.
//   Prices            the door prices (BunFest managers).
//   Let in twice      receipts two phones both let in — with times and phones.
import { useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { staffInput } from '../../../components/staffui'
import { BigButton, ErrorBox, StepShell } from '../../scan/ScanUI'
import { clock, money, toCents } from '../local'
import {
  duplicates,
  guessColumns,
  guessType,
  importTickets,
  parseCsv,
  partyText,
  removeTicket,
  rowsToTickets,
  saveDoorSettings,
  totals,
  useDoorSettings,
  useDoorSync,
  type CsvColumns,
  type TicketType,
} from '../door'
import { useCounterOrg } from '../CounterShell'

const TYPE_LABEL: Record<TicketType, string> = { adult: 'Adult ticket', child: 'Child 5–12 ticket', under5: 'Under-5 ticket', skip: 'Not a ticket' }

export default function DoorSetup() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { orgId, offline } = useCounterOrg()
  const settings = useDoorSettings(orgId)
  const door = useDoorSync(orgId, settings.event_key)
  const isManager = can('events.bunfest.manage')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const t = totals(door.tickets, door.entries)
  const twice = duplicates(door.entries)
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (s ? door.tickets.filter((x) => x.code.toLowerCase().includes(s) || (x.name ?? '').toLowerCase().includes(s)) : door.tickets).slice(0, 50)
  }, [q, door.tickets])

  const done = async (msg: string) => {
    setNote(msg)
    setError(null)
    await door.syncNow()
  }

  return (
    <StepShell title="Door setup" help={settings.event_name} onBack={() => navigate('/staff/counter/door')} backLabel="Door">
      <div className="space-y-5">
        {offline && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Setup needs signal.</p>}
        {note && <p className="rounded-2xl bg-green-50 px-4 py-3 text-base font-semibold text-green-800">{note}</p>}
        <ErrorBox>{error}</ErrorBox>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Receipts" value={String(door.tickets.length)} />
          <Stat label="Used" value={`${t.ticketsUsed}`} />
          <Stat label="In so far" value={String(t.advance + t.atDoor)} />
        </div>

        {orgId && !offline && (
          <ImportCsv
            onImport={async (rows) => {
              try {
                const r = await importTickets(orgId, settings.event_key, rows)
                await done(`Added ${r.new} ${r.new === 1 ? 'receipt' : 'receipts'}${r.updated ? `, updated ${r.updated}` : ''}.`)
              } catch (e) {
                setError(errMessage(e))
              }
            }}
          />
        )}

        {orgId && !offline && (
          <AddByHand
            onAdd={async (row) => {
              try {
                await importTickets(orgId, settings.event_key, [row], 'manual')
                await done(`Receipt ${row.code} added.`)
              } catch (e) {
                setError(errMessage(e))
              }
            }}
          />
        )}

        {twice.length > 0 && (
          <section className="space-y-2 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
            <p className="font-display text-lg font-extrabold text-red-800">Let in twice</p>
            <p className="text-sm text-red-800">Usually two door phones that were both without signal. Each entry shows when and where.</p>
            <ul className="space-y-2">
              {twice.map((d) => (
                <li key={d.code} className="rounded-xl bg-white px-3 py-2 text-sm">
                  <strong>Receipt {d.code}</strong> — {d.uses.map((u) => `${clock(u.at)}${u.device ? ` (${u.device})` : ''}${u.override_reason ? ` — “${u.override_reason}”` : ''}`).join(' · ')}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <p className="font-display text-lg font-extrabold text-ink">The ticket list</p>
          <input className={staffInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a receipt or name" aria-label="Find a receipt" />
          {door.tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No receipts yet — load the ticket shop’s export above.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
              {shown.map((x) => (
                <li key={x.code} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">
                      {x.code} · {x.name || '—'}
                    </span>
                    <span className="text-slate-500">{partyText(x)}</span>
                  </span>
                  {isManager && orgId && !offline && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Take receipt ${x.code} off the list?`)) return
                        try {
                          await removeTicket(orgId, settings.event_key, x.code)
                          await done(`Receipt ${x.code} taken off.`)
                        } catch (e) {
                          setError(errMessage(e))
                        }
                      }}
                      className="shrink-0 text-xs font-bold text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isManager && orgId && !offline && (
          <Prices
            initial={settings}
            onSave={async (s) => {
              try {
                await saveDoorSettings(orgId, s)
                setNote('Door settings saved. Door phones pick them up next time they open the Door screen.')
                setError(null)
              } catch (e) {
                setError(errMessage(e))
              }
            }}
          />
        )}
      </div>
    </StepShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-display text-xl font-black text-ink">{value}</p>
    </div>
  )
}

/* ================================================= the ticket shop's export */

function ImportCsv({ onImport }: { onImport: (rows: ReturnType<typeof rowsToTickets>) => Promise<void> }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [cols, setCols] = useState<CsvColumns | null>(null)
  const [types, setTypes] = useState<Record<string, TicketType>>({})
  const [busy, setBusy] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileError(null)
    const all = parseCsv(await f.text())
    if (all.length < 2) {
      setFileError('That file has no rows. Choose the orders export (a .csv file).')
      return
    }
    const c = guessColumns(all[0])
    setRows(all)
    setCols(c)
    const items = new Set(all.slice(1).map((r) => (c.item >= 0 ? (r[c.item] ?? '').trim() : 'Admission')))
    setTypes(Object.fromEntries([...items].map((i) => [i, guessType(i)])))
  }

  const header = rows?.[0] ?? []
  const tickets = rows && cols && cols.code >= 0 ? rowsToTickets(rows.slice(1), cols, types) : []
  const sum = tickets.reduce((a, x) => ({ adults: a.adults + x.adults, children: a.children + x.children, under5: a.under5 + x.under5 }), { adults: 0, children: 0, under5: 0 })

  const colSelect = (key: keyof CsvColumns, label: string, optional = false) =>
    cols && (
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        <select className={staffInput} value={cols[key]} onChange={(e) => setCols({ ...cols, [key]: Number(e.target.value) })}>
          {optional && <option value={-1}>(none)</option>}
          {!optional && cols[key] < 0 && <option value={-1}>Choose…</option>}
          {header.map((h, i) => (
            <option key={`${h}-${i}`} value={i}>
              {h || `Column ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
    )

  return (
    <section className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4">
      <p className="font-display text-lg font-extrabold text-ink">Load the advance tickets</p>
      {!rows ? (
        <>
          <p className="text-sm text-slate-600">
            In the ticket shop (Square), export the orders as a CSV file, then choose it here. Do it again the morning of the event to pick up late buyers — receipts already loaded are just updated.
          </p>
          <label className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-blue px-5 font-display text-base font-extrabold text-white">
            Choose the CSV file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onFile(e)} />
          </label>
          <ErrorBox>{fileError}</ErrorBox>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">{rows.length - 1} rows. Check the columns — the app guessed them from the headings.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {colSelect('code', 'Receipt / order number')}
            {colSelect('name', 'Buyer’s name', true)}
            {colSelect('item', 'Item', true)}
            {colSelect('qty', 'Quantity', true)}
          </div>
          {Object.keys(types).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Which items are tickets?</p>
              {Object.entries(types).map(([item, ty]) => (
                <label key={item} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-ink">{item || '(no item name)'}</span>
                  <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" value={ty} onChange={(e) => setTypes({ ...types, [item]: e.target.value as TicketType })}>
                    {(Object.keys(TYPE_LABEL) as TicketType[]).map((k) => (
                      <option key={k} value={k}>
                        {TYPE_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <p className="rounded-xl bg-brand-blue-50 px-3 py-2 text-sm text-brand-blue">
            {tickets.length} receipts · {partyText(sum)}
          </p>
          <div className="flex gap-2">
            <BigButton
              disabled={!tickets.length || busy}
              onClick={async () => {
                setBusy(true)
                await onImport(tickets)
                setBusy(false)
                setRows(null)
              }}
            >
              {busy ? 'Loading…' : 'Add to the door list'}
            </BigButton>
          </div>
          <button type="button" onClick={() => setRows(null)} className="w-full text-center text-sm font-bold text-slate-500">
            Choose a different file
          </button>
        </>
      )}
    </section>
  )
}

/* ================================================= by hand */

function AddByHand({ onAdd }: { onAdd: (row: { code: string; name: string; adults: number; children: number; under5: number }) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ code: '', name: '', adults: '1', children: '0', under5: '0' })
  const num = (s: string) => Math.max(0, parseInt(s.replace(/[^0-9]/g, ''), 10) || 0)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-center text-sm font-bold text-brand-blue">
        + Add a receipt by hand
      </button>
    )
  return (
    <section className="space-y-2 rounded-2xl border-2 border-slate-200 bg-white p-4">
      <p className="font-display text-lg font-extrabold text-ink">Add a receipt by hand</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-semibold text-slate-700">
          Receipt number
          <input className={staffInput} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} autoComplete="off" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Name
          <input className={staffInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
        </label>
        {(
          [
            ['adults', 'Adults'],
            ['children', 'Children 5–12'],
            ['under5', 'Under 5'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="block text-sm font-semibold text-slate-700">
            {label}
            <input className={staffInput} inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!f.code.trim() || num(f.adults) + num(f.children) + num(f.under5) === 0}
          onClick={async () => {
            await onAdd({ code: f.code, name: f.name.trim(), adults: num(f.adults), children: num(f.children), under5: num(f.under5) })
            setF({ code: '', name: '', adults: '1', children: '0', under5: '0' })
            setOpen(false)
          }}
          className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Add it
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </section>
  )
}

/* ================================================= prices */

function Prices({ initial, onSave }: { initial: { event_key: string; event_name: string; prices: { adult: number; child: number; under5: number } }; onSave: (s: typeof initial) => Promise<void> }) {
  const dollars = (c: number) => (c / 100).toFixed(c % 100 === 0 ? 0 : 2)
  const fromInitial = () => ({
    event_key: initial.event_key,
    event_name: initial.event_name,
    adult: dollars(initial.prices.adult),
    child: dollars(initial.prices.child),
    under5: dollars(initial.prices.under5),
  })
  const [f, setF] = useState(fromInitial)
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setF(fromInitial())
          setOpen(true)
        }}
        className="w-full text-center text-sm font-bold text-brand-blue"
      >
        Door prices: adults {money(initial.prices.adult)}, 5–12 {money(initial.prices.child)}, under 5 {initial.prices.under5 ? money(initial.prices.under5) : 'free'} — change
      </button>
    )
  const cents = { adult: toCents(f.adult), child: toCents(f.child), under5: toCents(f.under5) }
  const ok = cents.adult !== null && cents.child !== null && cents.under5 !== null && f.event_key.trim() && f.event_name.trim()
  return (
    <section className="space-y-2 rounded-2xl border-2 border-slate-200 bg-white p-4">
      <p className="font-display text-lg font-extrabold text-ink">Door settings</p>
      <label className="block text-sm font-semibold text-slate-700">
        Event
        <input className={staffInput} value={f.event_name} onChange={(e) => setF({ ...f, event_name: e.target.value })} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Short name for this year’s list (a new name starts an empty list)
        <input className={staffInput} value={f.event_key} onChange={(e) => setF({ ...f, event_key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['adult', 'Adult $'],
            ['child', '5–12 $'],
            ['under5', 'Under 5 $'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="block text-sm font-semibold text-slate-700">
            {label}
            <input className={staffInput} inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!ok}
          onClick={async () => {
            await onSave({ event_key: f.event_key.trim(), event_name: f.event_name.trim(), prices: { adult: cents.adult ?? 0, child: cents.child ?? 0, under5: cents.under5 ?? 0 } })
            setOpen(false)
          }}
          className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </section>
  )
}
