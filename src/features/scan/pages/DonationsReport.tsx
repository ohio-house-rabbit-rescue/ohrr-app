// Donations this month (update 40): what came in, from whom, what it was
// worth and where it is now — month by month, with a PDF (to print or send,
// from a phone too) and a spreadsheet for the board or the books.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import ExportButtons from '../../../components/ExportButtons'
import { Screen, SectionLabel } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { donationsReceived, isNeeds40, type DonationLine } from '../api'
import { ErrorBox } from '../ScanUI'
import { KIND_META, formatMoney, usDate } from '../types'
import { donorOf, inGivenOrder, lineCode, lineLabel, monthName, monthRange, plural, reportTotals, whereNow, worthLine } from '../letters'
import { donationsReportPdf, donationsSheet } from '../donationsExport'
import { StaffTitle } from '../../../components/StaffTitle'

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

  useEffect(() => {
    if (!orgId || !allowed) return
    let alive = true
    setLines(null)
    setError(null)
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

  const stamp = monthRange(month.y, month.m).from.slice(0, 7)

  const donorsSub = totals.notNamed > 0 ? `+ ${plural(totals.notNamed, 'item')} not named` : undefined
  const valueSub = totals.noValue > 0 ? `${totals.noValue} had no value` : undefined

  return (
    <>
      <Screen className="space-y-4">
        <div className="pt-1">
          <Link to="/staff/dropoffs" className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-base font-bold text-brand-blue hover:bg-brand-blue-50">
            <Icon name="arrowLeft" size={20} /> Drop-offs
          </Link>
          <StaffTitle title={isThisMonth ? 'Donations this month' : `Donations in ${name}`}>
            <p>Everything that came in, who gave it, what it was worth and where it is now.</p>
          </StaffTitle>
        </div>

        {!allowed ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">The donations report is for the people who sort donations.</p>
        ) : needs40 ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">This isn’t switched on yet — ask an admin.</p>
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
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-600">Nothing came in during {name}.</div>
            )}

            {lines && lines.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Items" value={String(totals.items)} />
                  <Stat label="Pieces" value={String(totals.pieces)} />
                  <Stat label="Donors" value={String(totals.donors)} sub={donorsSub} />
                  <Stat label="Value" value={formatMoney(totals.value_cents) || '$0'} sub={valueSub} />
                </div>

                <ExportButtons
                  spec={() => donationsSheet(ordered, name, stamp)}
                  label="Spreadsheet with photos"
                  pdf={{
                    label: 'Report (PDF)',
                    title: `Donations received - ${name}`,
                    filename: `ohrr-donations-${stamp}`,
                    build: () => donationsReportPdf(lines, ordered, name),
                  }}
                />

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

    </>
  )
}
