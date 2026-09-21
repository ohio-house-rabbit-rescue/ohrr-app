import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Shared form input styling, matching the public app's forms.
export const staffInput =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-blue" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}

// Shown on staff screens when VITE_SUPABASE_* env is missing (e.g. the public
// read-only build). The app still loads; staff features just aren't wired.
export function NotConfigured() {
  return (
    <div className="px-5 py-10">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-[13px] leading-relaxed text-amber-900">
        <p className="font-bold">Staff backend not configured</p>
        <p className="mt-1.5">
          This build has no Supabase connection. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code> (local) or Netlify
          environment variables (deployed), then reload.
        </p>
      </div>
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="text-sm font-semibold text-red-600">{children}</p>
}

// Route guard: requires a configured backend, a signed-in user, and an active
// OHRR membership. Otherwise routes to the right onboarding step. The DB still
// enforces every action regardless of what the UI shows.
export function RequireMembership() {
  const { configured, loading, user, membership } = useAuth()
  const location = useLocation()
  if (!configured) return <NotConfigured />
  if (loading) return <Spinner />
  // Remember where they were heading (a scanned tag's URL, say) so sign-in
  // can send them straight back there.
  if (!user) return <Navigate to="/staff/signin" replace state={{ from: location.pathname + location.search }} />
  if (!membership) return <Navigate to="/staff/start" replace />
  return <Outlet />
}
