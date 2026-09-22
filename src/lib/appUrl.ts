// Where this app really lives.
//
// Password-reset and invite emails carry a link back into the app. Using
// `window.location.origin` looked right but wasn't: someone who opened the old
// ohrr-app.netlify.app mirror got an email pointing back at that stale copy, so
// the reset landed on software from weeks ago. Emails now always point at the
// canonical app — except in local development, where the origin is what you
// want.
export const CANONICAL_ORIGIN = 'https://ohrr-app.pages.dev'

/** The origin an emailed link should come back to. */
export function authOrigin(): string {
  if (typeof window === 'undefined') return CANONICAL_ORIGIN
  const origin = window.location.origin
  // Local development and Cloudflare preview builds keep their own origin so a
  // reset can be tested where it was started.
  if (/localhost|127\.0\.0\.1|\.pages\.dev$/.test(origin)) return origin
  return CANONICAL_ORIGIN
}
