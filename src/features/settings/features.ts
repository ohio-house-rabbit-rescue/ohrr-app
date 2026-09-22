// The features an admin can switch on and off, in one list.
//
// Each entry is an `app_settings` row holding {"enabled": boolean}; the screen
// that shows the feature asks `useFeatureFlag(key, defaultOn)`. Adding one is
// an entry here plus a gate in the component — no deploy needed to flip it.
//
// Groups keep the Features screen readable as this list grows: the sections
// people hide seasonally (BunFest) sit apart from the store-review switches.

export interface AppFeature {
  /** app_settings.key */
  key: string
  label: string
  /** One line: what turning it on shows, and where. */
  description: string
  /** Treated as ON until a row is saved (the gate must pass the same default). */
  defaultOn?: boolean
  group: 'Midwest BunFest' | 'Volunteering' | 'For the app stores'
}

export const RAFFLE_TICKETS_FLAG = 'raffle_tickets_enabled'
/** Second switch for the Android / iPhone apps only (Apple 5.3.3 / Play gambling). */
export const RAFFLE_TICKETS_NATIVE_FLAG = 'raffle_tickets_native_enabled'
export const BUNFEST_SECTION_FLAG = 'bunfest_section_enabled'
export const VOLUNTEER_HOURS_FLAG = 'volunteer_hours_enabled'

export const APP_FEATURES: AppFeature[] = [
  {
    key: BUNFEST_SECTION_FLAG,
    label: 'The Midwest BunFest section',
    defaultOn: true,
    description:
      'The BunFest tab, its home screen and everything under it. Switch OFF out of season and the app becomes OHRR-only; the pages stay, ready for next year.',
    group: 'Midwest BunFest',
  },
  {
    key: RAFFLE_TICKETS_FLAG,
    label: 'Raffle tickets',
    description:
      'Show “Get raffle tickets” on the BunFest raffle page: numbered tickets held for the person, paid at the raffle table, drawn from Staff → Raffle tickets. Pricing comes from Silent Auction → Auction setup.',
    group: 'Midwest BunFest',
  },
  {
    key: VOLUNTEER_HOURS_FLAG,
    label: 'Volunteers can log their own hours',
    defaultOn: true,
    description:
      'The private “My volunteer hours” link lets a volunteer see their totals and log hours; staff confirm them under Staff → Volunteers. Switch OFF to keep hours staff-entered only.',
    group: 'Volunteering',
  },
  {
    key: RAFFLE_TICKETS_NATIVE_FLAG,
    label: 'Raffle tickets inside the phone apps',
    defaultOn: true,
    description:
      'Also show raffle tickets inside the installed Android / iPhone apps. ON for testers. Switch OFF before a store review if Apple or Google object to raffle tickets in an app — the web app is unaffected.',
    group: 'For the app stores',
  },
]

export const FEATURE_GROUPS: AppFeature['group'][] = ['Midwest BunFest', 'Volunteering', 'For the app stores']

/** Kept so existing imports (the old Test features list) keep working. */
export type TestFeature = AppFeature
export const TEST_FEATURES = APP_FEATURES
