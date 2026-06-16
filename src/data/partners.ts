// Rescue partners.
//
// CONFIRMED: Midwest BunFest is promoted by and features 15–20 rabbit rescue
// organizations from across the Midwest. OHRR is the host.
//
// The list below is a PLACEHOLDER set (besides OHRR) to show the layout —
// the confirmed 2026 partner rescues will be listed closer to the event.

export interface Partner {
  id: string
  name: string
  location: string
  url?: string
  host?: boolean
  sample?: boolean
}

export const partners: Partner[] = [
  {
    id: 'ohrr',
    name: 'Ohio House Rabbit Rescue',
    location: 'Columbus, OH',
    url: 'https://www.ohiohouserabbitrescue.org/',
    host: true,
  },
  { id: 'p2', name: 'Midwest Rabbit Rescue (sample)', location: 'Ohio', sample: true },
  { id: 'p3', name: 'Great Lakes House Rabbit Society (sample)', location: 'Michigan', sample: true },
  { id: 'p4', name: 'Tri-State Bunny Rescue (sample)', location: 'Indiana', sample: true },
  { id: 'p5', name: 'Buckeye Bunny Brigade (sample)', location: 'Ohio', sample: true },
  { id: 'p6', name: 'River City Rabbit Rescue (sample)', location: 'Kentucky', sample: true },
]
