// Staff → My account: your own name, title and photo as the team sees them,
// and what your level lets you do. Open to everyone on the team.
//
// Before this, your own profile could only be edited inside Staff → Team,
// which is hidden unless you can invite or manage people. Nothing here needs a
// database change: save_member_profile() always lets a member save their own
// profile. The sign-in email and password are the same for everyone with an
// account, so since update 31 they live in My OHRR (/account), linked below.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen, SectionLabel } from '../components/ui'
import { Spinner, FormError, staffInput } from '../components/staffui'
import StaffAvatar from '../components/StaffAvatar'
import StaffImageField from '../components/StaffImageField'
import { PERMISSION_CATALOG } from '../lib/capabilities'
import { Icon } from '../components/icons'
import { accessDate, isFullAccess, levelFromRole, levelInfo, useMyLevel } from '../lib/staffLevels'
import type { MembershipRole } from '../lib/database.types'

interface Profile {
  display_name: string | null
  title: string | null
  photo_url: string | null
  show_on_about: boolean
}

// Before update 28 there are no levels, only the role.
const ROLE_INFO: Record<MembershipRole, { label: string; blurb: string }> = {
  owner: { label: 'Owner', blurb: 'Everything' },
  admin: { label: 'Admin', blurb: 'Everything' },
  staff: { label: 'Staff', blurb: 'The permissions below' },
}

export default function StaffAccount() {
  const { user, membership, capabilities, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const myLevel = useMyLevel(user?.id, membership?.orgId)
  const membershipId = membership?.id ?? ''

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // RLS lets a member read their own membership row.
  const load = useCallback(async () => {
    if (!membershipId) return
    setLoadError(null)
    const { data, error } = await supabase
      .from('memberships')
      .select('display_name, title, photo_url, show_on_about')
      .eq('id', membershipId)
      .maybeSingle()
    if (error) setLoadError(errMessage(error))
    else
      setProfile({
        display_name: data?.display_name ?? null,
        title: data?.title ?? null,
        photo_url: data?.photo_url ?? null,
        show_on_about: Boolean(data?.show_on_about),
      })
    setLoading(false)
  }, [membershipId])
  useEffect(() => {
    void load()
  }, [load])

  // RequireMembership guards this route; this only satisfies the types.
  if (!user || !membership) return null

  const email = user.email ?? ''
  const name = profile?.display_name || email || 'You'
  const level = myLevel.level
  const levelLabel = level ? levelInfo(level).label : ROLE_INFO[membership.role].label
  const levelBlurb = level ? levelInfo(level).blurb : ROLE_INFO[membership.role].blurb
  const fullAccess = membership.role === 'owner' || membership.role === 'admin' || (level ? isFullAccess(level) : false)
  // Founders and developers look after each other; everyone else is managed from above.
  const isFounder = isFullAccess(level ?? levelFromRole(membership.role))
  const granted = PERMISSION_CATALOG.filter((p) => capabilities.has(p.key))

  const onSignOut = async () => {
    await signOut()
    navigate('/staff/signin', { replace: true })
  }

  return (
    <Screen className="space-y-5">
      <div className="flex items-center gap-3 pt-1">
        <StaffAvatar name={name} photoUrl={profile?.photo_url} size={56} />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black text-ink">My account</h1>
          <p className="break-all text-sm text-slate-600">
            {profile?.display_name ? (
              <>
                <strong>{profile.display_name}</strong> · {email}
              </>
            ) : (
              email
            )}
          </p>
        </div>
      </div>

      {/* How you appear */}
      <section className="space-y-2">
        <SectionLabel>How you appear</SectionLabel>
        {loading ? (
          <Card>
            <Spinner />
          </Card>
        ) : loadError || !profile ? (
          <Card className="space-y-3">
            <FormError>Your details couldn’t be loaded. {loadError}</FormError>
            <button type="button" onClick={() => void load()} className={btn.outline}>
              Try again
            </button>
          </Card>
        ) : (
          <ProfileForm
            membershipId={membership.id}
            userId={user.id}
            profile={profile}
            onSaved={async () => {
              await Promise.all([load(), refresh()])
            }}
          />
        )}
      </section>

      {/* Sign-in email and password: the same for every account, so in My OHRR */}
      <section className="space-y-2">
        <SectionLabel>Sign-in email and password</SectionLabel>
        <Link
          to="/account"
          className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm shadow-sm transition hover:bg-slate-50"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-ink">Change them in My OHRR</span>
            <span className="block break-all text-slate-500">You sign in with {email}</span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
        </Link>
      </section>

      {/* Level and access — read-only; someone above you changes it */}
      <section className="space-y-2">
        <SectionLabel>Your level and access</SectionLabel>
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={fullAccess ? 'blue' : 'slate'}>{levelLabel}</Badge>
            <span className="text-sm text-slate-600">{levelBlurb}</span>
          </div>
          {/* Access for a set time (update 30), e.g. BunFest weekend. */}
          {membership.accessUntil && (
            <p className="flex items-start gap-2 rounded-xl bg-brand-orange-50 px-3 py-2 text-sm font-semibold text-ink">
              <Icon name="clock" size={16} className="mt-0.5 shrink-0 text-brand-orange-dark" />
              Your access ends on {accessDate(membership.accessUntil)}.
            </p>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-700">What you can do</p>
            {fullAccess ? (
              <p className="mt-1 text-sm text-slate-600">Everything.</p>
            ) : granted.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">Nothing has been turned on for you yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {granted.map((p) => (
                  <li key={p.key} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="text-slate-700">
                      <span className="font-semibold">{p.area}</span> — {p.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            {isFounder
              ? 'Only another founder or developer can change your level or access (Staff → Team).'
              : 'Only someone above your level can change your level or access (Staff → Team).'}
          </p>
        </Card>
      </section>

      <button
        type="button"
        onClick={() => void onSignOut()}
        className="min-h-[48px] w-full rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
      >
        Sign out
      </button>
    </Screen>
  )
}

/** Name, title, photo and the About-page switch, saved with save_member_profile(). */
function ProfileForm({
  membershipId,
  userId,
  profile,
  onSaved,
}: {
  membershipId: string
  userId: string
  profile: Profile
  onSaved: () => Promise<void>
}) {
  const [d, setD] = useState({
    display_name: profile.display_name ?? '',
    title: profile.title ?? '',
    photo_url: profile.photo_url ?? '',
    show_on_about: profile.show_on_about,
  })
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const edit = (next: Partial<typeof d>) => {
    setSaved(false)
    setD({ ...d, ...next })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.rpc('save_member_profile', {
        p_membership: membershipId,
        p_display_name: d.display_name.trim() || null,
        p_title: d.title.trim(),
        p_photo_url: d.photo_url.trim(),
        p_show_on_about: d.show_on_about,
      })
      if (error) throw error
      // Show what was stored: a blank name keeps the one already saved.
      setD((cur) => ({
        ...cur,
        display_name: cur.display_name.trim() || profile.display_name || '',
        title: cur.title.trim(),
        photo_url: cur.photo_url.trim(),
      }))
      setSaved(true)
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Name
          <input
            className={staffInput}
            autoComplete="name"
            value={d.display_name}
            onChange={(e) => edit({ display_name: e.target.value })}
            placeholder="e.g. Bev"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Title
          <input
            className={staffInput}
            value={d.title}
            onChange={(e) => edit({ title: e.target.value })}
            placeholder="e.g. Adoption coordinator"
          />
        </label>
        <StaffImageField
          label="Photo"
          hint="Without one, the team list shows a bunny instead."
          value={d.photo_url}
          userId={userId}
          onChange={(url) => edit({ photo_url: url })}
          onBusyChange={setImageBusy}
        />
        <label className="flex min-h-[44px] items-center gap-2.5 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue"
            checked={d.show_on_about}
            onChange={(e) => edit({ show_on_about: e.target.checked })}
          />
          Show me on the About page
        </label>
        <FormError>{error}</FormError>
        {saved && !busy && <p className="text-sm font-bold text-green-700">Saved.</p>}
        <button type="submit" disabled={busy || imageBusy} className={`${btn.primary} w-full disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Card>
  )
}
