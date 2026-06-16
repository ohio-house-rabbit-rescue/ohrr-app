// App-wide constants and copy. Keeping this in one place makes it easy to
// swap placeholder content for OHRR-confirmed details later.

export const SAMPLE_DATA_NOTE =
  'Sample content for development. Schedule, vendors, partners, and sponsors will be replaced with the confirmed Midwest BunFest lineup.'

export interface NavLinkItem {
  to: string
  label: string
  end?: boolean
}

export const NAV_LINKS: NavLinkItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/schedule', label: 'Schedule' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/partners', label: 'Partners' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/visit', label: 'Plan Your Visit' },
]
