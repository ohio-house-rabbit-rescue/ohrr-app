// Staff → Supporters: OHRR's email list (update 31 — `mailing_list`). Who
// asked for emails, and about what — from the app (signed in or not), the
// website's email form, and everyone who joined through the old Inbox form.
// For people with "See and download the supporter email list"
// (supporters.view); founders and developers always can.
//
// Phone first: search, a filter per interest with its count, "Show people who
// unsubscribed", then "Copy emails" (the filtered list, subscribed only) and
// "Download spreadsheet" (CSV). Read-only: people change their own choices
// through My OHRR or the link in every email.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { errMessage, supabase } from '../lib/supabase'
import { Screen, Card, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { exportCsv, toCsv } from '../lib/exportFile'
import { INTERESTS, INTEREST_LABEL, cleanInterests, isMissing, type Interest } from '../features/account/emailList'
import type { Database } from '../lib/database.types'

type Row = Pick<
  Database['public']['Tables']['mailing_list']['Row'],
  'id' | 'email' | 'name' | 'interests' | 'source' | 'created_at' | 'unsubscribed_at'
>

const PAGE = 1000
const SOURCE_LABEL: Record<string, string> = {
  app: 'App',
  website: 'Website',
  account: 'Account',
  inbox: 'Old form',
}

/** "Oct 3, 2026" */
function usDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StaffSupporters() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<Row[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [interest, setInterest] = useState<Interest | 'all'>('all')
  const [showLeft, setShowLeft] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Everyone, a thousand at a time (PostgREST's page size).
  const load = useCallback(async () => {
    setError(null)
    const all: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('mailing_list')
        .select('id, email, name, interests, source, created_at, unsubscribed_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) {
        if (isMissing(error)) setMissing(true)
        else setError(errMessage(error))
        setRows([])
        return
      }
      all.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    setRows(all)
  }, [orgId])
  useEffect(() => {
    if (orgId && can('supporters.view')) void load()
  }, [orgId, can, load])

  const subscribed = useMemo(() => (rows ?? []).filter((r) => !r.unsubscribed_at), [rows])
  const perInterest = useMemo(() => {
    const out = Object.fromEntries(INTERESTS.map((i) => [i.key, 0])) as Record<Interest, number>
    for (const r of subscribed) for (const k of cleanInterests(r.interests)) out[k] += 1
    return out
  }, [subscribed])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows ?? []).filter(
      (r) =>
        (showLeft || !r.unsubscribed_at) &&
        (interest === 'all' || r.interests.includes(interest)) &&
        (!q || r.email.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q)),
    )
  }, [rows, query, interest, showLeft])
  const shownSubscribed = shown.filter((r) => !r.unsubscribed_at)

  if (!can('supporters.view'))
    return (
      <Screen>
        <p className="text-sm text-slate-600">You don’t have access to the supporter email list.</p>
      </Screen>
    )

  const copy = async () => {
    setMsg(null)
    const text = shownSubscribed.map((r) => r.email).join(', ')
    try {
      await navigator.clipboard.writeText(text)
      setMsg(`Copied ${shownSubscribed.length} email${shownSubscribed.length === 1 ? '' : 's'}. Paste them into BCC.`)
    } catch {
      setMsg('Couldn’t copy on this device — use Download spreadsheet instead.')
    }
  }

  const download = async () => {
    setMsg(null)
    const csv = toCsv(
      ['Name', 'Email', 'Interests', 'Source', 'Joined', 'Unsubscribed'],
      shown.map((r) => [
        r.name ?? '',
        r.email,
        cleanInterests(r.interests)
          .map((k) => INTEREST_LABEL[k])
          .join('; '),
        SOURCE_LABEL[r.source ?? ''] ?? r.source ?? '',
        usDate(r.created_at),
        usDate(r.unsubscribed_at),
      ]),
    )
    const stamp = new Date().toISOString().slice(0, 10)
    const out = await exportCsv(`ohrr-supporters-${interest === 'all' ? 'all' : interest}-${stamp}.csv`, csv)
    if (out === 'failed') setMsg('Couldn’t make the spreadsheet. Please try again.')
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Supporters</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Everyone who asked OHRR for emails, and what about. People change or stop theirs with the link in every email
          or in My OHRR.
        </p>
      </div>

      {missing ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            The email list arrives with database update 31. Until it’s run, mailing-list sign-ups keep landing in the
            Inbox.
          </p>
        </Card>
      ) : rows === null ? (
        <Spinner />
      ) : (
        <>
          <FormError>{error}</FormError>
          <p className="text-sm font-semibold text-ink">
            {subscribed.length} {subscribed.length === 1 ? 'person' : 'people'} on the list
            {rows.length > subscribed.length && (
              <span className="font-normal text-slate-500"> · {rows.length - subscribed.length} unsubscribed</span>
            )}
          </p>

          <label className="block text-sm font-semibold text-slate-700">
            Search
            <input
              className={staffInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or email"
              autoCapitalize="none"
            />
          </label>

          {/* One chip per interest, with how many (subscribed) people ticked it. */}
          <div className="flex flex-wrap gap-2">
            <Chip on={interest === 'all'} onClick={() => setInterest('all')}>
              Everyone · {subscribed.length}
            </Chip>
            {INTERESTS.map((i) => (
              <Chip key={i.key} on={interest === i.key} onClick={() => setInterest(i.key)}>
                {i.label} · {perInterest[i.key]}
              </Chip>
            ))}
          </div>

          <label className="flex min-h-[44px] items-center gap-2.5 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue"
              checked={showLeft}
              onChange={(e) => setShowLeft(e.target.checked)}
            />
            Show people who unsubscribed
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copy()} disabled={shownSubscribed.length === 0} className={`${btn.blue} min-h-[44px] disabled:opacity-50`}>
              Copy emails
            </button>
            <button type="button" onClick={() => void download()} disabled={shown.length === 0} className={`${btn.outline} min-h-[44px] disabled:opacity-50`}>
              Download spreadsheet
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Copy takes the {shownSubscribed.length} subscribed {shownSubscribed.length === 1 ? 'address' : 'addresses'} shown
            {showLeft ? ' (never anyone who unsubscribed)' : ''}. The spreadsheet has everyone shown.
          </p>
          {msg && <p className="text-sm font-semibold text-green-700">{msg}</p>}

          {shown.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600">{rows.length === 0 ? 'Nobody has joined the list yet.' : 'Nobody matches.'}</p>
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 !p-0">
              {shown.map((r) => (
                <div key={r.id} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{r.name || 'No name given'}</span>
                    {r.unsubscribed_at && <Badge tone="slate">Unsubscribed {usDate(r.unsubscribed_at)}</Badge>}
                  </div>
                  <a href={`mailto:${r.email}`} className="block break-all text-sm text-brand-blue">
                    {r.email}
                  </a>
                  <p className="text-xs text-slate-500">
                    {cleanInterests(r.interests)
                      .map((k) => INTEREST_LABEL[k])
                      .join(' · ') || 'Nothing ticked'}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Icon name="clock" size={12} /> Joined {usDate(r.created_at)}
                    {r.source ? ` · ${SOURCE_LABEL[r.source] ?? r.source}` : ''}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-[40px] items-center rounded-full px-3.5 text-sm font-bold transition ${
        on ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
