// Ohio House Rabbit Rescue — org facts and the real links from their site
// (https://www.ohiohouserabbitrescue.org). The app is read-only + outbound:
// content deep-links to OHRR's own pages.
import type { IconName } from '../components/icons'

export const ohrr = {
  name: 'Ohio House Rabbit Rescue',
  short: 'OHRR',
  tagline: 'Ohio’s first adoption center just for rabbits — rescuing, rehoming, and teaching better bunny care.',
  ein: '27-0830606',
  founded: 2009,
  address: '5485 N. High Street, Columbus, OH 43214',
  phone: '614-263-8557',
  phoneHref: 'tel:+16142638557',
  hours: 'Sat & Sun, 12–4 PM · by appointment',
  links: {
    site: 'https://www.ohiohouserabbitrescue.org/',
    adopt: 'https://www.ohiohouserabbitrescue.org/adopt/',
    adoptable: 'https://www.ohiohouserabbitrescue.org/adopt/adoptable-bunnies/',
    application: 'https://www.ohiohouserabbitrescue.org/adopt/adoption-application/',
    policy: 'https://www.ohiohouserabbitrescue.org/wp-content/uploads/2025/09/Adoption-Policy.pdf',
    process: 'https://www.ohiohouserabbitrescue.org/adoption-process-for-ohrr/',
    learn: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/',
    diet: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/bunny-diet/',
    living: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/bunny-living-space/',
    foods: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/foods-to-avoid/',
    resources: 'https://www.ohiohouserabbitrescue.org/rabbit-care/resources/',
    vets: 'https://www.ohiohouserabbitrescue.org/rabbit-care/vets/',
    stray: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/tips-for-catching-a-stray/',
    volunteer: 'https://www.ohiohouserabbitrescue.org/support-ohrr/volunteer/',
    support: 'https://www.ohiohouserabbitrescue.org/i-want-to-support/',
    about: 'https://www.ohiohouserabbitrescue.org/about-us/',
    mission: 'https://www.ohiohouserabbitrescue.org/about-us/mission-and-vision/',
    background: 'https://www.ohiohouserabbitrescue.org/about-us/background/',
    contact: 'https://www.ohiohouserabbitrescue.org/contact/',
    admissions: 'https://www.ohiohouserabbitrescue.org/about-us/admissions/',
    events: 'https://www.ohiohouserabbitrescue.org/events/',
    facebook: 'https://www.facebook.com/ohiohouserabbitrescue/',
  },
}

export interface LinkCard {
  title: string
  description: string
  url: string
  icon: IconName
}

// Adoption requirements (from OHRR's adoption policy / org profile).
export const adoptRequirements = [
  'Rabbits live indoors — never outdoors.',
  'A minimum 4×4 ft space, or free-range in the home.',
  'Fed unlimited hay, quality pellets, and a daily salad.',
  'All OHRR rabbits are spayed/neutered and vaccinated before adoption.',
]

export const adoptLinks: LinkCard[] = [
  { title: 'Meet Adoptable Bunnies', description: 'Browse rabbits currently looking for homes.', url: ohrr.links.adoptable, icon: 'heart' },
  { title: 'Adoption Process', description: 'How adoption works, step by step.', url: ohrr.links.process, icon: 'info' },
  { title: 'Adoption Application', description: 'Ready to adopt? Start your application.', url: ohrr.links.application, icon: 'book' },
  { title: 'Adoption Policy', description: 'Requirements and what to expect (PDF).', url: ohrr.links.policy, icon: 'external' },
]

// Rabbit-care learning topics.
export const learnLinks: LinkCard[] = [
  { title: 'Bunny Diet', description: 'Hay, pellets, and safe daily greens.', url: ohrr.links.diet, icon: 'book' },
  { title: 'Bunny Living Space', description: 'Indoor setups, free-range & bunny-proofing.', url: ohrr.links.living, icon: 'home' },
  { title: 'Foods to Avoid', description: 'What’s dangerous for rabbits.', url: ohrr.links.foods, icon: 'info' },
  { title: 'Bunny Care Resources', description: 'Bonding, litter training, and more guides.', url: ohrr.links.resources, icon: 'book' },
  { title: 'Rabbit-Savvy Vets', description: 'Find a vet experienced with rabbits.', url: ohrr.links.vets, icon: 'phone' },
  { title: 'Caught a Stray Rabbit?', description: 'Tips for catching and helping strays.', url: ohrr.links.stray, icon: 'mappin' },
]
