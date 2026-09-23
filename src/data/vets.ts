// Rabbit-savvy vets — the bundled seed for the shared `vets` table (see
// supabase/migrations/*_vets.sql). The app reads live published vets from
// Supabase and silently falls back to this list until the migration is applied.
// The same rows are seeded into the database by
// supabase/migrations/*_seed_live_site_content.sql (generated from this file).
//
// Verbatim from https://www.ohiohouserabbitrescue.org/rabbit-care/vets/
// (captured 2026-09-17). Nothing here is invented — blank fields are blank on
// the live site too.

export interface Vet {
  id: string
  name: string
  doctors?: string
  address?: string
  city?: string
  region: string
  phone?: string
  phone2?: string
  email?: string
  website?: string
  notes?: string
  isEmergency: boolean
  isLowCostSpay: boolean
  /** Gives the RHDV2 vaccine — the one BunFest requires. */
  givesRhdv2?: boolean
  rhdv2Note?: string
}

export const VET_REGIONS = [
  'Central Ohio',
  'Cincinnati',
  'Dayton Area',
  'Toledo',
  'Northeast Ohio',
] as const

export type VetRegion = (typeof VET_REGIONS)[number]

export const VET_DISCLAIMER =
  'The following vets are available for rabbit care. Please interview each vet before making a decision regarding your rabbit’s care. Ohio House Rabbit Rescue is unable to guarantee your satisfaction with them.'

// Central Ohio after-hours line, shown as the emergency banner at the top.
export const EMERGENCY_VET = {
  name: 'MedVet Hilliard',
  note: 'After-hours emergencies: MedVet Hilliard, 24/7 exotics',
  phone: '614-870-0480',
  address: '5230 Renner Road, Columbus, OH 43228',
}

// Other vet lists the live page points to.
export const VET_EXTERNAL_LISTS = [
  { label: 'Buckeye House Rabbit Society vet list', url: 'https://www.ohare.org/wordpress/vets/' },
  { label: 'Columbus House Rabbit Society vet list', url: 'https://www.columbusrabbit.org/vets.html' },
  {
    label: 'How do I find a rabbit-savvy vet? (House Rabbit Society)',
    url: 'http://www.rabbit.org/faq/sections/vet.html',
  },
]

const v = (
  id: string,
  region: string,
  name: string,
  rest: Partial<Omit<Vet, 'id' | 'region' | 'name'>> = {},
): Vet => ({
  id,
  region,
  name,
  isEmergency: false,
  isLowCostSpay: false,
  ...rest,
})

export const seedVets: Vet[] = [
  // ---- Central Ohio ----
  v('norton-road', 'Central Ohio', 'Norton Road Vet Hospital', {
    doctors: 'Dr. Elizabeth Logan',
    address: '1111 Norton Road',
    city: 'Galloway, OH 43119',
    phone: '614-870-7008',
    website: 'https://www.nortonroadvethospital.com/',
    notes: 'Open 7 days per week for wellness and emergency visits',
    givesRhdv2: true,
    rhdv2Note: 'Gives the vaccine by appointment — call 614-870-7008.',
  }),
  v('animal-hospital-pataskala', 'Central Ohio', 'Animal Hospital of Pataskala', {
    doctors: 'Dr. Susan Borders',
    address: '65 S Main St',
    city: 'Pataskala, OH 43062',
    phone: '740-927-0196',
    website: 'https://pataskalavet.com/',
  }),
  v('borders-veterinary-services', 'Central Ohio', 'Borders Veterinary Services, LLC', {
    doctors: 'Dr. Susan Borders',
    phone: '740-927-0196',
    email: 'Slborders1@gmail.com',
    website: 'https://www.facebook.com/profile.php?id=100076848312694',
    notes: 'Mobile wellness checks',
    givesRhdv2: true,
    rhdv2Note: 'Monthly vaccine clinics. For dates and locations, see the Borders Veterinary Services Facebook page or email Dr. Susan Borders at slborders1@gmail.com.',
  }),
  v('animal-care-unlimited', 'Central Ohio', 'Animal Care Unlimited', {
    doctors: 'Dr. Jamie Bobulsky, Dr. Melinda Marksz, Dr. Crissy Olson, Dr. Jodi Smith',
    address: '2665 Billingsley Road',
    city: 'Columbus, OH 43235',
    phone: '614-766-2317',
    website: 'https://www.animalcareunlimited.com/',
  }),
  v('medvet-hilliard', 'Central Ohio', 'MedVet Hilliard — Avian and Exotic Service', {
    doctors: 'Dr. Barbara Oglesbee, Dr. Nicholas Jew',
    address: '5230 Renner Road',
    city: 'Columbus, OH 43228',
    phone: '614-870-0480',
    website: 'https://www.medvetforpets.com/location/hilliard/',
    notes: 'Open 24/7 for exotics emergencies',
    isEmergency: true,
  }),
  v('elemental-veterinary-center', 'Central Ohio', 'Elemental Veterinary Center + Pet Spa', {
    doctors: 'Dr. Jane Flores, Rabbit Acupuncturist',
    address: '1250 N. High St.',
    city: 'Columbus, OH 43201',
    phone: '614-824-4036',
    website: 'http://www.elementalvetcenter.com/',
    notes: 'Spay, neuter, general wellness, acupuncturist',
  }),
  v('cedar-hill-animal-clinic', 'Central Ohio', 'Cedar Hill Animal Clinic', {
    doctors: 'Dr. Nicole Headlee',
    address: '6353 N. Hamilton Road',
    city: 'Westerville, OH 43081',
    phone: '614-897-0404',
    website: 'https://www.cedarhillvet.com/',
  }),
  v('all-critters-veterinary-hospital', 'Central Ohio', 'All Critters Veterinary Hospital', {
    doctors: 'Dr. Sam Valerius',
    address: '4161 Kelnor Dr.',
    city: 'Grove City, OH 43123',
    phone: '614-305-2085',
    phone2: 'Text 614-412-2146',
    website: 'https://www.allcrittersvet.com/',
  }),
  v('east-hilliard-veterinary-services', 'Central Ohio', 'East Hilliard Veterinary Services', {
    doctors: 'Dr. Tom Klein, Dr. Christine Kabalan',
    address: '3993 Brown Park Drive',
    city: 'Hilliard, OH 43026',
    phone: '614-876-7762',
    website: 'https://www.easthilliardvet.com/',
  }),
  v('healthy-pets-lewis-center', 'Central Ohio', 'Healthy Pets of Lewis Center, Inc', {
    doctors: 'Dr. Aubrey Burkett',
    address: '8025 Orange Center Drive',
    city: 'Lewis Center, OH 43035',
    phone: '740-549-4100',
    website: 'http://healthypetsofohio.com/locations/healthy-pets-of-lewis-center/',
  }),
  v('healthy-pets-delaware', 'Central Ohio', 'Healthy Pets of Delaware', {
    doctors: 'Dr. Dawn Keith',
    address: '803 N. Houk Rd',
    city: 'Delaware, OH 43015',
    phone: '740-362-6414',
    notes: 'Formerly Vetcare Animal Wellness Clinic',
  }),
  v('veterinary-acupuncture-integrative', 'Central Ohio', 'Veterinary Acupuncture and Integrative Medicine', {
    doctors: 'Dr. Caroline Jetté',
    address: 'In-Home or In-Office',
    city: 'Westerville, OH 43081',
    phone: '614-772-9439',
    website: 'https://newwavevet.com',
    notes: 'Free 10 minute phone consult',
  }),
  v('my-vet-animal-hospital', 'Central Ohio', 'My Vet Animal Hospital', {
    doctors: 'Dr. Jaimie Watts, Dr. Kelly Thompson',
    address: '7369 State Route 3',
    city: 'Westerville, OH 43082',
    phone: '614-600-5620',
    website: 'https://myvetohio.com/',
  }),

  // ---- Cincinnati ----
  v('grady-veterinary-hospital', 'Cincinnati', 'Grady Veterinary Hospital', {
    address: '9255 Winton Road',
    city: 'Cincinnati, OH 45231',
    phone: '513-931-8675',
    website: 'http://www.gradyvet.com/',
    notes: 'Open 24/7 for exotics emergencies',
    isEmergency: true,
  }),
  v('glenway-animal-hospital', 'Cincinnati', 'Glenway Animal Hospital', {
    doctors: 'Dr. Diana Dornbusch Cron',
    address: '6272 Glenway Ave',
    city: 'Cincinnati, OH 45211',
    phone: '513-662-0224',
    website: 'http://www.glenwayanimalhospital.com/',
  }),

  // ---- Dayton Area ----
  v('evergreen-veterinary-hospital', 'Dayton Area', 'Evergreen Veterinary Hospital', {
    address: '6600 Centerville Business Parkway',
    city: 'Centerville, OH',
    phone: '937-435-5622',
    website: 'https://evergreenvh.com/',
  }),
  v('tipp-city-veterinary-hospital', 'Dayton Area', 'Tipp City Veterinary Hospital', {
    doctors: 'Dr. Joel Harrington, Dr. Jacob Mathias',
    address: '4900 S. County Road 25A',
    city: 'Tipp City, OH 45371',
    phone: '937-586-7321',
    website: 'https://tippvet.com/',
  }),
  v('dayton-south-veterinary-clinic', 'Dayton Area', 'Dayton South Veterinary Clinic', {
    doctors: 'Dr. Daniel Brauer',
    address: '3200 Wilmington Pike',
    city: 'Kettering, OH 45429',
    phone: '937-294-8888',
    website: 'https://www.daytonsouthvet.com/',
  }),
  v('dixie-veterinary-clinic', 'Dayton Area', 'Dixie Veterinary Clinic', {
    doctors: 'Dr. Sara Helman',
    address: '900 S. Dixie Drive',
    city: 'Vandalia, OH 45377',
    phone: '937-890-6341',
    website: 'http://www.dixievet.com/',
  }),

  // ---- Toledo ----
  v('bird-and-exotic-pet-wellness-center', 'Toledo', 'The Bird and Exotic Pet Wellness Center', {
    doctors: 'Dr. Susan Orosz',
    address: '5166 Monroe St. Suite 306',
    city: 'Toledo, OH 43623',
    phone: '419-843-3137',
  }),

  // ---- Northeast Ohio ----
  v('town-and-country-veterinary-hospital', 'Northeast Ohio', 'Town and Country Veterinary Hospital', {
    doctors: 'Charlene Arendas, DVM',
    address: '8000 E. Market Street',
    city: 'Warren, OH 44484',
    phone: '330-856-1862',
    website: 'http://www.tc-vet.com/',
  }),
  v('small-miracles-animal-hospital', 'Northeast Ohio', 'Small Miracles Animal Hospital', {
    doctors: 'Dr. Beth Arnold',
    address: '8600 Pearl Road',
    city: 'Strongsville, OH 44136',
    phone: '440-234-7773',
    website: 'https://www.smallmiraclesanimalhospital.vet/',
  }),
  v('metropolitan-veterinary-hospital-norton', 'Northeast Ohio', 'Metropolitan Veterinary Hospital — Exotics Department (Norton)', {
    doctors: 'Dr. Gary Riggs, Bird and Exotic Department',
    address: '4873 Richland Avenue',
    city: 'Norton, OH 44203',
    phone: '330-825-2434',
    website: 'https://www.metropolitanvet.com/',
  }),
  v('metropolitan-veterinary-hospital-cleveland-east', 'Northeast Ohio', 'Metropolitan Veterinary Hospital — Cleveland East', {
    address: '734 Alpha Drive',
    city: 'Highland Heights, OH 44143',
    phone: '440-673-3483',
    website: 'https://www.metropolitanvet.com/',
  }),
  v('metropolitan-veterinary-hospital-akron', 'Northeast Ohio', 'Metropolitan Veterinary Hospital (after hours emergencies)', {
    address: '1053 S. Cleveland Massillon Road',
    city: 'Akron, OH 44321',
    phone: '330-666-2976',
    website: 'https://www.metropolitanvet.com/',
    notes: 'After hours emergencies',
    isEmergency: true,
  }),

  // ---- Low-cost spay/neuter ----
  v('humane-society-delaware-county', 'Central Ohio', 'Humane Society of Delaware County', {
    address: '4920 State Route 37 E.',
    city: 'Delaware, OH 43015',
    phone: '740-369-7387',
    website: 'https://hsdcohio.org/',
    isLowCostSpay: true,
  }),
  v('lake-humane-society', 'Northeast Ohio', 'Lake Humane Society', {
    address: '7564 Tyler Blvd Bldg E',
    city: 'Mentor, OH 44060',
    phone: '440-951-6122',
    website: 'https://www.lakehumane.org/',
    isLowCostSpay: true,
  }),
]
