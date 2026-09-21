// "Found a rabbit? / Need to surrender?" — the quick-action version of OHRR's
// Tips for Catching a Stray page, the field-rescue path, and the Admissions
// facts. Verbatim / faithfully condensed from ohiohouserabbitrescue.org
// (captured 2026-09-17). The full stray article lives in Learn.
import { ohrr } from './ohrr'
import { CHRS_HELP_LINE_EMAIL } from './volunteer'

export const foundContacts = {
  chrsHelpLine: CHRS_HELP_LINE_EMAIL,
  ohrrEmail: ohrr.email,
  ohrrPhone: ohrr.phone,
  ohrrPhoneHref: ohrr.phoneHref,
  facebookGroup: 'Columbus Rabbit Field Rescue',
}

export const wildOrDomestic = {
  heading: 'Domestic or wild?',
  text: 'The first thing to do is figure out if the rabbit is wild or domestic. If the rabbit does not look like a wild cottontail, it is a domestic rabbit — and it needs your help, because it does not possess the means for survival in the wild. Occasionally a domestic rabbit escapes an outdoor enclosure, but in most cases domestic rabbits are found outdoors after being intentionally “set free” by their previous owner.',
  wildNote: 'If you need help with a wild rabbit that may be injured or in danger, please contact the Ohio Wildlife Center.',
  wildUrl: ohrr.links.ohioWildlifeCenter,
}

// What to report when you contact a rescue (verbatim list).
export const reportDetails = [
  'The location of the rabbit',
  'The time of day you saw the rabbit',
  'How long you have seen the rabbit (days, weeks, etc.)',
  'The color and approximate size of the rabbit',
]

// Condensed steps from "Catching a Stray Rabbit".
export const catchSteps: { title: string; text: string }[] = [
  {
    title: 'Keep the rabbit coming back',
    text: 'Leave water and food where you saw the rabbit — green leaf or romaine lettuce with a few baby carrots or slices of banana — and refresh it daily. Rabbits are creatures of habit and will keep a daily routine as long as food and water are available along their route.',
  },
  {
    title: 'Try early morning or late evening',
    text: 'That’s when rabbits are most active. If you don’t see the rabbit, look under porches, cars, etc. — they hide and rest most of the day.',
  },
  {
    title: 'Judge how skittish it is',
    text: 'If the rabbit lets you within a couple of feet, try tossing a large box or laundry basket over it. If it runs when you get within 10 feet, use exercise pens: encircle it when it’s cornered or under an object, or set pens in a half circle at least 10 feet away and coax it in, then close the gap quickly. Be patient — a rabbit is easier to catch once it associates you with food.',
  },
  {
    title: 'Go easy on live traps',
    text: 'They are often unsuccessful and must be checked at least twice daily — volunteers usually catch opossums and raccoons instead. If you use one, put it in the shade out of plain sight and line it with hay, lettuce and treats, and be ready to safely release any wildlife.',
  },
  {
    title: 'Contain it safely',
    text: 'Have a pet carrier or crate ready, lined with newspaper or an old towel so the rabbit doesn’t slip. Then contact your local rabbit rescue or Humane Society for care advice and to arrange the surrender.',
  },
]

export const babiesWarning =
  'Multiple rabbits of opposite genders may be abandoned at once, or a nest of domestic babies may be found. Handle these with extreme care — babies cannot survive without their mother and should never be rescued without their mom.'

// The field-rescue path (from the Volunteer page's Bunny Field Rescuer section).
export const fieldRescue = {
  text: 'OHRR’s volunteers rescue many of the bunnies at the Adoption Center. In Columbus, stray reports are coordinated through the CHRS Help Line and the Columbus Rabbit Field Rescue Facebook group, where reports of stray bunnies are shared and rescue efforts are coordinated. Individuals may request to join the group, and membership requests will be reviewed by the group admins.',
}

// Admissions facts (verbatim from the Admissions page).
export const admissions = {
  intro:
    'Ohio House Rabbit Rescue, Inc. is a restricted admissions organization. If space is available, Ohio House Rabbit Rescue will accept rabbits that have been rescued by Ohio House Rabbit Rescue staff or volunteers and rabbits rescued and then surrendered by a Good Samaritan. A very limited space will be dedicated to rabbits surrendered by their owners.',
  noSpace:
    'If it is determined that Ohio House Rabbit Rescue does not have the space to admit the rabbit, then Ohio House Rabbit Rescue will offer a list of other organizations, with contact information that may accept the rabbit. Additionally, Ohio House Rabbit Rescue will utilize a waiting list option.',
  funding:
    'Ohio House Rabbit Rescue, Inc is a private, nonprofit rabbit rescue organization and does not receive any tax dollars from the city or any government agency.',
  contactFirst:
    'If you are considering bringing a rabbit to Ohio House Rabbit Rescue for possible intake, contact Ohio House Rabbit Rescue to see if space is available.',
  policyUrl: ohrr.links.admissionsPolicyPdf,
  surrenderPolicyUrl: ohrr.links.surrenderPolicyPdf,
  forms: [
    {
      title: 'Good Samaritan Rescue/Surrender & Relinquishment application',
      text: 'If you need to surrender a rabbit that you have rescued.',
      url: '/surrender/form?type=good-samaritan',
    },
    {
      title: 'Owner Surrender & Relinquishment application',
      text: 'If you need to surrender a rabbit that you own.',
      url: '/surrender/form?type=owner',
    },
  ],
}
