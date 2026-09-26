import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import QrCode from '../components/QrCode'
import StaffAvatar from '../components/StaffAvatar'
import StaffImageField from '../components/StaffImageField'
import { shareText } from '../features/share/share'
import { APP_URL } from '../features/mybunny/ics'
import {
  PERMISSION_CATALOG,
  PRESETS,
  type Capability,
  type PermissionMeta,
} from '../lib/capabilities'
import type { Database, Json, MembershipRole, MembershipStatus } from '../lib/database.types'
import {
  ADMIN_LEVELS,
  ALL_LEVELS,
  CERT_KINDS,
  HELPER_LEVELS,
  PRESET_SUGGESTED_LEVEL,
  accessDate,
  accessDay,
  accessEnded,
  certExpiry,
  certLabel,
  isFullAccess,
  isMissingFunction,
  levelFromRole,
  levelInfo,
  levelsICanGive,
  managedBy,
  ohrrToday,
  probeTiers,
  shortDate,
  todayIso,
  type StaffLevel,
} from '../lib/staffLevels'

/** The sign-up link a QR code carries: the join screen with the code in it. */
function joinUrl(code: string): string {
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return code ? `${base}/staff/join?code=${encodeURIComponent(code)}` : `${base}/staff/join`
}

/** Shown wherever inviting needs update 30 and it hasn't been run. */
const NEEDS_UPDATE_30 = 'Invites switch on with update 30 (RUN-THIS-IN-SUPABASE.sql in the Drive).'

interface Member {
  id: string
  user_id: string
  email: string | null
  role: MembershipRole
  status: MembershipStatus
  /** Founder / board / lead / worker (update 28; ten levels from update 30); before it, worked out from the role. */
  level: StaffLevel
  /** list_team's can_manage (update 28). null before it, when the old role rules apply. */
  manageable: boolean | null
  /** The last day of their access (update 30); null = no end, or before it. */
  access_until: string | null
  // Team profile — a photo is optional; a bunny stands in (20260922140000_*.sql)
  display_name: string | null
  title: string | null
  photo_url: string | null
  show_on_about: boolean
}

type Cert = Database['public']['Tables']['member_certifications']['Row']

const memberName = (m: Pick<Member, 'display_name' | 'email'>) => m.display_name || m.email || 'Team member'

/**
 * On hold: someone put them on hold (status 'disabled'), or their end date has
 * passed (America/New_York). Either way the database refuses them everything,
 * and they keep their account, level and tasks for when they're turned back on.
 */
const isOnHold = (m: Pick<Member, 'status' | 'access_until'>) => m.status === 'disabled' || accessEnded(m.access_until)

// Capabilities grouped by area, for the per-member toggle UI.
const AREAS: { area: string; caps: PermissionMeta[] }[] = (() => {
  const order: string[] = []
  const byArea = new Map<string, PermissionMeta[]>()
  for (const p of PERMISSION_CATALOG) {
    if (!byArea.has(p.area)) {
      byArea.set(p.area, [])
      order.push(p.area)
    }
    byArea.get(p.area)!.push(p)
  }
  return order.map((area) => ({ area, caps: byArea.get(area)! }))
})()

const describe = (key: string) => PERMISSION_CATALOG.find((p) => p.key === key)?.description ?? key

/* ---- A row of level buttons (only the levels on offer) ---- */
function LevelPicker({
  value,
  choices,
  onChange,
  disabled,
}: {
  value: StaffLevel | null
  choices: StaffLevel[]
  onChange: (l: StaffLevel) => void
  disabled?: boolean
}) {
  const cols =
    choices.length >= 5
      ? 'grid-cols-2 sm:grid-cols-3'
      : choices.length === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : choices.length === 3
          ? 'grid-cols-3'
          : 'grid-cols-2'
  return (
    <div className={`mt-1.5 grid gap-1.5 ${cols}`}>
      {ALL_LEVELS.filter((l) => choices.includes(l.value)).map((l) => {
        const on = value === l.value
        return (
          <button
            key={l.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(l.value)}
            className={`min-h-[44px] rounded-full px-3 text-sm font-bold transition disabled:opacity-60 ${
              on ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---- "How access works", in plain words ---- */
// The ten levels in groups, lowest first. Admins 1–3 share one line.
const EXPLAINER_GROUPS: { label: string; levels: StaffLevel[] }[] = [
  { label: 'Volunteers 1–3', levels: ['volunteer1', 'volunteer2', 'volunteer3'] },
  { label: 'Lead', levels: ['lead'] },
  { label: 'Admins 1–3', levels: ['admin1'] },
  { label: 'Board', levels: ['board'] },
  { label: 'Founder', levels: ['founder'] },
  { label: 'Developer', levels: ['developer'] },
]

function HowAccessWorks({ tiersReady }: { tiersReady: boolean }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-1">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 font-display text-[15px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
        How access works
        <Icon name="chevron" size={16} className="rotate-90 text-slate-400 transition-transform group-open:-rotate-90" />
      </summary>
      <div className="space-y-3 pb-3 text-sm leading-relaxed text-slate-600">
        <ul className="space-y-1">
          {EXPLAINER_GROUPS.map((g) =>
            g.levels.length === 1 ? (
              <li key={g.label}>
                <strong className="text-ink">{g.label}</strong> — {levelInfo(g.levels[0]).blurb}.
              </li>
            ) : (
              <li key={g.label}>
                <strong className="text-ink">{g.label}</strong>
                <ul className="mt-0.5 space-y-0.5 pl-3">
                  {g.levels.map((l) => (
                    <li key={l}>
                      {levelInfo(l).label} — {levelInfo(l).blurb}.
                    </li>
                  ))}
                </ul>
              </li>
            ),
          )}
        </ul>
        <p>
          <strong className="text-ink">Sharing goes downwards.</strong> You can only give someone a level below your
          own, and you can only share tasks you have yourself. Founders and developers have every task and can give
          any level; everyone else, Board and Admins included, has the tasks switched on for them.
        </p>
        <p>
          <strong className="text-ink">For a set time.</strong> Give someone an end date — BunFest weekend, say. After
          that day the staff area stops working for them until someone extends it. A founder’s or developer’s access
          never ends.
        </p>
        <p>
          <strong className="text-ink">On hold.</strong> Put someone on hold when you don’t need them for a while (e.g.
          BunFest helpers after the festival). They keep their account, level and tasks but can’t use anything until you
          turn them back on, with no new invite needed. An end date puts someone on hold automatically.
        </p>
        <p>
          <strong className="text-ink">Volunteers don’t need an account</strong> to sign up for shifts and log hours —
          they use their private volunteer link. Only people who work in the staff area (the Counter, check-in,
          editing) need one.
        </p>
        {!tiersReady && <p className="text-xs text-slate-500">The ten levels and end dates arrive with update 30.</p>}
      </div>
    </details>
  )
}

/* ---- Invite someone ---- */
const CUSTOM = '__custom__'

function InvitePanel({
  orgId,
  tiersReady,
  levelChoices,
  onInvited,
}: {
  orgId: string
  /** Update 30 is in (create_staff_invite). Before it, no invite can be made. */
  tiersReady: boolean
  /** The levels this person may invite at, highest first. */
  levelChoices: StaffLevel[]
  onInvited: () => void
}) {
  const { can } = useAuth()
  // Only presets whose tasks I all hold, and only tasks I hold (founders and developers: every one).
  const presetNames = useMemo(() => Object.keys(PRESETS).filter((p) => PRESETS[p].every((k) => can(k))), [can])
  const areas = useMemo(
    () => AREAS.map(({ area, caps }) => ({ area, caps: caps.filter((c) => can(c.key)) })).filter((a) => a.caps.length > 0),
    [can],
  )
  // Start at the lowest level on offer (Volunteer 1), never Founder, with a preset that suits it.
  const lowest: StaffLevel = levelChoices[levelChoices.length - 1] ?? 'volunteer1'
  const [picked, setLevel] = useState<StaffLevel>(lowest)
  const level = levelChoices.includes(picked) ? picked : lowest
  const [preset, setPreset] = useState<string>(
    () => presetNames.find((p) => PRESET_SUGGESTED_LEVEL[p] === lowest) ?? presetNames[0] ?? CUSTOM,
  )
  const [customCaps, setCustomCaps] = useState<Set<Capability>>(new Set())
  const [helpers, setHelpers] = useState(false)
  const [accessUntil, setAccessUntil] = useState('')
  const [who, setWho] = useState({ name: '', email: '', phone: '', position: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [made, setMade] = useState<{ level: StaffLevel; until: string | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const setWhoField = (k: keyof typeof who) => (e: { target: { value: string } }) => setWho({ ...who, [k]: e.target.value })

  const isCustom = preset === CUSTOM || !presetNames.includes(preset)
  // Founders and developers hold every task, so their invites carry none — and their access never ends.
  const fullAccess = isFullAccess(level)
  // A lead, admin or board member who may bring on helpers of their own.
  const helpersOffered = can('staff.invite') && can('staff.permissions.manage') && HELPER_LEVELS.includes(level)
  const until = fullAccess ? '' : accessUntil
  const shareable = areas.flatMap((x) => x.caps.map((c) => c.key))
  const allPicked = shareable.length > 0 && shareable.every((k) => customCaps.has(k))

  const pickLevel = (l: StaffLevel) => {
    setLevel(l)
    // Admin 1–3 have no preset: their tasks are chosen one by one.
    if (ADMIN_LEVELS.includes(l)) setPreset(CUSTOM)
  }

  const pickPreset = (p: string) => {
    setPreset(p)
    // e.g. "Hop Shop Worker" → Volunteer 1, when it's a level this person may give.
    const suggested = PRESET_SUGGESTED_LEVEL[p]
    if (suggested && levelChoices.includes(suggested)) setLevel(suggested)
  }

  const toggleCustom = (key: Capability) =>
    setCustomCaps((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const generate = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setCode(null)
    setCopied(false)
    setBusy(true)
    try {
      const caps = new Set<Capability>(fullAccess ? [] : isCustom ? customCaps : [])
      if (!fullAccess && helpersOffered && helpers) {
        caps.add('staff.invite')
        caps.add('staff.permissions.manage')
      }
      // One call: level, tasks, end date and who it's for — the database checks each.
      const { data, error } = await supabase.rpc('create_staff_invite', {
        p_org: orgId,
        p_level: level,
        p_capabilities: Array.from(caps),
        p_preset: fullAccess || isCustom ? null : preset,
        p_access_until: until || null,
        p_name: who.name.trim() || null,
        p_email: who.email.trim() || null,
        p_phone: who.phone.trim() || null,
        p_position: who.position.trim() || null,
        p_max_uses: 1,
      })
      if (error) throw isMissingFunction(error) ? new Error(NEEDS_UPDATE_30) : error
      setCode(data)
      setMade({ level, until: until || null })
      onInvited()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable; the code is shown for manual copy */
    }
  }

  if (!tiersReady) {
    return (
      <Card className="space-y-1">
        <h2 className="font-display text-[15px] font-extrabold text-ink">Invite someone</h2>
        <p className="text-sm text-slate-600">{NEEDS_UPDATE_30}</p>
      </Card>
    )
  }

  if (levelChoices.length === 0) {
    return (
      <Card className="space-y-1">
        <h2 className="font-display text-[15px] font-extrabold text-ink">Invite someone</h2>
        <p className="text-sm text-slate-600">
          You can invite people below your own level, and there isn’t one below yours. Ask someone above you to invite
          them.
        </p>
      </Card>
    )
  }

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="users" size={18} className="text-brand-blue" />
          <h2 className="font-display text-[15px] font-extrabold text-ink">Invite someone</h2>
        </div>

        <form onSubmit={generate} className="space-y-3">
          {/* Who it's for — so a pending invite isn't an anonymous code. */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <label className="block text-sm font-semibold text-slate-700">
              Their name
              <input className={staffInput} value={who.name} onChange={setWhoField('name')} placeholder="Bev" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input className={staffInput} type="email" value={who.email} onChange={setWhoField('email')} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Text / phone <span className="font-normal text-slate-400">(optional)</span>
                <input className={staffInput} type="tel" value={who.phone} onChange={setWhoField('phone')} />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              The position they asked about <span className="font-normal text-slate-400">(optional)</span>
              <input className={staffInput} value={who.position} onChange={setWhoField('position')} placeholder="Hop Shop, Saturdays" />
            </label>
            <p className="text-xs text-slate-500">
              Optional, but it means you can see who an unused invite belongs to — and send it to them in a tap.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700">Level</p>
            <LevelPicker value={level} choices={levelChoices} onChange={pickLevel} />
            <p className="mt-1.5 text-xs text-slate-500">{levelInfo(level).blurb}.</p>
          </div>

          {fullAccess ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Holds every task — nothing to choose.</p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                Tasks
                <select className={staffInput} value={isCustom ? CUSTOM : preset} onChange={(e) => pickPreset(e.target.value)}>
                  {presetNames.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value={CUSTOM}>Choose tasks myself</option>
                </select>
              </label>
              {isCustom ? (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pick their tasks</p>
                    <button
                      type="button"
                      onClick={() => setCustomCaps(allPicked ? new Set() : new Set(shareable))}
                      className="min-h-[44px] text-xs font-bold text-brand-blue"
                    >
                      {allPicked ? 'Clear them all' : 'Select all the tasks I can share'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {areas.map(({ area, caps }) => (
                      <div key={area}>
                        <p className="text-xs font-bold text-slate-500">{area}</p>
                        <div className="mt-1 grid grid-cols-1">
                          {caps.map((c) => (
                            <label key={c.key} className="flex min-h-[44px] items-center gap-2.5 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
                                checked={customCaps.has(c.key)}
                                onChange={() => toggleCustom(c.key)}
                              />
                              {c.description}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Only the tasks you have yourself are listed.</p>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                  <p className="font-bold text-slate-600">Gives them:</p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {PRESETS[preset]?.map((k) => <li key={k}>{describe(k)}</li>)}
                  </ul>
                </div>
              )}
              {helpersOffered && (
                <label className="flex min-h-[44px] items-start gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
                    checked={helpers}
                    onChange={(e) => setHelpers(e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">Can bring on helpers</span>
                    <span className="block text-xs text-slate-500">
                      They can invite people below them and share only the tasks they have.
                    </span>
                  </span>
                </label>
              )}
            </>
          )}

          {!fullAccess && (
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Access until <span className="font-normal text-slate-400">(optional)</span>
                <input
                  type="date"
                  className={staffInput}
                  value={accessUntil}
                  min={ohrrToday()}
                  onChange={(e) => setAccessUntil(e.target.value)}
                />
              </label>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">For a set time, e.g. BunFest weekend. Leave empty for no end.</p>
                {accessUntil && (
                  <button type="button" onClick={() => setAccessUntil('')} className="min-h-[36px] shrink-0 text-xs font-bold text-brand-blue">
                    No end date
                  </button>
                )}
              </div>
            </div>
          )}

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={busy || (!fullAccess && isCustom && customCaps.size === 0)}
            className={`${btn.blue} w-full disabled:opacity-60`}
          >
            {busy ? 'Generating…' : 'Generate invite code'}
          </button>
        </form>

        {code && made && (
          <div className="space-y-3 rounded-xl border border-brand-blue/30 bg-brand-blue-50/60 p-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">
                Invite {who.name ? `for ${who.name}` : '— share with them'} · joins as {levelInfo(made.level).label}
              </p>
              {made.until && <p className="mt-0.5 text-xs font-semibold text-slate-600">Access until {accessDate(made.until)}</p>}
            </div>

            {/* Show the code to a phone camera — no typing, no transcription. */}
            <div className="flex flex-col items-center gap-2">
              <QrCode value={joinUrl(code)} size={188} alt="QR code to join the OHRR staff app" />
              <p className="text-center text-xs text-slate-600">
                Hold this up — their camera opens the sign-up with the code already in it.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
              <code className="font-mono text-lg font-black tracking-wider text-ink">{code}</code>
              <button type="button" onClick={copy} className="min-h-[44px] rounded-full bg-brand-blue px-4 text-xs font-bold text-white">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {who.email && (
                <a
                  href={`mailto:${who.email}?subject=${encodeURIComponent('Your OHRR staff invite')}&body=${encodeURIComponent(
                    `Hi${who.name ? ` ${who.name}` : ''},\n\nHere's your invite to the OHRR staff app${who.position ? ` for ${who.position}` : ''}. Open this link, create your sign-in, and you're in:\n\n${joinUrl(code)}\n\nOr enter the code ${code} at ${joinUrl('')}\n\nIt's single-use and expires in 14 days.${made.until ? ` Your access runs until ${accessDate(made.until)}.` : ''}\n\nOhio House Rabbit Rescue`,
                  )}`}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-brand-blue px-4 text-xs font-bold text-white"
                >
                  Email it
                </a>
              )}
              {who.phone && (
                <a
                  href={`sms:${who.phone.replace(/[^0-9+]/g, '')}?&body=${encodeURIComponent(
                    `Your OHRR staff invite: ${joinUrl(code)} (code ${code})`,
                  )}`}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-brand-blue px-4 text-xs font-bold text-white"
                >
                  Text it
                </a>
              )}
              <button
                type="button"
                onClick={() => shareText(`Your OHRR staff invite: ${joinUrl(code)} (code ${code})`, 'OHRR staff invite')}
                className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600"
              >
                Share
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Single-use, expires in 14 days. They sign in (or create a sign-in) and the code joins them to the team with
              the access you chose.
            </p>
          </div>
        )}
      </Card>

      <WaitingInvites orgId={orgId} reloadKey={code ?? ''} />
    </>
  )
}

/* ---- Invites not used yet (open_invites) ---- */
interface WaitingInvite {
  code: string
  level: StaffLevel | null
  preset: string | null
  capabilities: string[]
  access_until: string | null
  invitee_name: string | null
  invitee_email: string | null
  position_note: string | null
  expires_at: string | null
}

const jsonText = (v: Json | undefined): string | null => (typeof v === 'string' && v ? v : null)

/** open_invites() returns jsonb; level, capabilities and access_until only from update 30. */
function parseInvites(data: Json | null): WaitingInvite[] {
  if (!Array.isArray(data)) return []
  const out: WaitingInvite[] = []
  for (const row of data) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const code = jsonText(row.code)
    if (!code) continue
    const level = jsonText(row.level)
    const caps = row.capabilities
    out.push({
      code,
      level: ALL_LEVELS.find((l) => l.value === level)?.value ?? null,
      preset: jsonText(row.preset),
      capabilities: Array.isArray(caps) ? caps.filter((c): c is string => typeof c === 'string') : [],
      access_until: jsonText(row.access_until),
      invitee_name: jsonText(row.invitee_name),
      invitee_email: jsonText(row.invitee_email),
      position_note: jsonText(row.position_note),
      expires_at: jsonText(row.expires_at),
    })
  }
  return out
}

function WaitingInvites({ orgId, reloadKey }: { orgId: string; reloadKey: string }) {
  const [invites, setInvites] = useState<WaitingInvite[]>([])
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('open_invites', { p_org: orgId })
    if (!error) setInvites(parseInvites(data))
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const revoke = async (code: string) => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('revoke_invite', { p_code: code })
    setBusy(false)
    if (error) return setError(errMessage(error))
    setConfirm(null)
    await load()
  }

  if (invites.length === 0) return null
  return (
    <Card className="space-y-2">
      <p className="font-display text-[15px] font-extrabold text-ink">
        Waiting invites <span className="font-bold text-slate-400">({invites.length})</span>
      </p>
      <ul className="divide-y divide-slate-100">
        {invites.map((i) => {
          const tasks =
            i.level && isFullAccess(i.level)
              ? 'Every task'
              : i.preset
                ? i.preset
                : `${i.capabilities.length} task${i.capabilities.length === 1 ? '' : 's'}`
          return (
            <li key={i.code} className="space-y-1.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block break-all text-sm font-bold text-ink">{i.invitee_name || i.invitee_email || 'No name given'}</span>
                  {i.invitee_name && i.invitee_email && <span className="block break-all text-xs text-slate-400">{i.invitee_email}</span>}
                  {i.position_note && <span className="block text-xs text-slate-500">{i.position_note}</span>}
                </span>
                {i.level && <Badge tone={isFullAccess(i.level) ? 'blue' : 'slate'}>{levelInfo(i.level).label}</Badge>}
              </div>
              <p className="text-xs text-slate-500">
                {tasks}
                {i.access_until ? ` · access until ${accessDay(i.access_until)}` : ''}
                {i.expires_at ? ` · code expires ${shortDate(i.expires_at.slice(0, 10))}` : ''}
                <span className="font-mono"> · {i.code}</span>
              </p>
              {confirm === i.code ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void revoke(i.code)}
                    disabled={busy}
                    className="min-h-[44px] flex-1 rounded-full bg-red-600 px-4 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busy ? 'Cancelling…' : 'Cancel this invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => shareText(`Your OHRR staff invite: ${joinUrl(i.code)} (code ${i.code})`, 'OHRR staff invite')}
                    className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600"
                  >
                    Send again
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(i.code)}
                    className="min-h-[44px] rounded-full border border-red-200 px-4 text-xs font-bold text-red-600"
                  >
                    Cancel invite
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <FormError>{error}</FormError>
    </Card>
  )
}

/* ---- Certifications: what someone has been trained and signed off for ---- */
function CertRow({
  cert,
  canRemove,
  certifiedBy,
  onRemoved,
}: {
  cert: Cert
  canRemove: boolean
  certifiedBy: string | null
  onRemoved: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exp = certExpiry(cert.expires_on)
  const label = certLabel(cert.kind)

  const remove = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('member_certifications').delete().eq('id', cert.id)
    if (error) {
      setError(errMessage(error))
      setBusy(false)
      return
    }
    await onRemoved()
  }

  return (
    <li
      className={`rounded-xl px-3 py-2 ${
        exp.state === 'expired' ? 'bg-red-50' : exp.state === 'soon' ? 'bg-brand-orange-50' : 'bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{label}</span>
          <span className="block text-xs text-slate-500">
            Certified {shortDate(cert.certified_on)}
            {certifiedBy ? ` by ${certifiedBy}` : ''}
            {cert.notes ? ` · ${cert.notes}` : ''}
          </span>
          <span
            className={`block text-xs font-bold ${
              exp.state === 'expired' ? 'text-red-600' : exp.state === 'soon' ? 'text-brand-orange-dark' : 'text-slate-500'
            }`}
          >
            {exp.state === 'expired' || exp.state === 'soon' ? (
              <Icon name="clock" size={12} className="mr-1 inline align-[-1px]" />
            ) : null}
            {exp.text}
          </span>
        </span>
        {canRemove && !confirm && (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={`Remove ${label}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-red-600"
          >
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
      {confirm && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Removing…' : `Remove ${label}`}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
          >
            Keep
          </button>
        </div>
      )}
      <FormError>{error}</FormError>
    </li>
  )
}

const OTHER = '__other__'

function addYears(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y + n, m - 1, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function CertForm({
  orgId,
  membershipId,
  userId,
  held,
  onDone,
  onCancel,
}: {
  orgId: string
  membershipId: string
  userId: string | null
  /** Kinds they already hold — saving one again renews it. */
  held: string[]
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [kind, setKind] = useState('')
  const [other, setOther] = useState('')
  const [certifiedOn, setCertifiedOn] = useState(todayIso())
  const [expiresOn, setExpiresOn] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Typed text that is one of the usual four is saved as its code, like the chips.
  const typed = other.trim()
  const finalKind =
    kind === OTHER ? (CERT_KINDS.find((k) => k.label.toLowerCase() === typed.toLowerCase())?.value ?? typed) : kind
  const renewing = Boolean(finalKind) && held.includes(finalKind)

  const save = async () => {
    if (!finalKind) return setError('Pick what they’re certified for.')
    if (!certifiedOn) return setError('When were they certified?')
    if (expiresOn && expiresOn < certifiedOn) return setError('It can’t expire before the day they were certified.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('member_certifications').upsert(
      {
        org_id: orgId,
        membership_id: membershipId,
        kind: finalKind,
        certified_on: certifiedOn,
        expires_on: expiresOn || null,
        certified_by: userId,
        notes: notes.trim() || null,
      },
      { onConflict: 'membership_id,kind' },
    )
    if (error) {
      setError(errMessage(error))
      setBusy(false)
      return
    }
    await onDone()
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">Certified for</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...CERT_KINDS, { value: OTHER, label: 'Something else' }].map((k) => {
            const on = kind === k.value
            return (
              <button
                key={k.value}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k.value)}
                className={`min-h-[44px] rounded-full px-3.5 text-sm font-bold ${
                  on ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {k.label}
              </button>
            )
          })}
        </div>
        {kind === OTHER && (
          <input
            className={staffInput}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="e.g. Nail trims"
            aria-label="What they're certified for"
            autoFocus
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Certified on
          <input type="date" className={staffInput} value={certifiedOn} max={todayIso()} onChange={(e) => setCertifiedOn(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Expires <span className="font-normal text-slate-400">(optional)</span>
          <input type="date" className={staffInput} value={expiresOn} min={certifiedOn || undefined} onChange={(e) => setExpiresOn(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => certifiedOn && setExpiresOn(addYears(certifiedOn, n))}
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-600"
          >
            Expires in {n} year{n === 1 ? '' : 's'}
          </button>
        ))}
        {expiresOn && (
          <button
            type="button"
            onClick={() => setExpiresOn('')}
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-600"
          >
            No expiry
          </button>
        )}
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Notes <span className="font-normal text-slate-400">(optional)</span>
        <input className={staffInput} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trained by Bev on the new till" />
      </label>
      {renewing && <p className="text-xs text-slate-500">They already have this one — saving renews it with these dates.</p>}
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || !finalKind} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : renewing ? 'Renew' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  )
}

function Certifications({
  orgId,
  member,
  certs,
  manage,
  userId,
  nameOf,
  onChanged,
}: {
  orgId: string
  member: Member
  certs: Cert[]
  manage: boolean
  userId: string | null
  nameOf: (userId: string | null) => string | null
  onChanged: () => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  if (certs.length === 0 && !manage) return null
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Certified for</p>
      {certs.length === 0 && !adding && <p className="text-sm text-slate-500">Nothing recorded yet.</p>}
      {certs.length > 0 && (
        <ul className="space-y-2">
          {certs.map((c) => (
            <CertRow key={c.id} cert={c} canRemove={manage} certifiedBy={nameOf(c.certified_by)} onRemoved={onChanged} />
          ))}
        </ul>
      )}
      {manage &&
        (adding ? (
          <CertForm
            orgId={orgId}
            membershipId={member.id}
            userId={userId}
            held={certs.map((c) => c.kind)}
            onDone={async () => {
              setAdding(false)
              await onChanged()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-brand-blue/40 px-4 text-sm font-bold text-brand-blue"
          >
            <Icon name="plus" size={16} /> Add a certification
          </button>
        ))}
    </div>
  )
}

/* ---- Access until a date (update 30) ---- */
function AccessUntilField({
  member,
  onSave,
}: {
  member: Member
  onSave: (member: Member, until: string | null) => Promise<string | null>
}) {
  const [value, setValue] = useState(member.access_until ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = member.access_until ?? ''

  const save = async (until: string | null) => {
    setBusy(true)
    setError(null)
    const err = await onSave(member, until)
    setBusy(false)
    if (err) setError(err)
    else setValue(until ?? '')
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">
        Put on hold automatically after
        <input
          type="date"
          className={`${staffInput} font-sans text-sm font-normal normal-case tracking-normal`}
          value={value}
          min={ohrrToday()}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <p className="text-xs text-slate-500">
        {current
          ? accessEnded(current)
            ? `Their access ended on ${accessDate(current)}, so they’re on hold. Pick a later day to extend it.`
            : `Their access ends after ${accessDate(current)}.`
          : 'No end date. For a set time (e.g. BunFest weekend), pick the last day.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save(value)}
          disabled={busy || !value || value === current}
          className="min-h-[44px] flex-1 rounded-full bg-brand-blue px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {current && (
          <button
            type="button"
            onClick={() => void save(null)}
            disabled={busy}
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 disabled:opacity-50"
          >
            No end date
          </button>
        )}
      </div>
      <FormError>{error}</FormError>
    </div>
  )
}

/* ---- One member row ---- */
function MemberCard({
  orgId,
  member,
  isSelf,
  userId,
  grants,
  manage,
  levelChoices,
  tiersReady,
  certs,
  nameOf,
  notice,
  onToggleCap,
  onPutOnHold,
  onTurnBackOn,
  onSetLevel,
  onSetAccessUntil,
  onProfileSaved,
  onCertsChanged,
}: {
  orgId: string
  member: Member
  isSelf: boolean
  userId: string | null
  grants: Set<string>
  /** May the signed-in person change this person's level, tasks and access? */
  manage: boolean
  /** The levels on offer (update 28); null before it. */
  levelChoices: StaffLevel[] | null
  /** Update 30 is in: six levels, end dates. */
  tiersReady: boolean
  /** Their certifications; null before update 28 (hidden). */
  certs: Cert[] | null
  nameOf: (userId: string | null) => string | null
  /** A line to show on the card, e.g. just after they were turned back on. */
  notice: string | null
  onToggleCap: (memId: string, key: Capability, grant: boolean) => Promise<void>
  onPutOnHold: (member: Member) => Promise<string | null>
  onTurnBackOn: (member: Member) => Promise<string | null>
  onSetLevel: (member: Member, level: StaffLevel) => Promise<string | null>
  onSetAccessUntil: (member: Member, until: string | null) => Promise<string | null>
  onProfileSaved: () => Promise<void>
  onCertsChanged: () => Promise<void>
}) {
  // What the signed-in person holds: only those tasks can be shared (update 30).
  const { can } = useAuth()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [confirmHold, setConfirmHold] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [pendingLevel, setPendingLevel] = useState<StaffLevel | null>(null)
  const [levelBusy, setLevelBusy] = useState(false)
  const [levelError, setLevelError] = useState<string | null>(null)
  const levelsMode = levelChoices !== null
  // Every task: founders and developers — and, before update 30, Board (then an admin).
  const everything = (l: StaffLevel) => isFullAccess(l) || (!tiersReady && l === 'board')
  const fullAccess = member.role === 'owner' || member.role === 'admin' || (levelsMode && everything(member.level))
  const name = memberName(member)
  const onHold = isOnHold(member)
  // Before update 28 admins and owners can't be put on hold from here, as before.
  const canHold = manage && !isSelf && (levelsMode || !fullAccess)
  const cantShare = !fullAccess && manage && PERMISSION_CATALOG.some((p) => !can(p.key))

  const handleCap = async (key: Capability, grant: boolean) => {
    setBusyKey(key)
    await onToggleCap(member.id, key, grant)
    setBusyKey(null)
  }

  // Both move the card to another part of the list, so this one unmounts on success.
  const runStatus = async (action: (m: Member) => Promise<string | null>) => {
    setStatusBusy(true)
    setStatusError(null)
    const err = await action(member)
    setStatusBusy(false)
    if (err) setStatusError(err)
    else setConfirmHold(false)
  }

  const saveLevel = async () => {
    if (!pendingLevel) return
    setLevelBusy(true)
    setLevelError(null)
    const err = await onSetLevel(member, pendingLevel)
    setLevelBusy(false)
    if (err) setLevelError(err)
    else setPendingLevel(null)
  }

  return (
    <Card className={`space-y-2.5 ${onHold ? 'bg-slate-50/80' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <StaffAvatar name={name} photoUrl={member.photo_url} size={52} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="break-all font-display text-[15px] font-extrabold text-ink">{name}</span>
              {isSelf && <span className="shrink-0 text-xs font-bold text-slate-400">(you)</span>}
            </div>
            {member.title && <span className="block text-xs font-semibold text-slate-500">{member.title}</span>}
            {member.display_name && member.email && (
              <span className="block break-all text-xs text-slate-400">{member.email}</span>
            )}
            {!member.email && !member.display_name && (
              <span className="font-mono text-[11px] text-slate-400">ID {member.user_id.slice(0, 8)}</span>
            )}
            {(isSelf || manage) && (
              <button
                type="button"
                onClick={() => setEditingProfile((v) => !v)}
                className="min-h-[36px] text-xs font-bold text-brand-blue"
              >
                {editingProfile ? 'Close' : member.photo_url ? 'Edit photo & title' : 'Add a photo & title'}
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={fullAccess ? 'blue' : 'slate'}>
            {levelsMode ? levelInfo(member.level).label : member.role[0].toUpperCase() + member.role.slice(1)}
          </Badge>
          {member.status === 'disabled' && <Badge tone="orange">On hold</Badge>}
          {member.access_until &&
            (accessEnded(member.access_until) ? (
              <Badge tone="slate">Access ended {accessDay(member.access_until)}</Badge>
            ) : (
              <Badge tone="orange">Access ends {accessDay(member.access_until)}</Badge>
            ))}
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {notice}
        </p>
      )}

      {editingProfile && (
        <ProfileForm
          member={member}
          onDone={async () => {
            setEditingProfile(false)
            await onProfileSaved()
          }}
        />
      )}

      {/* Level — only the levels this person may give, and only for people below them. */}
      {levelsMode && manage && levelChoices.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Level</p>
          <LevelPicker
            value={pendingLevel ?? member.level}
            choices={levelChoices}
            disabled={levelBusy}
            onChange={(l) => {
              setLevelError(null)
              setPendingLevel(l === member.level ? null : l)
            }}
          />
          {pendingLevel && (
            <div className="mt-2 space-y-2 rounded-xl bg-brand-blue-50/60 p-3">
              <p className="text-sm text-ink">
                Make {name} <strong>{levelInfo(pendingLevel).asA}</strong>? {levelInfo(pendingLevel).blurb}.
                {fullAccess && !everything(pendingLevel)
                  ? tiersReady && pendingLevel === 'board'
                    ? ' If they have no tasks switched on, they get the Board set — check the tasks below next.'
                    : ' They’ll keep only the tasks ticked below, so check those next.'
                  : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveLevel()}
                  disabled={levelBusy}
                  className="min-h-[44px] flex-1 rounded-full bg-brand-blue px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {levelBusy ? 'Saving…' : `Make ${levelInfo(pendingLevel).label}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingLevel(null)}
                  className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <FormError>{levelError}</FormError>
        </div>
      )}

      {fullAccess ? (
        <p className="text-sm text-slate-500">Holds every task.</p>
      ) : manage ? (
        <div className="space-y-2">
          {cantShare && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Greyed-out tasks: only someone who has this task can share it.
            </p>
          )}
          {AREAS.map(({ area, caps }) => (
            <div key={area}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{area}</p>
              <div className="mt-0.5 grid grid-cols-1">
                {caps.map((c) => {
                  const on = grants.has(c.key)
                  const mine = can(c.key)
                  return (
                    <label
                      key={c.key}
                      title={mine ? undefined : 'Only someone who has this task can share it.'}
                      className={`flex min-h-[44px] items-center gap-2.5 text-sm ${mine ? 'text-slate-700' : 'text-slate-400'}`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30 disabled:opacity-50"
                        checked={on}
                        disabled={!mine || busyKey === c.key}
                        onChange={(e) => handleCap(c.key, e.target.checked)}
                      />
                      {c.description}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {grants.size === 0
            ? 'No tasks switched on.'
            : `${grants.size} ${grants.size === 1 ? 'task' : 'tasks'} switched on.`}
        </p>
      )}

      {/* Access for a set time — not for founders or developers, whose access never ends. */}
      {manage && tiersReady && !isFullAccess(member.level) && <AccessUntilField member={member} onSave={onSetAccessUntil} />}

      {levelsMode && !manage && (
        <p className="text-xs font-semibold text-slate-400">
          {isSelf ? `Your own level and access: ${managedBy(member.level).toLowerCase()}.` : `${managedBy(member.level)}.`}
        </p>
      )}

      {certs && (
        <Certifications
          orgId={orgId}
          member={member}
          certs={certs}
          manage={manage}
          userId={userId}
          nameOf={nameOf}
          onChanged={onCertsChanged}
        />
      )}

      {/* On hold: they keep their account, level and tasks; turning back on needs no new invite. */}
      {canHold &&
        (onHold ? (
          <button
            type="button"
            onClick={() => void runStatus(onTurnBackOn)}
            disabled={statusBusy}
            className="min-h-[44px] rounded-full border border-emerald-200 px-4 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
          >
            {statusBusy ? 'Turning back on…' : 'Turn back on'}
          </button>
        ) : confirmHold ? (
          <div className="space-y-2 rounded-xl bg-brand-orange-50/70 p-3">
            <p className="text-sm text-ink">
              Put {name} on hold? They keep their account, level and tasks, but can’t use anything in the staff area until
              someone turns them back on.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void runStatus(onPutOnHold)}
                disabled={statusBusy}
                className="min-h-[44px] flex-1 rounded-full bg-brand-orange-dark px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {statusBusy ? 'Putting on hold…' : 'Put on hold'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmHold(false)
                  setStatusError(null)
                }}
                disabled={statusBusy}
                className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmHold(true)}
            className="min-h-[44px] rounded-full border border-brand-orange/40 px-4 text-xs font-bold text-brand-orange-dark transition hover:bg-brand-orange-50"
          >
            Put on hold
          </button>
        ))}
      <FormError>{statusError}</FormError>
    </Card>
  )
}

export default function StaffTeam() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const canInvite = can('staff.invite')
  const canManage = can('staff.permissions.manage')

  const [members, setMembers] = useState<Member[]>([])
  const [grantMap, setGrantMap] = useState<Map<string, Set<string>>>(new Map())
  // Update 28 (levels, certifications) and update 30 (ten levels, sharing, end dates): known after the first load.
  const [levelsReady, setLevelsReady] = useState(false)
  const [tiersReady, setTiersReady] = useState(false)
  const [certMap, setCertMap] = useState<Map<string, Cert[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setError(null)
    // list_team() (update 28) brings levels and who may manage whom. Before it
    // runs, fall back to list_org_members(), then to the memberships table (IDs only).
    const [teamRes, grantRes, profileRes, certRes, tiers] = await Promise.all([
      supabase.rpc('list_team', { p_org: orgId }),
      supabase.from('membership_permissions').select('membership_id, permission_key'),
      // Photos and titles live on the memberships row and are merged in.
      supabase.from('memberships').select('id, display_name, title, photo_url, show_on_about').eq('org_id', orgId),
      supabase.from('member_certifications').select('*').eq('org_id', orgId).order('certified_on', { ascending: false }),
      probeTiers(),
    ])
    const profiles = new Map(
      (profileRes.data ?? []).map((r) => [
        r.id,
        { display_name: r.display_name ?? null, title: r.title ?? null, photo_url: r.photo_url ?? null, show_on_about: Boolean(r.show_on_about) },
      ]),
    )
    const blankProfile = { display_name: null, title: null, photo_url: null, show_on_about: false }

    let mem: Member[]
    if (!teamRes.error && teamRes.data) {
      mem = teamRes.data.map((r) => ({
        id: r.membership_id,
        user_id: r.user_id,
        email: r.email,
        role: r.role,
        status: r.status,
        level: r.level,
        manageable: Boolean(r.can_manage),
        // Only from update 30.
        access_until: r.access_until ?? null,
        ...blankProfile,
        display_name: r.display_name ?? null,
        title: r.title ?? null,
        ...(profiles.get(r.membership_id) ?? {}),
      }))
    } else {
      const memRes = await supabase.rpc('list_org_members', { p_org: orgId })
      if (!memRes.error && memRes.data) {
        mem = memRes.data.map((r) => ({
          id: r.membership_id,
          user_id: r.user_id,
          email: r.email,
          role: r.role,
          status: r.status,
          level: levelFromRole(r.role),
          manageable: null,
          access_until: null,
          ...(profiles.get(r.membership_id) ?? blankProfile),
        }))
      } else {
        const fb = await supabase
          .from('memberships')
          .select('id, user_id, role, status, display_name, title, photo_url, show_on_about')
          .eq('org_id', orgId)
          .order('created_at')
        if (fb.error) {
          setError(errMessage(fb.error))
          setLoading(false)
          return
        }
        mem = (fb.data ?? []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          email: null,
          role: r.role,
          status: r.status,
          level: levelFromRole(r.role),
          manageable: null,
          access_until: null,
          display_name: r.display_name ?? null,
          title: r.title ?? null,
          photo_url: r.photo_url ?? null,
          show_on_about: Boolean(r.show_on_about),
        }))
      }
    }

    if (grantRes.error) {
      setError(errMessage(grantRes.error))
      setLoading(false)
      return
    }
    const map = new Map<string, Set<string>>()
    for (const g of grantRes.data ?? []) {
      if (!map.has(g.membership_id)) map.set(g.membership_id, new Set())
      map.get(g.membership_id)!.add(g.permission_key)
    }
    let certs: Map<string, Cert[]> | null = null
    if (!certRes.error) {
      certs = new Map()
      for (const c of certRes.data ?? []) {
        if (!certs.has(c.membership_id)) certs.set(c.membership_id, [])
        certs.get(c.membership_id)!.push(c)
      }
    }
    setMembers(mem)
    setGrantMap(map)
    setLevelsReady(!teamRes.error)
    setTiersReady(!teamRes.error && tiers)
    setCertMap(certs)
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  const toggleCap = useCallback(async (memId: string, key: Capability, grant: boolean) => {
    const { error } = await supabase.rpc('set_membership_permission', {
      p_membership: memId,
      p_key: key,
      p_grant: grant,
    })
    if (error) {
      setError(errMessage(error))
      return
    }
    setGrantMap((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(memId) ?? [])
      if (grant) set.add(key)
      else set.delete(key)
      next.set(memId, set)
      return next
    })
  }, [])

  // "<name> is back on…", shown on that person's card after turning them back on.
  const [backOn, setBackOn] = useState<{ id: string; text: string } | null>(null)

  const putOnHold = useCallback(async (member: Member): Promise<string | null> => {
    const { error } = await supabase.rpc('set_membership_status', { p_membership: member.id, p_status: 'disabled' })
    if (error) return errMessage(error)
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: 'disabled' } : m)))
    setBackOn((b) => (b?.id === member.id ? null : b))
    return null
  }, [])

  // On hold can mean put on hold, a passed end date, or both: undo whichever applies.
  const turnBackOn = useCallback(async (member: Member): Promise<string | null> => {
    if (member.status === 'disabled') {
      const { error } = await supabase.rpc('set_membership_status', { p_membership: member.id, p_status: 'active' })
      if (error) return errMessage(error)
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: 'active' } : m)))
    }
    if (accessEnded(member.access_until)) {
      const { error } = await supabase.rpc('set_member_access_until', { p_membership: member.id, p_until: null })
      if (error) return errMessage(error)
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, access_until: null } : m)))
    }
    setBackOn({ id: member.id, text: `${memberName(member)} is back on. Add an end date if their help is for a set time.` })
    return null
  }, [])

  // Their card moves from "On hold" up to their level: bring it into view.
  useEffect(() => {
    if (!backOn) return
    const t = window.setTimeout(() => {
      document.getElementById(`member-${backOn.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => window.clearTimeout(t)
  }, [backOn])

  const setLevel = useCallback(
    async (member: Member, level: StaffLevel): Promise<string | null> => {
      const { error } = await supabase.rpc('set_member_level', { p_membership: member.id, p_level: level })
      if (error) return errMessage(error)
      await load() // the role follows the level, and who may manage whom can change
      return null
    },
    [load],
  )

  const setAccessUntil = useCallback(async (member: Member, until: string | null): Promise<string | null> => {
    const { error } = await supabase.rpc('set_member_access_until', { p_membership: member.id, p_until: until })
    if (error) return errMessage(error)
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, access_until: until } : m)))
    // An end date added after turning them back on answers the "back on" note.
    if (until) setBackOn((b) => (b?.id === member.id ? null : b))
    return null
  }, [])

  const me = members.find((m) => m.user_id === user?.id) ?? null
  // The levels the signed-in person may give; null before update 28, the old four before update 30.
  const levelChoices = levelsReady ? levelsICanGive(me?.level, tiersReady) : null

  const nameOf = useCallback(
    (uid: string | null) => {
      if (!uid) return null
      const m = members.find((x) => x.user_id === uid)
      return m ? memberName(m) : null
    },
    [members],
  )

  // Everyone not on hold, grouped by level (highest first); within a level, in the order they joined.
  const groups = useMemo(
    () =>
      ALL_LEVELS.map((l) => ({ ...l, people: members.filter((m) => m.level === l.value && !isOnHold(m)) })).filter(
        (g) => g.people.length > 0,
      ),
    [members],
  )
  // Everyone on hold, in one section at the bottom: highest level first.
  const onHold = useMemo(
    () => ALL_LEVELS.flatMap((l) => members.filter((m) => m.level === l.value && isOnHold(m))),
    [members],
  )

  // Certifications that have run out or run out within 30 days, for people still on the team.
  const expiring = useMemo(() => {
    if (!certMap) return []
    const out: { who: string; what: string; text: string; expired: boolean }[] = []
    for (const m of members) {
      if (isOnHold(m)) continue
      for (const c of certMap.get(m.id) ?? []) {
        const e = certExpiry(c.expires_on)
        if (e.state === 'expired' || e.state === 'soon') {
          out.push({ who: memberName(m), what: certLabel(c.kind), text: e.text, expired: e.state === 'expired' })
        }
      }
    }
    return out.sort((a, b) => Number(b.expired) - Number(a.expired))
  }, [certMap, members])

  const renderCard = (m: Member) => {
    const isSelf = m.user_id === user?.id
    // After update 28 the database says who may manage whom; before it, the old rule.
    const manage = levelsReady ? Boolean(m.manageable) : canManage
    return (
      <div key={m.id} id={`member-${m.id}`} className="scroll-mt-24">
        <MemberCard
          orgId={orgId}
          member={m}
          isSelf={isSelf}
          userId={user?.id ?? null}
          grants={grantMap.get(m.id) ?? new Set()}
          manage={manage}
          levelChoices={levelChoices}
          tiersReady={tiersReady}
          certs={certMap ? (certMap.get(m.id) ?? []) : null}
          nameOf={nameOf}
          notice={backOn?.id === m.id ? backOn.text : null}
          onProfileSaved={load}
          onToggleCap={toggleCap}
          onPutOnHold={putOnHold}
          onTurnBackOn={turnBackOn}
          onSetLevel={setLevel}
          onSetAccessUntil={setAccessUntil}
          onCertsChanged={load}
        />
      </div>
    )
  }

  if (!canInvite && !canManage) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Team</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don't have access to manage the team. Ask {levelsReady ? 'someone above your level' : 'an owner or admin'} if
            you need it.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Team</h1>
        <p className="mt-1 text-sm text-slate-600">
          {levelsReady
            ? 'Everyone on the team, by level. You can change people below your own level and share the tasks you have. Changes take effect immediately and are logged.'
            : 'Invite staff and control what each person can do. Changes take effect immediately and are logged.'}
        </p>
      </div>

      {!loading && levelsReady && <HowAccessWorks tiersReady={tiersReady} />}

      {canInvite && !loading && (
        <InvitePanel orgId={orgId} tiersReady={tiersReady} levelChoices={levelChoices ?? []} onInvited={load} />
      )}

      <FormError>{error}</FormError>

      {expiring.length > 0 && (
        <Card className="space-y-1.5 border-brand-orange/40 bg-brand-orange-50/50">
          <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
            <Icon name="clock" size={18} className="text-brand-orange-dark" />
            {expiring.length} certification{expiring.length === 1 ? '' : 's'} to renew
          </p>
          <ul className="space-y-0.5 text-sm text-slate-700">
            {expiring.slice(0, 6).map((x, i) => (
              <li key={i}>
                <span className="font-semibold">{x.who}</span> — {x.what}:{' '}
                <span className={x.expired ? 'font-bold text-red-600' : 'font-bold text-brand-orange-dark'}>{x.text}</span>
              </li>
            ))}
            {expiring.length > 6 && <li className="text-slate-500">…and {expiring.length - 6} more below.</li>}
          </ul>
        </Card>
      )}

      {loading ? (
        <Spinner label="Loading team…" />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.value} className="space-y-2">
              <div className="px-1">
                <p className="font-display text-base font-extrabold text-ink">
                  {levelsReady ? g.plural : g.value === 'founder' ? 'Owners' : g.value === 'board' ? 'Admins' : 'Staff'}{' '}
                  <span className="font-bold text-slate-400">({g.people.length})</span>
                </p>
                {levelsReady && (
                  <p className="text-xs text-slate-500">
                    {!tiersReady && g.value === 'board' ? 'Every task' : g.blurb}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">{g.people.map(renderCard)}</div>
            </section>
          ))}

          {/* Everyone on hold, out of their level groups: closed until tapped. */}
          {onHold.length > 0 && (
            <details className="group space-y-2">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 [&::-webkit-details-marker]:hidden">
                <span className="font-display text-base font-extrabold text-slate-600">
                  On hold <span className="font-bold text-slate-400">({onHold.length})</span>
                </span>
                <Icon name="chevron" size={16} className="rotate-90 text-slate-400 transition-transform group-open:-rotate-90" />
              </summary>
              <p className="px-1 pt-1 text-xs text-slate-500">
                They keep their level and tasks. Turn someone back on when you need them again, e.g. for next year’s
                BunFest.
              </p>
              <div className="grid grid-cols-1 gap-3 opacity-90">{onHold.map(renderCard)}</div>
            </details>
          )}
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-slate-400">
        Members are shown by email. (If you see only short IDs, the database helper that exposes
        emails hasn’t been added yet — it’s a one-time setup step.)
      </p>
    </Screen>
  )
}



/**
 * A member's own picture and title. Optional by design — plenty of volunteers
 * would rather not be photographed, and the team list draws a bunny instead.
 * A member may always edit their own; staff.permissions.manage may edit anyone's.
 */
function ProfileForm({ member, onDone }: { member: Member; onDone: () => Promise<void> }) {
  const { user } = useAuth()
  const [d, setD] = useState({
    display_name: member.display_name ?? '',
    title: member.title ?? '',
    photo_url: member.photo_url ?? '',
    show_on_about: member.show_on_about,
  })
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.rpc('save_member_profile', {
        p_membership: member.id,
        p_display_name: d.display_name.trim() || null,
        p_title: d.title.trim(),
        p_photo_url: d.photo_url.trim(),
        p_show_on_about: d.show_on_about,
      })
      if (error) throw error
      await onDone()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
      <StaffImageField
        label="Photo"
        hint="Entirely optional — without one the team list shows a bunny with an excuse."
        value={d.photo_url}
        userId={user?.id ?? ''}
        onChange={(url) => setD({ ...d, photo_url: url })}
        onBusyChange={setImageBusy}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Name to show
          <input className={staffInput} value={d.display_name} onChange={(e) => setD({ ...d, display_name: e.target.value })} placeholder="Bev" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          What they do
          <input className={staffInput} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Adoption Coordinator" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 text-brand-blue"
          checked={d.show_on_about}
          onChange={(e) => setD({ ...d, show_on_about: e.target.checked })}
        />
        Show on the public About page
      </label>
      <FormError>{error}</FormError>
      <button type="button" onClick={save} disabled={busy || imageBusy} className={`${btn.primary} w-full disabled:opacity-60`}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
