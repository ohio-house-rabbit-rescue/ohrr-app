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
import type { Database, MembershipRole, MembershipStatus } from '../lib/database.types'
import {
  CERT_KINDS,
  LEVELS,
  PRESET_SUGGESTED_LEVEL,
  certExpiry,
  certLabel,
  isFullAccess,
  levelFromRole,
  levelInfo,
  levelsICanGive,
  managedBy,
  roleForLevel,
  shortDate,
  todayIso,
  type StaffLevel,
} from '../lib/staffLevels'

/** The sign-up link a QR code carries: the join screen with the code in it. */
function joinUrl(code: string): string {
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return code ? `${base}/staff/join?code=${encodeURIComponent(code)}` : `${base}/staff/join`
}

interface Member {
  id: string
  user_id: string
  email: string | null
  role: MembershipRole
  status: MembershipStatus
  /** Founder / board / lead / worker (update 28); before it, worked out from the role. */
  level: StaffLevel
  /** list_team's can_manage (update 28). null before it, when the old role rules apply. */
  manageable: boolean | null
  // Team profile — a photo is optional; a bunny stands in (20260922140000_*.sql)
  display_name: string | null
  title: string | null
  photo_url: string | null
  show_on_about: boolean
}

type Cert = Database['public']['Tables']['member_certifications']['Row']

/** "Make Bev a board member?" */
const AS_LEVEL: Record<StaffLevel, string> = {
  founder: 'a founder',
  board: 'a board member',
  lead: 'a lead',
  worker: 'a worker',
}

const memberName = (m: Pick<Member, 'display_name' | 'email'>) => m.display_name || m.email || 'Team member'

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
  return (
    <div className={`mt-1.5 grid gap-1.5 ${choices.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {LEVELS.filter((l) => choices.includes(l.value)).map((l) => {
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

/* ---- Invite someone ---- */
function InvitePanel({
  orgId,
  levelChoices,
  onInvited,
}: {
  orgId: string
  /** The levels this person may invite at (update 28); null before it — the old role choice shows. */
  levelChoices: StaffLevel[] | null
  onInvited: () => void
}) {
  const levelsMode = levelChoices !== null
  const [role, setRole] = useState<MembershipRole>('staff')
  const [level, setLevel] = useState<StaffLevel>(() =>
    levelChoices?.includes('lead') ? 'lead' : (levelChoices?.[levelChoices.length - 1] ?? 'lead'),
  )
  const [preset, setPreset] = useState<string>('Hop Shop Manager')
  const [customCaps, setCustomCaps] = useState<Set<Capability>>(new Set())
  const [who, setWho] = useState({ name: '', email: '', phone: '', position: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [codeLevel, setCodeLevel] = useState<StaffLevel | null>(null)
  const [copied, setCopied] = useState(false)
  const setWhoField = (k: keyof typeof who) => (e: { target: { value: string } }) => setWho({ ...who, [k]: e.target.value })

  const isCustom = preset === '__custom__'
  // Founders and board members (or, before update 28, admins) hold every permission.
  const fullAccess = levelsMode ? isFullAccess(level) : role === 'admin'

  const pickPreset = (p: string) => {
    setPreset(p)
    // e.g. "Hop Shop Worker" → the Worker level, when it's one this person may give.
    const suggested = PRESET_SUGGESTED_LEVEL[p]
    if (suggested && levelChoices?.includes(suggested)) setLevel(suggested)
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
      const caps = !fullAccess && isCustom ? Array.from(customCaps) : []
      const { data, error } = await supabase.rpc('create_invite_code', {
        p_org: orgId,
        p_role: levelsMode ? roleForLevel(level) : role,
        p_capabilities: caps,
        p_preset: fullAccess || isCustom ? null : preset,
        p_max_uses: 1,
      })
      if (error) throw error
      const newCode = data as string
      // The level they join at. If the database won't have it, the invite goes.
      if (levelsMode) {
        const lv = await supabase.rpc('set_invite_level', { p_code: newCode, p_level: level })
        if (lv.error) {
          await supabase.rpc('revoke_invite', { p_code: newCode })
          throw lv.error
        }
      }
      // Remember who it was for, so a pending invite can be chased or re-sent.
      if (who.name || who.email || who.phone || who.position) {
        await supabase.rpc('set_invite_details', {
          p_code: newCode,
          p_name: who.name || null,
          p_email: who.email || null,
          p_phone: who.phone || null,
          p_position: who.position || null,
        })
      }
      setCode(newCode)
      setCodeLevel(levelsMode ? level : null)
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

  if (levelChoices && levelChoices.length === 0) {
    return (
      <Card className="space-y-1">
        <h2 className="font-display text-[15px] font-extrabold text-ink">Invite someone</h2>
        <p className="text-sm text-slate-600">
          You can invite people below your own level, and there isn’t one below yours. Ask the board to invite them.
        </p>
      </Card>
    )
  }

  const presetPicker = (
    <label className="block flex-1 text-sm font-semibold text-slate-700">
      Access preset
      <select className={staffInput} value={preset} onChange={(e) => pickPreset(e.target.value)} disabled={fullAccess}>
        {Object.keys(PRESETS).map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
    </label>
  )

  return (
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
              Text / phone
              <input className={staffInput} type="tel" value={who.phone} onChange={setWhoField('phone')} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            The position they asked about
            <input className={staffInput} value={who.position} onChange={setWhoField('position')} placeholder="Hop Shop, Saturdays" />
          </label>
          <p className="text-xs text-slate-500">
            Optional, but it means you can see who an unused invite belongs to — and send it to them in a tap.
          </p>
        </div>

        {levelsMode ? (
          <>
            <div>
              <p className="text-sm font-semibold text-slate-700">Level</p>
              <LevelPicker value={level} choices={levelChoices} onChange={setLevel} />
              <p className="mt-1.5 text-xs text-slate-500">{levelInfo(level).blurb}.</p>
            </div>
            {presetPicker}
          </>
        ) : (
          <div className="flex gap-3">
            <label className="block flex-1 text-sm font-semibold text-slate-700">
              Role
              <select className={staffInput} value={role} onChange={(e) => setRole(e.target.value as MembershipRole)}>
                <option value="staff">Staff (scoped)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </label>
            {presetPicker}
          </div>
        )}

        {fullAccess ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {levelsMode
              ? `${levelInfo(level).plural === 'Board' ? 'Board members' : levelInfo(level).plural} hold every permission — no preset needed.`
              : 'Admins implicitly hold every capability — no preset needed.'}
          </p>
        ) : isCustom ? (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Pick capabilities</p>
            <div className="space-y-2">
              {AREAS.map(({ area, caps }) => (
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
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            Grants: {PRESETS[preset]?.map((k) => k.split('.').slice(-2).join(' ')).join(', ')}
          </p>
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

      {code && (
        <div className="space-y-3 rounded-xl border border-brand-blue/30 bg-brand-blue-50/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">
            Invite {who.name ? `for ${who.name}` : '— share with them'}
            {codeLevel ? ` · joins as ${levelInfo(codeLevel).label}` : ''}
          </p>

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
                  `Hi${who.name ? ` ${who.name}` : ''},\n\nHere's your invite to the OHRR staff app${who.position ? ` for ${who.position}` : ''}. Open this link, create your sign-in, and you're in:\n\n${joinUrl(code)}\n\nOr enter the code ${code} at ${joinUrl('')}\n\nIt's single-use and expires in 14 days.\n\nOhio House Rabbit Rescue`,
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

/* ---- One member row ---- */
function MemberCard({
  orgId,
  member,
  isSelf,
  userId,
  grants,
  manage,
  levelChoices,
  certs,
  nameOf,
  onToggleCap,
  onToggleStatus,
  onSetLevel,
  onProfileSaved,
  onCertsChanged,
}: {
  orgId: string
  member: Member
  isSelf: boolean
  userId: string | null
  grants: Set<string>
  /** May the signed-in person change this person's level, permissions and access? */
  manage: boolean
  /** The levels on offer (update 28); null before it. */
  levelChoices: StaffLevel[] | null
  /** Their certifications; null before update 28 (hidden). */
  certs: Cert[] | null
  nameOf: (userId: string | null) => string | null
  onToggleCap: (memId: string, key: Capability, grant: boolean) => Promise<void>
  onToggleStatus: (member: Member) => Promise<void>
  onSetLevel: (member: Member, level: StaffLevel) => Promise<string | null>
  onProfileSaved: () => Promise<void>
  onCertsChanged: () => Promise<void>
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [pendingLevel, setPendingLevel] = useState<StaffLevel | null>(null)
  const [levelBusy, setLevelBusy] = useState(false)
  const [levelError, setLevelError] = useState<string | null>(null)
  const levelsMode = levelChoices !== null
  const fullAccess = member.role === 'owner' || member.role === 'admin' || (levelsMode && isFullAccess(member.level))
  const name = memberName(member)
  // Before update 28 admins and owners can't be switched off from here, as before.
  const canSwitchOff = manage && !isSelf && (levelsMode || !fullAccess)

  const handleCap = async (key: Capability, grant: boolean) => {
    setBusyKey(key)
    await onToggleCap(member.id, key, grant)
    setBusyKey(null)
  }

  const handleStatus = async () => {
    setStatusBusy(true)
    await onToggleStatus(member)
    setStatusBusy(false)
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
    <Card className={`space-y-2.5 ${member.status === 'disabled' ? 'bg-slate-50/80' : ''}`}>
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
          {member.status === 'disabled' && <Badge tone="orange">Disabled</Badge>}
        </div>
      </div>

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
                Make {name} <strong>{AS_LEVEL[pendingLevel]}</strong>? {levelInfo(pendingLevel).blurb}.
                {fullAccess && !isFullAccess(pendingLevel)
                  ? ' They’ll keep only the permissions ticked below, so check those next.'
                  : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveLevel()}
                  disabled={levelBusy}
                  className="min-h-[44px] flex-1 rounded-full bg-brand-blue px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {levelBusy ? 'Saving…' : `Make ${levelInfo(pendingLevel).label === 'Board' ? 'board member' : levelInfo(pendingLevel).label.toLowerCase()}`}
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
        <p className="text-sm text-slate-500">Full access — holds every permission.</p>
      ) : manage ? (
        <div className="space-y-2">
          {AREAS.map(({ area, caps }) => (
            <div key={area}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{area}</p>
              <div className="mt-0.5 grid grid-cols-1">
                {caps.map((c) => {
                  const on = grants.has(c.key)
                  return (
                    <label key={c.key} className="flex min-h-[44px] items-center gap-2.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30 disabled:opacity-50"
                        checked={on}
                        disabled={busyKey === c.key}
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
            ? 'No capabilities granted.'
            : `${grants.size} ${grants.size === 1 ? 'capability' : 'capabilities'} granted.`}
        </p>
      )}

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

      {canSwitchOff && (
        <button
          type="button"
          onClick={handleStatus}
          disabled={statusBusy}
          className={`min-h-[44px] rounded-full border px-4 text-xs font-bold transition disabled:opacity-60 ${
            member.status === 'active'
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          }`}
        >
          {statusBusy ? '…' : member.status === 'active' ? 'Disable access' : 'Re-enable'}
        </button>
      )}
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
  // Update 28 (levels, certifications): known after the first load.
  const [levelsReady, setLevelsReady] = useState(false)
  const [certMap, setCertMap] = useState<Map<string, Cert[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setError(null)
    // list_team() (update 28) brings levels and who may manage whom. Before it
    // runs, fall back to list_org_members(), then to the memberships table (IDs only).
    const [teamRes, grantRes, profileRes, certRes] = await Promise.all([
      supabase.rpc('list_team', { p_org: orgId }),
      supabase.from('membership_permissions').select('membership_id, permission_key'),
      // Photos and titles live on the memberships row and are merged in.
      supabase.from('memberships').select('id, display_name, title, photo_url, show_on_about').eq('org_id', orgId),
      supabase.from('member_certifications').select('*').eq('org_id', orgId).order('certified_on', { ascending: false }),
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

  const toggleStatus = useCallback(async (member: Member) => {
    const nextStatus = member.status === 'active' ? 'disabled' : 'active'
    const { error } = await supabase.rpc('set_membership_status', {
      p_membership: member.id,
      p_status: nextStatus,
    })
    if (error) {
      setError(errMessage(error))
      return
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status: nextStatus } : m)),
    )
  }, [])

  const setLevel = useCallback(
    async (member: Member, level: StaffLevel): Promise<string | null> => {
      const { error } = await supabase.rpc('set_member_level', { p_membership: member.id, p_level: level })
      if (error) return errMessage(error)
      await load() // the role follows the level, and who may manage whom can change
      return null
    },
    [load],
  )

  const me = members.find((m) => m.user_id === user?.id) ?? null
  // The levels the signed-in person may give; null before update 28.
  const levelChoices = levelsReady ? levelsICanGive(me?.level) : null

  const nameOf = useCallback(
    (uid: string | null) => {
      if (!uid) return null
      const m = members.find((x) => x.user_id === uid)
      return m ? memberName(m) : null
    },
    [members],
  )

  // Everyone, grouped by level (founders first); within a level, in the order they joined.
  const groups = useMemo(
    () =>
      LEVELS.map((l) => ({ ...l, people: members.filter((m) => m.level === l.value) })).filter((g) => g.people.length > 0),
    [members],
  )

  // Certifications that have run out or run out within 30 days, for people still on the team.
  const expiring = useMemo(() => {
    if (!certMap) return []
    const out: { who: string; what: string; text: string; expired: boolean }[] = []
    for (const m of members) {
      if (m.status !== 'active') continue
      for (const c of certMap.get(m.id) ?? []) {
        const e = certExpiry(c.expires_on)
        if (e.state === 'expired' || e.state === 'soon') {
          out.push({ who: memberName(m), what: certLabel(c.kind), text: e.text, expired: e.state === 'expired' })
        }
      }
    }
    return out.sort((a, b) => Number(b.expired) - Number(a.expired))
  }, [certMap, members])

  if (!canInvite && !canManage) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Team</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don't have access to manage the team. Ask {levelsReady ? 'a founder or the board' : 'an owner or admin'} if you
            need it.
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
            ? 'Everyone on the team, by level. You can change people below your own level. Changes take effect immediately and are logged.'
            : 'Invite staff and control what each person can do. Changes take effect immediately and are logged.'}
        </p>
      </div>

      {canInvite && !loading && <InvitePanel orgId={orgId} levelChoices={levelChoices} onInvited={load} />}

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
        groups.map((g) => (
          <section key={g.value} className="space-y-2">
            <div className="px-1">
              <p className="font-display text-base font-extrabold text-ink">
                {levelsReady ? g.plural : g.value === 'founder' ? 'Owners' : g.value === 'board' ? 'Admins' : 'Staff'}{' '}
                <span className="font-bold text-slate-400">({g.people.length})</span>
              </p>
              {levelsReady && <p className="text-xs text-slate-500">{g.blurb}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3">
              {g.people.map((m) => {
                const isSelf = m.user_id === user?.id
                // After update 28 the database says who may manage whom; before it, the old rule.
                const manage = levelsReady ? Boolean(m.manageable) : canManage
                return (
                  <MemberCard
                    key={m.id}
                    orgId={orgId}
                    member={m}
                    isSelf={isSelf}
                    userId={user?.id ?? null}
                    grants={grantMap.get(m.id) ?? new Set()}
                    manage={manage}
                    levelChoices={levelChoices}
                    certs={certMap ? (certMap.get(m.id) ?? []) : null}
                    nameOf={nameOf}
                    onProfileSaved={load}
                    onToggleCap={toggleCap}
                    onToggleStatus={toggleStatus}
                    onSetLevel={setLevel}
                    onCertsChanged={load}
                  />
                )
              })}
            </div>
          </section>
        ))
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
