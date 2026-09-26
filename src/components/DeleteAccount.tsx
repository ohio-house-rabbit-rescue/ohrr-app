// "Delete my account" — anyone with an account can remove it (App Store rule
// 5.1.1(v): an app that offers sign-up must offer deletion). Shown in My OHRR
// for everyone and on the staff dashboard. delete_own_account() takes the
// sign-in, their name, what the account saved and their place on the email
// list (update 31), and any staff access; content they created for the rescue
// stays, unattributed. What's on this phone stays on this phone. The only
// active owner of the org is refused until someone else is an owner.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { forgetAccountSync } from '../features/account/sync'
import { Card, btn } from './ui'
import { staffInput } from './staffui'

export function DeleteAccount({ label = 'Your account' }: { label?: string }) {
  const { user, membership, signOut } = useAuth()
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
      // Nothing left to write to: drop anything waiting to sync.
      forgetAccountSync()
      await signOut()
      navigate('/account', { replace: true, state: { notice: 'Your account has been deleted.' } })
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <Card className="space-y-2">
        <p className="text-sm text-slate-600">
          Signed in as <span className="font-semibold text-ink">{user?.email}</span>.
        </p>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] text-sm font-bold text-red-600">
            Delete my account
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
            <p className="text-sm text-slate-700">
              This removes your account for good: your sign-in, your name, what your account saved and the email
              choices you made in it{membership ? ', and your staff access' : ''}. What’s on this phone stays on this
              phone.
              {membership ? ' Anything you added for the rescue (items, posts, bookings) stays.' : ''} Type{' '}
              <strong>DELETE</strong> to confirm.
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
