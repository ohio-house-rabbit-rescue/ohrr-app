// Small pieces the staff content editors share (rabbits, care guides, Bunny Help
// topics, vets, volunteer opportunities, Happy Tails), so their forms and list
// cards behave the same way. Built on the staff kit in StaffJob.tsx.
import { useState, type ReactNode } from 'react'
import { errMessage } from '../lib/supabase'
import { Part } from './StaffJob'

/** One lettered part of a form: the heading, then its fields. */
export function PartBox({ n, title, hint, children }: { n: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <Part n={n} hint={hint}>
        {title}
      </Part>
      {children}
    </section>
  )
}

/** A yes/no box with a 44px-tall row to tap. */
export function CheckRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1.5 text-base font-semibold text-slate-700">
      <input
        type="checkbox"
        className="mt-0.5 h-6 w-6 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="block text-sm font-normal text-slate-500">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * Saving state for a form: `submit` runs `run`, shows what went wrong, and
 * `guard` wraps the Remove action the same way so its error shows in the form.
 */
export function useSaving(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await run()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const guard = (fn: () => Promise<void>) => async () => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errMessage(e))
    }
  }
  return { busy, error, submit, guard }
}

/** Busy and error state for the buttons on a list card (Hide, Move, Remove …). */
export function useCardAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

/** Case-insensitive A–Z by a name. */
export const byName = <T,>(get: (t: T) => string) => (a: T, b: T) => get(a).localeCompare(get(b), 'en', { sensitivity: 'base' })

/** Asks first; true if they said yes. */
export const confirmRemove = (what: string) => window.confirm(`Remove ${what}? This can’t be undone.`)
