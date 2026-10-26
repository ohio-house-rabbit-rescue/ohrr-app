// Which auction a screen is showing. The same pages serve two auctions:
//   BunFest's Silent Auction  /bunfest/auction   on the day, with sessions and the table
//   the OHRR Online Auction   /auction           online only, one closing time,
//                                                 winners charged automatically (update 45)
// The routes wrap their pages in <AuctionEventProvider value={…}>; a page asks
// useAuctionEvent() for its slug, its paths and its words.
import { createContext, useContext, type ReactNode } from 'react'
import { AUCTION_EVENT, ONLINE_AUCTION_EVENT } from './client'

export interface AuctionEvent {
  slug: string
  /** Where its pages live: `${base}`, `${base}/register`, `${base}/me`, `${base}/:id`. */
  base: string
  /** Online only: no sessions, no table, one closing time, charged at the close. */
  online: boolean
  name: string
  subtitle: string
  /** Where "back" goes from the catalog. */
  home: { to: string; label: string }
}

export const BUNFEST_AUCTION: AuctionEvent = {
  slug: AUCTION_EVENT,
  base: '/bunfest/auction',
  online: false,
  name: 'Silent Auction',
  subtitle: 'Midwest BunFest 2026',
  home: { to: '/bunfest', label: 'Midwest BunFest' },
}

export const ONLINE_AUCTION: AuctionEvent = {
  slug: ONLINE_AUCTION_EVENT,
  base: '/auction',
  online: true,
  name: 'Online Auction',
  subtitle: 'Ohio House Rabbit Rescue',
  home: { to: '/support', label: 'Ways to help' },
}

export const AUCTION_EVENTS = [BUNFEST_AUCTION, ONLINE_AUCTION]

/** The auction an item or a bidder belongs to, by its event slug. */
export function auctionEventFor(slug: string | null | undefined): AuctionEvent {
  return slug === ONLINE_AUCTION_EVENT ? ONLINE_AUCTION : BUNFEST_AUCTION
}

const Ctx = createContext<AuctionEvent>(BUNFEST_AUCTION)

export function AuctionEventProvider({ value, children }: { value: AuctionEvent; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuctionEvent(): AuctionEvent {
  return useContext(Ctx)
}
