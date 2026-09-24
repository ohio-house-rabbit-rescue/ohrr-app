// Volunteers apply, staff approve, and only approved volunteers sign up for
// approved-only shifts (update 25). Also: a volunteer's self-serve hours
// letter, which the database works out and records under a code anyone can
// check. The app's copy of the website's lib/volunteers/approval.ts — keep
// the two the same (only the supabase import differs).
import { supabase } from '../../lib/supabase'
import { SITE_ORIGIN } from './calls'

/** The kinds of volunteering OHRR approves people for. `*` means everything. */
export const APPROVAL_KINDS = [
  { value: 'socialization', label: 'Bunny Socialization', hint: 'Sitting with the rabbits so they learn to trust people' },
  { value: 'buncare', label: 'Buncare', hint: 'Cleaning, feeding and care shifts (18+, after two socialization shifts and orientation)' },
  { value: 'events', label: 'Events & BunFest', hint: 'Helping at Midwest BunFest and other events' },
  { value: 'vet-transport', label: 'Vet runs', hint: 'Driving rabbits to and from the vet' },
  { value: 'hop-shop', label: 'Hop Shop', hint: 'Helping in the rescue’s shop' },
] as const
export type ApprovalKind = (typeof APPROVAL_KINDS)[number]['value']
export const EVERYTHING = '*'

export function kindLabel(value: string | null | undefined): string {
  if (!value) return 'Anyone'
  if (value === EVERYTHING) return 'Everything'
  return APPROVAL_KINDS.find((k) => k.value === value)?.label ?? value
}

/** "Everything" / "Bunny Socialization and Buncare" / "Nothing yet". */
export function approvedText(list: string[] | null | undefined): string {
  const l = list ?? []
  if (l.includes(EVERYTHING)) return 'Everything'
  if (l.length === 0) return 'Nothing yet'
  const names = l.map(kindLabel)
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ---- the application ---- */

export interface Application {
  name: string
  email: string
  phone: string
  kinds: string[]
  /** Everything else they told us: age, availability, experience, why … */
  answers: Record<string, string>
  hoursFor?: string
  source?: string
}

export async function applyToVolunteer(a: Application): Promise<void> {
  const { error } = await supabase.rpc('apply_to_volunteer', {
    p_name: a.name,
    p_email: a.email,
    p_phone: a.phone || null,
    p_kinds: a.kinds,
    p_answers: a.answers,
    p_hours_for: a.hoursFor || null,
    p_source: a.source || null,
  })
  if (error) throw error
}

/* ---- "is this email approved for this?" ---- */

export type CheckState = 'open' | 'approved' | 'pending' | 'other' | 'not_yet' | 'unknown' | 'invalid' | 'closed'
export interface CheckResult {
  state: CheckState
  /** The kind of volunteer this sign-up is for. */
  role?: string
  firstName?: string
}

export async function volunteerCheck(email: string, where: { type?: string; call?: string }): Promise<CheckResult> {
  const { data, error } = await supabase.rpc('volunteer_check', {
    p_email: email,
    p_type_slug: where.type ?? null,
    p_call_slug: where.call ?? null,
  })
  // Before update 25 runs there is no check: everything is open, as it was.
  if (error) {
    if (/volunteer_check|function|schema cache/i.test(error.message ?? '')) return { state: 'open' }
    throw error
  }
  const d = (data ?? {}) as { state?: CheckState; role?: string; first_name?: string }
  return { state: d.state ?? 'open', role: d.role, firstName: d.first_name || undefined }
}

/** What to tell someone after the check (the page adds the buttons). */
export function checkMessage(r: CheckResult): { title: string; body: string } {
  const what = kindLabel(r.role)
  switch (r.state) {
    case 'approved':
      return { title: r.firstName ? `Welcome back, ${r.firstName}!` : 'You’re approved', body: 'Pick a time below.' }
    case 'pending':
      return {
        title: 'Your application is with OHRR',
        body: 'Thank you for applying. Once someone has looked it over you’ll get an email, and then you can sign up here.',
      }
    case 'other':
      return {
        title: `You’re not approved for ${what} yet`,
        body: `You’re approved for other volunteering, but ${what} needs its own approval. Apply for it below, or email OHRR.`,
      }
    case 'not_yet':
      return {
        title: `This is for approved ${what} volunteers`,
        body: 'We don’t have that email approved for this yet. If you haven’t applied, you can below — or email OHRR if you think this is a mistake.',
      }
    case 'unknown':
      return {
        title: 'We don’t know that email yet',
        body: 'This is for approved volunteers. New here? Apply to volunteer — it only takes a few minutes. Applied already? Try the email you used.',
      }
    case 'invalid':
      return { title: 'Please check the email address', body: 'It needs to look like name@example.com.' }
    case 'closed':
      return { title: 'This isn’t taking sign-ups', body: 'Please check the Volunteer page for what’s open.' }
    default:
      return { title: '', body: '' }
  }
}

/* ---- remembering the email on this device (never anything else) ---- */

const EMAIL_KEY = 'ohrr-volunteer-email'
export function savedVolunteerEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}
export function rememberVolunteerEmail(email: string) {
  try {
    if (email) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase())
    else localStorage.removeItem(EMAIL_KEY)
  } catch {
    /* private window */
  }
}

/* ---- the volunteer's own hours letter ---- */

/**
 * The letters a volunteer can make for themselves. A certificate of
 * appreciation is OHRR's to give, from Staff (OHRR, 2026-09-24): the top tier
 * is told when a volunteer makes a letter or passes an hours mark they set.
 */
export const SELF_SERVE_KINDS = ['school', 'military', 'workplace', 'general'] as const

/** Certificates to consider (staff with "Make volunteer certificates"). */
export interface CertificateSuggestion {
  id: string
  volunteer_id: string
  reason: 'letter' | 'hours'
  hours: number | null
  milestone: number | null
  letter_code: string | null
  letter_kind: string | null
  status: 'open' | 'made' | 'dismissed'
  created_at: string
}

/** Why a certificate is suggested, in a line: "Passed 50 hours" / "Made a school letter (24 hours)". */
export function suggestionReason(s: Pick<CertificateSuggestion, 'reason' | 'hours' | 'milestone' | 'letter_kind'>): string {
  const h = s.hours != null ? `${Number(s.hours).toString().replace(/\.0+$/, '')} hours` : ''
  if (s.reason === 'hours') return `Passed ${s.milestone} hours${h ? ` (${h} in all)` : ''}`
  const kind = s.letter_kind === 'school' ? 'a school letter' : s.letter_kind === 'military' ? 'a military service letter' : s.letter_kind === 'workplace' ? 'a workplace letter' : 'an hours letter'
  return `Made ${kind}${h ? ` (${h} in all)` : ''}`
}

export interface IssuedLetter {
  code: string
  name: string
  from: string
  to: string
  lines: { on_date: string; activity: string; hours: number }[]
  total: number
  /** Hours they logged that OHRR hasn't confirmed yet (not on the letter). */
  pending: number
  issuedOn: string
}

export async function issueMyLetter(
  token: string,
  kind: string,
  from: string,
  to: string,
  details: Record<string, string>,
): Promise<IssuedLetter> {
  const { data, error } = await supabase.rpc('issue_my_letter', {
    p_token: token,
    p_kind: kind,
    p_from: from,
    p_to: to,
    p_details: details,
  })
  if (error) throw error
  const d = data as {
    code: string
    name: string
    from: string
    to: string
    lines: { on_date: string; activity: string; hours: number | string }[]
    total: number | string
    pending: number | string
    issued_on: string
  }
  return {
    code: d.code,
    name: d.name,
    from: d.from,
    to: d.to,
    lines: (d.lines ?? []).map((l) => ({ ...l, hours: Number(l.hours) })),
    total: Number(d.total),
    pending: Number(d.pending),
    issuedOn: d.issued_on,
  }
}

export interface VerifiedLetter {
  code: string
  name: string
  kind: string
  from: string
  to: string
  totalHours: number
  issuedOn: string
}

export async function verifyLetter(code: string): Promise<VerifiedLetter | null> {
  const { data, error } = await supabase.rpc('verify_volunteer_letter', { p_code: code })
  if (error) throw error
  if (!data) return null
  const d = data as { code: string; name: string; kind: string; from: string; to: string; total_hours: number | string; issued_on: string }
  return { code: d.code, name: d.name, kind: d.kind, from: d.from, to: d.to, totalHours: Number(d.total_hours), issuedOn: d.issued_on }
}

/** Where a school or employer checks a letter — always the website. */
export const VERIFY_BASE = `${SITE_ORIGIN}/verify`
export function verifyLine(code: string): string {
  return `Check this letter at ${VERIFY_BASE.replace(/^https:\/\//, '')} — code ${code}`
}

/* ---- what a volunteer is signed up for (from their private page) ---- */

export interface UpcomingItem {
  id: string
  what: string
  kind: 'shift' | 'appointment'
  starts_at: string
  ends_at: string
  status: 'requested' | 'confirmed'
  location: string | null
  area: string | null
  cancel_token: string
}
