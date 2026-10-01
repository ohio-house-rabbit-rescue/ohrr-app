// Donations this month (update 40): what came in, from whom, what it was
// worth and where it is now — month by month, with a printable page and a
// spreadsheet for the board or the books.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { exportCsv } from '../../../lib/exportFile'
import { Icon } from '../../../components/icons'
import { Screen, SectionLabel } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { ohrr } from '../../../data/ohrr'
import { donationsReceived, isNeeds40, type DonationLine } from '../api'
import { ErrorBox } from '../ScanUI'
import { KIND_META, formatMoney, usDate } from '../types'
import { donationsCsv, donorOf, inGivenOrder, lineCode, lineLabel, monthName, monthRange, plural, reportTotals, whereNow, worthLine } from '../letters'

const navBtn =
  'inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 bg-white px-3 text-[15px] font-bold text-brand-blue transition active:scale-[.98] disabled:opacity-30'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-0.5 font-display text-[26px] font-black leading-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
    </div>
  )
}

export default function DonationsReport() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = KIND_META.donation.caps.some((c) => can(c))
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [lines, setLines] = useState<DonationLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needs40, setNeeds40] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId || !allowed) return
    let alive = true
    setLines(null)
    setError(null)
    setMsg(null)
    const { from, to } = monthRange(month.y, month.m)
    donationsReceived(orgId, from, to)
      .then((r) => alive && setLines(r))
      .catch((e) => {
        if (!alive) return
        if (isNeeds40(e)) setNeeds40(true)
        else setError(errMessage(e))
      })
    return () => {
      alive = false
    }
  }, [orgId, allowed, month.y, month.m])

  const totals = useMemo(() => reportTotals(lines ?? []), [lines])
  const ordered = useMemo(() => inGivenOrder(lines ?? []), [lines])

  const today = new Date()
  const isThisMonth = month.y === today.getFullYear() && month.m === today.getMonth()
  const name = monthName(month.y, month.m)
  const shift = (by: number) =>
    setMonth(({ y, m }) => {
      const t = new Date(y, m + by, 1)
      return { y: t.getFullYear(), m: t.getMonth() }
    })

  const download = async () => {
    if (!lines?.length) return
    setMsg(null)
    const stamp = monthRange(month.y, month.m).from.slice(0, 7)
    const out = await exportCsv(`ohrr-donations-${stamp}.csv`, donationsCsv(ordered))
    if (out === 'failed') setMsg('Couldn’t make the spreadsheet. Please try again.')
  }

  const donorsSub = totals.notNamed > 0 ? `+ ${plural(totals.notNamed, 'item')} not named` : undefined
  const valueSub = totals.noValue > 0 ? `${totals.noValue} had no value` : undefined

  return (
    <>
      <Screen className="space-y-4 print:hidden">
        <div className="pt-1">
          <Link to="/staff/dropoffs" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
            <Icon name="arrowLeft" size={20} /> Drop-offs
          </Link>
          <h1 className="mt-1 font-display text-2xl font-black text-ink">{isThisMonth ? 'Donations this month' : `Donations in ${name}`}</h1>
          <p className="mt-1 text-base text-slate-600">Everything that came in, who gave it, what it was worth and where it is now.</p>
        </div>

        {!allowed ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">The donations report is for the people who sort donations.</p>
        ) : needs40 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">This needs database update 40.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => shift(-1)} className={navBtn} aria-label="Previous month">
                <Icon name="arrowLeft" size={20} />
              </button>
              <p className="flex-1 text-center font-display text-xl font-extrabold text-ink" aria-live="polite">
                {name}
              </p>
              <button type="button" onClick={() => shift(1)} disabled={isThisMonth} className={navBtn} aria-label="Next month">
                <Icon name="chevron" size={20} />
              </button>
            </div>

            <ErrorBox>{error}</ErrorBox>
            {lines === null && !error && <Spinner />}
            {lines && lines.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">Nothing came in during {name}.</div>
            )}

            {lines && lines.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Items" value={String(totals.items)} />
                  <Stat label="Pieces" value={String(totals.pieces)} />
                  <Stat label="Donors" value={String(totals.donors)} sub={donorsSub} />
                  <Stat label="Value" value={formatMoney(totals.value_cents) || '$0'} sub={valueSub} />
                </div>

                <div className="grid gap-3">
                  {!isNative && (
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-brand-blue font-display text-base font-extrabold text-white shadow-sm"
                    >
                      <Icon name="printer" size={20} /> Print
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void download()}
                    className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue/50 bg-white px-3 text-center font-display text-base font-extrabold leading-tight text-brand-blue"
                  >
                    Download a spreadsheet (CSV)
                  </button>
                </div>
                {msg && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{msg}</p>}

                <SectionLabel>Where it is now</SectionLabel>
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {totals.places.map((p) => (
                    <li key={p.label} className="flex min-h-[48px] items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 text-base text-ink">{p.label}</span>
                      <span className="shrink-0 text-right text-base font-extrabold text-ink">
                        {p.lines}
                        {p.pieces !== p.lines && <span className="block text-xs font-semibold text-slate-500">{plural(p.pieces, 'piece')}</span>}
                      </span>
                    </li>
                  ))}
                </ul>

                <SectionLabel>By donor</SectionLabel>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-base">
                    <thead className="bg-slate-50 text-sm text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-bold">Name</th>
                        <th className="px-2 py-2 text-right font-bold">Items</th>
                        <th className="px-4 py-2 text-right font-bold">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {totals.byDonor.map((d) => (
                        <tr key={d.name || '(not named)'}>
                          <td className={`px-4 py-2.5 ${d.name ? 'text-ink' : 'italic text-slate-500'}`}>{d.name || 'Not named'}</td>
                          <td className="px-2 py-2.5 text-right text-ink">{d.items}</td>
                          <td className="px-4 py-2.5 text-right text-ink">{d.value_cents ? formatMoney(d.value_cents) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <SectionLabel>Every donation</SectionLabel>
                <ul className="space-y-2">
                  {ordered.map((l) => {
                    const code = lineCode(l)
                    const worth = worthLine(l)
                    const who = donorOf(l)
                    const body = (
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-base font-extrabold leading-snug text-ink">{lineLabel(l)}</span>
                        <span className="mt-0.5 block text-sm text-slate-600">
                          {usDate(l.received_on)} · {who || 'Not named'}
                          {worth ? ` · ${worth}` : ''}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-slate-700">{whereNow(l, true)}</span>
                      </span>
                    )
                    return (
                      <li key={l.id}>
                        {code ? (
                          <Link to={`/staff/scan?code=${encodeURIComponent(code)}`} className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
                            {body}
                            <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
                          </Link>
                        ) : (
                          <div className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </Screen>

      {/* print-only: a plain report */}
      {lines && lines.length > 0 && (
        <div className="donations-print hidden print:block">
          <h1>Donations received — {name}</h1>
          <p className="sub">
            {ohrr.name} · printed {usDate(today.toISOString().slice(0, 10))}
          </p>
          <table className="totals">
            <tbody>
              <tr>
                <th>Items</th>
                <td>{totals.items}</td>
                <th>Pieces</th>
                <td>{totals.pieces}</td>
              </tr>
              <tr>
                <th>Donors</th>
                <td>
                  {totals.donors}
                  {totals.notNamed > 0 ? ` (+ ${plural(totals.notNamed, 'item')} not named)` : ''}
                </td>
                <th>Value</th>
                <td>
                  {formatMoney(totals.value_cents) || '$0'}
                  {totals.noValue > 0 ? ` (${totals.noValue} had no value)` : ''}
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Where it is now</h2>
          <table>
            <tbody>
              {totals.places.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td className="num">
                    {p.lines}
                    {p.pieces !== p.lines ? ` (${plural(p.pieces, 'piece')})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>By donor</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Items</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {totals.byDonor.map((d) => (
                <tr key={d.name || '(not named)'}>
                  <td>{d.name || 'Not named'}</td>
                  <td className="num">{d.items}</td>
                  <td className="num">{d.value_cents ? formatMoney(d.value_cents) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Every donation</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Donor</th>
                <th>Item</th>
                <th className="num">Value</th>
                <th>Where it is now</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap">{usDate(l.received_on)}</td>
                  <td>{donorOf(l) || 'Not named'}</td>
                  <td>{lineLabel(l)}</td>
                  <td className="num">{formatMoney(l.value_total_cents) || '—'}</td>
                  <td>{whereNow(l, true)}</td>
                  <td className="nowrap mono">{lineCode(l) ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        @media print {
          @page { size: letter; margin: 0.6in; }
          html, body { background: white !important; }
          header, nav, [data-tabbar] { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; padding: 0 !important; }
          .donations-print { font-family: 'Open Sans', Arial, sans-serif; font-size: 10.5pt; color: #000; }
          .donations-print h1 { font-size: 16pt; font-weight: 800; margin: 0; }
          .donations-print .sub { margin: 2pt 0 10pt; color: #444; }
          .donations-print h2 { font-size: 12pt; font-weight: 800; margin: 14pt 0 4pt; }
          .donations-print table { width: 100%; border-collapse: collapse; }
          .donations-print th, .donations-print td { border-bottom: 0.5pt solid #bbb; padding: 3pt 6pt 3pt 0; text-align: left; vertical-align: top; }
          .donations-print thead th { border-bottom: 1pt solid #000; }
          .donations-print .totals th { width: 15%; color: #444; font-weight: 700; }
          .donations-print .num { text-align: right; }
          .donations-print .nowrap { white-space: nowrap; }
          .donations-print .mono { font-family: 'Courier New', monospace; font-size: 9pt; }
          .donations-print tr { break-inside: avoid; }
        }
      `}</style>
    </>
  )
}
