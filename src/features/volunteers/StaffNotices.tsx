// Two notices for the staff dashboard (update 25):
//
//   "3 volunteer applications waiting" — for whoever looks after volunteers;
//   "Certificates to consider (2)"     — for whoever makes certificates
//     (volunteers.certificates), when a volunteer has made an hours letter or
//     passed an hours mark. Each can be made there and then, or put off.
//
// Before update 25 runs neither table/column exists, and both stay hidden.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errMessage } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { countApplications } from './api'
import { suggestionReason, type CertificateSuggestion } from './approval'

export function ApplicationsNotice({ orgId }: { orgId: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    countApplications(orgId).then((c) => alive && setN(c))
    return () => {
      alive = false
    }
  }, [orgId])
  if (n === 0) return null
  return (
    <Link
      to="/staff/volunteers"
      className="flex items-center gap-3 rounded-2xl border border-brand-orange/40 bg-brand-orange-50/50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-orange/15 text-brand-orange-dark">
        <Icon name="users" size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-ink">
          {n} volunteer application{n === 1 ? '' : 's'} waiting
        </span>
        <span className="block text-sm text-slate-600">Read {n === 1 ? 'it' : 'them'} and approve in Volunteers</span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
    </Link>
  )
}

type Suggestion = CertificateSuggestion & { name: string; email: string | null }

/** Open the certificate screen for this volunteer, ready to make the certificate. */
export function certificateHref(s: Pick<Suggestion, 'id' | 'reason' | 'name' | 'email'>): string {
  const p = new URLSearchParams({
    email: s.email ?? '',
    name: s.name,
    kind: 'certificate',
    heading: s.reason === 'hours' ? 'achievement' : 'appreciation',
    period: 'all',
    suggestion: s.id,
  })
  return `/staff/hours-letter?${p.toString()}`
}

export function CertificatesNotice({ orgId }: { orgId: string }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Suggestion[]>([])
  const [all, setAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('certificate_suggestions')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error || !data) return setRows([])
    const ids = [...new Set(data.map((s) => s.volunteer_id))]
    const people = new Map<string, { name: string; email: string | null }>()
    if (ids.length) {
      const { data: vs } = await supabase.from('volunteers').select('id, name, email').in('id', ids)
      for (const v of vs ?? []) people.set(v.id, { name: v.name, email: v.email })
    }
    setRows(
      data.map((s) => ({
        ...s,
        hours: s.hours == null ? null : Number(s.hours),
        name: people.get(s.volunteer_id)?.name ?? 'A volunteer',
        email: people.get(s.volunteer_id)?.email ?? null,
      })),
    )
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const notNow = async (id: string) => {
    setError(null)
    const { error } = await supabase
      .from('certificate_suggestions')
      .update({ status: 'dismissed', handled_by: user?.id ?? null, handled_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(errMessage(error))
    else setRows((r) => r.filter((s) => s.id !== id))
  }

  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, 4)

  return (
    <Card className="border-brand-blue/30 bg-brand-blue-50/40">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
          <Icon name="award" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-extrabold text-ink">Certificates to consider ({rows.length})</p>
          <p className="text-sm text-slate-600">Volunteers who made an hours letter or passed one of your certificate hours.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {shown.map((s) => (
          <li key={s.id} className="rounded-xl bg-white p-3">
            <p className="font-bold text-ink">{s.name}</p>
            <p className="text-sm text-slate-600">{suggestionReason(s)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {s.email ? (
                <Link
                  to={certificateHref(s)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-blue px-4 text-sm font-bold text-white"
                >
                  <Icon name="award" size={16} /> Make certificate
                </Link>
              ) : (
                <span className="text-xs text-slate-500">No email on their record — add one in Volunteers first.</span>
              )}
              <button
                type="button"
                onClick={() => void notNow(s.id)}
                className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600"
              >
                Not now
              </button>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 min-h-[44px] text-sm font-bold text-brand-blue">
          Show all {rows.length}
        </button>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </Card>
  )
}
