// Staff → Impact: the yearly numbers. Pick a year, type the counts, add a
// few highlight lines, publish. Volunteer hours can be pulled from the Hours
// tab with one tap.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Badge } from '../../../components/ui'
import { Spinner, staffInput } from '../../../components/staffui'
import { EditorForm, Field, Part, pill } from '../../../components/StaffJob'
import { hoursTotalForYear } from '../../bookings/api'
import { IMPACT_FIELDS, deleteImpact, listImpact, saveImpact, type ImpactYear } from '../api'
import { StaffTitle } from '../../../components/StaffTitle'

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

  if (!can('announcements.post')) return <Screen><p className="text-base text-slate-600">You don’t have access to the impact page.</p></Screen>

  const save = async () => {
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
  const saved = rows?.find((r) => r.year === year)

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Impact">
        <p>The year in numbers, for donors, sponsors and volunteers. Shown at /impact on the app and the website once published.</p>
        <p>A filled dot on a year means it is published; an empty dot means a draft.</p>
      </StaffTitle>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Year">
        {years.map((y) => {
          const has = rows?.find((r) => r.year === y)
          return (
            <button
              key={y}
              type="button"
              aria-pressed={year === y}
              onClick={() => {
                setYear(y)
                setMsg(null)
                setError(null)
              }}
              className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold ${year === y ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              {y}
              {has ? (has.is_published ? ' ●' : ' ○') : ''}
            </button>
          )
        })}
      </div>
      {rows === null && !error && <Spinner />}
      {d && (
        <EditorForm
          title={`${year} in numbers`}
          hint={saved?.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="slate">Hidden</Badge>}
          onSubmit={save}
          busy={busy}
          error={error}
          remove={
            saved
              ? {
                  label: `Remove ${year}`,
                  confirm: `Delete the ${year} numbers?`,
                  onRemove: () => deleteImpact(orgId, year).then(load).then(() => undefined).catch((e) => setError(errMessage(e))),
                }
              : undefined
          }
        >
          <div className="space-y-3">
            <Part n="A" hint="optional">
              The numbers
            </Part>
            {IMPACT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Field label={f.label} hint={f.hint}>
                  <input className={staffInput} inputMode="decimal" value={d.fields[f.key]} onChange={(e) => setD({ ...d, fields: { ...d.fields, [f.key]: e.target.value } })} placeholder={f.money ? '12500' : ''} />
                </Field>
                {f.key === 'volunteer_hours' && (
                  <button type="button" onClick={() => void pullHours()} className={pill.soft}>
                    Use the Hours tab
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Part n="B" hint="optional">
              In words
            </Part>
            <Field label="Highlights — one per line">
              <textarea className={staffInput} rows={4} value={d.highlights} onChange={(e) => setD({ ...d, highlights: e.target.value })} placeholder={'First mobile vet clinic\nNew adoption pens\nRecord Midwest BunFest'} />
            </Field>
            <Field label="One line under the numbers">
              <input className={staffInput} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Every number here was made possible by volunteers and donors." />
            </Field>
          </div>

          <div className="space-y-3">
            <Part n="C" hint="optional">
              Showing
            </Part>
            <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
              <input type="checkbox" className="h-6 w-6 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
              Show this year publicly
            </label>
          </div>
          {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}
        </EditorForm>
      )}
    </Screen>
  )
}
