// The "Test features" list on /staff/settings. Each entry is an app_settings
// key holding {"enabled": boolean}; the public app shows the feature only while
// it's on. Adding a test feature = one entry here + a useFeatureFlag() gate in
// the public component.

export interface TestFeature {
  /** app_settings.key */
  key: string
  label: string
  /** One line: what turning it on shows, and where. */
  description: string
}

export const RAFFLE_TICKETS_FLAG = 'raffle_tickets_enabled'

export const TEST_FEATURES: TestFeature[] = [
  {
    key: RAFFLE_TICKETS_FLAG,
    label: 'Raffle ticket reservation',
    description:
      'Show the reserve-numbered-tickets form (pay at the raffle table) on the BunFest raffle page. Pricing comes from Silent Auction → Auction setup.',
  },
]
