// Sponsor tiers. Sponsor slots are PLACEHOLDERS — this page doubles as a
// recruitment tool ("become a sponsor") until the confirmed sponsors are set.

export interface SponsorTier {
  id: string
  name: string
  blurb: string
  sponsors: string[] // empty => show "open" call-to-action
}

export const sponsorTiers: SponsorTier[] = [
  {
    id: 'presenting',
    name: 'Presenting Sponsor',
    blurb: 'Top-level partner — name and logo featured across the event.',
    sponsors: [],
  },
  {
    id: 'gold',
    name: 'Gold Sponsors',
    blurb: 'Major supporters of rabbit rescue and education.',
    sponsors: [],
  },
  {
    id: 'silver',
    name: 'Silver Sponsors',
    blurb: 'Generous businesses and organizations backing BunFest.',
    sponsors: [],
  },
  {
    id: 'community',
    name: 'Community Sponsors',
    blurb: 'Local shops, clubs, and friends of the rescue.',
    sponsors: [],
  },
]
