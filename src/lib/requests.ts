// Every public form in the app sends its answers here. They land in the
// `requests` table (supabase/migrations/20260921100000_requests.sql) and
// staff handle them in the Inbox (/staff/inbox, and the website's mirror).
// No sign-in is needed to send; the database function only ever inserts.
import { supabase, isSupabaseConfigured } from './supabase'

export type RequestKind =
  | 'appointment-request'
  | 'service-signup'
  | 'surrender-intake'
  | 'volunteer-signup'
  | 'happy-tail'
  | 'raffle-request'
  | 'reserve-session'
  | 'contact'
  | 'mailing-list'
  | 'adoption-application'
  | 'supporter'
  | 'foster-application'

export interface RequestFields {
  name?: string
  email?: string
  phone?: string
  /** Everything else — shown to staff as label/value pairs, in this order. */
  [field: string]: string | undefined
}

/** The one-line summary staff see in the list. */
function summarize(kind: RequestKind, f: RequestFields): string {
  const pick = (...keys: string[]) => keys.map((k) => f[k]).filter(Boolean).join(' · ')
  switch (kind) {
    case 'appointment-request':
      return pick('reason', 'date', 'times') || 'Appointment'
    case 'service-signup':
      return pick('service', 'date', 'time') || 'Service sign-up'
    case 'surrender-intake':
      return pick('type', 'bunnyName', 'bunny_name') || 'Surrender intake'
    case 'volunteer-signup':
      return pick('role', 'item') || 'Volunteer'
    case 'happy-tail':
      return pick('bunny') || 'Happy Tail'
    case 'raffle-request':
      return pick('quantity', 'total') || 'Raffle tickets'
    case 'reserve-session':
      return pick('service', 'time') || 'Session'
    case 'mailing-list':
      return 'Join the mailing list'
    case 'supporter':
      return 'Become a supporter'
    case 'foster-application':
      return pick('situation', 'length') || 'Foster interest'
    case 'adoption-application':
      return pick('rabbit', 'rabbitName') || 'Adoption application'
    default:
      return pick('subject') || 'Message'
  }
}

/**
 * Send a form. Resolves when it's stored; throws with a friendly message if
 * not. `fields['bot-field']` is the honeypot: when a bot fills it we pretend
 * to succeed and store nothing.
 */
export async function submitRequest(kind: RequestKind, fields: RequestFields): Promise<void> {
  if (fields['bot-field']) return
  if (!isSupabaseConfigured) throw new Error('This build isn’t connected to OHRR yet.')
  const { name, email, phone, ...rest } = fields
  delete rest['form-name']
  delete rest['bot-field']
  const payload: Record<string, string> = {}
  for (const [k, v] of Object.entries(rest)) if (v != null && String(v).trim() !== '') payload[k] = String(v)
  const { error } = await supabase.rpc('submit_request', {
    p_kind: kind,
    p_name: name ?? null,
    p_email: email ?? null,
    p_phone: phone ?? null,
    p_subject: summarize(kind, fields),
    p_payload: payload,
    p_source: 'app',
  })
  if (error) throw new Error(error.message || 'Could not send that right now.')
}
