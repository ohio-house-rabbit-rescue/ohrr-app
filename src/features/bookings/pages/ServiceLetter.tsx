// /staff/hours-letter?email=&name=&from=&to= — a printable service-hours
// letter on OHRR letterhead: the volunteer's dated entries, the total, and a
// signature line. Print (or Save as PDF) from the phone or a computer.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { ohrr } from '../../../data/ohrr'
import { btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner } from '../../../components/staffui'
import { hoursHistory, type HoursLine } from '../api'
import { fmtDate, fmtHours } from './HoursTab'
import { isNative } from '../../../native/platform'
import { renderLetter } from '../letterImage'
import { canvasToBlob } from '../../share/render'
import { savePngAsync } from '../../share/share'

export default function ServiceLetter() {
  const { membership, user } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const name = params.get('name') || email
  const from = params.get('from') ?? `${new Date().getFullYear()}-01-01`
  const to = params.get('to') ?? new Date().toISOString().slice(0, 10)
  const [lines, setLines] = useState<HoursLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!orgId || !email) return
    hoursHistory(orgId, email, from, to)
      .then((l) => setLines([...l].sort((a, b) => a.on_date.localeCompare(b.on_date))))
      .catch((e) => setError(errMessage(e)))
  }, [orgId, email, from, to])

  const total = useMemo(() => (lines ?? []).reduce((s, l) => s + l.hours, 0), [lines])
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  // In the app there is no window.print(): paint the letter and share it.
  const shareLetter = async () => {
    if (!lines) return
    setSharing(true)
    try {
      const canvas = document.createElement('canvas')
      await renderLetter(canvas, { name, from, to, lines, total, today, signer: user?.email ?? undefined, fmtDate, fmtHours })
      await savePngAsync(await canvasToBlob(canvas), `ohrr-service-hours-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setSharing(false)
    }
  }
  const subject = encodeURIComponent(`Volunteer service hours — ${name}`)
  const body = encodeURIComponent(
    `To whom it may concern,\n\n${name} volunteered ${fmtHours(total)} hours with Ohio House Rabbit Rescue between ${fmtDate(from)} and ${fmtDate(to)}.\n\n${(lines ?? []).map((l) => `${fmtDate(l.on_date)} — ${l.activity} — ${fmtHours(l.hours)} h`).join('\n')}\n\nOhio House Rabbit Rescue, Inc. · ${ohrr.address} · ${ohrr.phone}\n`,
  )

  return (
    <>
      <div className="px-5 pt-3 print:hidden">
        <Link to="/staff/bookings" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={20} /> Bookings
        </Link>
        <div className="mt-2 flex flex-wrap gap-2">
          {isNative ? (
            <button type="button" onClick={() => void shareLetter()} className={btn.primary} disabled={!lines || sharing}>
              <Icon name="printer" size={16} /> {sharing ? 'Making the letter…' : 'Print / share the letter'}
            </button>
          ) : (
            <button type="button" onClick={() => window.print()} className={btn.primary} disabled={!lines}>
              <Icon name="printer" size={16} /> Print / save as PDF
            </button>
          )}
          <a href={`mailto:${email}?subject=${subject}&body=${body}`} className={btn.outline}>
            <Icon name="mail" size={16} /> Email the text
          </a>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        {lines === null && !error && <Spinner />}
      </div>

      {lines && (
        <div className="letter mx-5 my-5 rounded-2xl border border-slate-200 bg-white p-6 print:m-0 print:rounded-none print:border-0 print:p-0">
          <div className="flex items-center gap-3 border-b-4 border-brand-blue pb-4">
            <img src="/ohrr-mark.png" alt="" className="h-14 w-14" />
            <div>
              <p className="font-display text-xl font-black text-brand-blue">Ohio House Rabbit Rescue, Inc.</p>
              <p className="text-sm text-slate-600">
                {ohrr.address} · {ohrr.phone} · {ohrr.email}
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-600">{today}</p>
          <h1 className="mt-4 font-display text-2xl font-black text-ink">Verification of volunteer service hours</h1>
          <p className="mt-4 text-base leading-relaxed text-ink">
            To whom it may concern: this letter confirms that <strong>{name}</strong> volunteered{' '}
            <strong>{fmtHours(total)} hours</strong> with Ohio House Rabbit Rescue between {fmtDate(from)} and {fmtDate(to)}, as recorded in our volunteer system.
          </p>
          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">Activity</th>
                <th className="py-1.5 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={`${l.source}:${l.ref_id}`} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(l.on_date)}</td>
                  <td className="py-1.5 pr-3">{l.activity}</td>
                  <td className="py-1.5 text-right">{fmtHours(l.hours)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2" colSpan={2}>
                  Total
                </td>
                <td className="py-2 text-right">{fmtHours(total)} hours</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-6 text-base leading-relaxed text-ink">
            Ohio House Rabbit Rescue is a 501(c)(3) nonprofit rabbit rescue and adoption center in Columbus, Ohio. Please contact us at {ohrr.email} or {ohrr.phone} with any questions.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-8 text-sm text-slate-600">
            <div>
              <div className="h-10 border-b border-slate-400" />
              <p className="mt-1">Signature, Ohio House Rabbit Rescue</p>
              <p className="text-xs">{user?.email}</p>
            </div>
            <div>
              <div className="h-10 border-b border-slate-400" />
              <p className="mt-1">Printed name and role</p>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          @page { size: letter; margin: 0.8in; }
          header, nav, [data-tabbar] { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; }
          .letter { font-size: 12pt; }
        }
      `}</style>
    </>
  )
}
