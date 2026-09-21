// "Delete my account" — every staff member can remove their own sign-in
// (App Store rule 5.1.1(v): an app that offers sign-up must offer deletion).
// Memberships go; content they created stays with the rescue, unattributed.
// The only active owner of the org is refused until someone else is an owner.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Card, btn } from './ui'
import { staffInput } from './staffui'

export function DeleteAccount() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const del = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      await signOut()
      navigate('/staff/signin', { replace: true, state: { notice: 'Your account has been deleted.' } })
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">Your account</p>
      <Card className="space-y-2">
        <p className="text-sm text-slate-600">
          Signed in as <span className="font-semibold text-ink">{user?.email}</span>.
        </p>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-red-600">
            Delete my account
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
            <p className="text-sm text-slate-700">
              This removes your sign-in and your staff access for good. Anything you added for the rescue (items, posts, bookings) stays. Type <strong>DELETE</strong> to confirm.
            </p>
            <input className={staffInput} value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" />
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" disabled={word !== 'DELETE' || busy} onClick={() => void del()} className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                {busy ? 'Deleting…' : 'Delete my account'}
              </button>
              <button type="button" onClick={() => { setOpen(false); setWord('') }} className={btn.outline}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
