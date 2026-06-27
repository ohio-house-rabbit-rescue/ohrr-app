import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'

export default function StaffResetPassword() {
  const { configured, loading, user } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!configured) return <NotConfigured />
  // The recovery link establishes a temporary session as the client parses the URL;
  // wait for auth to settle before deciding whether the link is valid.
  if (loading) return <Spinner label="Checking your link…" />

  // No session means the link is missing, already used, or expired.
  if (!user) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-slate-300" aria-hidden>
          <Icon name="help" size={40} className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Reset link expired</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          This password-reset link is invalid or has already been used. Request a new one from the
          sign-in screen.
        </p>
        <Link to="/staff/signin" className={`${btn.blue} mx-auto`}>
          Back to sign in
        </Link>
      </Screen>
    )
  }

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setStatus('submitting')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus('done')
      setTimeout(() => navigate('/staff', { replace: true }), 1200)
    } catch (err) {
      setError(errMessage(err))
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-emerald-500" aria-hidden>
          <Icon name="star" size={40} className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Password updated</h1>
        <p className="text-sm leading-relaxed text-slate-600">Taking you to your dashboard…</p>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Set a new password</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Choose a new password for <strong>{user.email}</strong>.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            New password
            <input
              className={staffInput}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Confirm new password
            <input
              className={staffInput}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </Card>
    </Screen>
  )
}
