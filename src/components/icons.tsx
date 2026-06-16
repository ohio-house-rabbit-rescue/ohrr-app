import type { ReactNode } from 'react'

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
    <path d="M12 21s-7.5-4.6-10-9.1C.7 9.2 1.8 5.7 4.8 4.8c2-.6 3.9.2 5 1.8 1.1-1.6 3-2.4 5-1.8 3 .9 4.1 4.4 2.8 7.1C19.5 16.4 12 21 12 21z" />
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
