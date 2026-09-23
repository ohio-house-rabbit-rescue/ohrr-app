// Ready-to-send outreach letters — the email a volunteer sends to a campus
// office, a vet clinic, a pet store, a school, a property manager or a
// newsletter editor to get OHRR in front of the people it is missing. Every
// fact comes from OHRR's own pages (volunteer rules, hours, address, the
// education pages); the sender only adds their name and who it is for.
// Links are UTM-tagged so the analytics show which letters bring people in.
import { ohrr } from '../../data/ohrr'
import { OHRR_CONTACT_EMAIL } from '../../data/volunteer'
import { SHARE_SITE, utm } from './templates'

export interface OutreachLetter {
  id: string
  /** who it goes to */
  audience: string
  /** one line on when to send it */
  when: string
  subject: string
  /** {{sender}} and {{org}} are filled in; {{link}} is the tagged page link */
  body: string
  path: string
  campaign: string
}

const SIGN = `{{sender}}
Ohio House Rabbit Rescue (volunteer)
${ohrr.address}
${OHRR_CONTACT_EMAIL}
${SHARE_SITE}`

export const OUTREACH: OutreachLetter[] = [
  {
    id: 'campus',
    audience: 'Student organisations, service-learning and campus volunteer offices',
    when: 'Start of each term, and before service-hour deadlines',
    subject: 'Volunteer hours with the rabbits — one hour at a time',
    body: `Hello {{org}},

I volunteer with Ohio House Rabbit Rescue, Ohio's adoption center just for rabbits, in Clintonville (${ohrr.addressLine1}, Columbus). We are looking for students who would like to help — and we can keep it small.

Bunny socialization: one-hour shifts sitting with rabbits who need to learn to trust people again. Shifts are booked online, up to two a month per person, no experience needed, and they count for service hours — we issue a signed service-hours letter from our records.

Foster: a few weeks with a rabbit in your home while it recovers or settles, with OHRR arranging the vet care and a team member a message away.

Online: students who are good with Instagram, TikTok or short video can post for the rescue from ready-made material — real experience for a portfolio.

Group visits are welcome too; we schedule them by email.

Could you share this with your members, or point me to the right place to list it? Everything is here: {{link}}

Thank you,
${SIGN}`,
    path: '/volunteer',
    campaign: 'outreach-campus',
  },
  {
    id: 'vet',
    audience: 'Veterinary clinics (rabbit-savvy or not)',
    when: 'Any time; again when the vet directory changes',
    subject: 'A rabbit-care resource for your clients — from Ohio House Rabbit Rescue',
    body: `Hello {{org}},

I volunteer with Ohio House Rabbit Rescue, Ohio's adoption center just for rabbits, in Clintonville. Many rabbit owners around Central Ohio never find a rabbit-savvy vet until something goes wrong, so we built a free app and website that lists the clinics that see rabbits, answers "my bunny is…" questions from OHRR's care pages, and reminds owners about nail trims, hay and RHDV2 boosters.

Two small asks:
1. Could we leave a one-page flyer for your reception or waiting room? It is a QR code to the app — nothing to sell.
2. If you see rabbits, may we list your clinic (or check the details we have)? Our directory is here: {{link}}

Thank you for caring for the bunnies,
${SIGN}`,
    path: '/learn/vets',
    campaign: 'outreach-vet',
  },
  {
    id: 'store',
    audience: 'Pet stores, feed stores and garden centres',
    when: 'February and March, before Easter',
    subject: 'Before Easter — a one-page "Is a rabbit right for us?" for your customers',
    body: `Hello {{org}},

I volunteer with Ohio House Rabbit Rescue in Columbus. Every spring, rescues across Ohio fill up with rabbits bought in March and given up by summer. Most of those families simply did not know that a rabbit is a ten-year, indoor, spayed-or-neutered pet with its own vet needs.

We have a plain one-page guide for families who are thinking about it — "Is a rabbit right for us?" — and a flyer with a QR code to it. Could we leave a small stack by your rabbit supplies or at the register from February to April? Nothing to sell, and it helps the families who go ahead to do it well.

The page is here: {{link}}

Thank you,
${SIGN}`,
    path: '/info/is-a-rabbit-right-for-us',
    campaign: 'outreach-store',
  },
  {
    id: 'school',
    audience: 'Schools, libraries, scouts and youth groups',
    when: 'Before a term or a summer programme',
    subject: 'A group visit to sit with the rabbits',
    body: `Hello {{org}},

I volunteer with Ohio House Rabbit Rescue, Ohio's adoption center just for rabbits, in Clintonville (${ohrr.addressLine1}, Columbus). Bunny socialization — sitting quietly with a rabbit so it learns to trust people — is open to groups, and it works well for children.

How it works: visits are one hour, at the Adoption Center. Children from age six can take part; children ten and under come with an adult, and the adult takes part too. Quiet hands, fifteen minutes with each bunny.

If you would like to bring a group, reply to this email or write to ${OHRR_CONTACT_EMAIL} and we will find a date. More about volunteering with OHRR: {{link}}

Thank you,
${SIGN}`,
    path: '/volunteer',
    campaign: 'outreach-school',
  },
  {
    id: 'apartments',
    audience: 'Property managers and apartment communities',
    when: 'Any time; leasing season (spring–summer)',
    subject: 'A quiet, indoor pet for your residents — rabbits, and where to adopt one',
    body: `Hello {{org}},

I volunteer with Ohio House Rabbit Rescue, Ohio's adoption center just for rabbits, in Clintonville. Rabbits are quiet, litter-trained indoor pets that suit apartments and renters well — and we hear from residents who never thought a rescue rabbit was an option.

We have a short page written for renters and students — why rabbits suit a small home, what they need, and where to start: {{link}}

Would you consider including it in a welcome packet or resident newsletter, or letting us leave a flyer at the leasing office? Happy to answer any pet-policy questions about rabbits.

Thank you,
${SIGN}`,
    path: '/info/rabbits-for-renters-and-students',
    campaign: 'outreach-apartments',
  },
  {
    id: 'media',
    audience: 'Community newsletters, neighbourhood groups and local media',
    when: 'Ahead of Midwest BunFest, adoption events and Easter',
    subject: 'Ohio House Rabbit Rescue — events and stories for your readers',
    body: `Hello {{org}},

I volunteer with Ohio House Rabbit Rescue, Ohio's adoption center just for rabbits, in Clintonville. We would love to be on your list for community events and animal stories: adoption weekends, nail-trim clinics, bonding dates, and Midwest BunFest, our annual rabbit expo.

Our events are always current here: {{link}}

For photos, interviews or a calendar listing, our media contact is ${ohrr.mediaEmail}.

Thank you,
${SIGN}`,
    path: '/events',
    campaign: 'outreach-media',
  },
]

export function fillLetter(l: OutreachLetter, sender: string, org: string): { subject: string; body: string; link: string } {
  const link = utm(l.path, l.campaign, 'email')
  const body = l.body
    .replace(/\{\{sender\}\}/g, sender.trim() || 'A volunteer')
    .replace(/\{\{org\}\}/g, org.trim() || 'there')
    .replace(/\{\{link\}\}/g, link)
  return { subject: l.subject, body, link }
}

export function mailtoFor(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
