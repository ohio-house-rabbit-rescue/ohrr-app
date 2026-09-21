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
  /** Treated as ON until a row is saved (the public gate must pass the same default). */
  defaultOn?: boolean
}

export const RAFFLE_TICKETS_FLAG = 'raffle_tickets_enabled'
/** Second switch for the Android / iPhone apps only. ON until a row says otherwise,
 *  so testers see the raffle; switch it OFF before a store review if the reviewer
 *  objects to raffle tickets in an app (Apple 5.3.3 / Play gambling policy) — the
 *  web app keeps working either way. */
export const RAFFLE_TICKETS_NATIVE_FLAG = 'raffle_tickets_native_enabled'

export const TEST_FEATURES: TestFeature[] = [
  {
    key: RAFFLE_TICKETS_NATIVE_FLAG,
    label: 'Raffle tickets inside the phone apps (Android / iPhone)',
    defaultOn: true,
    description:
      'Also show “Get raffle tickets” inside the installed apps. ON by default for testers. Switch OFF before a store review if Apple or Google object to raffle tickets in an app — the web app is unaffected.',
  },
  {
    key: RAFFLE_TICKETS_FLAG,
    label: 'Raffle tickets in the app',
    description:
      'Show “Get raffle tickets” on the BunFest raffle page: numbered tickets held for the person, paid at the raffle table, drawn from Staff → Raffle tickets. Pricing comes from Silent Auction → Auction setup.',
  },
]
