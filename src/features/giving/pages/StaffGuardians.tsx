// Staff → Rescue Rabbit Guardians: the Legacy Fund thank-you list, a year at a
// time (update 29). Shown on /info/legacy-fund in the app and on the website.
// The list holds only what is shown in public — the name the way the family
// wants it — never what anyone gave. The website has the desktop mirror
// (src/pages/staff/Guardians.tsx).
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { guessSortName, sortGuardians, type Guardian } from '../guardians'

/** Update 29 hasn't been run: PostgREST can't find the table. */
function tableMissing(e: { code?: string; message?: string }) {
  return e.code === 'PGRST205' || e.code === '42P01' || /schema cache|does not exist/i.test(e.message ?? '')
}

export default function StaffGuardians() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<Guardian[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [name, setName] = useState('')
  const [sortUnder, setSortUnder] = useState('')
  const [sortTouched, setSortTouched] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; sort: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('guardians')
      .select('id, year, display_name, sort_name, is_published')
      .eq('org_id', orgId)
    if (error) {
      if (tableMissing(error)) setMissing(true)
      else setError(errMessage(error))
      setRows([])
      return
    }
    const list = data ?? []
    setRows(list)
    // Open on the newest year that has names.
    setYear((y) => (list.some((g) => g.year === y) ? y : list.reduce((m, g) => Math.max(m, g.year), y)))
  }, [orgId])
  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    const set = new Set<number>([now, now + 1, ...(rows ?? []).map((g) => g.year)])
    return [...set].sort((a, b) => b - a)
  }, [rows])
  const list = useMemo(() => sortGuardians((rows ?? []).filter((g) => g.year === year)), [rows, year])
  const previous = useMemo(() => {
    const older = (rows ?? []).filter((g) => g.year < year).map((g) => g.year)
    return older.length ? Math.max(...older) : null
  }, [rows, year])

  if (!can('giving.guardians'))
    return (
      <Screen>
        <p className="text-sm text-slate-600">You don’t have access to the Guardians list.</p>
      </Screen>
    )

  const done = async (text: string) => {
    await load()
    setBusy(false)
    setMsg(text)
  }
  const fail = (e: unknown) => {
    setBusy(false)
    setError(errMessage(e))
  }
  const start = () => {
    setBusy(true)
    setError(null)
    setMsg(null)
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim().replace(/\s+/g, ' ')
    if (!n) return
    start()
    const { error } = await supabase.from('guardians').insert({
      org_id: orgId,
      year,
      display_name: n,
      sort_name: (sortUnder.trim() || guessSortName(n)).slice(0, 120),
      created_by: user?.id ?? null,
    })
    if (error) return fail(/duplicate|unique/i.test(error.message) ? new Error(`${n} is already on the ${year} list.`) : error)
    setName('')
    setSortUnder('')
    setSortTouched(false)
    await done(`Added ${n} to ${year}.`)
  }
  const saveEdit = async () => {
    if (!editing) return
    const n = editing.name.trim().replace(/\s+/g, ' ')
    if (!n) return
    start()
    const { error } = await supabase
      .from('guardians')
      .update({ display_name: n, sort_name: editing.sort.trim() || guessSortName(n) })
      .eq('id', editing.id)
    if (error) return fail(error)
    setEditing(null)
    await done('Saved.')
  }
  const toggle = async (g: Guardian) => {
    start()
    const { error } = await supabase.from('guardians').update({ is_published: !g.is_published }).eq('id', g.id)
    if (error) return fail(error)
    await done(g.is_published ? `${g.display_name} is hidden from the Legacy Fund page.` : `${g.display_name} is shown again.`)
  }
  const remove = async (g: Guardian) => {
    if (!window.confirm(`Take ${g.display_name} off the ${g.year} list?`)) return
    start()
    const { error } = await supabase.from('guardians').delete().eq('id', g.id)
    if (error) return fail(error)
    await done(`Removed ${g.display_name} from ${g.year}.`)
  }
  const copyFrom = async (from: number) => {
    const names = (rows ?? []).filter((g) => g.year === from)
    if (!window.confirm(`Copy all ${names.length} names from ${from} into ${year}? You can then add, hide or remove names for ${year}.`)) return
    start()
    const { error } = await supabase.from('guardians').upsert(
      names.map((g) => ({
        org_id: orgId,
        year,
        display_name: g.display_name,
        sort_name: g.sort_name,
        is_published: g.is_published,
        created_by: user?.id ?? null,
      })),
      { onConflict: 'org_id,year,display_name', ignoreDuplicates: true },
    )
    if (error) return fail(error)
    await done(`Copied ${names.length} names from ${from} into ${year}.`)
  }

  const shown = list.filter((g) => g.is_published).length

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Rescue Rabbit Guardians</h1>
        <p className="mt-1 text-sm text-slate-600">
          The Legacy Fund thank-you list: people who have made a planned gift or given $1,000 or more in a calendar year. The
          newest year is shown by name on{' '}
          <Link to="/info/legacy-fund#guardians" className="font-semibold text-brand-blue underline underline-offset-2">
            the Legacy Fund page
          </Link>
          , earlier years underneath. Write each name the way the family wants it. Leave off anyone who asked not to be listed.
        </p>
      </div>

      {missing && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm leading-relaxed text-slate-700">
            This list switches on with <strong>update 29</strong> (RUN-THIS-IN-SUPABASE.sql in the Drive). Until then the app
            and website show the 2026 names from the old site’s graphic.
          </p>
        </Card>
      )}

      {!missing && (
        <div className="flex flex-wrap gap-2">
          {years.map((y) => {
            const n = (rows ?? []).filter((g) => g.year === y).length
            return (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setYear(y)
                  setEditing(null)
                }}
                className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${year === y ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {y}
                {n ? ` · ${n}` : ''}
              </button>
            )
          })}
        </div>
      )}

      {rows === null && !error && <Spinner />}
      {rows && !missing && (
        <>
          <form onSubmit={add}>
            <Card className="space-y-3">
              <p className="font-display text-lg font-extrabold text-ink">Add a name to {year}</p>
              <label className="block text-sm font-semibold text-slate-700">
                Name as shown
                <input
                  className={staffInput}
                  value={name}
                  placeholder="e.g. Bob & Inger Barron, or the Hayes Family"
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!sortTouched) setSortUnder(e.target.value.trim() ? guessSortName(e.target.value) : '')
                  }}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Sort under
                <span className="block text-xs font-normal text-slate-500">Usually the surname; fix it if the guess is wrong.</span>
                <input
                  className={staffInput}
                  value={sortUnder}
                  onChange={(e) => {
                    setSortUnder(e.target.value)
                    setSortTouched(true)
                  }}
                />
              </label>
              <button type="submit" disabled={busy || !name.trim()} className={`${btn.primary} w-full disabled:opacity-60`}>
                <Icon name="plus" size={16} /> {busy ? 'Saving…' : 'Add'}
              </button>
            </Card>
          </form>

          <FormError>{error}</FormError>
          {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}

          <Card className="!p-0">
            <div className="space-y-2 border-b border-slate-100 px-4 py-3">
              <p className="font-display text-lg font-extrabold text-ink">
                {year} · {list.length} {list.length === 1 ? 'name' : 'names'}
                {list.length > shown && <span className="ml-2 text-sm font-semibold text-slate-500">({list.length - shown} hidden)</span>}
              </p>
              {list.length === 0 && previous != null && (
                <button type="button" disabled={busy} onClick={() => void copyFrom(previous)} className={`${btn.outline} w-full disabled:opacity-60`}>
                  Start {year} from {previous}’s list
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">No names for {year} yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((g) =>
                  editing?.id === g.id ? (
                    <li key={g.id} className="space-y-2 bg-slate-50/60 px-4 py-3">
                      <label className="block text-xs font-semibold text-slate-600">
                        Name as shown
                        <input className={staffInput} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      </label>
                      <label className="block text-xs font-semibold text-slate-600">
                        Sort under
                        <input className={staffInput} value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: e.target.value })} />
                      </label>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button type="button" disabled={busy} onClick={() => void saveEdit()} className={`${btn.blue} disabled:opacity-60`}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  ) : (
                    <li key={g.id} className="flex flex-wrap items-center gap-x-2 px-4 py-1">
                      <span className={`min-w-0 flex-1 py-2 text-sm font-semibold ${g.is_published ? 'text-ink' : 'text-slate-400 line-through'}`}>
                        {g.display_name}
                      </span>
                      {!g.is_published && <Badge tone="slate">Hidden</Badge>}
                      <span className="flex text-sm font-bold">
                        <button
                          type="button"
                          className="min-h-[40px] px-2 text-brand-blue"
                          onClick={() => setEditing({ id: g.id, name: g.display_name, sort: g.sort_name })}
                        >
                          Edit
                        </button>
                        <button type="button" className="min-h-[40px] px-2 text-brand-blue disabled:opacity-60" disabled={busy} onClick={() => void toggle(g)}>
                          {g.is_published ? 'Hide' : 'Show'}
                        </button>
                        <button type="button" className="min-h-[40px] px-2 text-red-600 disabled:opacity-60" disabled={busy} onClick={() => void remove(g)}>
                          Remove
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}
