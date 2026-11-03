import { useEffect, useRef, type ReactNode } from 'react'
import { bringIntoView } from '../lib/bringIntoView'

/**
 * A panel that opens after a tap (an edit form, a "pick what they're approved for" box, the card that says
 * "now send the email"): when it appears it is scrolled to where it can be seen, so the next step is never
 * left off the screen. The keyboard is left alone by default, because the first box in the panel may be
 * about to be typed in.
 */
export default function BringIn({
  children,
  className,
  align = 'top',
  keyboard = 'keep',
}: {
  children: ReactNode
  className?: string
  align?: 'auto' | 'top'
  keyboard?: 'away' | 'keep'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bringIntoView(ref.current, { align, keyboard })
    // Only when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
