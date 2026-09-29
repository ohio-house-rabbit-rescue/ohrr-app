// Stripe's card form, for saving a bidder's card. The card number goes straight
// from the form to Stripe; it never touches OHRR's sites or database.
// Copied to the website and the BunFest site (src/components/CardSetup.tsx).
import { useState, type FormEvent } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

let stripePromise: Promise<Stripe | null> | null = null
let stripeKey = ''

/** One Stripe.js load per publishable key. */
export function stripeFor(publishableKey: string): Promise<Stripe | null> {
  if (!stripePromise || stripeKey !== publishableKey) {
    stripeKey = publishableKey
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

/**
 * When a charge comes back `requires_action`, the bank wants a quick check
 * (3-D Secure). Stripe shows it; then call auctionApi.complete() to record the result.
 */
export async function confirmPaymentAction(publishableKey: string, clientSecret: string): Promise<{ ok: boolean; error?: string }> {
  const stripe = await stripeFor(publishableKey)
  if (!stripe) return { ok: false, error: 'Stripe did not load. Check your connection and try again.' }
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret)
  if (error) return { ok: false, error: error.message ?? 'The bank did not approve the payment.' }
  return paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing'
    ? { ok: true }
    : { ok: false, error: 'The payment was not completed.' }
}

const appearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#0669ac',
    colorText: '#0f172a',
    borderRadius: '12px',
    fontFamily: '"Open Sans", system-ui, sans-serif',
    fontSizeBase: '16px',
  },
}

export interface CardSetupProps {
  publishableKey: string
  /** From /api/auction/register or /api/auction/new-card. */
  clientSecret: string
  /** Called with the SetupIntent id once the card is saved. */
  onSaved: (setupIntentId: string) => void | Promise<void>
  buttonClassName: string
  label?: string
  busyLabel?: string
}

export default function CardSetup(props: CardSetupProps) {
  return (
    <Elements stripe={stripeFor(props.publishableKey)} options={{ clientSecret: props.clientSecret, appearance }}>
      <Form {...props} />
    </Elements>
  )
}

function Form({ onSaved, buttonClassName, label = 'Save card', busyLabel = 'Saving…' }: CardSetupProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    })
    if (error) {
      setError(error.message ?? 'The card was not saved. Please check it and try again.')
      setBusy(false)
      return
    }
    if (setupIntent?.status === 'succeeded') {
      try {
        await onSaved(setupIntent.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The card was saved, but we could not record it. Please try again.')
      }
    } else {
      setError('The card was not saved. Please try again.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button type="submit" disabled={!stripe || busy} className={buttonClassName}>
        {busy ? busyLabel : label}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">Your card is held by Stripe, not by OHRR. You are only charged if you win or use Buy Now.</p>
    </form>
  )
}
