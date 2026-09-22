import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'
import { authOrigin } from '../lib/appUrl'

type Mode = 'signin' | 'signup' | 'forgot'

export default function StaffSignIn() {
  const { configured, loading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const notice = (location.state as { notice?: string } | null)?.notice
  const dest = from && from.startsWith('/staff') ? from : '/staff'
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Already signed in → let the dashboard route to the right place.
  useEffect(() => {
    if (configured && !loading && user) navigate(dest, { replace: true })
  }, [configured, loading, user, navigate, dest])

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      if (mode === 'forgot') {
        // Always point the email at the real app — someone who opened the old
        // netlify.app mirror would otherwise be sent back to it.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${authOrigin()}/staff/reset`,
        })
        if (error) throw error
        setResetSent(true)
        return
      }
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // With "Confirm email" on, there's no session yet — tell them to confirm.
        if (!data.session) {
          setCheckEmail(true)
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      navigate(dest, { replace: true })
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setStatus('idle')
    }
  }

  // Signup: "confirm your email" interstitial.
  if (checkEmail) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-brand-blue" aria-hidden>
          <Icon name="mail" size={40} className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Confirm your email</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and sign
          in.
        </p>
        <button
          type="button"
          onClick={() => {
            setCheckEmail(false)
            setMode('signin')
          }}
          className={`${btn.blue} mx-auto`}
        >
          Back to sign in
        </button>
      </Screen>
    )
  }

  // Forgot password: "check your email for the reset link" interstitial.
  if (resetSent) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-brand-blue" aria-hidden>
          <Icon name="mail" size={40} className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Check your email</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
        </p>
        <ul className="mx-auto max-w-sm space-y-1.5 text-left text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="text-brand-orange">•</span> Open it on <strong>this device</strong> if
            you can — that's where the new password gets set.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-orange">•</span> It works <strong>once</strong>, and expires
            after about an hour.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-orange">•</span> Nothing after a few minutes? Check spam —
            it comes from Supabase on OHRR's behalf.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => {
            setResetSent(false)
            setMode('signin')
          }}
          className={`${btn.blue} mx-auto`}
        >
          Back to sign in
        </button>
      </Screen>
    )
  }

  const heading =
    mode === 'signin' ? 'Staff sign-in' : mode === 'signup' ? 'Create your account' : 'Reset password'
  const sub =
    mode === 'forgot'
      ? 'Enter your email and we’ll send a link to set a new password.'
      : `For OHRR staff and volunteers. ${mode === 'signin' ? 'Sign in' : 'Create your account'} to manage the app.`
  const submitLabel =
    status === 'submitting'
      ? 'Working…'
      : mode === 'signin'
        ? 'Sign in'
        : mode === 'signup'
          ? 'Create account'
          : 'Send reset link'

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-black text-ink">{heading}</h1>
        {notice && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</p>}
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{sub}</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input
              className={staffInput}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'forgot' && (
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                className={staffInput}
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setError(null)
              }}
              className="text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
            >
              Forgot password?
            </button>
          )}

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {submitLabel}
          </button>
        </form>
      </Card>

      {mode === 'forgot' ? (
        <p className="text-center text-sm text-slate-500">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setError(null)
            }}
            className="font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            ← Back to sign in
          </button>
        </p>
      ) : (
        <p className="text-center text-sm text-slate-500">
          {mode === 'signin' ? 'New to the staff app?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
            }}
            className="font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      )}

      <p className="text-center">
        <Link to="/" className="text-xs font-semibold text-slate-400 hover:text-slate-600">
          ← Back to the OHRR app
        </Link>
      </p>
    </Screen>
  )
}
