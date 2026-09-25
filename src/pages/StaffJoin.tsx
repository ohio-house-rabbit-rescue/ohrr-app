import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'

export default function StaffJoin() {
  const { configured, loading, user, membership, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // A QR code or an emailed link carries ?code=… — nothing to type.
  const [code, setCode] = useState(params.get('code') ?? '')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  // Not signed in yet: sign in (or create an account) and come straight back,
  // with a QR code's ?code=… still filled in.
  if (!user) return <Navigate to="/staff/signin" replace state={{ from: location.pathname + location.search }} />
  if (membership) return <Navigate to="/staff" replace />

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      const { error } = await supabase.rpc('redeem_invite_code', { p_code: code.trim() })
      if (error) throw error
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
        <h1 className="mt-3 font-display text-2xl font-black text-ink">Enter your invite code</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Signed in as <strong>{user.email}</strong>. You’re not on the OHRR team yet — one more step.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Ask a founder or board member for an invite code (they make one in{' '}
          <strong>Staff → Team → Invite someone</strong>), and enter it here. It joins you to the team with the
          access they set up for you.
        </p>
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

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={status === 'submitting' || code.trim().length === 0}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Joining…' : 'Join the team'}
          </button>
        </form>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
        <p className="font-bold text-slate-700">Are you an OHRR owner?</p>
        <p className="mt-1">
          Owners use the one-time master code instead.{' '}
          <a href="/staff/start" className="font-bold text-brand-blue hover:text-brand-blue-dark">
            Enter a master code
          </a>
        </p>
      </div>
    </Screen>
  )
}
