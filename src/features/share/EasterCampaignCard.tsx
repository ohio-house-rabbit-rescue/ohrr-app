// Staff → Post queue: the Easter campaign card (next Easter, the planned
// posts, and "Plan this year's Easter posts" for people who write posts), the
// one-line reminder at the top of the queue when Easter is near and nothing is
// planned, and the same reminder for the staff home. See easterCampaign.ts.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { errMessage } from '../../lib/supabase'
import { Card, Badge, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError } from '../../components/staffui'
import { STATUS_LABEL, localToday } from './queue'
import { cardName, easterNudge, easterReminder, planEasterCampaign, usDate, weeksLabel, type EasterCampaign } from './easterCampaign'

const CARD_ID = 'easter-campaign'
const banner = 'flex w-full items-center gap-3 rounded-2xl border border-brand-orange/40 bg-brand-orange-50 px-4 py-3 text-left shadow-sm'

function Reminder({ easter }: { easter: string }) {
  return (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange text-ink">
        <Icon name="calendar" size={20} />
      </span>
      <span className="min-w-0 flex-1 font-display text-[15px] font-extrabold text-ink">Easter is {usDate(easter)} — plan the Easter posts</span>
      <Icon name="chevron" size={18} className="shrink-0 text-slate-400" />
    </>
  )
}

/** Top of the post queue, for people who write posts. Taps down to the card. */
export function EasterNudge({ campaign }: { campaign: EasterCampaign }) {
  const easter = easterNudge(campaign)
  if (!easter) return null
  return (
    <button type="button" onClick={() => document.getElementById(CARD_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={banner}>
      <Reminder easter={easter} />
    </button>
  )
}

/**
 * For the staff home — people who write posts, near Easter, while nothing is
 * planned. Not on StaffHome yet; it goes next to PostsToApproveNotice:
 * {can('announcements.post') && <EasterCampaignNotice />}
 */
export function EasterCampaignNotice({ className = '' }: { className?: string }) {
  const { membership, can } = useAuth()
  const orgId = membership && can('announcements.post') ? membership.orgId : null
  const [easter, setEaster] = useState<string | null>(null)
  useEffect(() => {
    if (!orgId) return
    let alive = true
    void easterReminder(orgId).then((d) => {
      if (alive) setEaster(d)
    })
    return () => {
      alive = false
    }
  }, [orgId])
  if (!orgId || !easter) return null
  return (
    <Link to="/staff/posts" className={`${banner} ${className}`}>
      <Reminder easter={easter} />
    </Link>
  )
}

export function EasterCampaignCard({ campaign, canDraft, onPlanned }: { campaign: EasterCampaign; canDraft: boolean; onPlanned: () => Promise<void> }) {
  const { membership, user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { year, easter, slots, planned, toAdd } = campaign

  const plan = async () => {
    if (!membership || !user) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const out = await planEasterCampaign(membership.orgId, user.id, year, '/ohrr-mark.png')
      setMsg(
        out.added === 0
          ? 'Nothing to add — this Easter’s posts are already in the queue.'
          : `Added ${out.added} draft${out.added === 1 ? '' : 's'} to the queue${out.noPicture ? ` (${out.noPicture} without a picture — make it in the Share kit)` : ''}. Send each one for approval when it looks right.`,
      )
    } catch (e) {
      setError(errMessage(e))
    }
    // Reload either way: a run that stopped part-way still added some.
    await onPlanned()
    setBusy(false)
  }

  return (
    <Card className="space-y-3">
      {/* scroll-mt keeps the heading clear of the top bar when the reminder scrolls here */}
      <div id={CARD_ID} className="flex scroll-mt-24 flex-wrap items-center gap-2">
        <h2 className="font-display text-[15px] font-extrabold text-ink">Easter campaign</h2>
        <Badge tone={!planned ? 'slate' : toAdd > 0 ? 'orange' : 'blue'}>{!planned ? 'Not planned yet' : toAdd > 0 ? `${toAdd} to add` : 'Planned'}</Badge>
      </div>
      <p className="text-sm text-slate-600">
        Easter {easter < localToday() ? 'was' : 'is'} <strong>Sunday, {usDate(easter)}</strong>. {slots.filter((s) => s.weeks < 0).length} posts before it for families
        thinking about a bunny, {slots.filter((s) => s.weeks > 0).length} after for new owners — requests to surrender rise two to three months after Easter.
      </p>
      <ul className="divide-y divide-slate-100">
        {slots.map((s) => (
          <li key={s.source} className="flex items-center gap-3 py-2">
            <span className="w-[92px] shrink-0 text-xs font-bold text-ink">{usDate(s.date)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{cardName(s.card)}</span>
              <span className="block text-xs text-slate-500">{weeksLabel(s.weeks)} Easter</span>
            </span>
            <span className={`shrink-0 text-xs font-bold ${s.post ? 'text-brand-blue' : 'text-slate-400'}`}>{s.post ? STATUS_LABEL[s.post.status] : s.past ? 'Day has gone' : 'Not in the queue'}</span>
          </li>
        ))}
      </ul>
      {canDraft && toAdd > 0 && (
        <>
          <button type="button" onClick={() => void plan()} disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
            <Icon name="calendar" size={16} /> {busy ? 'Making the posts…' : 'Plan this year’s Easter posts'}
          </button>
          <p className="text-xs text-slate-500">
            Adds {toAdd === 1 ? 'the missing post' : `the ${toAdd} missing posts`} as drafts, each with its card picture and caption, dated as above. They still need sending for
            approval, approving and posting like any other post. Posts already in the queue aren’t added again.
          </p>
        </>
      )}
      {planned && toAdd === 0 && <p className="text-xs text-slate-500">This Easter’s posts are in the queue. Next year’s show here once this campaign is over.</p>}
      {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{msg}</p>}
      <FormError>{error}</FormError>
    </Card>
  )
}
