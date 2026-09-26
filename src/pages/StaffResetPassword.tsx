// /account/reset (and the older /staff/reset) — setting a new password from
// the emailed link. Since update 31 everyone has an account, so the link comes
// back to /account/reset, in the public app's look; staff go on to their
// dashboard afterwards, everyone else to My OHRR.
//
// Supabase sends that link in one of three shapes depending on how the project
// is configured, and only one of them signs you in by itself:
//
//   …/staff/reset#access_token=…&type=recovery     the client picks this up
//   …/staff/reset?code=…                           PKCE: exchange it for a session
//   …/staff/reset?token_hash=…&type=recovery       verify it for a session
//
// Before, anything but the first said "Reset link expired" — which was wrong,
// and a dead end. Now all three work, a genuinely expired link says so in
// plain words, and a new one can be requested right here instead of sending
// someone back to the sign-in screen to start again.
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'
import { authOrigin } from '../lib/appUrl'

type LinkState = 'checking' | 'ready' | 'bad'

export default function StaffResetPassword() {
  const { configured, loading, user, membership, refresh } = useAuth()
  const [params] = useSearchParams()
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const [linkError, setLinkError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Turn whatever the email link carried into a session.
  useEffect(() => {
    if (!configured || loading) return
    let alive = true

    const run = async () => {
      // Supabase reports an expired or already-used link in the query or the hash.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const errDescription = params.get('error_description') ?? hash.get('error_description')
      if (errDescription) {
        if (!alive) return
        setLinkError(errDescription.replace(/\+/g, ' '))
        setLinkState('bad')
        return
      }

      if (user) {
        if (alive) setLinkState('ready')
        return
      }

      const code = params.get('code')
      const tokenHash = params.get('token_hash') ?? params.get('token')
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
          if (error) throw error
        } else {
          // Nothing to work with: opened directly, or the link was truncated.
          if (alive) setLinkState('bad')
          return
        }
        await refresh()
        if (alive) setLinkState('ready')
      } catch (e) {
        if (!alive) return
        setLinkError(errMessage(e))
        setLinkState('bad')
      }
    }

    void run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loading, user])

  if (!configured) return <NotConfigured />
  if (loading || linkState === 'checking') return <Spinner label="Checking your link…" />

  if (linkState === 'bad') return <BadLink reason={linkError} />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setStatus('submitting')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await refresh()
      setStatus('done')
    } catch (err) {
      setError(errMessage(err))
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <Screen className="space-y-4 text-center">
        <span className="mx-auto mt-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Icon name="check" size={34} />
        </span>
        <h1 className="font-display text-xl font-extrabold text-ink">Password updated</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          You’re signed in. Taking you to {membership ? 'your dashboard' : 'My OHRR'}…
        </p>
        <GoOn to={membership ? '/staff' : '/account'} />
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Set a new password</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {user?.email ? (
            <>
              Choose a new password for <strong>{user.email}</strong>.
            </>
          ) : (
            'Choose a new password for your OHRR account.'
          )}
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            New password
            <input
              className={staffInput}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Type it again
            <input
              className={staffInput}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setShow((v) => !v)} className="text-sm font-bold text-brand-blue">
              {show ? 'Hide' : 'Show'} password
            </button>
            <span className="text-xs text-slate-500">At least 8 characters</span>
          </div>

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={status === 'submitting' || !password || !confirm}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        This link works once. If you don’t finish now, ask for another from the sign-in screen.
      </p>
    </Screen>
  )
}

/**
 * After a new password: on to the staff dashboard for staff, My OHRR for
 * everyone else (update 31 — anyone with an account can reset a password).
 */
function GoOn({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate(to, { replace: true }), 1400)
    return () => clearTimeout(t)
  }, [navigate, to])
  return null
}

/**
 * The link didn't work — say why, and let them start again from here. A dead
 * end with a "back to sign in" button made people give up.
 */
function BadLink({ reason }: { reason: string | null }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('sending')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${authOrigin()}/account/reset`,
      })
      if (error) throw error
      setStatus('sent')
    } catch (err) {
      setError(errMessage(err))
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <Screen className="space-y-4 text-center">
        <span className="mx-auto mt-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">
          <Icon name="mail" size={32} />
        </span>
        <h1 className="font-display text-xl font-extrabold text-ink">Check your email</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          A new link is on its way to <strong>{email}</strong>. It works once, and only for a short
          while — open it on this device if you can.
        </p>
        <Link to="/account" className={`${btn.outline} mx-auto`}>
          Back to sign in
        </Link>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-4 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-orange-50 text-brand-orange-dark">
          <Icon name="clock" size={32} />
        </span>
        <h1 className="mt-3 font-display text-xl font-extrabold text-ink">That link didn’t work</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Password links work once and expire after an hour. If you opened it on a different device
          from the one that asked, it won’t carry across either.
        </p>
        {reason && <p className="mt-2 text-xs text-slate-400">({reason})</p>}
      </div>

      <Card>
        <form onSubmit={send} className="space-y-3">
          <p className="font-display text-[15px] font-extrabold text-ink">Send me a new one</p>
          <label className="block text-sm font-semibold text-slate-700">
            Your OHRR email
            <input
              className={staffInput}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <FormError>{error}</FormError>
          <button type="submit" disabled={status === 'sending' || !email.trim()} className={`${btn.primary} w-full disabled:opacity-60`}>
            {status === 'sending' ? 'Sending…' : 'Email me a new link'}
          </button>
        </form>
      </Card>

      <Link to="/account" className={`${btn.outline} w-full`}>
        Back to sign in
      </Link>
    </Screen>
  )
}
