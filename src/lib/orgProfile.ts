// Opening hours, phone, address — and a holiday notice — that staff can change.
//
// These appear on a dozen screens and were constants in code, so a closure or a
// new number meant a code change and a new app build. They now live in one
// `app_settings` row (key `org_profile`, public to read, `settings.manage` to
// write); anything left blank falls back to the bundled value, so an empty row
// changes nothing.
import { useSetting } from '../features/settings/useSetting'
import { ohrr } from '../data/ohrr'

export const ORG_PROFILE_KEY = 'org_profile'

export interface OrgProfile {
  /** "Sat & Sun, 12–4 PM · adoptions by appointment" */
  hours: string
  /** "Sat & Sun, 12–4 PM" */
  hours_short: string
  /** "Saturday / Sunday Noon – 4:00 pm" */
  hopshop_hours: string
  /** A short line shown wherever hours are — "Closed Sat 25 Oct for BunFest". */
  notice: string
  phone: string
  email: string
  address: string
  /** Who signs volunteer-hours letters — never guessed; blank until set. */
  letter_signer_name: string
  letter_signer_title: string
  /** Shown on letters when set — volunteer-grant programmes often ask for it. */
  ein: string
}

export const ORG_PROFILE_FALLBACK: OrgProfile = {
  hours: ohrr.hours,
  hours_short: ohrr.hoursShort,
  hopshop_hours: ohrr.hopShopHours,
  notice: '',
  phone: ohrr.phone,
  email: ohrr.email,
  address: ohrr.address,
  letter_signer_name: '',
  letter_signer_title: '',
  ein: '',
}

/** The org's live details, with the bundled values filling any blanks. */
export function useOrgProfile(): OrgProfile {
  const { value } = useSetting<Partial<OrgProfile>>(ORG_PROFILE_KEY, {})
  const v = value ?? {}
  const pick = (k: keyof OrgProfile) => {
    const s = typeof v[k] === 'string' ? (v[k] as string).trim() : ''
    return s || ORG_PROFILE_FALLBACK[k]
  }
  return {
    hours: pick('hours'),
    hours_short: pick('hours_short'),
    hopshop_hours: pick('hopshop_hours'),
    // The notice is the one field whose fallback is "nothing".
    notice: typeof v.notice === 'string' ? v.notice.trim() : '',
    phone: pick('phone'),
    email: pick('email'),
    address: pick('address'),
    // No bundled fallback for these: a letter must never carry an invented name.
    letter_signer_name: typeof v.letter_signer_name === 'string' ? v.letter_signer_name.trim() : '',
    letter_signer_title: typeof v.letter_signer_title === 'string' ? v.letter_signer_title.trim() : '',
    ein: typeof v.ein === 'string' ? v.ein.trim() : '',
  }
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
