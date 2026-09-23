// The colour each vendor category is drawn in on the BunFest map, so the map
// and its key agree.
//
// The venue itself — rooms, tables, the stage, doors — used to be drawn from
// constants here and only fitted The Makoy. It is now designed per year by
// staff (Staff → BunFest → Floor plan) and lives in `bunfest_venues`; see
// features/bunfest/floor.ts.
import { vendorCategories } from './vendors'

export const CATEGORY_COLOR: Record<(typeof vendorCategories)[number], string> = {
  Art: '#e0950f',
  'Jewelry & Gifts': '#0669ac',
  'Toys & Enrichment': '#2f9e7f',
  'Beds & Comfort': '#9b6cc4',
  'Treats & Food': '#d9663d',
  'Home & Apparel': '#3aa0c4',
}
