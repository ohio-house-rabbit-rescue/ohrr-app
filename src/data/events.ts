// OHRR events — the bundled seed for the shared `events` table (see
// supabase/migrations/*_events.sql). The app reads live published events from
// Supabase and silently falls back to this list until the migration is applied.
// The same rows are seeded into the database by
// supabase/migrations/*_seed_live_site_content.sql (generated from this file by
// scripts/generate-seed-sql.mjs), so the app, the website, and the DB agree.
//
// Facts verbatim from ohiohouserabbitrescue.org (captured 2026-09-17):
// https://ohiohouserabbitrescue.org/midwest-bunfest-is-sunday-october-25th-2026/

export interface EventItem {
  id: string
  slug: string
  title: string
  /** ISO-8601 with offset (America/New_York) */
  startsAt: string
  endsAt?: string
  venue?: string
  address?: string
  city?: string
  summary?: string
  /** light markdown: blank-line paragraphs, `## ` headings, `- ` bullets */
  body?: string
  theme?: string
  url?: string
  /** A photo or poster for the event (20260922140000_*.sql). */
  imageUrl?: string
  /** Per-year facts staff edit: admission, parking, links, the rabbit rule. */
  info?: Record<string, unknown>
}

// The stable slug the BunFest sub-app looks up to keep its date/venue/theme live.
export const BUNFEST_EVENT_SLUG = 'midwest-bunfest-2026'

export const seedEvents: EventItem[] = [
  {
    id: BUNFEST_EVENT_SLUG,
    slug: BUNFEST_EVENT_SLUG,
    title: 'Midwest BunFest 2026',
    startsAt: '2026-10-25T10:00:00-04:00',
    endsAt: '2026-10-25T16:00:00-04:00',
    venue: 'The Makoy',
    address: '5462 Center St., Hilliard, OH 43026',
    city: 'Hilliard, OH',
    theme: 'Binky On!',
    url: 'https://www.midwestbunfest.org/',
    summary:
      'At Midwest BunFest you’ll find our amazing Sponsors, Rescue Partners, & Vendors. There will also be a silent auction, raffle, OHRR Hop Shop, bunny spa, bunny glamour shots, and more.',
    body: `Mark your calendars! Sunday, October 25, 2026, 10am – 4pm at The Makoy, 5462 Center St., Hilliard, OH 43026.

At Midwest BunFest you’ll find our amazing Sponsors, Rescue Partners, & Vendors. There will also be a silent auction, raffle, OHRR Hop Shop, bunny spa, bunny glamour shots, and more. Also available is the Chillaxabun Lounge, a quiet place where your bunny can chill; equipped with hay, water, and a hidey house to relax. There are educational sessions throughout the whole day, and you’ll be surrounded by a wonderful rescue rabbit community!

## This year’s theme: Binky On!

Bunnies binky when they feel joy. A bunny binky involves a big hop into the air, a twirling of the body, and enthusiastic kicking of the legs. It’s often followed by zoomies and head shakies – these are just some of the adorable things a happy, joyful bunny does.

Midwest BunFest’s 2026 theme is all about the joy of rabbits. Many rescued rabbits start out in rough shape, only to open up and relax once they know they are safe and around humans they can trust. This human cares and provides everything needed for the rabbit to thrive. Then, it happens: the binky!

- Space to run and play – yes!
- A place to be themselves – check!
- Somewhere they are loved – hooray!
- A home to be silly and sassy – woo hoo!

These resilient bunnies “binky on” and move beyond their past into the loving present moment, displaying their dance of utter joy! And we get the honor of witnessing it!

By supporting Midwest BunFest and all of the wonderful partners who participate, you help rescue rabbits get the second chance they deserve to joyfully “binky on” into a new chapter!

## About the logo

A huge thank you to Midwest BunFest 2026 logo designer, Tattoo Artist Jillian Lisska! A central Ohio native, Jillian tattoos at a private studio in Clintonville, Ohio. You can follow her work and two rescue rabbits, Jack and Caroline, on Instagram and TikTok at @jillianlisska.`,
  },
]
