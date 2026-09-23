// Rabbit rescues and humane organizations partnered with OHRR (and Midwest
// BunFest). Contact details (phone/email/address/city/state) were researched
// from each org's own public website on 2026-06-18; fields left undefined are
// ones the org doesn't clearly publish (we don't guess). The directory is built
// to grow nationwide so anyone can find a rescue near them through OHRR.

export interface Partner {
  id: string
  name: string
  location: string // human-readable label for cards
  city?: string
  state?: string // 2-letter
  region?: string // Midwest | Northeast | South | West
  phone?: string
  email?: string
  address?: string
  url?: string
  host?: boolean
  /** At this year's BunFest. Only set from the live directory. */
  atBunfest?: boolean
}

// Display order for the region filter (only regions present are shown).
export const REGIONS = ['Midwest', 'Northeast', 'South', 'West'] as const

// Abbreviation → full state name, so searching either ("OH" or "Ohio") works.
export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington DC',
}

export const partners: Partner[] = [
  {
    id: 'ohrr',
    name: 'Ohio House Rabbit Rescue',
    location: 'Columbus, OH',
    city: 'Columbus',
    state: 'OH',
    region: 'Midwest',
    phone: '614-263-8557',
    email: 'ohrrcontact@ohiohouserabbitrescue.org',
    address: '5485 N. High Street, Columbus, OH 43214',
    url: 'https://www.ohiohouserabbitrescue.org/',
    host: true,
  },
  { id: 'p1', name: 'A Home for EveryBunny', location: 'Iowa', state: 'IA', region: 'Midwest', url: 'https://www.iowarabbitrescue.org' },
  { id: 'p2', name: 'Buckeye House Rabbit Society', location: 'Ohio · since 1997', state: 'OH', region: 'Midwest', url: 'https://www.ohare.org/wordpress' },
  { id: 'p3', name: 'Bunnies on Board', location: 'Animal transport', url: 'https://www.facebook.com/bunniesonboard' },
  {
    id: 'p4',
    name: 'Columbus House Rabbit Society',
    location: 'Westerville, OH',
    city: 'Westerville',
    state: 'OH',
    region: 'Midwest',
    address: 'PO Box 2863, Westerville, OH 43086',
    url: 'https://www.columbusrabbit.org',
  },
  {
    id: 'p5',
    name: 'Columbus Humane',
    location: 'Hilliard, OH · since 1883',
    city: 'Hilliard',
    state: 'OH',
    region: 'Midwest',
    phone: '614-777-7387',
    email: 'questions@columbushumane.org',
    address: '3015 Scioto Darby Executive Ct, Hilliard, OH 43026',
    url: 'https://www.columbushumane.org',
  },
  { id: 'p6', name: 'Destiny’s Safe Haven Inc.', location: 'West Virginia', state: 'WV', region: 'South', url: 'https://www.destinyssafehaven.com' },
  { id: 'p7', name: 'Dolly’s Dream Home Rabbit Rescue', location: 'St. Charles, MO', city: 'St. Charles', state: 'MO', region: 'Midwest', url: 'https://www.DollysDreamHome.org' },
  {
    id: 'p8',
    name: 'E.A.R.S. — Erie Area Rabbit Society & Rescue',
    location: 'Erie, PA',
    city: 'Erie',
    state: 'PA',
    region: 'Northeast',
    phone: '814-838-9732',
    address: '2316 W. 38th St., Erie, PA 16506',
    url: 'https://www.eriearearabbitsociety.org',
  },
  { id: 'p9', name: 'F5RS — Frisky Ferrets, Fuzzies & Feathered Friends', location: 'North Lima, OH', city: 'North Lima', state: 'OH', region: 'Midwest', url: 'https://www.facebook.com/F5RS1/' },
  { id: 'p10', name: 'Friends of Rabbits, Inc.', location: 'DC · MD · VA · since 1997', state: 'VA', region: 'South', email: 'info@friendsofrabbits.org', url: 'https://www.friendsofrabbits.org' },
  {
    id: 'p11',
    name: 'Great Lakes Rabbit Sanctuary',
    location: 'Whittaker, MI · since 1995',
    city: 'Whittaker',
    state: 'MI',
    region: 'Midwest',
    address: 'P.O. Box 7, Whittaker, MI 48190',
    url: 'https://www.rabbitsanctuary.org',
  },
  {
    id: 'p12',
    name: 'Humane Society of Greater Dayton',
    location: 'Dayton, OH · since 1902',
    city: 'Dayton',
    state: 'OH',
    region: 'Midwest',
    phone: '937-268-7387',
    address: '1661 Nicholas Road, Dayton, OH 45417',
    url: 'https://www.hsdayton.org',
  },
  { id: 'p13', name: 'Indiana House Rabbit Society', location: 'Indianapolis, IN', city: 'Indianapolis', state: 'IN', region: 'Midwest', address: '1032 S Shelby St, Indianapolis, IN', url: 'https://indianahrs.org' },
  {
    id: 'p14',
    name: 'Missouri House Rabbit Society',
    location: 'Fenton, MO',
    city: 'Fenton',
    state: 'MO',
    region: 'Midwest',
    phone: '314-995-1457',
    email: 'mo_hrs@hotmail.com',
    address: '75 Elizabeth Dr., Fenton, MO 63026',
    url: 'https://www.morabbit.org',
  },
  { id: 'p15', name: 'Operation Obi', location: 'Pittsburgh, PA', city: 'Pittsburgh', state: 'PA', region: 'Northeast', url: 'https://linktr.ee/operationobi' },
  { id: 'p16', name: 'Saving Rabbits', location: 'Advocacy & education', url: 'https://www.savingrabbits.org' },
  { id: 'p17', name: 'Save the Buns, Inc.', location: 'Research-rabbit rescue', url: 'https://www.savethebuns.org/' },
  { id: 'p18', name: 'Snickerdoodles’ Rabbit Rescue', location: 'Stark County, OH', city: 'Stark County', state: 'OH', region: 'Midwest', url: 'https://snickerdoodlesrescue.org' },
]
