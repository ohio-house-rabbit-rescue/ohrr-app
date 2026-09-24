// Ohio House Rabbit Rescue — org facts and the real links from their site
// (https://www.ohiohouserabbitrescue.org), captured 2026-09-17. The app keeps
// content in-app; these links are for the forms/sign-ups that live on the site.

export const ohrr = {
  name: 'Ohio House Rabbit Rescue',
  short: 'OHRR',
  tagline: 'Ohio’s first adoption center just for rabbits — rescuing, rehoming, and teaching better bunny care.',
  ein: '27-0830606',
  founded: 2009,
  // The street address is for staff, suppliers and letters to one named person
  // only — public screens and share outputs say "Columbus, Ohio", and the
  // address comes with a booking. (People were leaving rabbits at the door.)
  address: '5485 N. High Street, Columbus, OH 43214',
  addressLine1: '5485 N. High Street',
  addressLine2: 'Columbus, OH 43214',
  // Verbatim from the Contact page.
  directions:
    'We are located north of Graceland Shopping Center and south of Selby Blvd — right next to the Firestone Complete Auto Care store.',
  mapUrl: 'https://goo.gl/maps/zk7N3v8ZXdq',
  phone: '614-263-8557',
  phoneHref: 'tel:+16142638557',
  email: 'ohrrcontact@ohiohouserabbitrescue.org',
  mediaEmail: 'ohrrmarketing@gmail.com',
  hours: 'Sat & Sun, 12–4 PM · adoptions by appointment',
  hoursShort: 'Sat & Sun, 12–4 PM',
  hopShopHours: 'Saturday / Sunday Noon – 4:00 pm',
  adoptionsNote: 'Adoptions by appointment only',
  // Shown where the address used to be and on the surrender / found-rabbit
  // screens. From OHRR's Admissions Policy ("a restricted admissions
  // organization"; a rabbit comes in once OHRR accepts it for admission).
  noDropOffNote:
    'Please don’t bring a rabbit to the Adoption Center without talking to us first. OHRR is a restricted-admissions rescue: a rabbit can only come in once we’ve accepted it.',
  links: {
    site: 'https://www.ohiohouserabbitrescue.org/',
    adopt: 'https://www.ohiohouserabbitrescue.org/adopt/',
    adoptable: 'https://www.ohiohouserabbitrescue.org/adopt/adoptable-bunnies/',
    application: 'https://www.ohiohouserabbitrescue.org/adopt/adoption-application/',
    policy: 'https://ohrr-website.pages.dev/docs/OHRR-Adoption-Policy.pdf', // OHRR's PDF, hosted on the new site
    process: 'https://www.ohiohouserabbitrescue.org/adoption-process-for-ohrr/',
    bunnyDates: '/info/bunny-dates', // in-app now
    petfinder: 'http://www.petfinder.com/pet-search?shelterid=OH975',
    adoptAPet:
      'http://www.adoptapet.com/animal-shelter-search?city_or_zip=43235&shelter_name=Ohio+House+Rabbit+Rescue&distance=50&adopts_out=all',
    learn: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/',
    living: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/bunny-living-space/',
    resources: 'https://www.ohiohouserabbitrescue.org/rabbit-care/resources/',
    vets: 'https://www.ohiohouserabbitrescue.org/rabbit-care/vets/',
    stray: 'https://www.ohiohouserabbitrescue.org/i-want-to-learn/tips-for-catching-a-stray/',
    volunteer: 'https://www.ohiohouserabbitrescue.org/support-ohrr/volunteer/',
    support: 'https://www.ohiohouserabbitrescue.org/i-want-to-support/',
    hopShop: 'https://www.ohiohouserabbitrescue.org/hop-shop/',
    about: 'https://www.ohiohouserabbitrescue.org/about-us/',
    mission: 'https://www.ohiohouserabbitrescue.org/about-us/mission-and-vision/',
    background: 'https://www.ohiohouserabbitrescue.org/about-us/background/',
    volunteerFamily: 'https://www.ohiohouserabbitrescue.org/about-us/volunteer-family/',
    adoptionCenter: 'https://www.ohiohouserabbitrescue.org/about-us/627-2/',
    contact: 'https://www.ohiohouserabbitrescue.org/contact/',
    admissions: 'https://www.ohiohouserabbitrescue.org/about-us/admissions/',
    admissionsPolicyPdf: 'https://ohrr-website.pages.dev/docs/OHRR-Admissions-Policy.pdf',
    surrenderPolicyPdf: 'https://ohrr-website.pages.dev/docs/OHRR-Surrender-Relinquishment-Policy.pdf',
    goodSamaritanForm:
      'https://www.ohiohouserabbitrescue.org/about-us/admissions/good-samaritian-rescuesurrender-and-relinquishment-form/',
    ownerSurrenderForm:
      'https://www.ohiohouserabbitrescue.org/about-us/admissions/owner-surrender-and-relinquishment-form/',
    events: 'https://www.ohiohouserabbitrescue.org/events/',
    facebook: 'https://www.facebook.com/ohiohouserabbitrescue/',
    instagram: 'https://www.instagram.com/ohio_house_rabbit_rescue/',
    columbusHrs: 'http://www.columbusrabbit.org/',
    houseRabbitSociety: 'http://www.rabbit.org',
    ohioWildlifeCenter: 'https://www.ohiowildlifecenter.org/wildlife-emergency/',
  },
}

// Adoption requirements (from OHRR's Adoption Policy, revised January 31, 2022).
export const adoptRequirements = [
  'Rabbits live indoors — never outside, in a garage, or in an unfinished basement.',
  'A minimum 4 ft × 4 ft floor enclosure with no wire flooring, or free range in a room — plus space and time for exercise.',
  'Limited high-quality timothy pellets, unlimited grass hay, a daily salad of fresh greens, and fresh water.',
  'Yearly wellness checks with a rabbit-experienced vet. All OHRR rabbits are spayed/neutered.',
]

// "How adopting works" — the 3 steps from the live Adoptable Bunnies page.
export const adoptionSteps: { title: string; text: string }[] = [
  {
    title: 'Read the Adoption Policy',
    text: 'If you are considering adopting from Ohio House Rabbit Rescue, please review our Adoption Policy first — the summary is right here in the app.',
  },
  {
    title: 'Apply online',
    text: 'After you have read the Adoption Policy, complete our online adoption application. Once received, you’ll be contacted by email within 72 hours.',
  },
  {
    title: 'Meet the bunnies by appointment',
    text: 'One of our adoption facilitators will contact you to talk about your application and set up a two-hour appointment on a Saturday or Sunday, where you can see how we house our bunnies, what we feed them, and then interact with and potentially adopt one of our rescue rabbits.',
  },
]

export const stillDecidingNote =
  'If you are in the early stages of trying to determine if a rabbit is the right pet for you, send an email to ohrrcontact@ohiohouserabbitrescue.org. We will contact you to set up an hour-long appointment where you can learn about being a bunny parent.'

export const matchmakingNote =
  'We provide free bunny matchmaking! If you’re interested in bonding your current bunny with one of OHRR’s adoptable bunnies, bring your bunny to OHRR for a date.'

// What to expect at a bonding date (from the live "Bunny Dates at OHRR" post).
export const bunnyDateSteps: string[] = [
  'Check the adoptable rabbits first. If a rabbit you’d like your bunny to meet is in a foster home, let us know ahead of time so we can bring them to the Center.',
  'Plan on being at the Center for about 1–2 hours.',
  'We set up an x-pen for your bunny, then ask you to pick 3 rabbits you would like your bunny to meet — even if you have your heart set on one. Sometimes the rabbit you pick isn’t the one your rabbit would pick.',
  'Our bonding expert gets in the pen with the two rabbits to observe and prevent injury; you watch from right outside. Nothing else is in the pen that the rabbits could fight over — not even litter boxes.',
  'Afterwards we talk through how each date went, coach you on continuing the bonding process at home (and lend you an x-pen if you need one), and our bonding expert keeps supporting you by email — and with in-home bonding visits if needed.',
]

// Readable summary of the Adoption Policy PDF (Ohio House Rabbit Rescue, Inc.,
// revised January 31, 2022) — faithful condensation, no additions.
export interface PolicySection {
  heading: string
  text: string
}

export const adoptionPolicyRevised = 'Revised January 31, 2022'

export const adoptionPolicy: PolicySection[] = [
  {
    heading: 'Primary caregiver',
    text: 'The primary caregiver must be an adult — OHRR does not adopt rabbits as pets to children. The rabbit should be an integral part of the family and wanted by the entire family, and all interactions with children and other household pets must be supervised. OHRR will not adopt into a home where anyone has ever been convicted of animal neglect or cruelty, or who breeds rabbits.',
  },
  {
    heading: 'Indoor housing',
    text: 'All rabbits must live indoors within the residential living space — not outside, in a garage, or in an unfinished basement. The rabbit must live on the floor in an enclosure with no wire flooring and minimum dimensions of 4 feet by 4 feet, or free range in a room inside the home, plus contiguous space and time for play and exercise. Flooring in the living and exercise area must be carpet or rugs. OHRR generally does not adopt to homes where other pets are kept outside, and does not adopt into households with snakes or ferrets.',
  },
  {
    heading: 'Social requirements',
    text: 'Rabbits are highly social beings, thriving in a stable atmosphere of companionship. The primary caregiver must be willing to create the necessary time in their lives for their new family member, including when life changes arise.',
  },
  {
    heading: 'Bonded pairs',
    text: 'Rabbits are not meant to live in solitude. Bonded pairs are much easier to care for, get into less trouble, are happier, and tend to relate better to people — and two rabbits are generally not more expensive than one (the exception is medical care). If two rabbits up for adoption are a bonded pair, the adopter must adopt both and agree to keep them together.',
  },
  {
    heading: 'Spay / neuter',
    text: 'All OHRR rabbits are spayed or neutered. If the adopted rabbit will be a companion to an existing pet rabbit, that rabbit must have been spayed or neutered at least one month before the introduction process. OHRR generally does not adopt to homes with other pets who are not spayed/neutered.',
  },
  {
    heading: 'Veterinary care & diet',
    text: 'Rabbits require yearly wellness checks by a rabbit-experienced veterinarian, and adopters must be prepared for the financial responsibility of rabbit ownership. Good health requires limited, high-quality timothy pellets (one of OHRR’s approved brands), unlimited high-quality grass hay, a daily salad of mixed fresh greens, and fresh water.',
  },
  {
    heading: 'Returns & exchanges',
    text: 'Rabbits live 8–12 years on average. Any rabbit adopted from OHRR must be returned to OHRR if the adopter can no longer care for it; the rabbit will be accepted back as soon as possible, though the time frame can vary from a few weeks to a few months. Exchanges are handled case-by-case at the discretion of the Adoption Facilitator.',
  },
  {
    heading: 'Adoption fee',
    text: 'Singles – $60. Pairs – $75.',
  },
  {
    heading: 'Adoption procedure',
    text: 'Application: complete the online application; you’ll be contacted by email within 72 hours (if not, email ohrrcontact@ohiohouserabbitrescue.org), then have a phone conversation with an Adoption Facilitator and, if appropriate, schedule an appointment. Meeting the rabbits: appointments are usually at 12:00 and 2:00 on Saturdays and Sundays, first come, first served; the primary caregiver must be present and all family members are encouraged to come. Homecoming: an “adopted” clip goes on the pen; you have up to two weeks to set up housing and bunny-proof, send photos of the habitat for approval, then schedule pick-up, sign the adoption contract and pay the fee. Follow-up: keep in touch with your Adoption Facilitator, especially in the first days and weeks.',
  },
]

