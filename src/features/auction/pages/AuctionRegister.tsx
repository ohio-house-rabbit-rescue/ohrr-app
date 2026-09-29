// /bunfest/auction/register?next=… — become a bidder in two steps:
//   1. name, email, phone (optional), pickup or shipping (+ address)
//   2. Stripe's card form (the number goes to Stripe, never to OHRR)
// Then the device remembers the bidder and we go back to where they came from.
// Closed (or not yet set up) → a friendly note and a way back.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, Screen, Card, btn, QuietNote } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { staffInput } from '../../../components/staffui'
import { auctionApi, rememberBidder, type Address, type Fulfil } from '../client'
import CardSetup from '../CardSetup'
import { safeNext, useCatalog, useRememberedBidder } from '../useAuction'

const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')

export default function AuctionRegister() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const { catalog } = useCatalog(false)
  const me = useRememberedBidder()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fulfil, setFulfil] = useState<Fulfil>('pickup')
  const [addr, setAddr] = useState<Address>({ line1: '', line2: '', city: '', state: 'OH', zip: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step2, setStep2] = useState<{ token: string; clientSecret: string } | null>(null)

  const settings = catalog?.settings ?? null
  const open = Boolean(settings?.bidding_enabled && settings?.stripe_publishable_key)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await auctionApi.register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        fulfil,
        address: fulfil === 'ship' ? addr : null,
      })
      setStep2({ token: r.bidder.access_token, clientSecret: r.client_secret })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not register you. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link to={next} className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark">
      <Icon name="arrowLeft" size={16} /> Back to the auction
    </Link>
  )

  if (!catalog) {
    return (
      <>
        <PageHeader icon="gavel" title="Register to bid" subtitle="Midwest BunFest Silent Auction" />
        <Screen>
          <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
        </Screen>
      </>
    )
  }

  if (!open) {
    return (
      <>
        <PageHeader icon="gavel" title="Register to bid" subtitle="Midwest BunFest Silent Auction" />
        <Screen className="space-y-4">
          <Card className="space-y-2">
            <p className="font-display text-lg font-extrabold text-ink">Bidding hasn’t opened yet</p>
            <p className="text-sm leading-relaxed text-slate-600">
              Online bidding opens before BunFest. Until then you can browse the items, and on the day the
              auction table takes bids too.
            </p>
          </Card>
          {back}
        </Screen>
      </>
    )
  }

  if (me && !step2) {
    return (
      <>
        <PageHeader icon="gavel" title="Register to bid" subtitle="Midwest BunFest Silent Auction" />
        <Screen className="space-y-4">
          <Card className="space-y-2">
            <p className="font-display text-lg font-extrabold text-ink">You’re already registered</p>
            <p className="text-sm text-slate-600">This phone is signed up as Bidder #{me.bidder_no} ({me.name}).</p>
            <Link to={next} className={`${btn.primary} min-h-[48px] w-full`}>
              Back to the auction
            </Link>
            <Link to="/bunfest/auction/me" className="block text-center text-sm font-bold text-brand-blue">
              Your bids and wins
            </Link>
          </Card>
        </Screen>
      </>
    )
  }

  if (step2) {
    return (
      <>
        <PageHeader icon="gavel" title="Save a card" subtitle="Step 2 of 2" />
        <Screen className="space-y-4">
          <Card className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600">
              Your card is saved with Stripe now and charged only if you win an item or use Buy now. OHRR never
              sees the card number.
            </p>
            <CardSetup
              publishableKey={settings!.stripe_publishable_key!}
              clientSecret={step2.clientSecret}
              buttonClassName={`${btn.primary} min-h-[52px] w-full text-base disabled:opacity-60`}
              label="Save card and start bidding"
              onSaved={async (setupIntentId) => {
                const { bidder } = await auctionApi.cardSaved(step2.token, setupIntentId)
                rememberBidder(bidder)
                navigate(next, { replace: true })
              }}
            />
          </Card>
        </Screen>
      </>
    )
  }

  return (
    <>
      <PageHeader icon="gavel" title="Register to bid" subtitle="Step 1 of 2 · who you are" />
      <Screen className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <Card className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Your name
              <input className={staffInput} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                className={staffInput}
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">Receipts and “you were outbid” notes go here.</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Phone (optional)
              <input className={staffInput} type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">If you win, how do you want your item?</p>
            <div className="grid grid-cols-2 gap-2">
              {(['pickup', 'ship'] as const).map((f) => (
                <label
                  key={f}
                  className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold ${
                    fulfil === f ? 'border-brand-blue bg-brand-blue-50 text-brand-blue' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <input type="radio" name="fulfil" className="sr-only" value={f} checked={fulfil === f} onChange={() => setFulfil(f)} />
                  {f === 'pickup' ? 'Pick up at BunFest' : 'Ship it to me'}
                </label>
              ))}
            </div>
            {fulfil === 'pickup' && settings?.pickup_note && <QuietNote>{settings.pickup_note}</QuietNote>}
            {fulfil === 'ship' && (
              <div className="space-y-3">
                {settings?.shipping_note && <QuietNote>{settings.shipping_note}</QuietNote>}
                <p className="text-xs leading-relaxed text-slate-500">
                  Items marked “Ships” add their shipping fee to your total; pickup-only items are collected at BunFest.
                </p>
                <label className="block text-sm font-semibold text-slate-700">
                  Street address
                  <input className={staffInput} required autoComplete="address-line1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Apartment, unit (optional)
                  <input className={staffInput} autoComplete="address-line2" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
                </label>
                <div className="flex gap-3">
                  <label className="block flex-1 text-sm font-semibold text-slate-700">
                    City
                    <input className={staffInput} required autoComplete="address-level2" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
                  </label>
                  <label className="block w-24 text-sm font-semibold text-slate-700">
                    State
                    <select className={staffInput} autoComplete="address-level1" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })}>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block w-28 text-sm font-semibold text-slate-700">
                    ZIP
                    <input className={staffInput} required autoComplete="postal-code" inputMode="numeric" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} />
                  </label>
                </div>
              </div>
            )}
          </Card>

          <QuietNote>
            Next you’ll save a card with Stripe. It’s charged only if you win an item or use Buy now. OHRR never sees
            the card number.
          </QuietNote>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${btn.primary} min-h-[52px] w-full text-base disabled:opacity-60`}>
            {busy ? 'One moment…' : 'Continue to the card'} <Icon name="chevron" size={16} />
          </button>
        </form>
        {back}
      </Screen>
    </>
  )
}
