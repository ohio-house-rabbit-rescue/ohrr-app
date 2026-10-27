// Staff → Volunteer calls: where the job starts. The five steps of a call,
// each with its button (the next call to share, today's call to check in, the
// last call to thank), then every call OHRR has put out, soonest first.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError } from '../../../components/staffui'
import { StepButton, StepRow, StepRows } from '../../../components/StaffJob'
import { fmtClock, fmtDay } from '../calls'
import { callRoster, callThanks, listCalls, type CallRow } from '../callsApi'
import StaffCall from './StaffCall'
import { StaffTitle } from '../../../components/StaffTitle'

/** A fresh page per call, so moving from "new" to the saved call starts clean. */
export function StaffCallRoute() {
  const { id = '' } = useParams()
  return <StaffCall key={id} />
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

interface Fill {
  taken: number
  places: number
}
/** How the thanking stands on a past call. */
interface Thanks {
  came: number
  thanked: number
}

const short = (t: string) => (t.length > 28 ? `${t.slice(0, 26).trim()}…` : t)

export default function StaffCalls() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<CallRow[] | null>(null)
  const [fill, setFill] = useState<Record<string, Fill>>({})
  const [thanks, setThanks] = useState<Record<string, Thanks>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    let active = true
    listCalls(orgId)
      .then(async (list) => {
        if (!active) return
        setRows(list)
        // How full the upcoming ones are.
        const upcoming = list.filter((c) => c.on_date >= today()).slice(0, 12)
        const entries = await Promise.all(
          upcoming.map(async (c) => {
            const ro = await callRoster(c.id).catch(() => [])
            const slots = new Map<string, number>()
            let taken = 0
            for (const r of ro) {
              slots.set(r.slot_id, r.capacity)
              if (r.booking_id && r.status !== 'cancelled') taken += 1
            }
            return [c.id, { taken, places: [...slots.values()].reduce((a, b) => a + b, 0) }] as const
          }),
        )
        if (active) setFill(Object.fromEntries(entries))
        // Who still needs thanking on the recent past ones.
        const past = list
          .filter((c) => c.on_date < today())
          .sort((a, b) => b.on_date.localeCompare(a.on_date))
          .slice(0, 8)
        const t = await Promise.all(
          past.map(async (c) => {
            const people = await callThanks(c.id).catch(() => [])
            return [c.id, { came: people.length, thanked: people.filter((p) => p.thanked_at).length }] as const
          }),
        )
        if (active) setThanks(Object.fromEntries(t))
      })
      .catch((e) => setError(errMessage(e)))
    return () => {
      active = false
    }
  }, [orgId])

  const upcoming = (rows ?? []).filter((c) => c.on_date >= today()).sort((a, b) => a.on_date.localeCompare(b.on_date))
  const past = (rows ?? []).filter((c) => c.on_date < today()).sort((a, b) => b.on_date.localeCompare(a.on_date))

  // The call each step's button opens.
  const todays = upcoming.find((c) => c.on_date === today())
  const next = upcoming.find((c) => c.on_date > today()) ?? todays
  const nextFill = next ? fill[next.id] : undefined
  const toThank = past.find((c) => thanks[c.id] && thanks[c.id].came > thanks[c.id].thanked)
  const toThankCount = toThank ? thanks[toThank.id].came - thanks[toThank.id].thanked : 0

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Volunteer calls">
        <p>
          Put out a need once — “5 people for 2-hour shifts at BunFest” — and it makes the shifts, writes the posts,
          texts, emails, letters and flyers, takes the sign-ups, and helps you thank everyone afterwards. Every call
          goes through the five steps below; each one is a tab on the call’s page.
        </p>
      </StaffTitle>

      <StepRows label="How a volunteer call runs">
        <StepRow n={1} name="Put out a call">
          <StepButton to="/staff/calls/new" tone="orange" icon="plus">
            Put out a new call
          </StepButton>
        </StepRow>
        <StepRow n={2} name="Spread the word" hint={next ? undefined : 'posts, texts, emails, letters, flyers'}>
          {next && (
            <StepButton to={`/staff/calls/${next.id}?tab=share`} icon="external">
              Share {short(next.title)}
            </StepButton>
          )}
        </StepRow>
        <StepRow n={3} name="Sign-ups" hint={next ? undefined : 'who’s coming, and where they heard'}>
          {next && (
            <StepButton to={`/staff/calls/${next.id}?tab=signups`} icon="users">
              {nextFill ? `${nextFill.taken} of ${nextFill.places} places filled` : 'See who’s signed up'}
            </StepButton>
          )}
        </StepRow>
        <StepRow n={4} name="On the day" hint={todays ? undefined : 'tap Here as people arrive'}>
          {todays && (
            <StepButton to={`/staff/calls/${todays.id}?tab=day`} tone="orange" icon="check">
              Check people in: {short(todays.title)}
            </StepButton>
          )}
        </StepRow>
        <StepRow n={5} name="Thank everyone" hint={toThank ? undefined : 'thank-yous, hours letters, the summary'}>
          {toThank && (
            <StepButton to={`/staff/calls/${toThank.id}?tab=thanks`} icon="mail" count={toThankCount}>
              Thank {short(toThank.title)}
            </StepButton>
          )}
        </StepRow>
      </StepRows>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-center text-sm leading-relaxed text-slate-600">No calls yet. Start with BunFest — the form can fill itself in from it.</Card>
      )}

      {upcoming.length > 0 && <CallList title="Coming up" rows={upcoming} fill={fill} thanks={thanks} />}
      {past.length > 0 && <CallList title="Done" rows={past} fill={fill} thanks={thanks} past />}
    </Screen>
  )
}

function CallList({ title, rows, fill, thanks, past }: { title: string; rows: CallRow[]; fill: Record<string, Fill>; thanks: Record<string, Thanks>; past?: boolean }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">{title}</p>
      {rows.map((c) => {
        const f = fill[c.id]
        const t = thanks[c.id]
        return (
          <Link key={c.id} to={`/staff/calls/${c.id}`} className="block">
            <Card className="flex items-center gap-3 transition hover:border-slate-300">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base font-extrabold text-ink">{c.title}</span>
                <span className="block text-sm text-slate-600">
                  {fmtDay(c.on_date)} · {fmtClock(c.starts_at)}–{fmtClock(c.ends_at)}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {f && !past && (
                    <Badge tone={f.taken >= f.places ? 'blue' : 'orange'}>
                      {f.taken} of {f.places} places filled
                    </Badge>
                  )}
                  {past && t && t.came === 0 && <Badge tone="slate">Nobody marked here</Badge>}
                  {past && t && t.came > 0 && t.thanked < t.came && <Badge tone="orange">{t.came - t.thanked} to thank</Badge>}
                  {past && t && t.came > 0 && t.thanked >= t.came && <Badge tone="blue">All thanked</Badge>}
                  {!c.is_published && <Badge tone="slate">Hidden</Badge>}
                </span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
            </Card>
          </Link>
        )
      })}
    </section>
  )
}
