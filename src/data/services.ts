// OHRR owner services: bunny bonding sessions and the mobile vet-clinic days.
// Clinic dates are illustrative sample data — swap in OHRR's real schedule (or
// wire to a scheduling tool) when confirmed.

export const bonding = {
  title: 'Bunny Bonding Sessions',
  blurb:
    'Rabbits are social and happiest with a friend — but introductions have to be done slowly and safely. OHRR runs guided bonding sessions to help your rabbit meet a potential match on neutral ground.',
  steps: [
    'Tell us about your rabbit and what you’re looking for.',
    'We schedule a supervised meet on neutral territory at the center.',
    'Our team guides the introduction and shares next steps for bonding at home.',
  ],
}

export const clinicInfo = {
  title: 'Mobile Vet Clinic Days',
  blurb:
    'A rabbit-savvy vet visits OHRR on select weekends for nail trims, wellness checks, and microchipping — by appointment. Reserve a time below and bring your bunny in.',
}

export interface ClinicDay {
  id: string
  weekday: string
  date: string
  location: string
  slots: string[]
  note?: string
}

export const clinicDays: ClinicDay[] = [
  {
    id: '2026-07-11',
    weekday: 'Saturday',
    date: 'July 11, 2026',
    location: 'OHRR Adoption Center · 5485 N. High St',
    slots: ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM'],
  },
  {
    id: '2026-08-09',
    weekday: 'Sunday',
    date: 'August 9, 2026',
    location: 'OHRR Adoption Center · 5485 N. High St',
    slots: ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM'],
    note: 'Nail trims & wellness checks',
  },
  {
    id: '2026-09-12',
    weekday: 'Saturday',
    date: 'September 12, 2026',
    location: 'OHRR Adoption Center · 5485 N. High St',
    slots: ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM'],
  },
]
