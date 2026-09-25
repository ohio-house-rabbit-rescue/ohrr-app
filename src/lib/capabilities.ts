// The capability catalog — mirrors the `permissions` seed in the migration.
// Capabilities are the named, gated actions a worker can be granted. Owners and
// admins implicitly hold all of them (enforced in has_permission() in the DB).
//
// The UI uses these to show/hide controls; the DATABASE is the real gate (RLS),
// so a hidden button is convenience, not security.

export const CAPABILITIES = [
  'hopshop.products.create',
  'hopshop.products.edit',
  'hopshop.products.delete',
  'hopshop.inventory.update',
  'hopshop.orders.view',
  'adoptions.listings.create',
  'adoptions.listings.edit',
  'adoptions.status.change',
  'volunteers.shifts.manage',
  'volunteers.signups.approve',
  'volunteers.certificates',
  // Update 29: the Legacy Fund's Rescue Rabbit Guardians list.
  'giving.guardians',
  'content.education.edit',
  'events.bunfest.manage',
  'announcements.post',
  'staff.invite',
  'staff.permissions.manage',
  'audit.view',
  'settings.manage',
  'inbox.manage',
  'bookings.manage',
  'social.publish',
  'social.approve',
  'counter.use',
] as const

export type Capability = (typeof CAPABILITIES)[number]

// Grouped catalog for the admin Team screen (area → capabilities), matching the
// seeded `permissions.area` + `description`. Loading from the `permissions` table
// would also work; this keeps the labels available without a round-trip.
export interface PermissionMeta {
  key: Capability
  area: string
  description: string
}

export const PERMISSION_CATALOG: PermissionMeta[] = [
  { key: 'hopshop.products.create', area: 'Hop Shop', description: 'Add new products' },
  { key: 'hopshop.products.edit', area: 'Hop Shop', description: 'Edit product details' },
  { key: 'hopshop.products.delete', area: 'Hop Shop', description: 'Delete products' },
  { key: 'hopshop.inventory.update', area: 'Hop Shop', description: 'Update stock quantities' },
  { key: 'hopshop.orders.view', area: 'Hop Shop', description: 'View orders' },
  { key: 'adoptions.listings.create', area: 'Adoptions', description: 'Create adoptable rabbit listings' },
  { key: 'adoptions.listings.edit', area: 'Adoptions', description: 'Edit adoptable rabbit listings' },
  { key: 'adoptions.status.change', area: 'Adoptions', description: "Change a rabbit's adoption status" },
  { key: 'volunteers.shifts.manage', area: 'Volunteers', description: 'Create/manage volunteer shifts' },
  { key: 'volunteers.signups.approve', area: 'Volunteers', description: 'Approve volunteer sign-ups' },
  { key: 'volunteers.certificates', area: 'Volunteers', description: 'Make volunteer certificates and set the hours that earn one' },
  { key: 'giving.guardians', area: 'Giving', description: 'Keep the Rescue Rabbit Guardians list (the Legacy Fund thank-you)' },
  { key: 'content.education.edit', area: 'Content', description: 'Edit education / care content' },
  { key: 'events.bunfest.manage', area: 'Events', description: 'Manage Midwest BunFest info' },
  { key: 'announcements.post', area: 'Content', description: 'Post announcements' },
  // Update 30: sharing only goes downwards, and only tasks you hold.
  { key: 'staff.invite', area: 'Staff', description: 'Invite people — to levels below yours, sharing only tasks you have' },
  {
    key: 'staff.permissions.manage',
    area: 'Staff',
    description: 'Change the level, tasks and access of people below you (sharing only tasks you have)',
  },
  { key: 'audit.view', area: 'Staff', description: 'View the activity log' },
  { key: 'settings.manage', area: 'Staff', description: 'Change app settings and turn test features on/off' },
  { key: 'inbox.manage', area: 'Inbox', description: 'Read and handle requests sent from the app and website' },
  { key: 'bookings.manage', area: 'Bookings', description: 'Set up bookable shifts & appointments, see rosters, confirm and check in' },
  { key: 'social.publish', area: 'Content', description: 'Release queued social-media posts (the one person who posts as OHRR)' },
  { key: 'social.approve', area: 'Content', description: 'Approve social-media posts written by someone else' },
  { key: 'counter.use', area: 'Counter', description: 'The Counter: add items, ring up sales, take tickets at the door, sell raffle tickets' },
]

// The preset → capabilities bundles, mirroring `permission_presets` in the seed
// (and update 30's additions). Highest level first; the level each one suggests
// is PRESET_SUGGESTED_LEVEL in staffLevels.ts. Admin 1–3 have none.
export const PRESETS: Record<string, Capability[]> = {
  // Update 30: the board's oversight and approvals (Board).
  Board: ['audit.view', 'social.approve', 'volunteers.certificates', 'giving.guardians'],
  // Lead:
  'Hop Shop Manager': [
    'hopshop.products.create',
    'hopshop.products.edit',
    'hopshop.products.delete',
    'hopshop.inventory.update',
    'hopshop.orders.view',
  ],
  'Adoptions Coordinator': [
    'adoptions.listings.create',
    'adoptions.listings.edit',
    'adoptions.status.change',
    'inbox.manage',
    'bookings.manage',
  ],
  'Volunteer Lead': ['volunteers.shifts.manage', 'volunteers.signups.approve', 'inbox.manage', 'bookings.manage'],
  'Content Editor': ['content.education.edit', 'announcements.post', 'events.bunfest.manage'],
  // Update 30: whoever runs the festival and its bookings.
  'BunFest & Events': ['events.bunfest.manage', 'bookings.manage', 'counter.use'],
  // Volunteer 3 — update 30: the Inbox; and (update 26) a second pair of eyes on social posts.
  'Inbox helper': ['inbox.manage'],
  'Content Approver': ['social.approve'],
  // Volunteer 2 — update 30: one area each.
  'Care pages helper': ['content.education.edit'],
  'Rabbit listings helper': ['adoptions.listings.create', 'adoptions.listings.edit', 'adoptions.status.change'],
  // Volunteer 1 — the till and the door only: no website editing, deleting or voiding.
  'Counter volunteer': ['counter.use'],
  // Volunteer 1 — a certified Hop Shop worker (update 28): the counter, stock counts and orders.
  'Hop Shop Worker': ['counter.use', 'hopshop.inventory.update', 'hopshop.orders.view'],
}
