// Drop-offs (update 40): each visit someone brought donations — who, when,
// how much, and whether they've been thanked. Tap one for its items and the
// thank-you letter.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { isNeeds40, listDropoffs, type Dropoff } from '../api'
import { ErrorBox } from '../ScanUI'
import { KIND_META, formatMoney, usDate } from '../types'
import { plural } from '../letters'

export default function Dropoffs() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = KIND_META.donation.caps.some((c) => can(c))
  const [rows, setRows] = useState<Dropoff[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needs40, setNeeds40] = useState(false)

  useEffect(() => {
    if (!orgId || !allowed) return
    let alive = true
    listDropoffs(orgId)
      .then((r) => alive && setRows(r))
      .catch((e) => {
        if (!alive) return
        if (isNeeds40(e)) setNeeds40(true)
        else setError(errMessage(e))
      })
    return () => {
      alive = false
    }
  }, [orgId, allowed])

  const toThank = (rows ?? []).filter((r) => !r.thanked_at).length

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <Link to="/staff/items" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={20} /> Items
        </Link>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">Drop-offs</h1>
        <p className="mt-1 text-base text-slate-600">Each time someone brings donations: who gave, what they gave, and their thank-you letter.</p>
      </div>

      {!allowed ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">Drop-offs are for the people who sort donations.</p>
      ) : needs40 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">This needs database update 40.</p>
      ) : (
        <>
          <Link
            to="/staff/donations/report"
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue/50 bg-white font-display text-base font-extrabold text-brand-blue"
          >
            <Icon name="calendar" size={20} /> Donations this month
          </Link>

          <ErrorBox>{error}</ErrorBox>
          {rows === null && !error && <Spinner />}
          {rows && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">No drop-offs yet.</div>
          )}
          {rows && rows.length > 0 && (
            <p className="px-1 text-sm font-semibold text-slate-500">
              {toThank === 0 ? 'Everyone has been thanked.' : `${plural(toThank, 'thank-you')} to send.`}
            </p>
          )}

          <ul className="space-y-2.5">
            {(rows ?? []).map((d) => {
              const name = (d.donor_name ?? '').trim()
              return (
                <li key={d.id}>
                  <Link
                    to={`/staff/dropoffs/${encodeURIComponent(d.id)}`}
                    className="flex min-h-[64px] items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition active:scale-[.99]"
                  >
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
                      <Icon name="gift" size={24} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-display text-[17px] font-extrabold ${name ? 'text-ink' : 'text-slate-500'}`}>{name || 'Not named'}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">
                        {usDate(d.received_on)} · {plural(d.items, 'item')} · {plural(d.pieces, 'piece')}
                        {d.value_total_cents != null ? ` · ${formatMoney(d.value_total_cents)}` : ''}
                      </span>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${
                          d.thanked_at ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-orange-50 text-brand-orange-dark'
                        }`}
                      >
                        {d.thanked_at ? (
                          <>
                            <Icon name="check" size={14} /> Thanked
                          </>
                        ) : (
                          'Thank-you to send'
                        )}
                      </span>
                    </span>
                    <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Screen>
  )
}
