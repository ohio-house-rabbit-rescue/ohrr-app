import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'
import { accessDate } from '../lib/staffLevels'
import { clearPendingInvite, getPendingInvite, savePendingInvite } from '../lib/pendingInvite'
import { putKeyboardAway } from '../lib/bringIntoView'
import { StatusNote } from '../features/scan/ScanUI'

export default function StaffJoin() {
  const { configured, loading, user, membership, accessEndedOn, accessOnHold, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // A QR code or an emailed link carries ?code=… — nothing to type.
  // The link's code, or the one kept on this phone when the link was opened before signing in.
  const linkCode = params.get('code')
  const [code, setCode] = useState(linkCode ?? getPendingInvite() ?? '')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  // "Check again" ran and they're still on hold: say so, so the tap doesn't seem to do nothing.
  const [checkedOnce, setCheckedOnce] = useState(false)
  useEffect(() => {
    if (linkCode) savePendingInvite(linkCode)
  }, [linkCode])

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  // Not signed in yet: sign in (or create an account) and come straight back,
  // with a QR code's ?code=… still filled in.
  // An invite link opens on Create account (a new person has no sign-in yet), says why, and comes
  // straight back here with the code. Someone who already has an account taps Sign in instead.
  if (!user) {
    if (linkCode || getPendingInvite()) {
      const back = `/staff/join?code=${encodeURIComponent(linkCode ?? getPendingInvite() ?? '')}`
      return (
        <Navigate
          to={`/account?next=${encodeURIComponent(back)}&create=1`}
          replace
          state={{ notice: 'You’re invited to join the OHRR team. Create your sign-in below — or tap Sign in if you already have an OHRR account. Your invite code is saved; you’ll be taken straight to it.' }}
        />
      )
    }
    return <Navigate to="/staff/signin" replace state={{ from: location.pathname + location.search }} />
  }
  if (membership) return <Navigate to="/staff" replace />

  // On hold: someone put them on hold, or their end date has passed (update 30).
  // They're still on the team with their level and tasks, and an invite code
  // never switches anyone back on — so there's no code to ask for here.
  if (accessOnHold || accessEndedOn) {
    const checkAgain = async () => {
      setChecking(true)
      await refresh()
      setChecking(false)
      setCheckedOnce(true)
    }
    return (
      <Screen className="space-y-5">
        <div className="pt-2">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange">
            <Icon name="clock" size={22} />
          </span>
          <h1 className="mt-3 font-display text-2xl font-black text-ink">On hold</h1>
          <p className="mt-2 rounded-xl bg-brand-orange-50 px-3 py-2.5 text-sm font-semibold leading-relaxed text-ink" role="status">
            {accessEndedOn
              ? `Your access ended on ${accessDate(accessEndedOn)}. It’s on hold until someone turns it back on.`
              : 'Your access is on hold. Ask whoever looks after your access (a lead, admin, founder or developer) to turn it back on.'}
          </p>
          {accessEndedOn && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Whoever looks after your access (a lead, admin, founder or developer) can turn it back on.
            </p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Signed in as <strong>{user.email}</strong>. You keep your account, level and tasks, so no new invite code is
            needed.
          </p>
        </div>
        <button type="button" onClick={() => void checkAgain()} disabled={checking} className={`${btn.primary} w-full disabled:opacity-60`}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
        {checkedOnce && !checking && (
          <StatusNote className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">
            Checked just now: your access is still on hold. Ask whoever looks after your access to turn it back on, then tap Check again.
          </StatusNote>
        )}
      </Screen>
    )
  }

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    putKeyboardAway()
    setError(null)
    setStatus('submitting')
    try {
      const { error } = await supabase.rpc('redeem_invite_code', { p_code: code.trim() })
      if (error) throw error
      clearPendingInvite()
      await refresh()
      navigate('/staff', { replace: true })
    } catch (err) {
      setError(errMessage(err))
      setStatus('idle')
    }
  }

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange">
          <Icon name="ticket" size={22} />
        </span>
        <h1 className="mt-3 font-display text-2xl font-black text-ink">{code ? 'Join the OHRR team' : 'This area is for OHRR staff and volunteers'}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Signed in as <strong>{user.email}</strong>. You’re not on the OHRR team yet — one more step.
        </p>
        {code ? (
          <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold leading-relaxed text-green-800">
            Your invite code is filled in below. Tap <strong>Join the team</strong>.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            If you’re joining the OHRR team, enter the invite code the person bringing you on gave you. If you’re not, there’s
            nothing for you here: thank you for stopping by.{' '}
            <Link to="/" className="font-bold text-brand-blue">
              Back to the app
            </Link>
          </p>
        )}
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
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

          <button
            type="submit"
            disabled={status === 'submitting' || code.trim().length === 0}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Joining…' : 'Join the team'}
          </button>

          <FormError>{error}</FormError>
        </form>
      </Card>

      <details className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
        <summary className="cursor-pointer font-bold text-slate-700">Are you an OHRR owner?</summary>
        <p className="mt-1">
          Owners use the one-time master code instead.{' '}
          <a href="/staff/start" className="font-bold text-brand-blue hover:text-brand-blue-dark">
            Enter a master code
          </a>
        </p>
      </details>
    </Screen>
  )
}
