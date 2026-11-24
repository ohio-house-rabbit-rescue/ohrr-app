// Foster, surrender and found — the requests that need following through to the
// end. They also show in the Inbox; this page keeps just these three kinds, grouped
// by where each one is (new, being worked on, finished).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase, errMessage } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import { Screen, Card, Badge } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { StaffTitle } from '../components/StaffTitle'
import { Spinner, FormError } from '../components/staffui'
import { StatusNote } from '../features/scan/ScanUI'
import { Field, Notes, labelOf, valueText, when } from './StaffInbox'

type Row = Database['public']['Tables']['requests']['Row']
type Status = Row['status']

const KINDS: { kind: string; label: string; icon: IconName }[] = [
  { kind: 'foster-application', label: 'Foster offers', icon: 'home' },
  { kind: 'surrender-intake', label: 'Surrenders', icon: 'mappin' },
  { kind: 'found-rabbit', label: 'Found bunnies', icon: 'mappin' },
]
const KIND_NAMES = KINDS.map((k) => k.kind)
const isOpen = (r: Row) => r.status === 'new' || r.status === 'in_progress'

export default function StaffCareRequests() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [kind, setKind] = useState<string>('all')
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('org_id', orgId)
      .in('kind', KIND_NAMES)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) setError(errMessage(error))
    else setRows((data ?? []) as Row[])
  }, [orgId])

  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows ?? []) if (isOpen(r)) c[r.kind] = (c[r.kind] ?? 0) + 1
    return c
  }, [rows])

  const shown = useMemo(() => (rows ?? []).filter((r) => r.status !== 'archived' && (kind === 'all' || r.kind === kind)), [rows, kind])
  const fresh = shown.filter((r) => r.status === 'new')
  const working = shown.filter((r) => r.status === 'in_progress')
  const finished = shown.filter((r) => r.status === 'done')

  const setStatus = async (r: Row, status: Status, notes?: string, message?: string): Promise<boolean> => {
    setError(null)
    setNote(null)
    const { error } = await supabase.rpc('set_request_status', { p_id: r.id, p_status: status, p_notes: notes ?? null })
    if (error) {
      setError(errMessage(error))
      return false
    }
    setRows((list) => (list ?? []).map((x) => (x.id === r.id ? { ...x, status, staff_notes: notes ?? x.staff_notes } : x)))
    if (message) setNote(message)
    return true
  }

  const who = (r: Row) => r.name || 'That request'
  const card = (r: Row) => {
    const payload = (r.payload ?? {}) as Record<string, unknown>
    const k = KINDS.find((x) => x.kind === r.kind)
    return (
      <li key={r.id}>
        <Card className={`space-y-3 ${r.status === 'new' ? 'border-brand-orange/40' : ''}`}>
          <div>
            <p className="break-words font-display text-[15px] font-extrabold text-ink">
              {r.name || 'No name'} {r.status === 'new' && <Badge tone="orange">New</Badge>}
            </p>
            <p className="text-sm text-slate-700">
              {k?.label ?? r.kind}
              {r.subject ? ` · ${r.subject}` : ''}
            </p>
            <p className="text-xs text-slate-400">{when(r.created_at)}</p>
          </div>
          <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {r.email && <Field label="Email" value={r.email} />}
            {Object.entries(payload).map(([key, value]) => (
              <Field key={key} label={labelOf(key)} value={valueText(key, value)} />
            ))}
          </dl>
          {r.email && (
            <a
              href={`mailto:${r.email}?subject=${encodeURIComponent(`OHRR — ${k?.label ?? r.kind}${r.subject ? `: ${r.subject}` : ''}`)}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-blue-50 px-4 text-sm font-bold text-brand-blue"
            >
              <Icon name="mail" size={16} /> Email
            </a>
          )}
          <Notes row={r} onSave={(n) => setStatus(r, r.status, n)} />
          <div className="grid grid-cols-2 gap-2">
            {r.status === 'done' ? (
              <button
                type="button"
                onClick={() => void setStatus(r, 'in_progress', undefined, `${who(r)} is back under “Working on it”.`)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-100 font-display text-base font-extrabold text-ink"
              >
                Open it again
              </button>
            ) : (
              <>
                {r.status === 'new' ? (
                  <button
                    type="button"
                    onClick={() => void setStatus(r, 'in_progress', undefined, `${who(r)} is now under “Working on it”.`)}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border-2 border-brand-blue/40 font-display text-base font-extrabold text-brand-blue"
                  >
                    I’m on it
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => void setStatus(r, 'done', undefined, `${who(r)} is finished. It is under “Show finished”.`)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-brand-orange font-display text-base font-extrabold text-ink"
                >
                  <Icon name="check" size={18} /> Finished
                </button>
              </>
            )}
          </div>
        </Card>
      </li>
    )
  }

  const group = (title: string, list: Row[]) =>
    list.length > 0 && (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-extrabold text-ink">
          {title} ({list.length})
        </h2>
        <ul className="space-y-3">{list.map(card)}</ul>
      </section>
    )

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Foster, surrender and found" label="How this works">
        <p>These requests also show in the Inbox. This page is where you follow each one to the end. The notes are shared with the team.</p>
      </StaffTitle>

      <div className="grid gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setKind(kind === k.kind ? 'all' : k.kind)}
            aria-pressed={kind === k.kind}
            className={`flex min-h-[48px] items-center justify-between gap-3 rounded-2xl px-4 text-left font-display text-base font-extrabold ${kind === k.kind ? 'bg-brand-blue text-white' : 'border-2 border-slate-200 bg-white text-ink'}`}
          >
            <span>{k.label}</span>
            <span className="text-sm font-bold">{counts[k.kind] ?? 0} open</span>
          </button>
        ))}
      </div>

      <FormError>{error}</FormError>
      {note && (
        <StatusNote key={note} className="rounded-2xl bg-green-50 px-4 py-3 text-[15px] font-bold text-green-800">
          {note}
        </StatusNote>
      )}
      {rows === null && !error && <Spinner />}

      {rows && shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Nothing waiting. New requests arrive in the{' '}
          <Link to="/staff/inbox" className="font-bold text-brand-blue underline">
            Inbox
          </Link>{' '}
          and show here too.
        </p>
      )}

      {group('New', fresh)}
      {group('Working on it', working)}
      {finished.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
          >
            {showDone ? 'Hide finished' : `Show finished (${finished.length})`}
          </button>
          {showDone && <ul className="space-y-3">{finished.map(card)}</ul>}
        </section>
      )}

      <Link to="/staff/inbox" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-brand-blue underline">
        Back to the Inbox
      </Link>
    </Screen>
  )
}
