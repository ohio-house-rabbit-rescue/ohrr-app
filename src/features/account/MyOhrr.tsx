// /account — "My OHRR", one account for everyone (update 31).
//
// Signed out: Sign in / Create account (SignInForm). `?next=/staff…` sends
// them on once signed in — /staff/signin redirects here with it — and
// `?create=1` opens on Create account.
//
// Signed in, phone first, in this order: their name; what's saved on the
// account; the emails they want; phone reminders (in the app); sign-in email
// and password; staff (an invite code, or their level and the way in);
// delete the account; sign out.
//
// Until update 31 is run each part degrades on its own: the name can't be
// saved, saving to the account says it hasn't started, and the email choices
// point to the mailing-list form. Nothing is ever looked up by the account's
// email address — sign-up emails aren't confirmed.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../../lib/auth'
import { supabase, errMessage } from '../../lib/supabase'
import { btn, Badge, Card, PageHeader, Screen, SectionLabel } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, NotConfigured, Spinner, staffInput } from '../../components/staffui'
import { DeleteAccount } from '../../components/DeleteAccount'
import { useFollowing } from '../../lib/follow'
import { useSavedSessions } from '../../lib/savedSessions'
import { activeBunnies, useMyBunny } from '../mybunny/storage'
import { isFullAccess, levelInfo, useMyLevel } from '../../lib/staffLevels'
import SignInForm from './SignInForm'
import ForYou from './ForYou'
import InterestPicker from './InterestPicker'
import { EmailForm, PasswordForm } from './AccountForms'
import { PhoneRemindersSection } from './PhoneReminders'
import { firstName, saveMyName, useMyName } from './profile'
import { useSyncStatus } from './sync'
import { getDeviceInterests, loadMyEmailPrefs, saveMyEmailPrefs, type Interest } from './emailList'

/** Only a path inside this app (never another site, never back here). */
function safeNext(v: string | null): string | null {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/account')) return null
  return v
}

export default function MyOhrr() {
  const { configured, loading, user } = useAuth()
  const [params] = useSearchParams()
  const location = useLocation()
  const next = safeNext(params.get('next'))
  const notice = (location.state as { notice?: string } | null)?.notice

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  // Signed in with somewhere to go (the staff area, a scanned tag): go there.
  if (user && next) return <Navigate to={next} replace />
  if (!user) {
    const forStaff = Boolean(next?.startsWith('/staff'))
    return (
      <>
        {/* The top bar's count lands here: show what it counts (not on the staff sign-in). */}
        {!forStaff && <ForYou className="mx-5 mt-5" />}
        <SignInForm startWith={params.get('create') ? 'signup' : 'signin'} forStaff={forStaff} notice={notice} />
        <p className="-mt-2 px-5 pb-4 text-center text-xs text-slate-500">
          <Link to="/privacy" className="font-semibold text-brand-blue">
            What an account keeps
          </Link>{' '}
          · You can use the app without one.
        </p>
      </>
    )
  }
  return <SignedIn user={user} />
}

function SignedIn({ user }: { user: User }) {
  const { signOut } = useAuth()
  const name = useMyName(user.id)
  const first = firstName(name)
  const [signingOut, setSigningOut] = useState(false)

  return (
    <>
      <PageHeader icon="user" title="My OHRR" subtitle={first ? `Hi, ${first}. Everything you’ve saved, and what OHRR emails you about.` : 'Everything you’ve saved, and what OHRR emails you about.'} />
      <Screen className="space-y-6">
        <ForYou />

        <section className="space-y-2">
          <SectionLabel>Your name</SectionLabel>
          {/* Keyed so the box fills in once the saved name arrives. */}
          <NameForm key={name} userId={user.id} initial={name} />
        </section>

        <SavedOnAccount />

        <EmailChoices userId={user.id} name={name} />

        <PhoneRemindersSection />

        <section className="space-y-2">
          <SectionLabel>Sign-in email</SectionLabel>
          <EmailForm email={user.email ?? ''} pending={user.new_email ?? null} />
        </section>

        <section className="space-y-2">
          <SectionLabel>Password</SectionLabel>
          <PasswordForm />
        </section>

        <StaffBox />

        <DeleteAccount label="Delete my account" />

        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true)
            void signOut().finally(() => setSigningOut(false))
          }}
          className="min-h-[48px] w-full rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Signing out leaves what’s on this phone as it is.{' '}
          <Link to="/privacy" className="font-semibold text-brand-blue">
            What your account keeps
          </Link>
        </p>
      </Screen>
    </>
  )
}

/* ------------------------------------------------------------- name */

function NameForm({ userId, initial }: { userId: string; initial: string }) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveMyName(userId, value)
      setSaved(true)
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
          Name
          <input
            className={staffInput}
            autoComplete="name"
            maxLength={120}
            value={value}
            onChange={(e) => {
              setSaved(false)
              setValue(e.target.value)
            }}
            placeholder="e.g. Jamie Rivera"
          />
        </label>
        <button type="submit" disabled={busy || value.trim() === initial.trim()} className={`${btn.blue} disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <div className="w-full">
          <FormError>{error}</FormError>
          {saved && !busy && <p className="text-sm font-bold text-green-700">Saved.</p>}
        </div>
      </form>
    </Card>
  )
}

/* ------------------------------------------------------ saved things */

function SavedOnAccount() {
  const follows = useFollowing().size
  const sessions = useSavedSessions().size
  const bunnies = activeBunnies(useMyBunny()).length
  const { state, problem } = useSyncStatus()
  const rows: { label: string; n: number; to: string }[] = [
    { label: 'Favourite rabbits', n: follows, to: '/tails' },
    { label: 'Saved BunFest sessions', n: sessions, to: '/bunfest/schedule' },
    { label: 'My Bunny rabbits', n: bunnies, to: '/my-bunny' },
  ]
  return (
    <section className="space-y-2">
      <SectionLabel>Saved on your account</SectionLabel>
      <Card className="space-y-1">
        {rows.map((r) => (
          <Link key={r.label} to={r.to} className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
            <span className="text-slate-700">{r.label}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-display text-lg font-extrabold text-brand-blue">{r.n}</span>
              <Icon name="chevron" size={16} className="text-slate-300" />
            </span>
          </Link>
        ))}
        <p className="border-t border-slate-100 pt-2 text-sm text-slate-600">
          {state === 'unavailable'
            ? 'For now these are kept on this phone. Saving them to your account starts with OHRR’s next update.'
            : 'Sign in on any phone and they’re there.'}
        </p>
        {state === 'offline' && (
          <p className="text-xs text-slate-500">Not connected right now — changes reach your account when you’re back online.</p>
        )}
        {problem && <p className="text-xs font-semibold text-red-600">{problem}</p>}
      </Card>
    </section>
  )
}

/* ------------------------------------------------------------ emails */

function EmailChoices({ userId, name }: { userId: string; name: string }) {
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading')
  const [interests, setInterests] = useState<Interest[]>([])
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void loadMyEmailPrefs(userId).then((r) => {
      if (!alive) return
      if (r === 'missing' || r === 'error') {
        setState(r)
        return
      }
      // Not on the list yet: start from what was ticked on this phone.
      setInterests(r.onList ? r.interests : getDeviceInterests())
      setSubscribed(r.subscribed)
      setState('ready')
    })
    return () => {
      alive = false
    }
  }, [userId])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (subscribed && interests.length === 0) {
      setError('Tick at least one, or turn emails off.')
      return
    }
    setBusy(true)
    try {
      await saveMyEmailPrefs(interests, subscribed, name || null)
      setSaved(true)
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      <SectionLabel>Emails from OHRR</SectionLabel>
      {state === 'loading' ? (
        <Card>
          <Spinner />
        </Card>
      ) : state === 'missing' ? (
        <Card className="space-y-2">
          <p className="text-sm text-slate-600">Choosing your emails here opens with OHRR’s next update.</p>
          <Link to="/mailing-list" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue">
            Join the mailing list <Icon name="chevron" size={14} />
          </Link>
        </Card>
      ) : state === 'error' ? (
        <Card>
          <p className="text-sm text-slate-600">Your email choices couldn’t be loaded. Check your connection and open this page again.</p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={save} className="space-y-3">
            <button
              type="button"
              role="switch"
              aria-checked={subscribed}
              onClick={() => {
                setSaved(false)
                setSubscribed((v) => !v)
              }}
              className="flex min-h-[48px] w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block font-display text-[15px] font-extrabold text-ink">Get emails</span>
                <span className="block text-sm text-slate-500">
                  {subscribed ? 'To your sign-in email, about what you tick' : 'Off — OHRR won’t email you'}
                </span>
              </span>
              <span
                aria-hidden
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${subscribed ? 'bg-brand-blue' : 'bg-slate-300'}`}
              >
                <span className={`absolute h-6 w-6 rounded-full bg-white shadow transition ${subscribed ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>
            <div className={subscribed ? '' : 'opacity-60'}>
              <InterestPicker
                value={interests}
                onChange={(v) => {
                  setSaved(false)
                  setInterests(v)
                }}
                legend="What about"
              />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">What you tick also decides what “New for you” shows on Home.</p>
            <FormError>{error}</FormError>
            {saved && !busy && <p className="text-sm font-bold text-green-700">Saved.</p>}
            <button type="submit" disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
              {busy ? 'Saving…' : 'Save my email choices'}
            </button>
          </form>
        </Card>
      )}
    </section>
  )
}

/* ------------------------------------------------------------- staff */

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', staff: 'Staff' }

/**
 * Staff are ordinary accounts with a membership: an invite code adds one and
 * the staff area appears — same login, more features.
 */
function StaffBox() {
  const { user, membership, accessOnHold, accessEndedOn, refresh } = useAuth()
  const myLevel = useMyLevel(user?.id, membership?.orgId)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  if (membership) {
    const label = myLevel.level ? levelInfo(myLevel.level).label : (ROLE_LABEL[membership.role] ?? 'Staff')
    const full = membership.role === 'owner' || membership.role === 'admin' || (myLevel.level ? isFullAccess(myLevel.level) : false)
    return (
      <section className="space-y-2">
        <SectionLabel>OHRR staff</SectionLabel>
        <Card className="space-y-3">
          {joined && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Welcome to the team.</p>}
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            You’re on the team <Badge tone={full ? 'blue' : 'slate'}>{label}</Badge>
          </p>
          <Link to="/staff" className={`${btn.blue} w-full`}>
            Go to the staff area
          </Link>
          <Link to="/staff/account" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue">
            How you appear to the team, and your access <Icon name="chevron" size={14} />
          </Link>
        </Card>
      </section>
    )
  }

  if (accessOnHold || accessEndedOn) {
    return (
      <section className="space-y-2">
        <SectionLabel>OHRR staff</SectionLabel>
        <Card className="space-y-2">
          <p className="text-sm text-slate-600">Your staff access is on hold. Everything else here works as usual.</p>
          <Link to="/staff/join" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue">
            Why, and who can turn it back on <Icon name="chevron" size={14} />
          </Link>
        </Card>
      </section>
    )
  }

  const redeem = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error } = await supabase.rpc('redeem_invite_code', { p_code: code.trim() })
      if (error) throw error
      await refresh()
      setJoined(true)
      setCode('')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      <SectionLabel>Staff?</SectionLabel>
      <details className="group rounded-2xl border border-slate-200/80 bg-white">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
          Have a staff invite code?
          <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-open:rotate-90" />
        </summary>
        <form onSubmit={redeem} className="space-y-3 border-t border-slate-100 px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-600">
            OHRR staff and volunteers get a code from whoever brings them on. Enter it and the staff area appears here —
            same account, same password.
          </p>
          <label className="block text-sm font-semibold text-slate-700">
            Invite code
            <input
              className={`${staffInput} font-mono tracking-wider`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 9F3A2B7C1D"
            />
          </label>
          <FormError>{error}</FormError>
          <button type="submit" disabled={busy || code.trim().length === 0} className={`${btn.primary} w-full disabled:opacity-60`}>
            {busy ? 'Joining…' : 'Join the team'}
          </button>
        </form>
      </details>
    </section>
  )
}
