import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { NotConfigured, Spinner, FormError, staffInput } from '../components/staffui'

export default function StaffOnboard() {
  const { configured, loading, user, membership, refresh } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/staff/signin" replace />
  if (membership) return <Navigate to="/staff" replace />

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      const { error } = await supabase.rpc('redeem_master_code', { p_code: code.trim() })
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
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
          <Icon name="star" size={22} />
        </span>
        <h1 className="mt-3 font-display text-2xl font-black text-ink">Enter your master code</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Signed in as <strong>{user.email}</strong>. Redeeming the one-time master code makes you an{' '}
          <strong>Owner</strong> of Ohio House Rabbit Rescue — you can then add staff and manage the
          Hop Shop.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Master code
            <input
              className={`${staffInput} font-mono tracking-wider`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Provided by the OHRR owner"
            />
          </label>

          <FormError>{error}</FormError>

          <button
            type="submit"
            disabled={status === 'submitting' || code.trim().length === 0}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Redeeming…' : 'Become Owner'}
          </button>
        </form>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
        <p className="font-bold text-slate-700">Joining the team?</p>
        <p className="mt-1">
          Use the invite code a founder or board member gave you (they make one in Staff → Team → Invite
          someone).{' '}
          <a href="/staff/join" className="font-bold text-brand-blue hover:text-brand-blue-dark">
            Enter an invite code
          </a>
        </p>
      </div>
    </Screen>
  )
}
