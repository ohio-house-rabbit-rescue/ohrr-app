import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'

type Mode = 'signin' | 'signup'

export default function StaffSignIn() {
  const { configured, loading, user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  // Already signed in → let the dashboard route to the right place.
  useEffect(() => {
    if (configured && !loading && user) navigate('/staff', { replace: true })
  }, [configured, loading, user, navigate])

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
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
      navigate('/staff', { replace: true })
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setStatus('idle')
    }
  }

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

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Staff sign-in</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          For OHRR staff and volunteers. {mode === 'signin' ? 'Sign in' : 'Create your account'} to
          manage the app.
        </p>
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

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting'
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
      </Card>

      <p className="text-center text-sm text-slate-500">
        {mode === 'signin' ? "New to the staff app?" : 'Already have an account?'}{' '}
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

      <p className="text-center">
        <Link to="/" className="text-xs font-semibold text-slate-400 hover:text-slate-600">
          ← Back to the OHRR app
        </Link>
      </p>
    </Screen>
  )
}
