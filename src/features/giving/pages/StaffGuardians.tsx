// Staff → Rescue Rabbit Guardians: the Legacy Fund thank-you list, a year at a
// time (update 29). Shown on /info/legacy-fund in the app and on the website.
// The list holds only what is shown in public — the name the way the family
// wants it — never what anyone gave. The website has the desktop mirror
// (src/pages/staff/Guardians.tsx).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
import { Screen, Card, Badge } from '../../../components/ui'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { CardActions, EditorForm, Field, NotOnYet, Part, StepButton, pill } from '../../../components/StaffJob'
import { guessSortName, sortGuardians, type Guardian } from '../guardians'
import { StaffTitle } from '../../../components/StaffTitle'

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
  const [adding, setAdding] = useState(false)
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
  // A–Z by the name each is sorted under.
  const list = useMemo(() => sortGuardians((rows ?? []).filter((g) => g.year === year)), [rows, year])
  const previous = useMemo(() => {
    const older = (rows ?? []).filter((g) => g.year < year).map((g) => g.year)
    return older.length ? Math.max(...older) : null
  }, [rows, year])

  if (!can('giving.guardians'))
    return (
      <Screen>
        <p className="text-base text-slate-600">You don’t have access to the Guardians list.</p>
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

  const closeAdd = () => {
    setAdding(false)
    setName('')
    setSortUnder('')
    setSortTouched(false)
    setError(null)
  }

  const add = async () => {
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
    closeAdd()
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
    start()
    const { error } = await supabase.from('guardians').delete().eq('id', g.id)
    if (error) return fail(error)
    setEditing(null)
    await done(`Removed ${g.display_name} from ${g.year}.`)
  }
  const confirmRemove = (g: Guardian) => {
    if (window.confirm(`Take ${g.display_name} off the ${g.year} list?`)) void remove(g)
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
      <StaffTitle title="Rescue Rabbit Guardians">
        <p>
          The Legacy Fund thank-you list: people who have made a planned gift or given $1,000 or more in a calendar year. The
          newest year is shown by name on{' '}
          <Link to="/info/legacy-fund#guardians" className="font-semibold text-brand-blue underline underline-offset-2">
            the Legacy Fund page
          </Link>
          , earlier years underneath. Names are listed A to Z by the name each is sorted under.
        </p>
      </StaffTitle>
      {/* Kept in view, not folded: it is a privacy rule to follow while typing names. */}
      <p className="text-base text-slate-700">Write each name the way the family wants it. Leave off anyone who asked not to be listed.</p>

      {missing && (
        <NotOnYet what="The Guardians list" update={29}>
          Until then the app and website show the 2026 names from the old site’s graphic.
        </NotOnYet>
      )}

      {!missing && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Year">
          {years.map((y) => {
            const n = (rows ?? []).filter((g) => g.year === y).length
            return (
              <button
                key={y}
                type="button"
                aria-pressed={year === y}
                onClick={() => {
                  setYear(y)
                  setEditing(null)
                }}
                className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold ${year === y ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
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
          {adding ? (
            <EditorForm
              title={`Add a name to ${year}`}
              onSubmit={add}
              onCancel={closeAdd}
              busy={busy}
              saveLabel="Add"
              canSave={!!name.trim()}
              error={error}
            >
              <div className="space-y-3">
                <Part n="A" hint="needed">
                  The name
                </Part>
                <Field label="Name as shown" needed>
                  <input
                    className={staffInput}
                    value={name}
                    placeholder="e.g. Bob & Inger Barron, or the Hayes Family"
                    onChange={(e) => {
                      setName(e.target.value)
                      if (!sortTouched) setSortUnder(e.target.value.trim() ? guessSortName(e.target.value) : '')
                    }}
                  />
                </Field>
              </div>
              <div className="space-y-3">
                <Part n="B" hint="optional">
                  Where it sorts
                </Part>
                <Field label="Sort under" hint="Usually the surname; fix it if the guess is wrong.">
                  <input
                    className={staffInput}
                    value={sortUnder}
                    onChange={(e) => {
                      setSortUnder(e.target.value)
                      setSortTouched(true)
                    }}
                  />
                </Field>
              </div>
            </EditorForm>
          ) : (
            <StepButton tone="orange" icon="plus" onClick={() => setAdding(true)}>
              New name for {year}
            </StepButton>
          )}

          {!adding && !editing && <FormError>{error}</FormError>}
          {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}

          <div className="space-y-2">
            <p className="font-display text-lg font-extrabold text-ink">
              {year} · {list.length} {list.length === 1 ? 'name' : 'names'}
              {list.length > shown && <span className="ml-2 text-sm font-semibold text-slate-500">({list.length - shown} hidden)</span>}
            </p>
            {list.length === 0 && previous != null && (
              <StepButton disabled={busy} onClick={() => void copyFrom(previous)}>
                Start {year} from {previous}’s list
              </StepButton>
            )}
          </div>
          {list.length === 0 ? (
            <Card className="text-base text-slate-600">No names for {year} yet.</Card>
          ) : (
            <div className="space-y-3">
              {list.map((g) =>
                editing?.id === g.id ? (
                  <EditorForm
                    key={g.id}
                    title="Edit this name"
                    onSubmit={saveEdit}
                    onCancel={() => {
                      setEditing(null)
                      setError(null)
                    }}
                    busy={busy}
                    canSave={!!editing.name.trim()}
                    error={error}
                    remove={{ label: 'Remove', confirm: `Take ${g.display_name} off the ${g.year} list?`, onRemove: () => remove(g) }}
                  >
                    <div className="space-y-3">
                      <Part n="A" hint="needed">
                        The name
                      </Part>
                      <Field label="Name as shown" needed>
                        <input className={staffInput} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                      </Field>
                    </div>
                    <div className="space-y-3">
                      <Part n="B" hint="optional">
                        Where it sorts
                      </Part>
                      <Field label="Sort under">
                        <input className={staffInput} value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: e.target.value })} />
                      </Field>
                    </div>
                  </EditorForm>
                ) : (
                  <Card key={g.id} className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`min-w-0 text-base font-semibold ${g.is_published ? 'text-ink' : 'text-slate-400 line-through'}`}>{g.display_name}</span>
                      {!g.is_published && <Badge tone="slate">Hidden</Badge>}
                    </div>
                    <CardActions>
                      <button type="button" className={pill.blue} onClick={() => setEditing({ id: g.id, name: g.display_name, sort: g.sort_name })}>
                        Edit
                      </button>
                      <button type="button" className={pill.outline} disabled={busy} onClick={() => void toggle(g)}>
                        {g.is_published ? 'Hide' : 'Show'}
                      </button>
                      <button type="button" className={pill.red} disabled={busy} onClick={() => confirmRemove(g)}>
                        Remove
                      </button>
                    </CardActions>
                  </Card>
                ),
              )}
            </div>
          )}
        </>
      )}
    </Screen>
  )
}
