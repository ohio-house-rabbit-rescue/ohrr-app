// Staff → My account: your own name, title and photo, your sign-in email and
// password, and what your level lets you do. Open to everyone on the team.
//
// Before this, your own profile could only be edited inside Staff → Team,
// which is hidden unless you can invite or manage people, and a password could
// only be changed through "Forgot password". Nothing here needs a database
// change: save_member_profile() always lets a member save their own profile,
// and the email and password go through Supabase's own updateUser().
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen, SectionLabel } from '../components/ui'
import { Spinner, FormError, PasswordInput, staffInput } from '../components/staffui'
import StaffAvatar from '../components/StaffAvatar'
import StaffImageField from '../components/StaffImageField'
import { PERMISSION_CATALOG } from '../lib/capabilities'
import { isFullAccess, levelFromRole, levelInfo, useMyLevel } from '../lib/staffLevels'
import { authOrigin } from '../lib/appUrl'
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
  // Founders can manage founders; everyone else is managed from above.
  const isFounder = (level ?? levelFromRole(membership.role)) === 'founder'
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

      {/* Sign-in email */}
      <section className="space-y-2">
        <SectionLabel>Sign-in email</SectionLabel>
        <EmailForm email={email} pending={user.new_email ?? null} />
      </section>

      {/* Password */}
      <section className="space-y-2">
        <SectionLabel>Password</SectionLabel>
        <PasswordForm />
      </section>

      {/* Level and access — read-only; someone above you changes it */}
      <section className="space-y-2">
        <SectionLabel>Your level and access</SectionLabel>
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={fullAccess ? 'blue' : 'slate'}>{levelLabel}</Badge>
            <span className="text-sm text-slate-600">{levelBlurb}</span>
          </div>
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
              ? 'Only another founder can change your level or access (Staff → Team).'
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

/**
 * Changing the sign-in email. Supabase emails a link to the new address and
 * only switches once it's opened, so until then the old one still signs in.
 */
function EmailForm({ email, pending }: { email: string; pending: string | null }) {
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ to: string; from: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const to = next.trim()
    if (!to) return
    if (to.toLowerCase() === email.toLowerCase()) {
      setError('That’s already your sign-in email.')
      return
    }
    setBusy(true)
    try {
      // The link comes back to the real app, as the password-reset link does.
      const { error } = await supabase.auth.updateUser({ email: to }, { emailRedirectTo: `${authOrigin()}/staff` })
      if (error) throw error
      setSent({ to, from: email })
      setNext('')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          You sign in with <strong className="break-all text-ink">{email}</strong>.
        </p>
        {sent ? (
          <div className="space-y-1 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-800">
            <p className="font-semibold">
              We sent a link to <span className="break-all">{sent.to}</span>. Your sign-in email changes when you open it.
              Until then, keep signing in with <span className="break-all">{sent.from}</span>.
            </p>
            <p className="text-xs">If a link comes to {sent.from} as well, open that one too.</p>
          </div>
        ) : (
          pending && (
            <p className="rounded-xl bg-brand-blue-50 px-3 py-2.5 text-sm text-slate-700">
              Waiting for you to open the link sent to <strong className="break-all">{pending}</strong>.
            </p>
          )
        )}
        <label className="block text-sm font-semibold text-slate-700">
          New email
          <input
            className={staffInput}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <FormError>{error}</FormError>
        <button type="submit" disabled={busy || !next.trim()} className={`${btn.blue} w-full disabled:opacity-60`}>
          {busy ? 'Sending…' : 'Change my email'}
        </button>
      </form>
    </Card>
  )
}

/** A new password while signed in — no email round trip. */
function PasswordForm() {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== again) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setPassword('')
      setAgain('')
    } catch (err) {
      const msg = errMessage(err)
      // "Secure password change" wants a recent sign-in.
      setError(
        /reauthenticat/i.test(msg)
          ? 'For safety this needs a fresh sign-in: sign out, sign back in, then change your password here.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          New password
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => {
              setDone(false)
              setPassword(e.target.value)
            }}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Type it again
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={again}
            onChange={(e) => {
              setDone(false)
              setAgain(e.target.value)
            }}
          />
        </label>
        <p className="text-xs text-slate-500">At least 8 characters.</p>
        <FormError>{error}</FormError>
        {done && <p className="text-sm font-bold text-green-700">Password changed.</p>}
        <button type="submit" disabled={busy || !password || !again} className={`${btn.blue} w-full disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Change my password'}
        </button>
      </form>
    </Card>
  )
}
