// Where My Bunny's quick links point. Kept in one place so they're trivial to
// re-point as the app grows. (No imports from src/data on purpose — this
// feature should merge cleanly no matter how the data files move.)

/** In-app Hop Shop (supplies & merch). */
export const HOP_SHOP_TO = '/hop-shop'

/** In-app rabbit-care articles. */
export const LEARN_TO = '/learn'

/**
 * Rabbit-savvy vet directory. There is no in-app /vets route on this branch;
 * when one lands, set `to: '/vets'` and the profile/emergency cards switch to
 * it automatically (the OHRR website page stays as the fallback).
 */
export const VET_DIRECTORY: { to: string | null; href: string } = {
  to: null,
  href: 'https://www.ohiohouserabbitrescue.org/rabbit-care/vets/',
}

/** After-hours exotics emergency contact, as supplied in the feature brief. */
export const EMERGENCY_VET = {
  name: 'MedVet Hilliard',
  phone: '614-870-0480',
  phoneHref: 'tel:+16148700480',
  note: 'Open 24/7 for exotics emergencies',
}
