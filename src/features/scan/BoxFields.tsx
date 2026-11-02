// The questions about a box besides its number (update 50): its name ("Raffle box"), a description ("green tote"),
// and which event it goes to — picked from the events list, or a new event made right here.
import { useEffect, useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { staffInput } from '../../components/staffui'
import { slugify } from '../../lib/careContent'
import { eventTimeToIso } from '../raffle/types'

export interface BoxFieldValues {
  name: string
  description: string
  eventId: string | null
}

interface EventRow {
  id: string
  slug: string
  title: string
  starts_at: string
}

const NEW = '__new__'
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })

export default function BoxFields({ orgId, value, onChange }: { orgId: string; value: BoxFieldValues; onChange: (patch: Partial<BoxFieldValues>) => void }) {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventRow[]>([])
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    let alive = true
    void (async () => {
      const { data, error: e } = await supabase.from('events').select('id, slug, title, starts_at').eq('org_id', orgId).order('starts_at', { ascending: false }).limit(40)
      if (!alive) return
      if (e) setError(errMessage(e))
      else setEvents(data ?? [])
    })()
    return () => {
      alive = false
    }
  }, [orgId])

  const addEvent = async () => {
    const name = title.trim()
    if (!name || !day || busy) return
    const startsAt = eventTimeToIso('10:00', day)
    if (!startsAt) {
      setError('That day doesn’t look right — pick it from the calendar.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let slug = slugify(name)
      if (events.some((r) => r.slug === slug)) slug = `${slug}-${day.slice(0, 4)}`
      const { data, error: e } = await supabase
        .from('events')
        // Hidden until it is ready: Staff → Events turns it to Shown.
        .insert({ org_id: orgId, slug, title: name, starts_at: startsAt, is_published: false, created_by: user?.id ?? null })
        .select('id, slug, title, starts_at')
        .single()
      if (e) throw e
      setEvents((list) => [data, ...list])
      onChange({ eventId: data.id })
      setAdding(false)
      setTitle('')
      setDay('')
    } catch (e) {
      setError(`Couldn’t add that event: ${errMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-base font-bold text-ink">
        Name <span className="font-normal text-slate-500">(optional — it says “Box 12” if you leave it)</span>
        <input value={value.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={60} placeholder="e.g. Raffle box" className={`mt-1 ${staffInput}`} />
      </label>
      <label className="block text-base font-bold text-ink">
        What it looks like <span className="font-normal text-slate-500">(optional)</span>
        <input value={value.description} onChange={(e) => onChange({ description: e.target.value })} maxLength={120} placeholder="e.g. Green tote" className={`mt-1 ${staffInput}`} />
      </label>
      <label className="block text-base font-bold text-ink">
        Where it goes <span className="font-normal text-slate-500">(an event, optional)</span>
        <select
          value={adding ? NEW : (value.eventId ?? '')}
          onChange={(e) => {
            if (e.target.value === NEW) setAdding(true)
            else {
              setAdding(false)
              onChange({ eventId: e.target.value || null })
            }
          }}
          className={`mt-1 ${staffInput}`}
        >
          <option value="">No event yet</option>
          {events.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} · {when(r.starts_at)}
            </option>
          ))}
          <option value={NEW}>＋ Add a new event…</option>
        </select>
      </label>
      {adding && (
        <div className="space-y-3 rounded-2xl border-2 border-brand-orange/60 bg-white p-3">
          <p className="font-display text-lg font-extrabold text-ink">A new event</p>
          <label className="block text-base font-bold text-ink">
            Its name
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Midwest BunFest 2027" className={`mt-1 ${staffInput}`} />
          </label>
          <label className="block text-base font-bold text-ink">
            The day
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`mt-1 ${staffInput}`} />
          </label>
          <p className="text-sm text-slate-600">It is added to Staff → Events, hidden from the public until you show it there.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void addEvent()} disabled={busy || !title.trim() || !day} className="min-h-[48px] rounded-2xl bg-brand-blue px-4 text-base font-bold text-white disabled:opacity-50">
              {busy ? 'Adding…' : 'Add the event'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-bold text-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-base font-semibold text-red-700">{error}</p>}
    </div>
  )
}
