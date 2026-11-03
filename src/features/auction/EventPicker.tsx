// "Which event is the auction and raffle for?" (update 48; Staff → Silent Auction).
//
// The event used to be written into the code, so each new one needed a code
// change. Now an admin picks one of the events already in Staff → Events, or
// types a new one (a name and a day); the choice is saved as one setting
// (src/lib/currentEvent.ts) and the page reloads so every screen — the
// auction desk, the raffle, labels, table holds — uses it. Items and prizes of
// the old event stay where they are, under that event.
import { useEffect, useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Card } from '../../components/ui'
import { Field, Part, pill } from '../../components/StaffJob'
import { staffInput } from '../../components/staffui'
import { ErrorBox } from '../scan/ScanUI'
import { putKeyboardAway } from '../../lib/bringIntoView'
import { showRow } from '../../lib/staffScroll'
import { slugify } from '../../lib/careContent'
import { setSetting } from '../settings/useSetting'
import { EVENT_SETTING_KEY, currentEvent, dayLabel, ohioDay, type CurrentEvent } from '../../lib/currentEvent'
import { eventTimeToIso } from '../raffle/types'

interface EventRow {
  slug: string
  title: string
  starts_at: string
}

export default function EventPicker() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const mayChange = can('settings.manage') && can('events.bunfest.manage')
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<EventRow[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !orgId) return
    let alive = true
    void (async () => {
      const { data, error: e } = await supabase
        .from('events')
        .select('slug, title, starts_at')
        .eq('org_id', orgId)
        .order('starts_at', { ascending: false })
        .limit(12)
      if (!alive) return
      if (e) setError(errMessage(e))
      else setRows(data ?? [])
    })()
    return () => {
      alive = false
    }
  }, [open, orgId])

  const choose = async (next: CurrentEvent) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await setSetting(EVENT_SETTING_KEY, next as unknown as Record<string, string>, { orgId, userId: user?.id })
      window.location.reload()
    } catch (e) {
      setError(`Couldn’t save that: ${errMessage(e)}`)
      setBusy(false)
    }
  }

  const addNew = async () => {
    const title = name.trim()
    if (!title || !day || busy) return
    putKeyboardAway()
    const startsAt = eventTimeToIso('10:00', day)
    if (!startsAt) {
      setError('That day doesn’t look right — pick it from the calendar.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let slug = slugify(title)
      if (rows.some((r) => r.slug === slug)) slug = `${slug}-${day.slice(0, 4)}`
      const { error: e } = await supabase
        .from('events')
        // Hidden until it is ready: Staff → Events turns it to Shown.
        .insert({ org_id: orgId, slug, title, starts_at: startsAt, is_published: false, created_by: user?.id ?? null })
      if (e) throw e
      await choose({ slug, title, date: day })
    } catch (e) {
      setError(`Couldn’t add that event: ${errMessage(e)}`)
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">This auction and raffle are for</p>
        <p className="mt-0.5 text-lg font-extrabold text-ink">{currentEvent.title}</p>
        <p className="text-sm text-slate-600">{dayLabel(currentEvent.date)}</p>
      </div>

      {!mayChange && <p className="text-sm text-slate-500">An admin can change the event here when the next one comes around.</p>}

      {mayChange && !open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            showRow('event-picker-open', { align: 'top' })
          }}
          className={`${pill.soft} !min-h-[48px]`}
        >
          Change the event
        </button>
      )}

      {mayChange && open && (
        <div data-row="event-picker-open" className="space-y-3">
          <Part n="A" hint="Items, prizes and tickets of the other events stay safe under their event.">
            Pick the event
          </Part>
          <div className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-slate-500">Loading the events…</p>}
            {rows.map((r) => {
              const here = r.slug === currentEvent.slug
              return (
                <button
                  key={r.slug}
                  type="button"
                  disabled={busy || here}
                  onClick={() => void choose({ slug: r.slug, title: r.title, date: ohioDay(r.starts_at) })}
                  className={`flex min-h-[60px] w-full flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left ${here ? 'border-brand-blue bg-brand-blue-50' : 'border-slate-200 bg-white'} disabled:opacity-70`}
                >
                  <span className="text-base font-bold text-ink">{r.title}</span>
                  <span className="text-sm text-slate-600">
                    {dayLabel(ohioDay(r.starts_at), false)}
                    {here ? ' · in use now' : ''}
                  </span>
                </button>
              )
            })}
          </div>

          <Part n="B" hint="Use this when the event isn’t in the list.">
            Or type a new event
          </Part>
          {!adding ? (
            <button
              type="button"
              onClick={() => {
                setAdding(true)
                showRow('event-new', { align: 'auto' })
              }}
              className={`${pill.outline} !min-h-[48px]`}
            >
              Type a new event
            </button>
          ) : (
            <div data-row="event-new" className="space-y-3">
              <Field label="Name of the event" needed>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Midwest BunFest 2027" className={staffInput} />
              </Field>
              <Field label="Day of the event" needed>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={staffInput} />
              </Field>
              <button
                type="button"
                disabled={busy || !name.trim() || !day}
                onClick={() => void addNew()}
                className={`${pill.orange} !min-h-[52px] w-full disabled:opacity-50`}
              >
                {busy ? 'Saving…' : 'Use this new event'}
              </button>
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] text-[15px] font-bold text-brand-blue">
            Never mind
          </button>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
    </Card>
  )
}
