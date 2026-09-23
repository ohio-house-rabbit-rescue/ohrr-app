// Volunteer calls — one need, said every way it has to be said.
//
// A call is entered once ("Midwest BunFest, Sun 25 Oct, 10 AM – 4 PM, 2-hour
// shifts, 5 people each") and everything else comes from it: the shifts, the
// need in plain words, a post for Facebook and Instagram, a text, an email to
// companies, a letter to community and support groups, a flyer, a newsletter
// paragraph — and afterwards, the thank-you. Every message ends by thanking
// the reader, and says only what the call and OHRR's own details say.
//
// Each medium gets its own link, so the sign-ups show which one worked.
// Media read on a phone (posts, stories, texts) point at the app; media read
// at a desk or on paper (emails, letters, flyers, newsletters) point at the
// website. Both have the same sign-up page.
//
// Plain TypeScript with no app imports: the website keeps a copy.

export type HoursFor = 'school' | 'military' | 'workplace' | 'community' | 'other'

export const HOURS_FOR: { value: HoursFor; label: string; ask: { key: string; label: string; placeholder?: string }[] }[] = [
  { value: 'school', label: 'School or college credit', ask: [{ key: 'school', label: 'School', placeholder: 'Dublin Jerome High School' }] },
  {
    value: 'military',
    label: 'A military volunteer service award',
    ask: [
      { key: 'branch', label: 'Branch', placeholder: 'U.S. Army' },
      { key: 'rank', label: 'Rank (optional)', placeholder: 'SSG' },
    ],
  },
  { value: 'workplace', label: 'A workplace volunteer programme', ask: [{ key: 'employer', label: 'Employer', placeholder: 'Nationwide' }] },
  { value: 'community', label: 'Court or community service', ask: [] },
]

export interface Shift {
  slot_id: string
  starts_at: string
  ends_at: string
  capacity: number
  taken: number
  open: boolean
}

export interface Call {
  id: string
  slug: string
  title: string
  summary: string | null
  details: string | null
  location: string | null
  on_date: string
  starts_at: string
  ends_at: string
  shift_minutes: number
  people_per_shift: number
  areas: string[]
  who: string | null
  perks: string[]
  requirements: string | null
  closes_on: string | null
  is_open?: boolean
  shifts?: Shift[]
}

/** What the messages need to know about OHRR. */
export interface OrgBits {
  name: string
  short: string
  phone: string
  email: string
  address: string
  signerName: string
  signerTitle: string
}

export const APP_ORIGIN = 'https://ohrr-app.pages.dev'
export const SITE_ORIGIN = 'https://ohrr-website.pages.dev'

/* ------------------------------------------------------------ time */

const TZ = 'America/New_York'

/** "2026-10-25" → "Sunday, October 25" (the date itself, no timezone shift). */
export function fmtDay(isoDate: string, withYear = false): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

/** "2026-10-25" → "Sun, Oct 25" */
export function fmtDayShort(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "10:00:00" → "10 AM", "12:30:00" → "12:30 PM" */
export function fmtClock(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`
}

/** A timestamp as Ohio clock time: "10 AM". */
export function fmtClockAt(iso: string): string {
  const s = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  return s.replace(':00', '')
}

/** "10 AM – 12 PM" */
export function fmtShift(s: { starts_at: string; ends_at: string }): string {
  return `${fmtClockAt(s.starts_at)} – ${fmtClockAt(s.ends_at)}`
}

/** 120 → "2 hours", 90 → "1½ hours", 60 → "1 hour" */
export function lengthText(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`
  if (h === 0) return `${rest} minutes`
  if (rest === 30) return `${h}½ hours`
  return `${h} h ${rest} min`
}

/** 120 → "2-hour" (for "2-hour shifts") */
export function lengthAdj(minutes: number): string {
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}-hour` : minutes % 30 === 0 ? `${h}-hour` : `${minutes}-minute`
}

export function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

/* ------------------------------------------------------------ the need */

/** The shifts a call makes, before it's saved — for the editor's preview. */
export function plannedShifts(c: Pick<Call, 'starts_at' | 'ends_at' | 'shift_minutes'>): { from: string; to: string }[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const toClock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`
  const out: { from: string; to: string }[] = []
  const end = toMin(c.ends_at)
  if (!(c.shift_minutes >= 30)) return out
  for (let t = toMin(c.starts_at); t + c.shift_minutes <= end; t += c.shift_minutes) out.push({ from: toClock(t), to: toClock(t + c.shift_minutes) })
  return out
}

export function totalPlaces(c: Call): number {
  return c.shifts ? c.shifts.reduce((n, s) => n + s.capacity, 0) : plannedShifts(c).length * c.people_per_shift
}

export function placesLeft(c: Call): number {
  return (c.shifts ?? []).filter((s) => s.open).reduce((n, s) => n + Math.max(0, s.capacity - s.taken), 0)
}

/** "Sunday, October 25, 10 AM – 4 PM" */
export function whenText(c: Call, withYear = false): string {
  return `${fmtDay(c.on_date, withYear)}, ${fmtClock(c.starts_at)} – ${fmtClock(c.ends_at)}`
}

/** "5 people for each 2-hour shift between 10 AM and 4 PM — 15 places in all" */
export function needText(c: Call): string {
  const n = c.people_per_shift
  const shifts = c.shifts?.length ?? plannedShifts(c).length
  const who = `${n} ${n === 1 ? 'person' : 'people'}`
  const base =
    shifts <= 1
      ? `${who} from ${fmtClock(c.starts_at)} to ${fmtClock(c.ends_at)}`
      : `${who} for each ${lengthAdj(c.shift_minutes)} shift between ${fmtClock(c.starts_at)} and ${fmtClock(c.ends_at)}`
  const total = totalPlaces(c)
  return shifts > 1 ? `${base} — ${total} places in all` : base
}

/** The need without the hours, for when the hours were just said. */
export function needShort(c: Call): string {
  const n = c.people_per_shift
  const shifts = c.shifts?.length ?? plannedShifts(c).length
  const who = `${n} ${n === 1 ? 'person' : 'people'}`
  return shifts > 1 ? `${who} for each ${lengthAdj(c.shift_minutes)} shift — ${totalPlaces(c)} places in all` : who
}

function areasText(c: Call): string {
  if (c.areas.length === 0) return ''
  if (c.areas.length === 1) return `You’ll help with ${c.areas[0]}.`
  return `Pick where you’d like to help: ${c.areas.slice(0, -1).join(', ')} or ${c.areas[c.areas.length - 1]}.`
}

/** "Free admission" → "free admission", but "OHRR T-shirt" stays as it is. */
const lowerFirst = (x: string) => (/^[A-Z][a-z]/.test(x) || /^(A|An) /.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x)

function perksText(c: Call): string {
  const p = c.perks.map((x) => x.trim()).filter(Boolean).map(lowerFirst)
  if (p.length === 0) return ''
  return `Volunteers get ${p.length === 1 ? p[0] : `${p.slice(0, -1).join(', ')} and ${p[p.length - 1]}`}.`
}

/**
 * Join lines into paragraphs: '' is a paragraph break, and a missing field
 * (null, undefined, false or an empty string passed as a field) just drops
 * out — without leaving two breaks in a row.
 */
function para(...xs: (string | null | undefined | false)[]): string {
  const out: string[] = []
  for (const x of xs) {
    if (x === null || x === undefined || x === false) continue
    if (x === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(x)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

/** A field that may be empty, as something para() will drop. */
const opt = (x: string | null | undefined) => (x && x.trim() ? x.trim() : null)

const HOURS_PROMISE =
  'Need the hours for school, work or a military volunteer award? Every shift is recorded, and we’ll send you a letter confirming your hours.'

/* ------------------------------------------------------------ where it points */

export type Medium = 'facebook' | 'instagram' | 'story' | 'text' | 'email-business' | 'email-groups' | 'letter' | 'flyer' | 'newsletter'

export const MEDIA: { id: Medium; label: string; audience: string; dest: 'app' | 'web' }[] = [
  { id: 'facebook', label: 'Facebook post', audience: 'Followers and local groups', dest: 'app' },
  { id: 'instagram', label: 'Instagram post', audience: 'Followers', dest: 'app' },
  { id: 'story', label: 'Story (Instagram / Facebook)', audience: 'Followers, for a day', dest: 'app' },
  { id: 'text', label: 'Text message', audience: 'Past volunteers and friends', dest: 'app' },
  { id: 'email-business', label: 'Email to a company', audience: 'Employee volunteering and team service days', dest: 'web' },
  { id: 'email-groups', label: 'Email to a community group', audience: 'Veterans’ groups, scouts, faith groups, school clubs, senior centers', dest: 'web' },
  { id: 'letter', label: 'Printed letter', audience: 'The same groups, by post or by hand', dest: 'web' },
  { id: 'flyer', label: 'Flyer with a QR code', audience: 'Notice boards, the Hop Shop counter, vet clinics', dest: 'web' },
  { id: 'newsletter', label: 'Newsletter paragraph', audience: 'Partner newsletters and bulletins', dest: 'web' },
]

/** The sign-up link for one medium, tagged so its sign-ups are counted. */
export function callLink(slug: string, medium: Medium | 'direct'): string {
  const dest = MEDIA.find((m) => m.id === medium)?.dest ?? 'app'
  const origin = dest === 'app' ? APP_ORIGIN : SITE_ORIGIN
  return `${origin}/volunteer/call/${slug}${medium === 'direct' ? '' : `?src=${medium}`}`
}

/** What a sign-up records as where the person came from. */
export function sourceFrom(params: URLSearchParams): string | null {
  return params.get('src') || params.get('utm_campaign') || params.get('utm_source') || null
}

export const SOURCE_LABEL: Record<string, string> = {
  direct: 'Straight to the page',
  'walk-in': 'Walked in on the day',
  ...Object.fromEntries(MEDIA.map((m) => [m.id, m.label])),
}

/* ------------------------------------------------------------ the words */

export interface Message {
  subject?: string
  body: string
  link: string
}

function signature(org: OrgBits): string {
  const who = [org.signerName, org.signerTitle].filter(Boolean).join(', ')
  return [who, org.name, `${org.address} · ${org.phone}`, org.email].filter(Boolean).join('\n')
}

/** The message for one medium. `{{org}}` in emails is the group's name. */
export function outreach(c: Call, medium: Medium, org: OrgBits): Message {
  const link = callLink(c.slug, medium)
  const bare = link.replace(/^https:\/\//, '')
  const when = whenText(c)
  const where = c.location ? ` at ${c.location}` : ''
  const shifts = c.shifts?.length ?? plannedShifts(c).length

  switch (medium) {
    case 'facebook':
      return {
        link,
        body: para(
          `VOLUNTEERS NEEDED — ${c.title}`,
          '',
          opt(c.summary),
          '',
          `When: ${when}`,
          c.location ? `Where: ${c.location}` : null,
          `We need ${needShort(c)}.`,
          opt(c.who),
          opt(areasText(c)),
          opt(perksText(c)),
          '',
          `Sign up in a minute: ${link}`,
          '',
          `Thank you for helping the rabbits of ${org.short} — and please share this with anyone who might like to help.`,
        ),
      }
    case 'instagram':
      return {
        link,
        body: para(
          `Volunteers needed — ${c.title}.`,
          '',
          opt(c.summary),
          '',
          `${when}${where}.`,
          `We need ${needShort(c)}.`,
          opt(c.who),
          opt(areasText(c)),
          opt(perksText(c)),
          '',
          `Sign up: ${bare} (link in our bio too).`,
          '',
          'Thank you for helping the rabbits — please share!',
          '#OhioHouseRabbitRescue #Volunteer #Columbus #HouseRabbit',
        ),
      }
    case 'story':
      return { link, body: `Volunteers needed ${fmtDayShort(c.on_date)} — sign up: ${link}` }
    case 'text':
      return {
        link,
        body: `Hi! ${org.name} needs volunteers for ${c.title} on ${fmtDayShort(c.on_date)}, ${fmtClock(c.starts_at)}–${fmtClock(c.ends_at)}${
          shifts > 1 ? `, in ${lengthAdj(c.shift_minutes)} shifts` : ''
        }. Could you help? Sign up here: ${link} Thank you!`,
      }
    case 'email-business':
      return {
        link,
        subject: `A volunteer opportunity for your team — ${c.title}, ${fmtDayShort(c.on_date)}`,
        body: para(
          'Hello {{org}},',
          '',
          `${org.name} is a nonprofit rabbit rescue and adoption center in Columbus. On ${when}, we need volunteers for ${c.title}${where} — and we would love to include people from {{org}}.`,
          '',
          opt(c.summary),
          `What we need: ${needShort(c)}.`,
          opt(c.who),
          opt(areasText(c)),
          opt(perksText(c)),
          '',
          'It works well as a team service day: colleagues can sign up for the same shift, and every shift is recorded, so we can confirm hours for your volunteer or matching-gift programme.',
          '',
          `Sign up, or pass it to your team: ${link}`,
          '',
          'Thank you for considering it — and for supporting the rescue rabbits of Central Ohio.',
          '',
          signature(org),
        ),
      }
    case 'email-groups':
      return {
        link,
        subject: `Volunteers needed for ${c.title} — ${fmtDayShort(c.on_date)}`,
        body: para(
          'Hello {{org}},',
          '',
          `I’m writing from ${org.name}, a nonprofit rabbit rescue and adoption center in Columbus. On ${when}, we need volunteers for ${c.title}${where}, and I hope some of your members might like to help.`,
          '',
          opt(c.summary),
          `What we need: ${needShort(c)}.`,
          opt(c.who),
          opt(areasText(c)),
          opt(perksText(c)),
          '',
          HOURS_PROMISE,
          '',
          `Anyone can sign up here: ${link}`,
          '',
          'Could you share this with your members? Thank you so much for thinking of us — every pair of hands makes a difference to the rabbits in our care.',
          '',
          signature(org),
        ),
      }
    case 'letter':
      return {
        link,
        subject: `Volunteers needed for ${c.title}`,
        body: para(
          'Dear friends at {{org}},',
          '',
          `${org.name} is a nonprofit rabbit rescue and adoption center in Columbus. On ${when}, we need volunteers for ${c.title}${where}, and we would be grateful for your members’ help.`,
          '',
          opt(c.summary),
          `We need ${needShort(c)}.`,
          opt(c.who),
          opt(areasText(c)),
          opt(perksText(c)),
          '',
          HOURS_PROMISE,
          '',
          `To sign up, scan the code on this letter or visit ${bare}. You can also call us on ${org.phone}.`,
          '',
          'Thank you for reading this, and for everything your group does for our community.',
        ),
      }
    case 'flyer':
      return { link, body: `Scan to sign up — or visit ${bare}` }
    case 'newsletter':
      return {
        link,
        body: [
          `Volunteers needed: ${c.title}.`,
          `On ${when}${where}, ${org.name} needs ${needText(c)}.`,
          opt(c.who),
          opt(perksText(c)),
          `Sign up at ${link}.`,
          'Thank you for helping the rabbits!',
        ]
          .filter(Boolean)
          .join(' '),
      }
  }
}

/* ------------------------------------------------------------ afterwards */

export interface Helper {
  email: string
  name: string
  phone: string | null
  shifts: number
  hours_here: number
  hours_year: number
  hours_all: number
  hours_token: string | null
  thanked_at: string | null
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n

/** The thank-you, with their hours — by email and as a text. */
export function thankYou(c: Call, h: Helper, org: OrgBits, hoursFor?: HoursFor | null): { subject: string; body: string; sms: string } {
  const first = firstName(h.name)
  const year = c.on_date.slice(0, 4)
  const link = h.hours_token ? `${APP_ORIGIN}/volunteer/hours/${h.hours_token}` : ''
  const more = h.hours_year > h.hours_here + 0.01
  const letterFor: Record<HoursFor, string> = {
    school: 'school',
    military: 'a military volunteer award',
    workplace: 'your workplace programme',
    community: 'community service',
    other: 'anything else',
  }
  const body = para(
    `Dear ${first},`,
    '',
    `Thank you for volunteering at ${c.title} on ${fmtDay(c.on_date)}. You gave ${fmtHours(h.hours_here)} ${h.hours_here === 1 ? 'hour' : 'hours'}${
      h.shifts > 1 ? ` across ${h.shifts} shifts` : ''
    }, and it made a real difference — to the day, and to the rabbits in our care.`,
    '',
    more
      ? `That brings your volunteer time with ${org.short} in ${year} to ${fmtHours(h.hours_year)} hours${
          h.hours_all > h.hours_year + 0.01 ? `, and ${fmtHours(h.hours_all)} hours in all` : ''
        }. Thank you for coming back again and again.`
      : null,
    '',
    link ? `You can see all your hours any time here: ${link}` : null,
    hoursFor
      ? `If you need a letter confirming your hours for ${letterFor[hoursFor]}, just reply and we’ll send one.`
      : 'If you ever need a letter confirming your hours, just reply and we’ll send one.',
    '',
    'With our thanks,',
    signature(org),
  )
  const sms = `Thank you, ${first}, for volunteering at ${c.title}! You gave ${fmtHours(h.hours_here)} hours${
    more ? ` — ${fmtHours(h.hours_year)} this year` : ''
  }.${link ? ` Your hours: ${link}` : ''} — ${org.short}`
  return { subject: `Thank you for volunteering at ${c.title}`, body, sms }
}
