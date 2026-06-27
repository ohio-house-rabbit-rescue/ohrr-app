import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Public, browser-safe credentials. Only the anon key belongs on the client —
// never the service_role key. Set these in .env.local (gitignored) for local dev
// and in Netlify's environment variables for the deployed staff build.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// The public read-only app builds and runs WITHOUT these. Staff screens check
// this flag and show a "backend not configured" notice instead of throwing.
export const isSupabaseConfigured = Boolean(url && anonKey)

// A single shared client. When env is absent we still construct it with harmless
// placeholders so module imports never throw; nothing connects until a staff
// screen actually calls it (and those are gated on isSupabaseConfigured).
export const supabase = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

// Turn a thrown Supabase/PostgREST error into a human-readable string. RLS
// denials and RPC `raise exception` messages both surface here.
export function errMessage(e: unknown): string {
  if (!e) return 'Something went wrong.'
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const o = e as { message?: string; error_description?: string; details?: string }
    return o.message || o.error_description || o.details || 'Something went wrong.'
  }
  return 'Something went wrong.'
}
