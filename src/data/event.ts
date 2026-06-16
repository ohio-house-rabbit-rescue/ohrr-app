// Midwest BunFest — REAL event data from midwestbunfest.org.
// 2026 date/venue/admission are confirmed on the site; the schedule, vendors,
// partners, and sponsors reflect the 2025 program (most recent published lineup)
// and will be refreshed as the 2026 roster is announced.
import type { IconName } from '../components/icons'

export const event = {
  name: 'Midwest BunFest',
  edition: 2026,
  host: {
    name: 'Ohio House Rabbit Rescue',
    short: 'OHRR',
    url: 'https://www.ohiohouserabbitrescue.org/',
  },
  tagline: 'The largest rabbit festival & educational expo in the Eastern U.S.',
  blurb:
    'A family-friendly celebration of house rabbits — education from vets and rabbit experts, specialty vendors, a bunny spa, glamour shots, a silent auction & raffle, and rescues from across the country. All proceeds support Ohio House Rabbit Rescue.',
  date: 'Sunday, October 25, 2026',
  dateShort: 'Sun, Oct 25, 2026',
  timeLabel: '10:00 AM – 4:00 PM',
  venue: {
    name: 'The Makoy',
    address: '5462 Center St., Hilliard, OH 43026',
    city: 'Hilliard, Ohio',
    parking: 'Ample free parking in The Makoy lot.',
  },
  admission: [
    { who: 'Adults', price: '$10' },
    { who: 'Ages 5–12', price: '$5' },
    { who: 'Under 5', price: 'Free' },
  ],
  admissionNote: 'Cash or card. Buy at the door or in advance.',
  links: {
    bunfest: 'https://www.midwestbunfest.org/',
    eventInfo: 'https://www.midwestbunfest.org/event-info.html',
    tickets: 'https://www.midwestbunfest.org/purchase-tickets.html',
    map: 'https://www.midwestbunfest.org/event-map.html',
    bringingBunny: 'https://www.midwestbunfest.org/bringing-your-bunny.html',
    attendanceAgreement: 'https://www.midwestbunfest.org/rabbit-attendance-agreement.html',
    accommodations: 'https://www.midwestbunfest.org/accommodations.html',
    apparel: 'https://www.midwestbunfest.org/mwbf-apparel.html',
    facebook: 'https://www.facebook.com/MidwestBunFest/',
    ohrr: 'https://www.ohiohouserabbitrescue.org/',
  },
}

export interface Activity {
  title: string
  text: string
  icon: IconName
  url: string
}

// What happens at the festival (real activity pages on midwestbunfest.org).
export const activities: Activity[] = [
  {
    title: 'Education Sessions',
    text: 'Talks from vets and rabbit experts all day.',
    icon: 'book',
    url: 'https://www.midwestbunfest.org/special-interest-sessions.html',
  },
  {
    title: 'Bunny Spa',
    text: 'Nail trims and grooming for your rabbit.',
    icon: 'sparkles',
    url: 'https://www.midwestbunfest.org/bunny-spa.html',
  },
  {
    title: 'Glamour Shots',
    text: 'Professional photos of your bun.',
    icon: 'star',
    url: 'https://www.midwestbunfest.org/glamour-shots.html',
  },
  {
    title: 'Raffle & Silent Auction',
    text: 'Bid and win — proceeds help rabbits.',
    icon: 'ticket',
    url: 'https://www.midwestbunfest.org/raffle-and-silent-auction.html',
  },
  {
    title: 'Toymaking Workshop',
    text: 'Make an enrichment toy to take home.',
    icon: 'gift',
    url: 'https://www.midwestbunfest.org/toymaking-workshop.html',
  },
  {
    title: 'Chillaxabun Lounge',
    text: 'A calm space to relax between sessions.',
    icon: 'heart',
    url: 'https://www.midwestbunfest.org/chillaxabun-lounge.html',
  },
]
