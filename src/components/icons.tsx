import type { ReactNode } from 'react'

// The shared OHRR line-icon set. The website (ohrr-website/src/components/icons.tsx)
// carries a copy so the same icon means the same thing on both surfaces:
// calendar = events, gift = ways to give, award = silent auction, users = volunteer,
// book = care guides, phone = vets, mappin = found a rabbit / surrender, bag = Hop Shop,
// sparkles = news / Happy Tails, star = partners, mail = contact, device = the app.
// Keep the two files in sync.

export type IconName =
  | 'home'
  | 'calendar'
  | 'bag'
  | 'heart'
  | 'info'
  | 'users'
  | 'award'
  | 'mappin'
  | 'clock'
  | 'chevron'
  | 'external'
  | 'phone'
  | 'sparkles'
  | 'arrowLeft'
  | 'book'
  | 'gift'
  | 'ticket'
  | 'mail'
  | 'store'
  | 'star'
  | 'settings'
  | 'apple'
  | 'search'
  | 'help'
  | 'mic'
  | 'x'
  | 'device'
  | 'scan'
  | 'gavel'
  | 'camera'
  | 'check'
  | 'plus'
  | 'minus'
  | 'keyboard'
  | 'printer'
  | 'trash'
  | 'box'

const paths: Record<IconName, ReactNode> = {
  home: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
    </>
  ),
  bag: (
    <>
      <path d="M6 2.5 3.5 6.5V20a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V6.5L18 2.5z" />
      <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
      <path d="M16 10.5a4 4 0 0 1-8 0" />
    </>
  ),
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8.5" r="6" />
      <path d="M8.5 13.7 7 22l5-2.8L17 22l-1.5-8.3" />
    </>
  ),
  mappin: (
    <>
      <path d="M20 10.5c0 6-8 11-8 11s-8-5-8-11a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10.5" r="2.8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  chevron: <path d="M9 18l6-6-6-6" />,
  external: (
    <>
      <path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  ),
  sparkles: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  book: (
    <>
      <path d="M3 4.8A1.8 1.8 0 0 1 4.8 3H11v15.5H4.8A1.8 1.8 0 0 0 3 20.3z" />
      <path d="M21 4.8A1.8 1.8 0 0 0 19.2 3H13v15.5h6.2a1.8 1.8 0 0 1 1.8 1.8z" />
    </>
  ),
  gift: (
    <>
      <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" />
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h14a1.5 1.5 0 0 1 1.5 1.5V11a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" />
      <path d="M12 7v14" />
      <path d="M12 7H8.5a2 2 0 1 1 0-4C11 3 12 7 12 7z" />
      <path d="M12 7h3.5a2 2 0 1 0 0-4C13 3 12 7 12 7z" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.7a1.8 1.8 0 0 0 0 3.6v1.7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-1.7a1.8 1.8 0 0 0 0-3.6z" />
      <path d="M14 7.5v9" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5.2 4h13.6L20 9.5" />
      <path d="M5 9.8V20h14V9.8" />
      <path d="M9.5 20v-5.5h5V20" />
      <path d="M4 9.3a2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.7 0 2.4 2.4 0 0 0 4.7 0" />
    </>
  ),
  star: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9z" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 12a7.5 7.5 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" />
    </>
  ),
  apple: (
    <path
      d="M16.4 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6 1.7-1 2.4-2c.5-.7.8-1.4 1-2-.1 0-2-.8-2-2.6zM14.5 6.7c.6-.7 1-1.6.9-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.9 2.5.9.1 1.8-.5 2.4-1.2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.6 2.3c-.9.5-1.6 1-1.6 2.1v.3" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="18" x2="12" y2="21.5" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  // A phone outline — "Get the OHRR app" on the website; kept here for parity.
  device: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <line x1="10.5" y1="18" x2="13.5" y2="18" />
    </>
  ),
  // Scan an item (the four corners of a viewfinder + a scan line).
  scan: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </>
  ),
  // Silent Auction item (gavel).
  gavel: (
    <>
      <path d="m14 13-7.5 7.5a1.4 1.4 0 0 1-2-2L12 11" />
      <path d="m10 6 8 8" />
      <path d="m13 3 8 8" />
      <path d="m17 7-6 6" />
      <path d="M3 21h9" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <rect x="4" y="8" width="16" height="8" rx="2" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
    </>
  ),
  // Hop Shop stock (a box).
  box: (
    <>
      <path d="M3.5 8 12 4l8.5 4v8L12 20l-8.5-4z" />
      <path d="M3.5 8 12 12l8.5-4" />
      <path d="M12 12v8" />
    </>
  ),
}

export function Icon({
  name,
  size = 24,
  className = '',
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
