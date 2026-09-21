// Staff → Impact: the yearly numbers. Pick a year, type the counts, add a
// few highlight lines, publish. Volunteer hours can be pulled from the Hours
// tab with one tap.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { hoursTotalForYear } from '../../bookings/api'
import { IMPACT_FIELDS, deleteImpact, listImpact, saveImpact, type ImpactYear } from '../api'

type Draft = { fields: Record<string, string>; highlights: string; note: string; is_published: boolean }

function toDraft(r: ImpactYear | null): Draft {
  const d: Draft = { fields: {}, highlights: r?.highlights.join('\n') ?? '', note: r?.note ?? '', is_published: r?.is_published ?? false }
  for (const f of IMPACT_FIELDS) {
    const v = r?.[f.key]
    d.fields[f.key] = v == null ? '' : f.money ? String(Math.round(Number(v) / 100)) : String(v)
  }
  return d
}

export default function StaffImpact() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<ImpactYear[] | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [d, setD] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await listImpact(orgId)
      setRows(r)
      return r
    } catch (e) {
      setError(errMessage(e))
      return []
    }
  }, [orgId])
  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])
  useEffect(() => {
    if (rows) setD(toDraft(rows.find((r) => r.year === year) ?? null))
  }, [rows, year])

  if (!can('announcements.post')) return <Screen><p className="text-sm text-slate-600">You don’t have access to the impact page.</p></Screen>

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!d) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const row: Partial<ImpactYear> & { org_id: string; year: number } = {
        org_id: orgId,
        year,
        highlights: d.highlights.split('\n').map((s) => s.trim()).filter(Boolean),
        note: d.note.trim() || null,
        is_published: d.is_published,
      }
      for (const f of IMPACT_FIELDS) {
        const raw = d.fields[f.key].replace(/[^0-9.]/g, '')
        const n = raw === '' ? null : Number(raw)
        ;(row as Record<string, unknown>)[f.key] = n == null ? null : f.money ? Math.round(n * 100) : n
      }
      await saveImpact(row, user?.id ?? '')
      await load()
      setMsg(d.is_published ? `Saved and published — visible at /impact.` : 'Saved as a draft (not public yet).')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const pullHours = async () => {
    try {
      const h = await hoursTotalForYear(orgId, year)
      setD((x) => (x ? { ...x, fields: { ...x.fields, volunteer_hours: String(Math.round(h)) } } : x))
      setMsg(`Volunteer hours from the Hours tab for ${year}: ${Math.round(h)}.`)
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Impact</h1>
        <p className="mt-1 text-sm text-slate-600">The year in numbers, for donors, sponsors and volunteers. Shown at /impact on the app and the website once published.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {years.map((y) => {
          const has = rows?.find((r) => r.year === y)
          return (
            <button key={y} type="button" onClick={() => setYear(y)} className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${year === y ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
              {y}
              {has ? (has.is_published ? ' ●' : ' ○') : ''}
            </button>
          )
        })}
      </div>
      {rows === null && !error && <Spinner />}
      {d && (
        <form onSubmit={save} className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-display text-lg font-extrabold text-ink">{year}</p>
              {rows?.find((r) => r.year === year)?.is_published ? <Badge tone="blue">Published</Badge> : <Badge tone="slate">Draft</Badge>}
            </div>
            {IMPACT_FIELDS.map((f) => (
              <label key={f.key} className="block text-sm font-semibold text-slate-700">
                {f.label}
                <span className="block text-xs font-normal text-slate-500">{f.hint}</span>
                <div className="flex gap-2">
                  <input className={staffInput} inputMode="decimal" value={d.fields[f.key]} onChange={(e) => setD({ ...d, fields: { ...d.fields, [f.key]: e.target.value } })} placeholder={f.money ? '12500' : ''} />
                  {f.key === 'volunteer_hours' && (
                    <button type="button" onClick={() => void pullHours()} className="mt-1 shrink-0 rounded-xl bg-brand-blue-50 px-3 text-xs font-bold text-brand-blue">
                      Use Hours tab
                    </button>
                  )}
                </div>
              </label>
            ))}
            <label className="block text-sm font-semibold text-slate-700">
              Highlights — one per line (optional)
              <textarea className={staffInput} rows={4} value={d.highlights} onChange={(e) => setD({ ...d, highlights: e.target.value })} placeholder={'First mobile vet clinic\nNew adoption pens\nRecord Midwest BunFest'} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              One line under the numbers (optional)
              <input className={staffInput} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Every number here was made possible by volunteers and donors." />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
              Show this year publicly
            </label>
          </Card>
          <FormError>{error}</FormError>
          {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
            <Icon name="check" size={16} /> {busy ? 'Saving…' : 'Save'}
          </button>
          {rows?.find((r) => r.year === year) && (
            <button
              type="button"
              onClick={() => window.confirm(`Delete the ${year} numbers?`) && deleteImpact(orgId, year).then(load).catch((e) => setError(errMessage(e)))}
              className="block w-full py-2 text-center text-sm font-bold text-red-600"
            >
              Delete {year}
            </button>
          )}
        </form>
      )}
    </Screen>
  )
}
