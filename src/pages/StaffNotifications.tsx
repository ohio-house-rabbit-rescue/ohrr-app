// Staff → Send a notification (update 32, notifications.send): a phone
// notification to everyone who asked for one topic — who it's for, a title, a
// message and where a tap opens, with a live preview and a "Send to N
// phones?" check. The ohrr-jobs function does the sending (send_notification()
// only writes the message). Below: the latest notifications, the automatic
// ones included. The website has the desktop mirror.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { errMessage, supabase } from '../lib/supabase'
import type { Database, Json, PushTopic } from '../lib/database.types'
import { Screen, Card, Badge } from '../components/ui'
import { StaffTitle } from '../components/StaffTitle'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { EditorForm, Field, NotOnYet, Part, pill } from '../components/StaffJob'
import { PUSH_TOPICS, PUSH_TOPIC_LABEL, isPushTopic } from '../features/account/push'

type Message = Pick<
  Database['public']['Tables']['push_messages']['Row'],
  'id' | 'topic' | 'title' | 'created_at' | 'sent_at' | 'sent_count' | 'created_by'
>

interface Counts {
  ready: boolean
  phones: number
  byTopic: Record<PushTopic, number>
}

function readCounts(v: Json): Counts | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const n = (x: Json | undefined) => (typeof x === 'number' ? x : 0)
  return {
    ready: v.ready === true,
    phones: n(v.phones),
    byTopic: { volunteer: n(v.volunteer), events: n(v.events), adoptions: n(v.adoptions), bunfest: n(v.bunfest), news: n(v.news) },
  }
}

/** PostgREST: the table or function isn't there (update 32 not run yet). */
function update32Missing(e: { code?: string; message?: string }) {
  return (
    e.code === 'PGRST205' ||
    e.code === 'PGRST202' ||
    e.code === '42P01' ||
    /schema cache|does not exist|could not find the (table|function)/i.test(e.message ?? '')
  )
}

const LINKS = [
  { value: '/volunteer', label: 'Volunteer page' },
  { value: '/events', label: 'Events' },
  { value: '/adopt', label: 'Adopt' },
  { value: '/bunfest', label: 'BunFest' },
  { value: '/', label: 'Home' },
  { value: 'custom', label: 'Somewhere else…' },
] as const

/** Where each topic's notification usually opens. */
const TOPIC_LINK: Record<PushTopic, string> = {
  volunteer: '/volunteer',
  events: '/events',
  adoptions: '/adopt',
  bunfest: '/bunfest',
  news: '/',
}

const okLink = (v: string) => /^(\/(?!\/)|https:\/\/)/.test(v)

const phones = (n: number) => `${n} ${n === 1 ? 'phone' : 'phones'}`

/** "sent to 12 phones", "sending…" — or, after ten minutes with no word from the function, "not sent". */
function status(m: Message): string {
  if (m.sent_at) return `sent to ${phones(m.sent_count ?? 0)}`
  return Date.now() - new Date(m.created_at).getTime() > 10 * 60_000 ? 'not sent' : 'sending…'
}

/** "today 7:15 AM", "yesterday 7:15 AM", "Sep 21, 7:15 AM". */
function when(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return `today ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${time}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

export default function StaffNotifications() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [counts, setCounts] = useState<Counts | null | 'missing' | 'loading'>('loading')
  const [history, setHistory] = useState<Message[]>([])
  const [topic, setTopic] = useState<PushTopic>('volunteer')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState<string>(TOPIC_LINK.volunteer)
  const [linkTouched, setLinkTouched] = useState(false)
  const [custom, setCustom] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [c, h] = await Promise.all([
      supabase.rpc('push_counts', { p_org: orgId }),
      supabase
        .from('push_messages')
        .select('id, topic, title, created_at, sent_at, sent_count, created_by')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (c.error) {
      if (update32Missing(c.error)) setCounts('missing')
      else {
        setCounts(null)
        setError(errMessage(c.error))
      }
      return
    }
    setCounts(readCounts(c.data))
    if (!h.error) setHistory(h.data ?? [])
  }, [orgId])
  useEffect(() => {
    if (orgId) void load()
  }, [orgId, load])

  const url = link === 'custom' ? custom.trim() : link
  const n = counts && typeof counts === 'object' ? counts.byTopic[topic] : 0
  const ready = Boolean(counts && typeof counts === 'object' && counts.ready)
  const linkLabel = useMemo(() => LINKS.find((l) => l.value === link && l.value !== 'custom')?.label ?? url, [link, url])

  if (!can('notifications.send'))
    return (
      <Screen>
        <p className="text-base text-slate-600">You don’t have access to send notifications.</p>
      </Screen>
    )

  const pickTopic = (t: PushTopic) => {
    setTopic(t)
    setConfirming(false)
    if (!linkTouched) setLink(TOPIC_LINK[t])
  }

  const check = () => {
    setError(null)
    setMsg(null)
    if (!title.trim()) return setError('Give it a title.')
    if (link === 'custom' && !okLink(url)) return setError('The link should start with / (a page in the app) or https://')
    setConfirming(true)
  }

  const send = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('send_notification', {
      p_org: orgId,
      p_topic: topic,
      p_title: title.trim(),
      p_body: body.trim() || null,
      p_url: url || null,
    })
    setBusy(false)
    setConfirming(false)
    if (error) return setError(errMessage(error))
    setMsg(`Sent — on its way to ${phones(n)}.`)
    setTitle('')
    setBody('')
    await load()
    // The function takes a few seconds; show how many it reached.
    setTimeout(() => void load(), 8000)
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Send a notification">
        <p>
          To the phones of people who asked for notifications about one thing.
        </p>
        <p>New volunteer calls, events and rabbits send a notification by themselves.</p>
      </StaffTitle>
      {/* Kept in view, not folded: it is the caution to read before sending. */}
      <p className="text-base text-slate-700">Keep it for what matters — every one lands on someone’s lock screen.</p>

      {counts === 'loading' && !error && <Spinner />}
      {counts === null && <FormError>{error}</FormError>}
      {counts === 'missing' && <NotOnYet what="Phone notifications" update={32} />}
      {counts && typeof counts === 'object' && (
        <>
          {!counts.ready && <NotOnYet what="Sending to phones" />}

          <EditorForm
            title="New notification"
            hint="It goes to the phones of people who asked for this kind of news."
            onSubmit={confirming ? send : check}
            onCancel={confirming ? () => setConfirming(false) : undefined}
            cancelLabel="Not yet"
            busy={busy}
            saveLabel={confirming ? `Yes, send to ${phones(n)}` : 'Send…'}
            canSave={confirming || (ready && n > 0 && !!title.trim())}
            error={error}
          >
            <div className="space-y-2">
              <Part n="A" hint="needed">
                Who gets it
              </Part>
              <fieldset>
                <legend className="sr-only">Who it’s for</legend>
                {PUSH_TOPICS.map((t) => (
                  <label key={t.key} className="flex min-h-[48px] items-center gap-3 text-base text-slate-700">
                    <input
                      type="radio"
                      name="topic"
                      className="h-6 w-6 shrink-0 border-slate-300 text-brand-blue"
                      checked={topic === t.key}
                      onChange={() => pickTopic(t.key)}
                    />
                    <span className="min-w-0 flex-1">{t.label}</span>
                    <span className="text-sm font-semibold text-slate-600">{phones(counts.byTopic[t.key])}</span>
                  </label>
                ))}
              </fieldset>
              {ready && n === 0 && (
                <p className="text-sm text-slate-600">No phones have asked for {PUSH_TOPIC_LABEL[topic].toLowerCase()} yet.</p>
              )}
            </div>

            <div className="space-y-3">
              <Part n="B" hint="needed">
                What it says
              </Part>
              <Field label="Title" needed>
                <input
                  className={staffInput}
                  value={title}
                  maxLength={120}
                  placeholder="e.g. Hay unloading this Saturday — 4 more hands"
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setConfirming(false)
                  }}
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">{title.length}/120</span>
              </Field>
              <Field label="Message">
                <textarea
                  className={staffInput}
                  rows={3}
                  value={body}
                  maxLength={400}
                  placeholder="When, where, and what to do next"
                  onChange={(e) => {
                    setBody(e.target.value)
                    setConfirming(false)
                  }}
                />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">{body.length}/400</span>
              </Field>
            </div>

            <div className="space-y-2">
              <Part n="C" hint="optional">
                When
              </Part>
              <p className="text-base text-slate-700">It goes out as soon as you confirm.</p>
            </div>

            <div className="space-y-3">
              <Part n="D" hint="optional">
                Where it opens
              </Part>
              <Field label="Tapping it opens">
                <select
                  className={staffInput}
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value)
                    setLinkTouched(true)
                    setConfirming(false)
                  }}
                >
                  {LINKS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              {link === 'custom' && (
                <Field label="Link" hint="A page in the app (starts with /) or a web address (https://…)">
                  <input
                    className={staffInput}
                    value={custom}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="/volunteer/call/… or https://…"
                    onChange={(e) => {
                      setCustom(e.target.value)
                      setConfirming(false)
                    }}
                  />
                </Field>
              )}

              <div>
                <p className="text-sm font-semibold text-slate-700">How it will look</p>
                <div className="mt-1.5 rounded-2xl bg-slate-100 p-3">
                  <div className="flex gap-3 rounded-xl bg-white p-3 shadow-sm">
                    <img src="/ohrr-mark.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-500">OHRR · now</p>
                      <p className={`break-words text-base font-bold ${title.trim() ? 'text-ink' : 'text-slate-400'}`}>{title.trim() || 'Your title'}</p>
                      {body.trim() && <p className="line-clamp-4 whitespace-pre-line break-words text-sm text-slate-600">{body.trim()}</p>}
                    </div>
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-600">Tapping it opens: {linkLabel || '—'}</p>
                </div>
              </div>
            </div>

            {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}
            {confirming && (
              <p className="rounded-xl border border-brand-orange/40 bg-brand-orange-50 px-3 py-3 text-base font-bold text-ink">Send to {phones(n)}?</p>
            )}
          </EditorForm>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="font-display text-lg font-extrabold text-ink">Sent lately</h2>
              <button type="button" onClick={() => void load()} className={pill.outline}>
                Refresh
              </button>
            </div>
            {history.length === 0 ? (
              <p className="px-1 text-base text-slate-600">Nothing sent yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((m) => (
                  <Card key={m.id} className="!p-3">
                    <p className="break-words text-base font-semibold text-ink">{m.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                      <Badge tone="slate">{isPushTopic(m.topic) ? PUSH_TOPIC_LABEL[m.topic] : m.topic}</Badge>
                      {!m.created_by && <span>automatic</span>}
                      <span>{when(m.created_at)}</span>
                      <span className="font-semibold">{status(m)}</span>
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {counts === null && !error && <p className="text-base text-slate-600">You don’t have access to send notifications.</p>}
    </Screen>
  )
}
