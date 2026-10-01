// A feature switch as the public screens see it (Staff → Features).
//
//   on       the switch itself (a missing row = the feature's default)
//   show     render the feature: it is on, or the viewer is signed-in staff
//   preview  it is off but staff are looking — render it under a note so it
//            can be got ready before it goes public
//
// <FeatureGate> wraps a whole page: nothing while loading (no flash), a short
// "not open right now" page for visitors, the page plus the note for staff.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Card, Screen, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useFeatureFlag } from './useSetting'
import { featureDefault } from './features'

export interface FeatureState {
  on: boolean
  show: boolean
  preview: boolean
  loading: boolean
}

export function useFeature(key: string, defaultOn = featureDefault(key)): FeatureState {
  const { value, loading } = useFeatureFlag(key, defaultOn)
  const { membership } = useAuth()
  const isStaff = Boolean(membership)
  return { on: value, show: value || isStaff, preview: !value && isStaff, loading }
}

/** The note staff see on a switched-off feature. */
export function HiddenFromPublic({ className = '' }: { className?: string }) {
  return (
    <div role="note" className={`flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-900 ${className}`}>
      <Icon name="eye" size={18} className="mt-0.5 shrink-0" />
      <span>
        <span className="font-bold">Hidden from the public.</span> Only signed-in staff see this. A Founder or Developer can switch it on in Staff →
        Features.
      </span>
    </div>
  )
}

export function FeatureGate({
  flag,
  closedTitle,
  closedText,
  backTo = '/',
  backLabel = 'Back to OHRR',
  children,
}: {
  flag: string
  closedTitle: string
  closedText?: string
  backTo?: string
  backLabel?: string
  children: ReactNode
}) {
  const f = useFeature(flag)
  if (f.loading) return null
  if (!f.show) {
    return (
      <Screen className="space-y-4">
        <Card className="space-y-3 text-center">
          <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">
            <Icon name="clock" size={30} />
          </span>
          <h1 className="font-display text-xl font-black text-ink">{closedTitle}</h1>
          {closedText && <p className="text-sm leading-relaxed text-slate-600">{closedText}</p>}
          <Link to={backTo} className={`${btn.blue} mx-auto`}>
            {backLabel}
          </Link>
        </Card>
      </Screen>
    )
  }
  if (f.preview) {
    return (
      <>
        <div className="px-4 pt-3">
          <HiddenFromPublic />
        </div>
        {children}
      </>
    )
  }
  return <>{children}</>
}
