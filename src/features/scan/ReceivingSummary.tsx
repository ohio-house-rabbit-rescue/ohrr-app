// "I'm done": everything received on this phone today, with the thank-you
// letters for each donor and the summary to print or send — a PDF, the
// one-page list and the full spreadsheet (OHRR 2026-10-27).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errMessage } from '../../lib/supabase'
import { Icon } from '../../components/icons'
import { Spinner } from '../../components/staffui'
import ExportButtons from '../../components/ExportButtons'
import { todayStamp, type SheetSpec } from '../../lib/inventoryExport'
import { itemPhotos, listItems } from './api'
import { BigButton, ErrorBox, Part, StepShell } from './ScanUI'
import { SHEET_COLUMNS, SIMPLE_COLUMNS, sheetRow, simpleRow } from './itemSheets'
import { formatMoney, type TaggedItem } from './types'
import { fromLine, itemCents, receivingSummaryPdf, summarize, type SessionItem } from './receivingSession'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function ReceivingSummary({
  orgId,
  session,
  onMore,
  onDone,
}: {
  orgId: string
  session: SessionItem[]
  /** Back to receiving; today's list keeps growing. */
  onMore: () => void
  /** Finished for today: the list starts again next time. */
  onDone: () => void
}) {
  const navigate = useNavigate()
  const [items, setItems] = useState<TaggedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const order = new Map(session.map((s, i) => [s.code, i]))
    listItems(orgId)
      .then((rows) => {
        if (!alive) return
        setItems(rows.filter((r) => order.has(r.code)).sort((a, b) => order.get(a.code)! - order.get(b.code)!))
      })
      .catch((e) => alive && setError(errMessage(e)))
    return () => {
      alive = false
    }
  }, [orgId, session])

  const made = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const sheet = (): SheetSpec => ({
    filename: `ohrr-received-${todayStamp()}`,
    sheetName: 'Received',
    title: `Ohio House Rabbit Rescue — items received ${made} (${items?.length ?? 0})`,
    columns: SHEET_COLUMNS,
    rows: (items ?? []).map(sheetRow),
  })
  const simpleSheet = (): SheetSpec => ({
    ...sheet(),
    filename: `ohrr-received-list-${todayStamp()}`,
    columns: SIMPLE_COLUMNS,
    rows: (items ?? []).map(simpleRow),
    layout: 'print',
  })

  const { groups, totals } = summarize(items ?? [])
  const unprintedCodes = (items ?? []).filter((i) => !i.label_printed_at).map((i) => i.code)
  const letters = groups.filter((g) => !g.bought)

  return (
    <StepShell
      title="Done receiving"
      help="Everything received on this phone today: thank each donor, print what’s left, and print or send the summary."
      onBack={onMore}
      backLabel="Receive more"
      footer={
        <div className="space-y-2">
          <BigButton onClick={onDone} icon="check">
            Done for today
          </BigButton>
          <BigButton tone="plain" onClick={onMore} icon="camera">
            Receive more
          </BigButton>
        </div>
      }
    >
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        {items === null && !error && <Spinner />}
        {items && items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">Nothing received yet today.</p>
        )}
        {items && items.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                [String(totals.items), totals.items === 1 ? 'item' : 'items'],
                [String(totals.donors), totals.donors === 1 ? 'donor' : 'donors'],
                totals.given ? [formatMoney(totals.given), 'value given'] : [String(totals.pieces), totals.pieces === 1 ? 'piece' : 'pieces'],
              ].map(([big, small]) => (
                <div key={small} className="rounded-2xl bg-brand-blue-50 p-3 text-center">
                  <p className="font-display text-2xl font-black text-brand-blue">{big}</p>
                  <p className="text-sm font-bold text-slate-600">{small}</p>
                </div>
              ))}
            </div>
            {totals.paid > 0 && <p className="text-center text-[15px] text-slate-600">We paid {formatMoney(totals.paid)} for the things we bought.</p>}

            <Part n="A">Labels</Part>
            {unprintedCodes.length ? (
              <BigButton
                tone="outline"
                icon="printer"
                onClick={() => navigate(`/staff/labels?${unprintedCodes.map((c) => `code=${encodeURIComponent(c)}`).join('&')}`)}
              >
                Print the {plural(unprintedCodes.length, 'label')} still waiting
              </BigButton>
            ) : (
              <p className="flex items-center gap-2 text-[15px] font-bold text-green-800">
                <Icon name="check" size={18} /> Every label is printed.
              </p>
            )}

            {letters.length > 0 && (
              <>
                <Part n="B">Thank-you letters</Part>
                <p className="text-[15px] text-slate-600">One letter for each donor, with everything they brought today.</p>
                <div className="space-y-2">
                  {letters.map((g) =>
                    g.dropoffId ? (
                      <Link
                        key={g.key}
                        to={`/staff/dropoffs/${g.dropoffId}`}
                        className="flex min-h-[60px] items-center gap-3 rounded-2xl border-2 border-brand-blue bg-white px-4 py-2"
                      >
                        <Icon name="mail" size={22} className="shrink-0 text-brand-blue" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-lg font-extrabold leading-tight text-ink">Letter to {g.name}</span>
                          <span className="block text-sm text-slate-600">
                            {plural(g.items.length, 'item')}
                            {g.cents ? ` · value ${formatMoney(g.cents)}` : ''}
                          </span>
                        </span>
                        <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
                      </Link>
                    ) : (
                      <p key={g.key} className="rounded-2xl bg-slate-50 px-4 py-3 text-[15px] text-slate-600">
                        {g.name}: {plural(g.items.length, 'item')} — no drop-off was saved, so write this letter from Drop-offs.
                      </p>
                    ),
                  )}
                </div>
                <Link to="/staff/dropoffs" className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-brand-blue">
                  All drop-offs and thank-yous
                </Link>
              </>
            )}

            <Part n={letters.length > 0 ? 'C' : 'B'}>Print or send the summary</Part>
            <p className="text-[15px] text-slate-600">
              The summary is a PDF with the totals, who it came from and every item with its photo. The spreadsheets are the one-page list and the full one.
            </p>
            <ExportButtons
              spec={sheet}
              label="Full spreadsheet"
              simple={simpleSheet}
              pdf={{
                label: 'Summary (PDF)',
                title: `Items received ${made}`,
                filename: `ohrr-received-summary-${todayStamp()}`,
                build: (progress) => receivingSummaryPdf(items, progress),
              }}
            />

            <p className="font-display text-base font-black uppercase tracking-wide text-slate-500">What came in</p>
            <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
              {items.map((i) => {
                const photo = itemPhotos(i)[0]
                return (
                  <li key={i.code}>
                    <Link to={`/staff/scan?code=${encodeURIComponent(i.code)}`} className="flex items-center gap-3 px-3 py-2">
                      {photo ? (
                        <img src={photo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <Icon name="camera" size={20} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-bold text-ink">
                          {i.title}
                          {(i.quantity ?? 1) > 1 ? ` (${i.quantity})` : ''}
                        </span>
                        <span className="block truncate text-sm text-slate-500">
                          {fromLine(i)}
                          {i.location ? ` · ${i.location}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        <span className="block font-mono text-slate-500">{i.code}</span>
                        {itemCents(i) > 0 && <span className="block font-bold text-ink">{formatMoney(itemCents(i))}</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </StepShell>
  )
}
