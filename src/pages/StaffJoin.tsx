import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, staffInput } from '../components/staffui'
import { accessDate } from '../lib/staffLevels'
import { clearPendingInvite, getPendingInvite, savePendingInvite } from '../lib/pendingInvite'
import { inviteProblem } from '../lib/inviteText'
import { putKeyboardAway } from '../lib/bringIntoView'
import { StatusNote } from '../features/scan/ScanUI'
import { JOINED_PATH } from '../features/guide/guideEnv'

export default function StaffJoin() {
  const { configured, loading, user, membership, accessEndedOn, accessOnHold, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // A QR code or an emailed link carries ?code=… — nothing to type.
  // The link's code, or the one kept on this phone when the link was opened before signing in.
  const linkCode = params.get('code')
  const [startCode] = useState(() => linkCode ?? getPendingInvite() ?? '')
  const [code, setCode] = useState(startCode)
  // They arrived with a code: join them straight away, no button to find. The form only shows if that fails.
  const [auto, setAuto] = useState(Boolean(startCode))
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  // Why the invitation didn't go through, in plain words.
  const [problem, setProblem] = useState<{ text: string; wrongEmail: boolean } | null>(null)
  const [checking, setChecking] = useState(false)
  // "Check again" ran and they're still on hold: say so, so the tap doesn't seem to do nothing.
  const [checkedOnce, setCheckedOnce] = useState(false)
  const tried = useRef(false)
  // The invite just went through: the next stop is "You're on the team", not Staff home.
  const justJoined = useRef(false)
  useEffect(() => {
    if (linkCode) savePendingInvite(linkCode)
  }, [linkCode])

  const email = user?.email ?? null
  const join = useCallback(
    async (c: string) => {
      setProblem(null)
      setStatus('submitting')
      try {
        const { error } = await supabase.rpc('redeem_invite_code', { p_code: c.trim() })
        if (error) throw error
        justJoined.current = true
        clearPendingInvite()
        await refresh()
        navigate(JOINED_PATH, { replace: true })
      } catch (err) {
        const p = inviteProblem(errMessage(err), email)
        // A code that is used up or unknown is finished: stop offering it on this phone.
        if (p.dead) clearPendingInvite()
        setProblem(p)
        setAuto(false)
        setStatus('idle')
      }
    },
    [email, navigate, refresh],
  )

  // Signed in, not on the team, not on hold: the only state an invite code is for.
  const canJoin = configured && !loading && Boolean(user) && !membership && !accessOnHold && !accessEndedOn
  useEffect(() => {
    if (!canJoin || tried.current || !startCode) return
    tried.current = true
    void join(startCode)
  }, [canJoin, startCode, join])

  // Already on the team: a saved invite has nothing left to do.
  useEffect(() => {
    if (membership && !justJoined.current) clearPendingInvite()
  }, [membership])

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  // Not signed in yet. An invite link opens on Create account (a new person has no sign-in yet) with a
  // welcome, and comes straight back here with the code. Someone who already has an account taps Sign in.
  if (!user) {
    const saved = linkCode ?? getPendingInvite()
    if (saved) {
      const back = `/staff/join?code=${encodeURIComponent(saved)}`
      return <Navigate to={`/account?next=${encodeURIComponent(back)}&create=1`} replace />
    }
    return <Navigate to="/staff/signin" replace state={{ from: location.pathname + location.search }} />
  }
  if (membership) return <Navigate to={justJoined.current ? JOINED_PATH : '/staff'} replace />

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

  // The invite is going through on its own: nothing to read, nothing to tap.
  if (auto) {
    return (
      <Screen className="space-y-3 pt-10 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange">
          <Icon name="ticket" size={24} />
        </span>
        <h1 className="font-display text-2xl font-black text-ink" role="status">
          Joining the OHRR team…
        </h1>
        <p className="text-base text-slate-600">One moment.</p>
      </Screen>
    )
  }

  const onSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    putKeyboardAway()
    void join(code)
  }

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange">
          <Icon name="ticket" size={22} />
        </span>
        <h1 className="mt-3 font-display text-2xl font-black text-ink">{problem ? 'Almost there' : 'This part is for the OHRR team'}</h1>
        {problem ? (
          <p className="mt-2 rounded-xl bg-brand-orange-50 px-3 py-2.5 text-base font-semibold leading-relaxed text-ink" role="alert">
            {problem.text}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Signed in as <strong className="break-all">{user.email}</strong>.
            </p>
            <p className="mt-2 text-base leading-relaxed text-slate-700">
              <strong>Have an invitation?</strong> Open your invite email and tap the link in it. That’s all it takes. Or type the
              code from it below.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Not on the team? The rest of the app is open to you.{' '}
              <Link to="/" className="font-bold text-brand-blue">
                Back to the app
              </Link>
            </p>
          </>
        )}
      </div>

      {problem?.wrongEmail && (
        <button type="button" onClick={() => void signOut()} className={`${btn.primary} w-full`}>
          Sign in with a different email
        </button>
      )}

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
            className={`${problem?.wrongEmail ? btn.blue : btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Joining…' : problem ? 'Try again' : 'Join the team'}
          </button>
        </form>
      </Card>

      {/* Owners setting the rescue up: never shown to someone who came by an invite. */}
      {!startCode && !problem && (
        <details className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
          <summary className="cursor-pointer font-bold text-slate-700">Are you an OHRR owner?</summary>
          <p className="mt-1">
            Owners use the one-time master code instead.{' '}
            <a href="/staff/start" className="font-bold text-brand-blue hover:text-brand-blue-dark">
              Enter a master code
            </a>
          </p>
        </details>
      )}
    </Screen>
  )
}
