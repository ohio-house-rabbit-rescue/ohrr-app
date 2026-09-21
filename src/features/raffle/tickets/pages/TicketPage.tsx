// /raffle/tickets/:token — one reservation's tickets: numbers, what to pay,
// status (Reserved / Paid / Winner) and the QR the raffle table scans.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../../../../components/ui'
import { TicketCard } from '../../../../components/RaffleTickets'
import { orderByToken, type RaffleOrder } from '../api'

export default function TicketPage() {
  const { token } = useParams()
  const [order, setOrder] = useState<RaffleOrder | null | undefined>(undefined)

  useEffect(() => {
    if (!token) return
    let alive = true
    const load = () => orderByToken(token).then((o) => alive && setOrder(o)).catch(() => alive && setOrder(null))
    void load()
    // The desk marks it paid / drawn while the person watches — refresh gently.
    const t = setInterval(load, 15000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [token])

  return (
    <>
      <PageHeader icon="ticket" title="My raffle tickets" subtitle="Midwest BunFest raffle — show this at the raffle table." />
      <Screen className="space-y-4">
        {order === undefined && <p className="text-sm text-slate-500">Finding your tickets…</p>}
        {order === null && (
          <Card>
            <p className="font-bold text-ink">We couldn’t find those tickets.</p>
            <p className="mt-1 text-sm text-slate-600">The link may be incomplete. Ask at the raffle table with your name and phone number.</p>
            <Link to="/bunfest/p/raffle" className={`${btn.blue} mt-3`}>
              Raffle page
            </Link>
          </Card>
        )}
        {order && <TicketCard order={order} link={false} />}
        <Link to="/bunfest/p/raffle" className="block text-center text-sm font-bold text-brand-blue">
          Back to the raffle
        </Link>
      </Screen>
    </>
  )
}
