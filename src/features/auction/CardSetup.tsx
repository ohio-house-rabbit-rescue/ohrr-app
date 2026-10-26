// Square's card form, for saving a bidder's card (update 45). The card number
// goes straight from Square's form to Square; OHRR's sites only ever get a
// one-time token, which the payment server turns into a saved card.
// Copied to the website and the BunFest site (src/components/CardSetup.tsx).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

interface SquareCard {
  attach(target: string | HTMLElement): Promise<void>
  tokenize(details?: Record<string, unknown>): Promise<{ status: string; token?: string; errors?: { message?: string }[] }>
  destroy(): Promise<boolean>
}
interface SquarePayments {
  card(options?: Record<string, unknown>): Promise<SquareCard>
}
declare global {
  interface Window {
    Square?: { payments(applicationId: string, locationId: string): SquarePayments }
  }
}

const scripts = new Map<string, Promise<void>>()

/** Square's script, once per page: the sandbox one for "sandbox-" application ids. */
function loadSquare(applicationId: string): Promise<void> {
  const src = applicationId.startsWith('sandbox-') ? 'https://sandbox.web.squarecdn.com/v1/square.js' : 'https://web.squarecdn.com/v1/square.js'
  let p = scripts.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        scripts.delete(src)
        reject(new Error('Square’s card form did not load. Check your connection and try again.'))
      }
      document.head.appendChild(s)
    })
    scripts.set(src, p)
  }
  return p
}

/** Who is saving the card: Square uses it for the bank's check (3-D Secure). */
export interface CardHolder {
  name: string
  email: string
  phone?: string
  address?: { line1?: string; line2?: string; city?: string; state?: string; zip?: string } | null
}

export interface CardSetupProps {
  applicationId: string
  locationId: string
  /** Read when the button is pressed. */
  holder: () => CardHolder
  /** Checks the rest of the form first; a message stops the save. */
  check?: () => string | null
  /** Called with Square's one-time card token. Throw to show a message. */
  onToken: (cardToken: string) => void | Promise<void>
  buttonClassName: string
  label?: ReactNode
  busyLabel?: string
  /** Fields shown above the card (the rest of the form). */
  children?: ReactNode
}

export default function CardSetup({
  applicationId,
  locationId,
  holder,
  check,
  onToken,
  buttonClassName,
  label = 'Save card',
  busyLabel = 'Saving…',
  children,
}: CardSetupProps) {
  const box = useRef<HTMLDivElement>(null)
  const card = useRef<SquareCard | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let made: SquareCard | null = null
    setReady(false)
    loadSquare(applicationId)
      .then(async () => {
        if (!alive || !box.current || !window.Square) return
        made = await window.Square.payments(applicationId, locationId).card({
          style: { input: { fontSize: '16px', color: '#0f172a' }, '.input-container.is-focus': { borderColor: '#0669ac' } },
        })
        if (!alive) return void made.destroy()
        await made.attach(box.current)
        card.current = made
        setReady(true)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Square’s card form did not load.'))
    return () => {
      alive = false
      card.current = null
      if (made) void made.destroy().catch(() => undefined)
    }
  }, [applicationId, locationId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = check?.()
    if (problem) return setError(problem)
    if (!card.current) return
    setBusy(true)
    setError(null)
    try {
      const h = holder()
      const [given, ...rest] = h.name.trim().split(/\s+/)
      const a = h.address
      const r = await card.current.tokenize({
        intent: 'STORE',
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: {
          givenName: given,
          familyName: rest.join(' ') || undefined,
          email: h.email || undefined,
          phone: h.phone || undefined,
          addressLines: a?.line1 ? [a.line1, a.line2].filter(Boolean) : undefined,
          city: a?.city || undefined,
          state: a?.state || undefined,
          postalCode: a?.zip || undefined,
          countryCode: 'US',
        },
      })
      if (r.status !== 'OK' || !r.token) {
        setError(r.errors?.[0]?.message ?? 'Please check the card and try again.')
        return
      }
      await onToken(r.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The card was not saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {children}
      <div className="relative min-h-[52px]">
        <div ref={box} />
        {!ready && !error && <div className="absolute inset-x-0 top-0 h-12 animate-pulse rounded-xl bg-slate-100" aria-label="Loading the card form" />}
      </div>
      <button type="submit" disabled={!ready || busy} className={buttonClassName}>
        {busy ? busyLabel : label}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">Your card is held by Square, not by OHRR. You are only charged if you win or use Buy now.</p>
    </form>
  )
}
