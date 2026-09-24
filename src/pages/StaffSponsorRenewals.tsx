import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { telHref } from '../lib/orgProfile'
import { exportCsv, toCsv } from '../lib/exportFile'
import { copyText } from '../features/share/share'
import { isNative } from '../native/platform'
import { btn, Badge, Card, QuietNote, Screen, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { SponsorLogo } from '../features/sponsors/SponsorLogo'
import {
  hrefFor,
  surfaceLabel,
  tierLabel,
  type PlacementRow,
  type RenewalRow,
  type RenewalStatus,
  type SponsorRow,
} from '../features/sponsors/types'

// Sponsor renewals — /staff/sponsors/renewals, gated on events.bunfest.manage.
//
// OHRR (2026-09-24): "we will need a list generator on sponsors that are about
// to expire and then we can reach out for a continued." Sponsorships already end
// on their own on term_end; this is who to ask about continuing, soonest first:
// the contact, where the ask stands, a ready-written email, and the whole list
// to copy, download or print. Contacts and status live in the staff-only
// `sponsor_renewals` table (update 24). Until that update is run the list still
// shows who is ending; it just can't keep contacts or notes.

/* ---- dates: plain YYYY-MM-DD calendar days, never shifted by time zone ---- */

const pad = (n: number) => String(n).padStart(2, '0')

function localTodayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

const utcDay = (iso: string) => {
  const [y, m, d] = ymd(iso)
  return Date.UTC(y, m - 1, d)
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / 86_400_000)
}

function addDays(iso: string, n: number): string {
  const d = new Date(utcDay(iso) + n * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Same month and day next year; 29 Feb becomes 28 Feb. */
function addYear(iso: string): string {
  const [y, m, d] = ymd(iso)
  return `${y + 1}-${pad(m)}-${pad(m === 2 && d === 29 ? 28 : d)}`
}

/** "Dec 31, 2026" · long: "December 31, 2026" · noYear: "Sep 3" */
function fmtDate(iso: string, opts: { long?: boolean; noYear?: boolean } = {}): string {
  const [y, m, d] = ymd(iso)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: opts.long ? 'long' : 'short',
    day: 'numeric',
    ...(opts.noYear ? {} : { year: 'numeric' }),
  })
}

/* ---- the list ---- */

// Opens on six months: sponsorships tend to end together (every 2026 one ends
// Dec 31), and asking early gives time to hear back before the term runs out.
type WindowLabel = 'Next 30 days' | 'Next 90 days' | 'Next 6 months' | 'All'
const WINDOWS: readonly WindowLabel[] = ['Next 30 days', 'Next 90 days', 'Next 6 months', 'All']
const WINDOW_DAYS: Record<WindowLabel, number | null> = {
  'Next 30 days': 30,
  'Next 90 days': 90,
  'Next 6 months': 183,
  All: null,
}
/** A sponsorship that ended this recently may still renew, so it always stays on the list. */
const ENDED_GRACE_DAYS = 90

interface Item {
  sponsor: SponsorRow
  termEnd: string
  daysLeft: number
  ended: boolean
  /** Inside the sponsor's own reminder window, or already ended. */
  soon: boolean
  shownOn: string[]
  renewal: RenewalRow | null
  /** The status for THIS term; a renewal row about an earlier term reads "not asked". */
  status: RenewalStatus
  askedOn: string | null
}

function buildItem(s: SponsorRow, placements: PlacementRow[], renewal: RenewalRow | null, today: string): Item {
  const termEnd = s.term_end as string
  const daysLeft = daysBetween(today, termEnd)
  const current = Boolean(renewal && renewal.status_for === termEnd)
  const nowIso = new Date().toISOString()
  const surfaces = placements
    .filter((p) => p.sponsor_id === s.id && p.is_active && (!p.ends_at || p.ends_at >= nowIso))
    .map((p) => surfaceLabel(p.surface))
  return {
    sponsor: s,
    termEnd,
    daysLeft,
    ended: daysLeft < 0,
    soon: daysLeft <= (s.remind_days ?? 21),
    // Every active, in-term sponsor is also on the public Our Partners page.
    shownOn: [...new Set(surfaces), 'Our Partners page'],
    renewal,
    status: current && renewal ? renewal.status : 'not_asked',
    askedOn: current && renewal ? renewal.asked_on : null,
  }
}

function statusText(item: Pick<Item, 'status' | 'askedOn'>): string {
  switch (item.status) {
    case 'asked':
      return item.askedOn ? `Asked ${fmtDate(item.askedOn, { noYear: true })}` : 'Asked'
    case 'renewing':
      return 'Renewing'
    case 'not_renewing':
      return 'Not renewing'
    default:
      return 'Not asked yet'
  }
}

const PILL: Record<RenewalStatus, string> = {
  not_asked: 'border border-slate-300 bg-white text-slate-600',
  asked: 'bg-brand-blue-50 text-brand-blue',
  renewing: 'bg-green-100 text-green-700',
  not_renewing: 'bg-slate-100 text-slate-500',
}

function StatusPill({ item }: { item: Item }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL[item.status]}`}>
      {statusText(item)}
    </span>
  )
}

function whenText(item: Item): string {
  const date = fmtDate(item.termEnd)
  if (item.ended) {
    const ago = -item.daysLeft
    return `Ended ${date} · ${ago === 1 ? 'yesterday' : `${ago} days ago`}`
  }
  if (item.daysLeft === 0) return `Ends ${date} · today`
  return `Ends ${date} · ${item.daysLeft === 1 ? 'tomorrow' : `in ${item.daysLeft} days`}`
}

/* ---- the renewal email (no prices, no benefits: just the ask) ---- */

function firstNameOf(full: string | null | undefined): string {
  const words = (full ?? '').trim().split(/\s+/).filter(Boolean)
  // "Dr. Susan Borders" → Susan; "Dr. Borders" stays as it is.
  if (words.length >= 3 && /^(dr|mr|mrs|ms|miss|mx|prof)\.?$/i.test(words[0])) return words[1]
  if (words.length === 2 && /^(dr|mr|mrs|ms|miss|mx|prof)\.?$/i.test(words[0])) return words.join(' ')
  return words[0] ?? ''
}

function renewalMailto(item: Item, email: string): string {
  const subject = 'Sponsoring Ohio House Rabbit Rescue again'
  const through = fmtDate(item.termEnd, { long: true })
  const body = [
    `Hello ${firstNameOf(item.renewal?.contact_name) || 'there'},`,
    '',
    item.ended
      ? `Thank you for sponsoring Ohio House Rabbit Rescue. Your sponsorship ran through ${through}.`
      : `Thank you for sponsoring Ohio House Rabbit Rescue. Your current sponsorship runs through ${through}.`,
    '',
    "We would love to have you with us again. Would you like to continue for next year? Just reply to this email and we'll take care of the rest.",
    '',
    'Thank you for helping the rabbits,',
    'Ohio House Rabbit Rescue',
  ].join('\n')
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/* ---- copy / spreadsheet ---- */

function contactParts(r: RenewalRow | null): string[] {
  return [r?.contact_name, r?.contact_email, r?.contact_phone].map((v) => (v ?? '').trim()).filter(Boolean)
}

function listText(items: Item[], windowLabel: WindowLabel, today: string): string {
  const head = `Sponsor renewals, ${windowLabel === 'All' ? 'all upcoming' : windowLabel.toLowerCase()} (as of ${fmtDate(today)})`
  const paras = items.map((i) => {
    const contact = contactParts(i.renewal)
    return [
      i.sponsor.name,
      tierLabel(i.sponsor.tier),
      `${i.ended ? 'Ended' : 'Ends'} ${fmtDate(i.termEnd)}`,
      contact.length > 0 ? contact.join(', ') : 'No contact yet',
      statusText(i),
      // One paragraph per sponsor, so a note's own line breaks become spaces.
      (i.renewal?.note ?? '').trim().replace(/\s*\n\s*/g, ' '),
    ]
      .filter(Boolean)
      .join(' — ')
  })
  return [head, ...paras].join('\n\n')
}

const CSV_HEADERS = [
  'Sponsor',
  'Level',
  'Term start',
  'Term end',
  'Days left',
  'Shown on',
  'Contact name',
  'Contact email',
  'Contact phone',
  'Status',
  'Asked on',
  'Note',
  'Website',
]

function csvRows(items: Item[]): unknown[][] {
  return items.map((i) => [
    i.sponsor.name,
    tierLabel(i.sponsor.tier),
    i.sponsor.term_start ?? '',
    i.termEnd,
    i.daysLeft,
    i.shownOn.join(', '),
    i.renewal?.contact_name ?? '',
    i.renewal?.contact_email ?? '',
    i.renewal?.contact_phone ?? '',
    i.status === 'asked' ? 'Asked' : statusText(i),
    i.askedOn ?? '',
    i.renewal?.note ?? '',
    i.sponsor.website ? hrefFor(i.sponsor.website) : '',
  ])
}

/** The update-24 table isn't there yet (PostgREST: not in the schema cache / relation missing). */
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false
  if (e.code === 'PGRST205' || e.code === '42P01') return true
  const msg = e.message ?? ''
  return /sponsor_renewals/.test(msg) && /schema cache|does not exist/i.test(msg)
}

/* ---- contact & note form ---- */

interface ContactDraft {
  contact_name: string
  contact_email: string
  contact_phone: string
  note: string
}

function ContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ContactDraft
  onSave: (d: ContactDraft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ContactDraft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set =
    (k: keyof ContactDraft) =>
    (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [k]: e.target.value }))

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 print:hidden">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Who to ask</p>
      <label className="block text-sm font-semibold text-slate-700">
        Contact name
        <input
          className={staffInput}
          value={draft.contact_name}
          onChange={set('contact_name')}
          placeholder="Who looks after the sponsorship"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Email
        <input
          className={staffInput}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={draft.contact_email}
          onChange={set('contact_email')}
          placeholder="name@business.com"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Phone
        <input
          className={staffInput}
          type="tel"
          inputMode="tel"
          value={draft.contact_phone}
          onChange={set('contact_phone')}
          autoComplete="off"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Note
        <textarea
          className={staffInput}
          rows={3}
          value={draft.note}
          onChange={set('note')}
          placeholder="e.g. Asked at BunFest, call back in November"
        />
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${btn.primary} min-h-[44px] flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ---- one sponsor ---- */

const actionBtn =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-bold transition disabled:opacity-60'

function RenewalCard({
  item,
  orgId,
  userId,
  canSave,
  today,
  onChanged,
}: {
  item: Item
  orgId: string
  userId: string
  /** False until update 24 is run (or the renewals table can't be read). */
  canSave: boolean
  today: string
  onChanged: (flash?: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmRenew, setConfirmRenew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { sponsor, renewal } = item
  const email = (renewal?.contact_email ?? '').trim()
  const phone = (renewal?.contact_phone ?? '').trim()
  const note = (renewal?.note ?? '').trim()
  const muted = item.status === 'not_renewing'
  const nextStart = addDays(item.termEnd, 1)
  const nextEnd = addYear(item.termEnd)

  const setStatus = async (next: RenewalStatus) => {
    setBusy(true)
    setError(null)
    const sameTerm = renewal?.status_for === item.termEnd
    const { error } = await supabase.from('sponsor_renewals').upsert(
      {
        sponsor_id: sponsor.id,
        org_id: orgId,
        status: next,
        status_for: item.termEnd,
        // "Asked" is dated today; an ask from an earlier term doesn't carry over.
        ...(next === 'asked' ? { asked_on: today } : next === 'not_asked' || !sameTerm ? { asked_on: null } : {}),
        updated_by: userId || null,
      },
      { onConflict: 'sponsor_id' },
    )
    setBusy(false)
    if (error) setError(errMessage(error))
    else await onChanged()
  }

  const saveContact = async (d: ContactDraft) => {
    const { error } = await supabase.from('sponsor_renewals').upsert(
      {
        sponsor_id: sponsor.id,
        org_id: orgId,
        contact_name: d.contact_name.trim() || null,
        contact_email: d.contact_email.trim() || null,
        contact_phone: d.contact_phone.trim() || null,
        note: d.note.trim() || null,
        updated_by: userId || null,
      },
      { onConflict: 'sponsor_id' },
    )
    if (error) throw error
    setEditing(false)
    await onChanged()
  }

  // Renewed: the next term starts the day after this one ends and runs a year.
  // The renewal row is left alone; it's about the old term, so the new one
  // reads "Not asked yet" when it next comes round.
  const addAYear = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('sponsors')
      .update({ term_start: nextStart, term_end: nextEnd, is_active: true })
      .eq('id', sponsor.id)
    setBusy(false)
    setConfirmRenew(false)
    if (error) setError(errMessage(error))
    else
      await onChanged(
        `${sponsor.name} now runs ${fmtDate(nextStart)} to ${fmtDate(nextEnd)}. When that term comes up, it starts again at “Not asked yet”.`,
      )
  }

  const toggle = (s: Exclude<RenewalStatus, 'not_asked'>) => () => setStatus(item.status === s ? 'not_asked' : s)

  const statusBtn = (s: Exclude<RenewalStatus, 'not_asked'>, label: string, pressedLabel = label) => {
    const on = item.status === s
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={toggle(s)}
        disabled={busy}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-2 py-1.5 text-center text-sm font-bold leading-tight transition disabled:opacity-60 ${
          on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        {on ? pressedLabel : label}
      </button>
    )
  }

  return (
    <Card className={`space-y-3 print:break-inside-avoid print:shadow-none ${muted ? 'bg-slate-50/80' : ''}`}>
      <div className={`flex gap-3 ${muted ? 'opacity-60' : ''}`}>
        <SponsorLogo name={sponsor.name} logoUrl={sponsor.logo_url ?? undefined} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-extrabold text-ink">{sponsor.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={sponsor.tier === 'presenting' ? 'orange' : 'blue'}>{tierLabel(sponsor.tier)}</Badge>
            <StatusPill item={item} />
          </div>
          <p
            className={`mt-1.5 flex items-center gap-1.5 text-sm ${
              item.soon ? 'font-bold text-brand-orange-dark' : 'text-slate-600'
            }`}
          >
            <Icon name="clock" size={15} className="shrink-0" />
            {whenText(item)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {item.ended ? 'Was shown on' : 'Shown on'} {item.shownOn.join(', ')}
          </p>
        </div>
      </div>

      {/* Who to ask */}
      <div className={`space-y-0.5 text-sm ${muted ? 'opacity-60' : ''}`}>
        {renewal?.contact_name && <p className="font-semibold text-ink">{renewal.contact_name}</p>}
        {email && (
          <a href={`mailto:${email}`} className="flex items-center gap-1.5 py-0.5 font-semibold text-brand-blue">
            <Icon name="mail" size={15} className="shrink-0" />
            <span className="break-all">{email}</span>
          </a>
        )}
        {phone && (
          <a href={telHref(phone)} className="flex items-center gap-1.5 py-0.5 font-semibold text-brand-blue">
            <Icon name="phone" size={15} className="shrink-0" />
            {phone}
          </a>
        )}
        {!renewal?.contact_name && !email && !phone && <p className="text-slate-500">No contact yet.</p>}
        {note && (
          <p className="mt-1.5 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-slate-700">{note}</p>
        )}
      </div>

      {editing ? (
        <ContactForm
          initial={{
            contact_name: renewal?.contact_name ?? '',
            contact_email: email,
            contact_phone: phone,
            note: renewal?.note ?? '',
          }}
          onSave={saveContact}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-2.5 border-t border-slate-100 pt-3 print:hidden">
          {canSave &&
            (email ? (
              <a href={renewalMailto(item, email)} className={`${btn.blue} min-h-[44px] w-full !py-2`}>
                <Icon name="mail" size={16} /> Email them
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${btn.blue} min-h-[44px] w-full !py-2`}
              >
                <Icon name="plus" size={16} /> {renewal?.contact_name || phone ? 'Add their email' : 'Add a contact'}
              </button>
            ))}

          {canSave && (
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Where ${sponsor.name}’s renewal stands`}>
              {statusBtn('asked', 'Mark as asked', 'Asked')}
              {statusBtn('renewing', 'Renewing')}
              {statusBtn('not_renewing', 'Not renewing')}
            </div>
          )}

          {confirmRenew ? (
            <div className="space-y-2 rounded-xl border border-brand-orange/40 bg-brand-orange-50/60 p-3">
              <p className="text-sm text-slate-700">
                Renewed? The new term runs <strong>{fmtDate(nextStart)}</strong> to{' '}
                <strong>{fmtDate(nextEnd)}</strong>, and {sponsor.name}{' '}
                {item.ended ? 'shows in the app again' : 'keeps showing in the app'}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addAYear} disabled={busy} className={`${btn.primary} min-h-[44px] !py-2`}>
                  {busy ? 'Saving…' : 'Yes, add a year'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRenew(false)}
                  disabled={busy}
                  className={`${actionBtn} border-slate-200 bg-white text-slate-500 hover:bg-slate-50`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              {canSave && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-blue"
                >
                  Edit contact & note
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmRenew(true)}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-orange-dark disabled:opacity-60"
              >
                Renewed — add a year
              </button>
            </div>
          )}
        </div>
      )}

      <FormError>{error}</FormError>
    </Card>
  )
}

/* ---- screen ---- */

export default function StaffSponsorRenewals() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('events.bunfest.manage')

  const [sponsors, setSponsors] = useState<SponsorRow[]>([])
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [renewals, setRenewals] = useState<Map<string, RenewalRow>>(new Map())
  /** 'missing' = update 24 not run yet; 'error' = couldn't read it for another reason. */
  const [renewalsState, setRenewalsState] = useState<'ok' | 'missing' | 'error'>('ok')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowLabel, setWindowLabel] = useState<WindowLabel>('Next 6 months')
  const [flash, setFlash] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [toolNote, setToolNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const [s, p, r] = await Promise.all([
        supabase
          .from('sponsors')
          .select('*')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .not('term_end', 'is', null),
        supabase.from('sponsor_placements').select('*').eq('org_id', orgId).eq('is_active', true),
        supabase.from('sponsor_renewals').select('*').eq('org_id', orgId),
      ])
      if (s.error) setError(errMessage(s.error))
      setSponsors(s.data ?? [])
      // Placements only label "Shown on"; the list works without them.
      setPlacements(p.error ? [] : (p.data ?? []))
      if (r.error) {
        setRenewals(new Map())
        setRenewalsState(isMissingTable(r.error) ? 'missing' : 'error')
      } else {
        setRenewals(new Map((r.data ?? []).map((row) => [row.sponsor_id, row])))
        setRenewalsState('ok')
      }
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(
    async (message?: string) => {
      if (message) setFlash(message)
      await load()
    },
    [load],
  )

  const today = localTodayIso()
  const windowDays = WINDOW_DAYS[windowLabel]

  // Everyone with an end date: ended in the last 90 days, or still to come.
  const all = useMemo(
    () =>
      sponsors
        .filter((s) => s.term_end)
        .map((s) => buildItem(s, placements, renewals.get(s.id) ?? null, today))
        .filter((i) => i.daysLeft >= -ENDED_GRACE_DAYS),
    [sponsors, placements, renewals, today],
  )

  // In the window, soonest first; "not renewing" sinks to the bottom.
  const items = useMemo(
    () =>
      all
        .filter((i) => i.ended || windowDays === null || i.daysLeft <= windowDays)
        .sort(
          (a, b) =>
            Number(a.status === 'not_renewing') - Number(b.status === 'not_renewing') ||
            a.daysLeft - b.daysLeft ||
            a.sponsor.name.localeCompare(b.sponsor.name),
        ),
    [all, windowDays],
  )

  // The first one beyond the window, for the empty-state hint.
  const nextOutside = useMemo(
    () =>
      windowDays === null
        ? null
        : (all.filter((i) => i.daysLeft > windowDays).sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null),
    [all, windowDays],
  )

  const counts = {
    asked: items.filter((i) => i.status === 'asked').length,
    renewing: items.filter((i) => i.status === 'renewing').length,
    notRenewing: items.filter((i) => i.status === 'not_renewing').length,
  }

  const copyList = async () => {
    setToolNote(null)
    const ok = await copyText(listText(items, windowLabel, today))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setToolNote('Could not copy here. Try “Download spreadsheet” instead.')
    }
  }

  const download = async () => {
    setToolNote(null)
    const filename = `ohrr-sponsor-renewals-${today}.csv`
    const out = await exportCsv(filename, toCsv(CSV_HEADERS, csvRows(items)))
    if (out === 'saved') setToolNote(`Saved ${filename}. It opens in Excel, Numbers or Google Sheets.`)
    else if (out === 'failed') setToolNote('Could not make the spreadsheet. Try “Copy list” instead.')
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Sponsor renewals</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to sponsors. An owner or admin can grant the “Manage Midwest BunFest info”
            capability.
          </p>
        </Card>
      </Screen>
    )
  }

  const toolBtn =
    'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-brand-blue transition hover:bg-slate-50 disabled:opacity-50'

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Sponsor renewals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sponsorships end on their own on their end date. This is who to ask about continuing, soonest first.
        </p>
        <p className="mt-1 hidden text-sm text-slate-600 print:block">
          {windowLabel === 'All' ? 'All upcoming' : windowLabel}, as of {fmtDate(today)}.
        </p>
      </div>

      <div className="print:hidden">
        <SegTabs options={WINDOWS} value={windowLabel} onChange={setWindowLabel} wrap />
      </div>

      {flash && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 print:hidden"
        >
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">{flash}</p>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss"
            className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-green-700"
          >
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {renewalsState === 'missing' && (
        <div className="print:hidden">
          <QuietNote>
            Saving contacts, notes and who has been asked needs the latest database update (update 24). Until
            it’s run, this still lists who is ending, and “Renewed — add a year” works.
          </QuietNote>
        </div>
      )}
      {renewalsState === 'error' && (
        <div className="print:hidden">
          <QuietNote>
            Contacts and notes couldn’t be loaded just now, so they’re hidden. The list of who is ending is still
            right. Come back in a moment to try again.
          </QuietNote>
        </div>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading sponsors…" />
      ) : items.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          {windowDays === null ? (
            <>
              <p className="text-sm font-semibold text-slate-700">No active sponsorship has an end date.</p>
              <p className="mt-1 text-sm text-slate-500">
                Set a term end on a sponsor in Sponsors & partners and it will show here.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700">No sponsorships end in the {windowLabel.toLowerCase()}.</p>
              <p className="mt-1 text-sm text-slate-500">
                {nextOutside
                  ? `The next one, ${nextOutside.sponsor.name}, ends ${fmtDate(nextOutside.termEnd)}. Choose a longer window or “All” above to see it.`
                  : 'Choose a longer window or “All” above to look further ahead.'}
              </p>
            </>
          )}
        </Card>
      ) : (
        <>
          <p className="px-1 text-sm font-bold text-slate-700" aria-live="polite">
            {items.length} sponsor{items.length === 1 ? '' : 's'} · {counts.asked} asked · {counts.renewing} renewing
            {counts.notRenewing > 0 ? ` · ${counts.notRenewing} not renewing` : ''}
          </p>

          {/* The list generator: take it anywhere */}
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={copyList} className={toolBtn}>
              {copied && <Icon name="check" size={16} />}
              {copied ? 'Copied' : 'Copy list'}
            </button>
            <button type="button" onClick={download} className={toolBtn}>
              Download spreadsheet (.csv)
            </button>
            {!isNative && (
              <button type="button" onClick={() => window.print()} className={toolBtn}>
                <Icon name="printer" size={16} /> Print
              </button>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {copied ? 'Copied the list' : ''}
          </p>
          {toolNote && <p className="px-1 text-sm text-slate-600 print:hidden">{toolNote}</p>}

          <div className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <RenewalCard
                key={item.sponsor.id}
                item={item}
                orgId={orgId}
                userId={userId}
                canSave={renewalsState === 'ok'}
                today={today}
                onChanged={refresh}
              />
            ))}
          </div>
        </>
      )}

      <p className="px-1 text-sm text-slate-500 print:hidden">
        To change a sponsor’s dates, logo or where they’re shown, open{' '}
        <Link to="/staff/sponsors" className="font-bold text-brand-blue">
          Sponsors & partners
        </Link>
        .
      </p>

      {/* Print: just the list, full width, no app chrome */}
      <style>{`
        @media print {
          @page { margin: 0.6in; }
          body { background: white !important; }
          header { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; }
        }
      `}</style>
    </Screen>
  )
}
