import type { ReactNode } from 'react'
import { SAMPLE_DATA_NOTE } from '../data/content'

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`mx-auto w-full max-w-5xl px-4 ${className}`}>{children}</div>
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-emerald-700 text-white">
      <Container className="py-10 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-emerald-50/90">{subtitle}</p>}
      </Container>
    </div>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      {children}
    </span>
  )
}

export function SampleBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong className="font-semibold">Heads up:</strong> {children ?? SAMPLE_DATA_NOTE}
    </div>
  )
}
