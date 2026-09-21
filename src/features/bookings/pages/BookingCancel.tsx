// /book/cancel/:token — the private link from a booking confirmation.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { errMessage } from '../../../lib/supabase'
import { bookingByToken, cancelBooking } from '../api'
import { fmtDay, fmtRange, statusLabel, type BookingReceipt } from '../types'

export default function BookingCancel() {
  const { token = '' } = useParams()
  const [b, setB] = useState<BookingReceipt | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    bookingByToken(token)
      .then((r) => alive && setB(r))
      .catch((e) => alive && (setError(errMessage(e)), setB(null)))
    return () => {
      alive = false
    }
  }, [token])

  const cancel = async () => {
    if (!window.confirm('Cancel this booking?')) return
    setBusy(true)
    try {
      setB(await cancelBooking(token))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader icon="calendar" title="Your booking" />
      <Screen className="space-y-4">
        {b === undefined && <Spinner />}
        {b === null && (
          <Card className="text-sm text-slate-600">
            <p className="font-bold text-ink">We couldn’t find that booking.</p>
            <p className="mt-1">The link may have been typed wrong. {error}</p>
          </Card>
        )}
        {b && (
          <Card className="space-y-3">
            <p className="font-display text-xl font-black text-ink">{b.type_name}</p>
            <p className="text-base text-slate-700">
              {fmtDay(b.starts_at)}
              <br />
              {fmtRange(b.starts_at, b.ends_at)}
            </p>
            {b.location && <p className="text-sm text-slate-500">{b.location}</p>}
            <p className={`text-sm font-bold ${b.status === 'cancelled' ? 'text-red-600' : 'text-brand-blue'}`}>{statusLabel(b.status)}</p>
            {(b.status === 'confirmed' || b.status === 'requested') && (
              <button type="button" onClick={() => void cancel()} disabled={busy} className={`${btn.outline} w-full border-red-300 text-red-700 hover:bg-red-50`}>
                {busy ? 'Cancelling…' : 'Cancel this booking'}
              </button>
            )}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          </Card>
        )}
        <Link to="/" className={`${btn.outline} w-full`}>
          Back to the app
        </Link>
      </Screen>
    </>
  )
}
