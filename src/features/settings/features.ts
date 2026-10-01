// The features a Founder or Developer can switch on and off, in one list.
//
// Each entry is an `app_settings` row holding {"enabled": boolean}; the screen
// that shows the feature asks `useFeature(key, defaultOn)` (or the older
// `useFeatureFlag`). Adding one is an entry here plus a gate in the component —
// no deploy needed to flip it.
//
// Switched OFF, a feature disappears for visitors on the app, the website and
// the BunFest site. Signed-in staff still see it, under a "Hidden from the
// public" note, so it can be got ready and checked before it goes live.
// Only Founders and Developers may flip a switch: the database refuses anyone
// else for keys ending in "_enabled" (update 38).
//
// The website's src/lib/settings.ts carries a copy of this list — keep the two
// in sync (same keys, labels, descriptions, defaults and groups).

export type FeatureGroup = 'Midwest BunFest' | 'The rescue' | 'Volunteering' | 'For the app stores'

export interface AppFeature {
  /** app_settings.key — always ends in "_enabled". */
  key: string
  label: string
  /** One line: what turning it on shows, and where. */
  description: string
  /** Treated as ON until a row is saved (the gate must pass the same default). */
  defaultOn?: boolean
  group: FeatureGroup
}

export const BUNFEST_SECTION_FLAG = 'bunfest_section_enabled'
export const SILENT_AUCTION_FLAG = 'silent_auction_enabled'
export const RAFFLE_TICKETS_FLAG = 'raffle_tickets_enabled'
/** Second switch for the Android / iPhone apps only (Apple 5.3.3 / Play gambling). */
export const RAFFLE_TICKETS_NATIVE_FLAG = 'raffle_tickets_native_enabled'
export const HOP_SHOP_ITEMS_FLAG = 'hop_shop_items_enabled'
export const PHONE_NOTIFICATIONS_FLAG = 'phone_notifications_enabled'
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
    key: SILENT_AUCTION_FLAG,
    label: 'Silent Auction',
    defaultOn: true,
    description:
      'The auction items, their pages and online bidding, on the app, the website and the BunFest site. Switching it OFF also closes online bidding; switch bidding back on at the auction desk when the auction is ready.',
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
    key: HOP_SHOP_ITEMS_FLAG,
    label: 'Hop Shop items online',
    defaultOn: true,
    description:
      'The “On the shelf now” list on the Hop Shop page, on the app and the website: what staff have added to the shop, with photos and prices. The shop’s hours and address always show.',
    group: 'The rescue',
  },
  {
    key: PHONE_NOTIFICATIONS_FLAG,
    label: 'Phone notifications',
    defaultOn: true,
    description:
      'The “Notifications on this phone” sign-up in My OHRR and the one-time offer on Home. Switched OFF, nothing new is sent either; phones already signed up hear again when it is back on.',
    group: 'The rescue',
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

export const FEATURE_GROUPS: FeatureGroup[] = ['Midwest BunFest', 'The rescue', 'Volunteering', 'For the app stores']

/** The default for a key (ON unless the entry says otherwise). */
export function featureDefault(key: string): boolean {
  return Boolean(APP_FEATURES.find((f) => f.key === key)?.defaultOn)
}

/** Kept so existing imports (the old Test features list) keep working. */
export type TestFeature = AppFeature
export const TEST_FEATURES = APP_FEATURES
