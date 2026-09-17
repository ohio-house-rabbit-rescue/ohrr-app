// OHRR volunteer program — the four REAL positions from
// https://ohiohouserabbitrescue.org/support-ohrr/volunteer/ (captured
// 2026-09-17; summaries and requirements verbatim), the "other volunteer needs"
// list, and the group-visit note. Each position also seeds one row into the
// shared `volunteer_opportunities` table (category = slug) via
// supabase/migrations/*_seed_live_site_content.sql, generated from this file.
import type { IconName } from '../components/icons'

export type VolunteerSlug = 'socialization' | 'buncare' | 'vet-transport' | 'field-rescue'

export interface SignupAction {
  label: string
  href: string
  /** shown under the button */
  note?: string
}

export interface VolunteerWay {
  slug: VolunteerSlug
  title: string
  code: string // stable role code carried into every in-app sign-up (e.g. "BUNCARE")
  icon: IconName
  tagline: string // short line for the cards
  summary: string // verbatim "Summary:" from the live site
  requirements: string[] // verbatim "Requirements:" bullets
  location: string
  locationDetail?: string[]
  commitment: string // quick chip, e.g. time ask
  /** the real sign-up action(s) from the live site */
  signup: SignupAction[]
  /** extra notes shown under the sign-up (verbatim) */
  notes?: string[]
}

export const OHRR_CONTACT_EMAIL = 'ohrrcontact@ohiohouserabbitrescue.org'
export const CHRS_HELP_LINE_EMAIL = 'chrstipline@gmail.com'

// Role code used when someone signs up generally (not via a specific way).
export const GENERAL_ROLE = { title: 'General volunteer', code: 'GENERAL' }

export const volunteerIntro =
  'Ohio House Rabbit Rescue has many volunteer opportunities. Whether you want to get up close and personal with the bunnies or would prefer to work behind the scenes, we have an opportunity for you! Some volunteers come to us knowing everything about bunnies and some start off with OHRR knowing nothing at all. We welcome volunteers of all ages and backgrounds.'

export const volunteerWays: VolunteerWay[] = [
  {
    slug: 'socialization',
    title: 'Bunny Socialization',
    code: 'SOCIALIZE',
    icon: 'heart',
    tagline: 'Sit in with the bunnies and help them learn to trust people again.',
    summary:
      'Many of our bunnies come from situations where they experienced little human contact or were mistreated by humans. The bunnies need to learn to trust people again. This is where you come in! We need volunteers to sit in with the bunnies and help get them ready for adoption. To allow the maximum amount of people to volunteer, please sign up for NO MORE than two 1-hour socialization shifts PER MONTH. Additional hours for service credit are not available at this time.',
    requirements: [
      'Must be at least 6 years old. Children 10 and under must be accompanied by an adult.',
      'Ability to focus on and interact with individual bunnies in 15-minute intervals',
      'If you are a parent accompanying a child, you must sign up for a volunteer slot also. Because of COVID, we must account for all people in the building.',
    ],
    location: 'OHRR Adoption Center',
    commitment: '1-hour shifts · no more than two per month',
    signup: [{ label: 'Sign up for Bunny Socialization', href: 'http://signup.com/go/35ayZe' }],
    notes: [
      `This opportunity is open to groups. If you’re interested in scheduling a group visit, please contact us at ${OHRR_CONTACT_EMAIL}.`,
    ],
  },
  {
    slug: 'buncare',
    title: 'Buncare Volunteer',
    code: 'BUNCARE',
    icon: 'home',
    tagline: 'Keep the bunnies happy and healthy — cleaning, feeding, pens and litter boxes.',
    summary:
      'Buncare volunteers help keep our bunnies happy and healthy. As a Buncare volunteer you will be sweeping/cleaning, feeding pellets and hay, expanding/unexpanding pens, changing litter boxes and much more.',
    requirements: [
      'Must be at least 18 years old',
      'Must be dependable and trustworthy',
      'Must be willing to volunteer for at least two hours every two weeks for at least a year',
      'Must have volunteered for Bunny Socialization at least twice, and the two visits must have occurred on two separate days',
      `Must have completed the 2-hour Buncare Orientation. To sign up for Buncare Orientation, please send an email to Bev at ${OHRR_CONTACT_EMAIL}. She will connect with you to find a convenient time for you to complete the 2-hour Buncare Orientation.`,
    ],
    location: 'OHRR Adoption Center',
    commitment: '2 hours every two weeks · at least a year',
    signup: [
      {
        label: 'Sign up for a Buncare shift',
        href: 'http://signup.com/go/WuT2xR',
        note: 'Once you have successfully met the requirements. Please sign up at least two hours before your shift so that we can ensure someone is at the Adoption Center to let you in.',
      },
      {
        label: 'Email Bev for Buncare Orientation',
        href: `mailto:${OHRR_CONTACT_EMAIL}?subject=Buncare%20Orientation`,
      },
    ],
    notes: [
      'If you are volunteering at OHRR to earn service hours, you can earn those hours by volunteering to socialize — please do not sign up for Buncare to earn service hours.',
    ],
  },
  {
    slug: 'vet-transport',
    title: 'Vet Delivery & Pick-up',
    code: 'VET-TRANSPORT',
    icon: 'mappin',
    tagline: 'Drive bunnies between the Adoption Center and the vet — mornings, evenings, or both.',
    summary:
      'Our bunnies visit the vet frequently for checkups, spays/neuters, etc. We need volunteers that are willing to pick up bunnies from the Adoption Center in the morning to drop them off at the vet and/or pick them up from the vet in the evening and return them to the Adoption Center. The bunnies typically stay at the vet the entire day, so you can sign up for drop-off shifts in the morning, pick-up shifts in the evening, or both. Volunteer as your schedule allows!',
    requirements: [
      'Must have a car and valid driver’s license',
      'Must have volunteered for bunny socialization at least twice or participated in “interview” at the Adoption Center',
    ],
    location: 'OHRR Adoption Center ↔ Norton Road Veterinary Hospital or MedVet Hilliard',
    locationDetail: [
      'Deliveries (typically in the morning): Bunnies are picked up from the OHRR Adoption Center and delivered to Norton Road Veterinary Hospital or MedVet Hilliard. The vet will vary and depend on the needs of the bunny.',
      'Pick-Ups (typically in the evening): Bunnies are picked up from either Norton Road Veterinary Hospital or MedVet Hilliard. They are then taken back to the OHRR Adoption Center.',
    ],
    commitment: 'As your schedule allows',
    signup: [
      {
        label: 'Email to sign up for vet delivery or pick-up',
        href: `mailto:${OHRR_CONTACT_EMAIL}?subject=Vet%20Delivery%20%26%20Pick-up%20volunteer`,
        note: 'We will add you to our email thread for future veterinary appointment needs.',
      },
    ],
  },
  {
    slug: 'field-rescue',
    title: 'Bunny Field Rescuer',
    code: 'FIELD-RESCUE',
    icon: 'users',
    tagline: 'On-call rescue of domestic bunnies abandoned outdoors, typically in Columbus.',
    summary:
      'Many of the bunnies at our Adoption Center are rescued by our volunteers. We get many calls or emails throughout the year about domestic bunnies that have been abandoned outdoors and need rescuing. This is an on-call volunteer position that allows you to help out as your schedule allows. There are weeks where our volunteers rescue a bunny almost every day and months where volunteers have no field rescues at all. In this position, we are looking for volunteers to respond as needed. No training is required, you will learn what you need to know at your first volunteer shift.',
    requirements: [
      'This is an outdoor volunteer position. Please be willing to be outdoors for extended periods of time, exposed to whatever the elements may be.',
      'This is an active volunteer position. It may occasionally involve running, climbing, crawling, etc. Please be honest with yourself and those you are volunteering with in regards to your limits.',
      'Must have a car and valid driver’s license',
      'Must be at least 18 years old',
    ],
    location: 'Varies (typically in the city of Columbus)',
    commitment: 'On call · as your schedule allows',
    signup: [
      {
        label: 'Email the CHRS Help Line to join',
        href: `mailto:${CHRS_HELP_LINE_EMAIL}?subject=Columbus%20Rabbit%20Field%20Rescue%20Group`,
        note: 'Ask to be added to the Columbus Rabbit Field Rescue Group.',
      },
    ],
    notes: [
      'If you are on Facebook, Columbus Rabbit Field Rescue is a Facebook group where reports of stray bunnies are shared and rescue efforts are coordinated. Individuals may request to join the group, and membership requests will be reviewed by the group admins.',
    ],
  },
]

export function findWay(slug?: string): VolunteerWay | undefined {
  return volunteerWays.find((w) => w.slug === slug)
}

// "Other Volunteer Needs" — verbatim list; each taps into the in-app interest
// form (role = the need), and the live site's "contact us" email is shown too.
export const otherVolunteerNeeds: string[] = [
  'Event & Fundraising Volunteer',
  'Graphic Designer',
  'Adoption Coordinator',
  'Hop Shop Volunteer',
  'Veterinary Care',
  'Photographer',
  'Web Designer',
  'Grant Writer',
  'Marketing',
]

export const otherNeedsNote =
  'Please contact us if you would like more information on any of the above opportunities or think you may be able to help OHRR in any other way!'

export const groupVisitNote = `Bunny Socialization is open to groups. If you’re interested in scheduling a group visit, please contact us at ${OHRR_CONTACT_EMAIL}.`
