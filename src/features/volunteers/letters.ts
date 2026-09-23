// Hours letters, written from the record.
//
// Volunteers need proof of their hours for different people: a school giving
// credit, a commander putting a service member forward for the Military
// Outstanding Volunteer Service Medal, an employer's volunteer-grant
// programme, or just "to whom it may concern". Each letter here is built from
// the volunteer's details and the hours recorded on the day they were given —
// nothing is typed, so nothing is guessed — and every one of them thanks the
// volunteer.
//
// The letter says what OHRR can vouch for (who, how many hours, when, doing
// what) and no more: an award or credit is always the other side's decision.
// It names the person rather than guessing their pronouns.
//
// Plain TypeScript with no app imports: the website keeps a copy.
import { fmtHours, type OrgBits } from './calls'

export type LetterKind = 'school' | 'military' | 'workplace' | 'general' | 'certificate'

export const LETTER_KINDS: { value: LetterKind; label: string; hint: string; ask: { key: string; label: string; placeholder?: string }[] }[] = [
  {
    value: 'school',
    label: 'School or college credit',
    hint: 'For a teacher, counselor or service-learning office.',
    ask: [
      { key: 'school', label: 'School', placeholder: 'Dublin Jerome High School' },
      { key: 'recipient', label: 'Addressed to (optional)', placeholder: 'Ms. Patel, school counselor' },
    ],
  },
  {
    value: 'military',
    label: 'Military volunteer service',
    hint: 'For the service member’s command — e.g. the Military Outstanding Volunteer Service Medal.',
    ask: [
      { key: 'rank', label: 'Rank (optional)', placeholder: 'SSG' },
      { key: 'branch', label: 'Branch', placeholder: 'U.S. Army' },
      { key: 'unit', label: 'Unit (optional)', placeholder: '1st Battalion, 145th Armor Regiment' },
      { key: 'recipient', label: 'Addressed to (optional)', placeholder: 'Commanding Officer' },
    ],
  },
  {
    value: 'workplace',
    label: 'Workplace volunteer programme',
    hint: 'For an employer’s volunteer-hours or matching-grant programme.',
    ask: [
      { key: 'employer', label: 'Employer', placeholder: 'Nationwide' },
      { key: 'recipient', label: 'Addressed to (optional)', placeholder: 'Community Giving team' },
    ],
  },
  { value: 'general', label: 'Anyone else', hint: '“To whom it may concern” — court, a scholarship, a job application.', ask: [{ key: 'recipient', label: 'Addressed to (optional)' }] },
  { value: 'certificate', label: 'Certificate of appreciation', hint: 'A thank-you to frame — lovely for young volunteers.', ask: [] },
]

export interface HoursLine {
  on_date: string
  activity: string
  hours: number
}

export interface LetterInput {
  kind: LetterKind
  name: string
  details: Record<string, string>
  from: string
  to: string
  lines: HoursLine[]
  org: OrgBits & { ein?: string }
  /** "September 23, 2026" */
  today: string
}

export interface Letter {
  title: string
  /** The address block, top left. */
  recipient: string[]
  salutation: string
  paragraphs: string[]
  /** Show the dated list of hours. */
  table: boolean
  total: number
  days: number
  closing: string
  signer: { name: string; title: string; missing: boolean }
  footer: string
}

/** "2026-10-25" → "October 25, 2026" */
export function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "Midwest BunFest (1 day), bunny socialization (6 days) and Buncare (4 days)" */
function activities(lines: HoursLine[]): string {
  const byActivity = new Map<string, Set<string>>()
  for (const l of lines) {
    const k = l.activity.replace(/\s*\(volunteer call\)$/i, '').trim() || 'volunteering'
    if (!byActivity.has(k)) byActivity.set(k, new Set())
    byActivity.get(k)!.add(l.on_date)
  }
  const parts = [...byActivity.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([k, days]) => `${k} (${days.size} ${days.size === 1 ? 'day' : 'days'})`)
  if (parts.length <= 1) return parts[0] ?? 'volunteering'
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** Whole months from the first recorded day to the last, for "over N months". */
function monthsSpanned(lines: HoursLine[]): number {
  if (lines.length === 0) return 0
  const ds = lines.map((l) => l.on_date).sort()
  const [y1, m1] = ds[0].split('-').map(Number)
  const [y2, m2] = ds[ds.length - 1].split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1) + 1
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || n
const lastName = (n: string) => {
  const p = n.trim().split(/\s+/)
  return p[p.length - 1] || n
}

export function buildLetter(i: LetterInput): Letter {
  const total = i.lines.reduce((s, l) => s + l.hours, 0)
  const days = new Set(i.lines.map((l) => l.on_date)).size
  const months = monthsSpanned(i.lines)
  const H = `${fmtHours(total)} ${total === 1 ? 'hour' : 'hours'}`
  const period = `between ${longDate(i.from)} and ${longDate(i.to)}`
  const first = firstName(i.name)
  const d = i.details
  const org = i.org.name
  const about = `${org} is a nonprofit organization${i.org.ein ? ` (EIN ${i.org.ein})` : ''} in Columbus, Ohio, that rescues abandoned rabbits, finds them homes through an adoption center just for rabbits, and teaches the public how to care for them.`
  const recorded = 'Each hour listed was recorded on the day it was given.'
  const contact = `Please contact me at ${i.org.phone} or ${i.org.email} if you need anything further.`
  const signer = {
    name: i.org.signerName.trim(),
    title: i.org.signerTitle.trim(),
    missing: !i.org.signerName.trim(),
  }
  const footer = [org, i.org.address, i.org.phone, i.org.email].filter(Boolean).join(' · ')
  const who = (d.recipient ?? '').trim()

  switch (i.kind) {
    case 'school':
      return {
        title: 'Confirmation of volunteer service hours',
        recipient: [who, d.school].filter(Boolean),
        salutation: who ? `Dear ${who.split(',')[0]},` : 'To whom it may concern:',
        paragraphs: [
          `This letter confirms that ${i.name}${d.school ? `, a student at ${d.school},` : ''} volunteered ${H} with ${org} ${period}, on ${days} separate ${days === 1 ? 'day' : 'days'}.`,
          `${first}’s service included ${activities(i.lines)}. ${recorded}`,
          about,
          `Thank you for encouraging ${first} to serve. We are grateful for the time and care ${first} gave to the rabbits in our care, and we would welcome ${first} back any time. ${contact}`,
        ],
        table: true,
        total,
        days,
        closing: 'With thanks,',
        signer,
        footer,
      }
    case 'military': {
      const rank = (d.rank ?? '').trim()
      const formal = [rank, i.name].filter(Boolean).join(' ')
      const short = rank ? `${rank} ${lastName(i.name)}` : i.name
      return {
        title: 'Verification of volunteer service',
        recipient: [who || 'Commanding Officer', d.unit, d.branch].filter(Boolean),
        salutation: `Dear ${(who || 'Commanding Officer').split(',')[0]},`,
        paragraphs: [
          `This letter verifies the volunteer service of ${formal}${d.branch ? `, ${d.branch},` : ''} with ${org}, a nonprofit organization serving the civilian community in Central Ohio.`,
          `${period.charAt(0).toUpperCase() + period.slice(1)}, ${short} volunteered ${H} on ${days} separate ${days === 1 ? 'day' : 'days'}${
            months > 1 ? ` over ${months} months` : ''
          }. The service was voluntary and unpaid, and it benefited the civilian community.`,
          `${short}’s service included ${activities(i.lines)}. ${recorded}`,
          about,
          `We understand this record may support an application for recognition such as the Military Outstanding Volunteer Service Medal. The decision on any award rests with the command; we are glad to answer any questions. ${contact}`,
          `On behalf of everyone at ${org}, thank you to ${short} for giving so generously of their time — in addition to serving our country.`,
        ],
        table: true,
        total,
        days,
        closing: 'With gratitude,',
        signer,
        footer,
      }
    }
    case 'workplace':
      return {
        title: 'Confirmation of volunteer hours',
        recipient: [who, d.employer].filter(Boolean),
        salutation: who ? `Dear ${who.split(',')[0]},` : 'To whom it may concern:',
        paragraphs: [
          `This letter confirms that ${i.name}${d.employer ? ` of ${d.employer}` : ''} volunteered ${H} with ${org} ${period}, on ${days} separate ${days === 1 ? 'day' : 'days'}.`,
          `${first}’s service included ${activities(i.lines)}. ${recorded}`,
          about,
          `Thank you for supporting ${first}’s volunteering — and thank you, ${first}, for the time and care given to the rabbits in our care. ${contact}`,
        ],
        table: true,
        total,
        days,
        closing: 'With thanks,',
        signer,
        footer,
      }
    case 'general':
      return {
        title: 'Confirmation of volunteer service',
        recipient: who ? [who] : [],
        salutation: who ? `Dear ${who.split(',')[0]},` : 'To whom it may concern:',
        paragraphs: [
          `This letter confirms that ${i.name} volunteered ${H} with ${org} ${period}, on ${days} separate ${days === 1 ? 'day' : 'days'}.`,
          `${first}’s service included ${activities(i.lines)}. ${recorded}`,
          about,
          `We are grateful to ${first} for giving time so generously — the rabbits in our care are better off for it. ${contact}`,
        ],
        table: true,
        total,
        days,
        closing: 'With thanks,',
        signer,
        footer,
      }
    case 'certificate':
      return {
        title: 'Certificate of Appreciation',
        recipient: [],
        salutation: '',
        paragraphs: [
          `Presented to ${i.name}`,
          `in grateful recognition of ${H} of volunteer service to the rabbits of ${org}, ${period}.`,
          `Thank you, ${first}, for your kindness, your time and your care.`,
        ],
        table: false,
        total,
        days,
        closing: '',
        signer,
        footer,
      }
  }
}

/** The same letter as plain text, for email. */
export function letterText(l: Letter, i: LetterInput): string {
  const out: string[] = [i.today, '']
  if (l.recipient.length) out.push(...l.recipient, '')
  out.push(l.title.toUpperCase(), '')
  if (l.salutation) out.push(l.salutation, '')
  for (const p of l.paragraphs) out.push(p, '')
  if (l.table) {
    for (const x of [...i.lines].sort((a, b) => a.on_date.localeCompare(b.on_date)))
      out.push(`${longDate(x.on_date)} — ${x.activity.replace(/\s*\(volunteer call\)$/i, '')} — ${fmtHours(x.hours)} h`)
    out.push(`Total: ${fmtHours(l.total)} hours`, '')
  }
  if (l.closing) out.push(l.closing)
  out.push(l.signer.name || '[name]', l.signer.title || '[title]', l.footer)
  return out.join('\n')
}
