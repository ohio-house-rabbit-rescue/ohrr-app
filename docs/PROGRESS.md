# OHRR App — Progress Log

> The single source of truth for "where is this project right now." A fresh
> session (human or AI) should be able to resume from **GitHub `main` + this file
> + the Drive design docs** alone. Keep it current: update and push at the end of
> every work chunk, and mirror a copy to the Drive folder "OHRR App Design" as
> `04-progress-log.md`.

- **Last updated:** 2026-09-17
- **Repo:** https://github.com/chasingtheunicorn/ohrr-app
- **Live site:** https://ohrr-app.netlify.app
- **Local working tree:** `C:\Users\johns\ohrr-app` (this is the git repo; the
  Google Drive "OHRR App Design" folder holds the canonical *design* docs only).
- **New here? Read [`START-HERE.md`](START-HERE.md) first** — storage map, how to
  resume, and why Claude sessions kept disappearing (open the project from the
  local repo path above, **not** the Google Drive Streaming path).

---

## Current state (at a glance)

- **App settings + raffle-ticket TEST feature — LIVE (2026-09-17).** Sponsor decision:
  the in-app "reserve numbered raffle tickets, pay at the table" flow is a **test
  feature** — hidden from the public by default and shown only while an owner switches
  it on in the app; its pricing is **never hard-coded** (the old "$1 each / 6 for $5"
  was unverified and is gone) — staff enter it.
  - **Migration (apply AFTER `20260917130000_raffle_items.sql`):**
    `supabase/migrations/20260917170000_app_settings.sql` — seeds the capability
    `settings.manage` (Staff area; owners/admins hold it implicitly), creates
    `app_settings` (org_id, key, jsonb value; public select, writes gated on
    `settings.manage`; **non-secret flags only** — every row is publicly readable), and
    adds nullable `raffle_ticket_price_cents`, `raffle_bundle_qty`,
    `raffle_bundle_price_cents`, `raffle_details` to `auction_settings`. Until it's
    applied the app quietly behaves as "everything off / nothing set".
  - **Staff → Settings** (`/staff/settings`, `StaffSettings`, gated `settings.manage`;
    nav entry + dashboard tile): a "Test features" list of switches
    (`src/features/settings/testFeatures.ts` — add a feature = one `{key,label,description}`
    entry). First switch: **Raffle ticket reservation** → `app_settings`
    `raffle_tickets_enabled` = `{"enabled": true}`.
  - **Staff → Silent Auction → Auction setup** now has a **Raffle tickets** group: ticket
    price ($ → cents), optional bundle (quantity + price; both or neither), and a free-text
    details line (where tickets are sold, drawing time…). Saved with the same upsert.
  - **Public:** `RaffleTickets` (on `/bunfest/p/raffle`) renders **only** while the flag is
    on, carries a small **Preview** chip, and shows a price line / total **only** from
    `auction_settings` (unset → no price shown, blank total in the form post). The
    staff `raffle_details` text appears under the page's neutral "Raffle" copy when set.
    Reservations still post to the Netlify Form `raffle-request` (hidden form registered
    in `index.html`: quantity, total, MWBF-##### ticket codes, name, phone) — codes are
    generated client-side; **no payment processing** was added.
  - Hook: `src/features/settings/useSetting.ts` — `useSetting<T>(key, fallback)` /
    `useFeatureFlag(key)` (silent fallback on missing table/row), `fetchSettings(orgId)`,
    `setSetting(key, value, {orgId, userId})`.

- **Live-site parity + shared data contract — LIVE (2026-09-17).** Everything on
  the read-only WordPress site (ohiohouserabbitrescue.org) is now IN the app, built
  for phones, and the app shares ONE Supabase backend with the new OHRR website:
  - **New tables (migrations to paste into the Supabase SQL editor, in this order):**
    `supabase/migrations/20260917120000_events.sql`,
    `supabase/migrations/20260917120100_vets.sql`,
    `supabase/migrations/20260917120150_hero_slides.sql` (+ public `site-images`
    Storage bucket), then the seed
    `supabase/migrations/20260917120200_seed_live_site_content.sql` (idempotent;
    BunFest 2026 event, 27 vets, 13 care articles, the 4 volunteer positions, 6
    hero/featured slides). The seed is **generated** from the app's own data files by
    `node scripts/generate-seed-sql.mjs` (Node 22.6+), so the app fallback, the DB and
    the website agree — edit `src/data/{events,vets,careArticles,volunteer,heroSlides}.ts`
    and re-run; never hand-edit the seed. Until the migrations are applied every screen
    silently uses the bundled seed (`useEvents`, `useVets`, `useHeroSlides`,
    `useCareArticles` fallback).
  - **New public screens:** `/events` (upcoming first, map + calendar links),
    `/vets` (Find a rabbit-savvy vet: region filter, MedVet Hilliard 24/7 emergency
    banner, tap-to-call, EMERGENCY badges, low-cost spay/neuter, HRS vet lists, the
    live-site disclaimer), `/found` (Found a rabbit? / Need to surrender?: domestic-vs-wild,
    catching a stray, CHRS Help Line + Columbus Rabbit Field Rescue path, Admissions facts
    + both official online applications), `/adopt/how-it-works` (3 steps, still-deciding
    hour-long visit, free bunny matchmaking + what to expect at a bunny date, Petfinder /
    Adopt-A-Pet links, Adoption Policy summary + fees). `/give` redirects to `/support`.
  - **Rebuilt screens:** Home (photo quick actions: Find a vet · Found a stray · Adopt ·
    Volunteer · Give · Events; top cards from `hero_slides`; BunFest date/theme live),
    Give (EVERY channel incl. Kroger, license plate, merch, affiliates, Legacy Fund,
    Spay It Forward — with in-app "More" detail), Volunteer + VolunteerWay (the 4 REAL
    positions with verbatim requirements + real sign-up links; other needs; group visits;
    live "Open shifts"), Learn (13 seeded articles from the Resources page + Living Space
    + Stray, bare URLs tappable, vet card), Hop Shop (real product list, hours, map,
    live "In the shop now" when RLS allows), About (Mission & Vision, Background,
    Volunteer Family, contact parity incl. landmark directions, media email, socials).
    The BunFest sub-app reads its date/time/venue/theme from the BunFest event record
    via `useBunfestEvent()`.
  - **Staff:** `/staff/events` (gated `events.bunfest.manage`) and `/staff/vets`
    (gated `content.education.edit`), both with one-tap import of the bundled seed;
    nav entries + dashboard tiles; volunteer categories now `socialization` / `buncare` /
    `vet-transport` / `field-rescue` / `events` (unknown values tolerated).
  - **Unchanged by sponsor instruction:** adoptable rabbits stay on the labelled sample
    data; the Petfinder function was not touched. Link-only/noindex settings untouched.
  - **Could not fetch/verify:** the Binkybunny.com "cost of a house rabbit" page (404 —
    summarized from OHRR's description only, still linked); the Columbus Rabbit Field
    Rescue Facebook group has no public URL on the live site (named, not linked); the
    2026 BunFest logo artwork is not bundled (2025 logo still shown, theme text is 2026).

- **Staff backend (Supabase) — MERGED & LIVE (2026-06-27).** [PR #28] merged to
  `main` (merge `a60b8b5`) and **deployed to `ohrr-app.netlify.app`**. The staff admin
  is reachable at **`/staff`** (unlinked from the public app): Supabase Auth sign-in,
  role/capability access control, master-code owner bootstrap, a capability-gated
  **Hop Shop manager** (CRUD + inventory), a **Team** screen (invite + per-capability
  toggles + enable/disable), and worker **join**. The browser-safe Supabase config is
  committed in **`.env.production`** (public project URL + *publishable* anon key —
  safe by design; secrets never committed) so the Netlify build connects without
  dashboard env setup; verified the URL bakes into the live bundle and that RLS blocks
  anonymous access. Owner decisions confirmed 2026-06-27: login = email+password,
  admins = full access (no code change needed). Owner has **signed in + redeemed the
  master code (verified live 2026-06-27)**. A **second increment is live ([PR #29])**:
  a discreet **Settings → "OHRR Staff"** entry point (so staff don't need the `/staff`
  URL), an **Activity** (audit-log) view, and the **Team** screen now shows members by
  **email** via `list_org_members()` — apply
  `supabase/migrations/20260627053730_staff_admin_extras.sql` in the Supabase SQL
  editor to enable it (falls back to short IDs otherwise). **Password reset is now live ([PR #30])** — a
  "Forgot password?" flow on sign-in + a `/staff/reset` page; it needs one Supabase
  config step to accept the emailed link: add the app origin
  (`https://ohrr-app.netlify.app`) under **Auth → URL Configuration** (Site URL +
  Redirect URLs). The owner chose to **keep the public Hop Shop on curated samples**
  for now (not wired to live inventory). With that, the **staff admin is
  feature-complete for release** — what's left is owner-side Supabase config only
  (below). **Heads-up:** the Supabase project currently has **email confirmation ON**
  (`mailer_autoconfirm=false`), so new staff get a confirmation email — turn it off
  (Auth → Providers → Email → "Confirm email") for frictionless signup, or click the
  emailed link. See the **Staff backend (Supabase)** section below.
- **Staff-editable content (in progress, 2026-06-27).** Extending staff editing
  beyond the Hop Shop to everything non-static (owner's request). Per-area pattern: a
  DB table (RLS — public reads *published* rows, staff with that area's capability read
  drafts + write), a staff editor screen, and the public app reads live data (with
  sample fallback where it makes sense). **#1 Announcements is LIVE ([PR #31])**:
  `/staff/announcements` (gated `announcements.post`) posts notices shown on the OHRR
  home via `AnnouncementsBanner`. **Owner step:** apply
  `migrations/20260627063130_announcements.sql` in the Supabase SQL editor to switch it
  on (until then the banner shows nothing and the editor errors — nothing else breaks).
  **#2 Volunteer opportunities is LIVE ([PR #32])**: `/staff/volunteer` (gated
  `volunteers.shifts.manage`) manages the shifts / vet-transport runs / events shown
  on the `VolunteerWay` pages — each category shows live staff data when present,
  else the built-in samples; apply
  `migrations/20260627064506_volunteer_opportunities.sql`. **#3 Education / care guides
  is LIVE ([PR #33])**: `/staff/learn` (gated `content.education.edit`) edits the
  Rabbit Care articles — a one-click "Import the built-in guides" seeds the 7 existing
  guides (light-markdown body: `##` headings, `-` bullets); `Learn`/`LearnTopic` render
  live-or-built-in; apply `migrations/20260627065720_care_articles.sql` then tap import.
  **#4 Adoptable rabbits is LIVE ([PR #35])**: `/staff/adopt` (gated `adoptions.*`)
  manages rabbits with **photo uploads** (Supabase Storage `rabbit-photos` bucket) and
  adoption status (`set_rabbit_status` RPC for status-only workers); `getAdoptables()`
  now prefers app rabbits (then Petfinder, then samples); apply
  `migrations/20260627072524_rabbits.sql` (creates the table, RPC, and Storage bucket).
  **All four planned content areas are now staff-editable** (announcements, volunteer,
  care, adoptions). The Hop Shop *public* view still shows curated samples by the
  owner's choice (the staff Hop Shop manager is live).
- **Workflow:** finished, verified work is merged straight to `main` (auto-deploys
  to Netlify) — the sponsor is the only stakeholder, so we don't park work in draft
  PRs. Still branch + PR per change for clean history. *(Exception: the staff-backend
  build above keeps one draft PR open across steps, since its pieces — auth, RLS,
  screens — only fully verify together against the live Supabase project.)*
- **Latest on `main`:** [PR #13](https://github.com/chasingtheunicorn/ohrr-app/pull/13)
  (in-app polish: volunteer role codes, wrapping vendor filter, in-app surrender
  content) is **merged & live**, on top of #12 (event map) and #11 (volunteer hub +
  photos). The **in-app surrender intake form** (`feat/surrender-intake-form`) is the
  next merge.
- **Merged & live:** #13, #12, #11, [#10](https://github.com/chasingtheunicorn/ohrr-app/pull/10)
  (Settings + calendar chooser), [#9](https://github.com/chasingtheunicorn/ohrr-app/pull/9)
  (plan-your-day); PRs #1–#8 merged/closed.
- **Build health:** `npm run typecheck` and `npm run build` pass clean; features
  verified in-browser (or, when the screenshot tool is down, via the a11y snapshot
  + DOM geometry checks + interaction tests).
- **Phase:** v1 shipped and deployed. The app has grown well past the original
  "BunFest companion" scope into a full OHRR host app with BunFest as a themed
  sub-app. Now layering in attendee-retention + identity features, and making the
  service sections (Volunteer first) actually usable in-app.
- **Identity/backend note:** an optional email "profile" capability now exists
  (device-local, stable anonymous UUID, `src/lib/profile.ts`). `identityPayload()`
  is the seam for the **still-pending backend decision** — wiring a database to
  persist/sync profiles + saved data is the next major step.

---

## Stack & deployment

- **Frontend:** Vite 6 + React 19 + TypeScript + Tailwind CSS v4 + React Router 7.
- **Hosting:** Netlify. Build `npm run build` → `dist/`; SPA fallback redirect so
  deep links/refreshes work; `NODE_VERSION = 22`.
- **Serverless:** `netlify/functions/petfinder.js` proxies Petfinder's API so the
  Adopt page can show OHRR's live adoptable rabbits. Credentials
  (`PETFINDER_CLIENT_ID/SECRET/ORG_ID`) are server-side only (set in Netlify env,
  never `VITE_`-prefixed). Until set, the page falls back to built-in sample data.
- **Backend:** **Supabase (Postgres + Auth + RLS)** is now being wired in for the
  **staff side** (`@supabase/supabase-js`, schema under `supabase/migrations/`,
  client in `src/lib/supabase.ts`). The public attendee-facing app is still
  read-only + outbound and builds/runs **without** Supabase env — staff screens show
  a "not configured" notice until `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are
  set (`.env.local` locally, Netlify env when deployed; anon key only on the client,
  never the service_role key). The Supabase schema is **already applied** to the live
  project and the OHRR org + a one-time master code are bootstrapped (the migration
  file just version-controls it).

---

## What's been built

### OHRR host app (routes under `/`)
- **Home** (`OhrrHome`) — branded landing / hub. *(feat/appointment-flow)* The visit
  mini-card no longer shows the street address; it shows hours + a "Visits are by
  appointment — schedule one" link to the new Appointment page (address is revealed
  there, after a visit is requested).
- **Appointment** (`Appointment`, `/appointment`) *(feat/appointment-flow,
  feat/appointment-slots, feat/appointment-date)* — a by-appointment "Schedule a
  Visit" page: a request form (Netlify `appointment-request`) plus a "prefer to
  call?" option. It has a **required date picker** (native calendar/manual entry,
  no past dates, **weekend-only** — weekday picks warn and block submit, since OHRR
  is open Sat/Sun) and **eight 30-minute slots** (12:00–3:30 PM, OHRR's open hours),
  **multi-select** so a visitor can flag
  several times that work (auto-sorted to clock order) — framed as **requests, not a
  booked time** (real availability/booked-slot logic awaits a backend). The
  **address/location shows only on the confirmation**, once a visit is requested.
  Swappable to a real third-party scheduler later if OHRR adopts one.
- **Adopt** (`Adopt`, `AdoptRabbit`) — live adoptable rabbits via the Petfinder
  Netlify function, with sample fallback; per-rabbit detail pages. *(PR #11)* The
  sample rabbits now show **real, freely-licensed photos** (bundled in
  `public/sample-bunnies/`, mapped in `src/data/photos.ts`) instead of an emoji;
  `RabbitPhoto` falls back to the placeholder only if an image fails to load.
  Photo credits are listed on the Settings screen.
- **Happy Tails** (`Tails`, `TailDetail`) — adopter showcase with a bunny status
  timeline and a "follow" capability (`src/lib/follow.ts`). *(feat/tails-and-bunfest-logo)*
  Now uses **real freely-licensed photos** (distinct set from Adopt, in
  `public/sample-bunnies/tail-*`) and **words-only status badges** — the cheesy
  status emojis (💪/🎉/etc.) were removed per sponsor feedback ("no icons — they date it").
  *(feat/tails-share-and-nav)* "Share your Happy Tail" is now an **in-app form**
  (`ShareTail`, `/tails/share`, Netlify `happy-tail`) instead of a link to the website.
- **Bunny Services** (`Services`, `ServiceSignup`) — bonding-session requests and
  mobile vet-clinic sign-ups.
- **Learn** (`Learn`, `LearnTopic`) — rabbit-care content brought fully in-app
  (native pages, not external links).
- **Volunteer** (`Volunteer`, `VolunteerWay`, `VolunteerSignup`) *(PR #11)* —
  built out as a real in-app section. "Become a volunteer" now opens an in-app
  form (Netlify `volunteer-signup`), not the OHRR website. Each way to help
  (`/volunteer/:slug`: socialization, vet-transport, events, foster) has its own
  detail page with **template data** clearly labelled *Sample* — bunnies who need
  socializing (with photos), open 1-hr shifts, vet-transport runs, and outreach
  events — each routing into the shared sign-up flow. Content in `src/data/volunteer.ts`.
  *(feat/inapp-polish)* Every sign-up now carries a **stable role `code`**
  (SOCIALIZE / VET-TRANSPORT / EVENTS / FOSTER / GENERAL) plus the human role and
  the specific `item`, so the OHRR-side submission says exactly what someone signed
  up for; the sign-up form headlines the role instead of a generic title.
- **Support / Give** (`Give`) — consolidated giving directory.
- **Hop Shop** (`HopShop`, `/hop-shop`) *(feat/hop-shop)* — an in-app, **browse-only**
  shop (the "Shop the Hop Shop" link is now native, not outbound) showing **example
  inventory** of real rabbit products + OHRR merch (16 items across Hay & Food /
  Toys / Comfort & Litter / Apparel, with prices + In/Low stock + a category
  filter), the Hop Shop's hours & address, and a note that purchases happen in
  person. Sample data clearly labelled; real stock will come from the planned
  staff scan-a-product / set-quantity tool. Data in `src/data/hopshop.ts`.
- **Settings** (`Settings`, gear icon in both top bars) — app version/build info,
  optional email identity (`src/lib/profile.ts`), and a saved-data summary.
- **About** (`About`), **NotFound** (`*`). *(PR #11)* The blunt "Surrender a
  rabbit" button is reframed as a compassionate **"Need help with your rabbit?"**
  card that leads with reaching out; the owner-surrender path stays available but
  de-emphasized — now linking to the in-app Surrender page (below), not the website.
- **Surrender** (`Surrender`, `/surrender`) *(feat/inapp-polish)* — OHRR's owner-
  surrender process brought **fully in-app** (no more linking out for the info):
  supportive intro, the 6-step process, the $40/$60 surrender donation, what happens
  to the rabbit after intake, the Good-Samaritan-vs-owner distinction, contact, and
  the **verbatim full policies** (Surrender & Relinquishment + Admissions) in
  collapsible sections. Content in `src/data/surrender.ts`, from OHRR's policy PDFs.
- **Intake form** (`SurrenderForm`, `/surrender/form?type=owner|good-samaritan`)
  *(feat/surrender-intake-form)* — the relinquishment **intake form is now in the
  app** instead of linking to OHRR's website. One data-driven form (schema in
  `src/data/surrenderForm.ts`) handles both types: owner (contact + full rabbit
  profile — enclosure, behaviors, litter, diet, vet, spay/neuter, etc.) and Good
  Samaritan (find circumstances). It carries the **verbatim relinquishment
  agreement** with a required checkbox + typed signature + date, and posts to
  Netlify Forms (`surrender-intake`, registered in `index.html`). The Surrender
  page’s two form buttons open it in-app.
- **Top bar / header** *(PR #11, feat/header-help-search, feat/tails-share-and-nav)*:
  outbound website links removed; the right-side cluster is a shared `HeaderActions`
  (**Search · Help · Settings**) on **both** top bars. **Returning from BunFest to
  the OHRR app is now an "OHRR" home tab — the first item in the BunFest bottom tab
  bar** (with a divider), chosen by the sponsor over two rejected top-of-screen
  treatments. The BunFest header is now clean (no back strip).
- **Help** (`Help`, `/help`) *(feat/header-help-search → rebuilt in feat/help-faq-hub)*
  — the `?` icon opens a **FAQ + support hub**: a prominent "Call / Email OHRR"
  card, a filterable FAQ (~21 Qs across Adopting · Care · Giving · Volunteering &
  surrender · BunFest · Using the app), each answer with a one-tap jump into the
  matching in-app page. This replaced the original screen-by-screen "describer,"
  which the sponsor (rightly, per UX research) found low-value. Content in
  `src/data/help.ts`.
- **Search** (`Search`, `/search`) *(feat/header-help-search)* — the search icon
  opens a **global app search** (type **or voice** via the Web Speech API) over an
  index of screens, adoptable rabbits, care topics, vendors, Happy Tails, volunteer
  roles, giving options, and BunFest sessions; results are grouped and link straight
  to the page. Index in `src/data/search.ts`. (Page-specific search is a future add.)

- **Rescue Partners / Find a Rescue** (`Partners`, `PartnerDetail`)
  *(feat/rescue-partner-directory)* — the partner directory is now a real
  **find-a-rescue hub**: each org shows researched **contact info** (address, phone
  → dialer, email → mail app, and the website **as text** above a "Visit website"
  button — via the reusable `ContactLinks`), and the list has **search by
  name/state** (full name or 2-letter, via `US_STATES`) **+ region filter**
  (Midwest/Northeast/South). The same component is mounted in **two places** (a
  `base` prop): BunFest (`/bunfest/partners`) and the **OHRR host app**
  (`/rescues` "Find a Rescue", in the home hub) so anyone, anywhere, lands on OHRR
  as the hub. Contact data researched from each org's public site 2026-06-18
  (fields left blank where not published — not guessed). Data + `US_STATES` in
  `src/data/partners.ts`.

### Midwest BunFest sub-app (routes under `/bunfest`, distinct look & feel)
- **Home** (`BunfestHome`), **Schedule** (`Schedule`), **Vendors**
  (`Vendors`, `VendorDetail`), **Rescue Partners** (`Partners`, `PartnerDetail`),
  **Sponsors** (`Sponsors`), **Visit** (`Visit`), **Give**.
- **BunFest content native** (`BunfestPage`, `/bunfest/p/:id`) *(feat/bunfest-native)*
  — the festival is now its **own entity** in-app: the "At the festival" activities
  (Bunny Spa, Glamour Shots, Raffle & Silent Auction, Toymaking, Chillaxabun Lounge —
  Education Sessions points to the native Schedule) and the Visit info pages
  (Bringing Your Bunny, the 9-term Rabbit Attendance Agreement, Accommodations/host
  hotel) are **native screens** instead of links out to midwestbunfest.org. Content
  transcribed from the BunFest site 2026-06-18; includes the RHDV2 vaccination rule,
  pricing, and the host-hotel contact (via `ContactLinks`). **Ticket purchase stays
  external** (payment). Data in `src/data/bunfestPages.ts`.
- **BunFest reserve & raffle** *(feat/bunfest-reserve-raffle)* — interactive add-ons
  on the activity pages: **Bunny Spa / Glamour Shots** have an in-app **session
  reservation** (`ReserveSession`: service + 30-min time window + name/phone/bunny →
  OHRR confirms; pay at the table — no payment backend needed), and the **Raffle** has
  an in-app **ticket flow** (`RaffleTickets`: quantity → reserves numbered MWBF-#####
  tickets to pay for at the table). **Since 2026-09-17 this is a TEST feature:** hidden
  unless switched on in `/staff/settings`, and pricing comes only from
  `auction_settings` (staff-entered; nothing hard-coded).
  Post to Netlify (`spa-reservation`, `glamour-reservation`, `raffle-request`),
  clearly labelled "pay in person until in-app payment is set up."
- **Silent Auction gallery** (`SilentAuction`, `/bunfest/silent-auction`)
  *(feat/silent-auction)* — a browsable gallery (linked from the Raffle page) of
  auction items, each with **item number, photo, description, estimated value, and a
  donor credit**, plus a category filter. Built to hold the real lineup ahead of the
  event (bidding stays in-person, by sponsor's choice); ships with **example items**
  using real representative photos (Wikimedia, credited in Settings) and BunFest
  vendor/sponsor donors, and shows a "Photo coming" placeholder for items without a
  photo yet. Data in `src/data/silentAuction.ts`.
- **Sponsor & vendor contact treatment** *(feat/sponsor-vendor-contacts)* — the
  Sponsors page now shows each sponsor's **researched contact info** via
  `ContactLinks` (address, phone → dialer, email → mail, website **as text** + a
  button) instead of a bare "Visit" link — most useful for the local Central Ohio
  vets (MedVet Hilliard, Pataskala, Animal Care Unlimited, Norton Road, Central Ohio
  Compounding). Vendor detail uses the same treatment for the shop link (URL text +
  "Visit shop"). Contacts researched from public listings 2026-06-18. Vendor *shops*
  remain external by design.
- **Year logo / theme art** *(feat/tails-and-bunfest-logo)* — the real **2025
  Midwest BunFest logo** ("Compassion in Motion") now headlines the BunFest card on
  the OHRR home and the BunFest home hero, replacing the cartoon-bunny emoji, to
  flag the year's theme. Bundled at `public/bunfest-2025-logo.jpg` and referenced
  via `event.logo` / `event.logoYear` — swap the file + year when 2026 art lands.
- **Event Map** (`EventMap`, `/bunfest/map`) *(feat/event-map)* — a built-in
  interactive floor plan that replaces the old external map link. Models the real
  2025 two-room layout (Burgundy + Emerald) with stages, Hop Shop, Bunny Spa,
  Glamour Shots, Chillaxabun Lounge, Silent Auction, Raffle, MedVet, etc., and lays
  all 27 vendors into numbered booths (B1–B12 / E1–E15) with one or two 8-ft tables
  each (Burgundy left→right, Emerald top→bottom). **Booth positions are estimates,
  clearly labelled** — OHRR sets the final layout. Tap a booth → vendor detail;
  deep-linkable `?vendor=<id>`. Vendor list/detail show booth + room. Data in
  `src/data/floorplan.ts`. *(Source: the real 2025 map at
  midwestbunfest.org/event-map.html.)*
- **Plan-your-day on Schedule** *(PR #9/#10, live)* — save/unsave sessions
  (account-free, `localStorage` via `src/lib/savedSessions.ts`), an All/Saved
  filter, and an "Add to calendar" chooser (`CalendarSheet`) offering **Apple/iOS**
  (one `.ics`, all saved) or **Google Calendar** (per-session links) via
  `src/lib/ics.ts`.

### Staff backend (Supabase) — routes under `/staff` *(feat/staff-backend, in progress)*
A separate, capability-gated admin shell for OHRR staff/volunteers, distinct from
the public attendee app. Design = `docs/05-...md`; schema = the Drive
`06-hopshop-backend.sql`. **Roles** owner/admin/staff; **capabilities** like
`hopshop.products.create`, `hopshop.inventory.update`, `staff.invite`. Owners/admins
implicitly hold all; staff hold only what's granted. **Row-Level Security in Postgres
is the real gate** — the UI only hides/shows controls for convenience.

- **Schema migration** — `supabase/migrations/20260627052536_hopshop_backend.sql`
  version-controls the already-applied schema (organizations, memberships, the
  permissions catalog + presets, invite codes, audit log, Hop Shop products +
  inventory, all RLS + the SECURITY DEFINER RPCs). Idempotent. `supabase/README.md`
  documents apply + `npm run gen:types`.
- **TS types** — `src/lib/database.types.ts` (hand-authored to mirror the applied
  schema until `supabase gen types --linked` can run with the project ref).
- **Client + context** — `src/lib/supabase.ts` (env-gated client + `errMessage`),
  `src/lib/capabilities.ts` (capability catalog + presets, mirrors the seed),
  `src/lib/auth.tsx` (`AuthProvider`/`useAuth`: session, membership, effective
  capabilities, `can()`, `refresh()`, `signOut()`).
- **Sign-in** (`StaffSignIn`, `/staff/signin`) — Supabase Auth **email + password**
  (sign in / create account; handles the "confirm your email" case), plus a
  **"Forgot password?"** flow → `/staff/reset` (`StaffResetPassword`) that consumes
  the recovery link and sets a new password. *(Email+password confirmed by the owner;
  magic-link remains a small swap if ever wanted.)*
- **Owner bootstrap** (`StaffOnboard`, `/staff/start`) — "Enter master code" →
  `rpc('redeem_master_code')` → caller becomes **Owner**.
- **Dashboard** (`StaffHome`, `/staff`) — routes by state (→ signin / → start /
  → dashboard); shows role, what you can manage, and a staff member's granted access.
- **Hop Shop manager** (`HopShopManager`, `/staff/hopshop`) — list / **create / edit /
  delete** products + a **stock stepper** (upserts `hopshop_inventory`). Every control
  is gated by the matching `hopshop.*` capability via `can()`, **and** the DB enforces
  it (RLS). View-only for members without write caps.
- **Team** (`StaffTeam`, `/staff/team`) — owner/admin (or `staff.invite` /
  `staff.permissions.manage`): **invite a worker** (role + preset or custom caps →
  `create_invite_code` → copyable single-use code), **per-capability toggles** on each
  staff member (`set_membership_permission`), and **enable/disable** (`set_membership_status`).
  Members currently show by role + short user-id (Supabase hides other users' emails
  from the client — a small `list_org_members()` SECURITY DEFINER function is the
  follow-up to show names/emails).
- **Worker join** (`StaffJoin`, `/staff/join`) — enter invite code →
  `redeem_invite_code` → joins scoped to the invite's preset/caps. Linked from the
  master-code screen.
- **Shell + guard** — `StaffLayout` (own top bar, role label, sign-out) + a compact
  **dropdown section menu** ([PR #34]) that shows the current section and opens a list
  of all of them — replaced the row of tabs that clipped once there were 7, and scales
  to any number of sections with no horizontal scroll. + `RequireMembership` (redirects
  to signin/start as needed). Wired in `App.tsx`; `AuthProvider` wraps the app in
  `main.tsx`.
- **Verified** so far via typecheck + `build` + browser render (sign-in renders,
  guard redirects unauthenticated `/staff/hopshop` → signin, public app unaffected,
  no console errors). **Live end-to-end auth/RLS not yet exercised** — needs the real
  `VITE_SUPABASE_*` env to sign in and redeem the master code.
- **Still to build (this feature):** live end-to-end verification against the real
  Supabase project (sign in → redeem master code → manage Hop Shop → invite a worker
  → worker joins → toggle caps); optionally a `list_org_members()` function to show
  member names/emails on the Team screen; optionally an audit-log view (`audit.view`);
  and connecting the **public** Hop Shop view to the live tables. Code-splitting the
  staff bundle (it pushed the JS to ~707 kB / 199 kB gzip) is a nice-to-have.

### Structure
- `src/pages/*` — route components (listed above).
- `src/components/*` — `OhrrLayout`/`OhrrTopBar`/`TabBar` (host shell),
  `BunfestLayout`/`BunfestTopBar` (sub-app shell), `RabbitPhoto`, `ScrollToTop`,
  `ui.tsx`, `tailbits.tsx`, `icons.tsx`.
- `src/data/*` — content/data modules: `adoptables`, `care`, `content`, `event`,
  `floorplan` (BunFest rooms/zones + vendor booth assignments), `giving`, `help`
  (FAQ categories + support hub), `ohrr`, `search` (global search index),
  `partners`, `photos` (sample bunny images + credits), `services`, `sessions`,
  `sponsors`, `surrender` (in-app owner-surrender content + verbatim policies),
  `surrenderForm` (intake form schema + relinquishment agreement), `tails`,
  `vendors`, `volunteer` (ways + role codes + template shifts/runs/events/bunnies),
  `version`.
- `src/lib/*` — `adopt.ts` (Petfinder helpers), `follow.ts` (follow state),
  `savedSessions.ts` (saved BunFest sessions), `ics.ts` (calendar export + Google
  URLs), `profile.ts` (optional email identity + DB-sync seam).
- `docs/*` — design docs (00–03), `START-HERE.md`, + this progress log.

### Shipped PRs (history)
1. Import OHRR design docs + project README. (#1)
2. Scaffold Midwest BunFest companion v1. (#2)
3. OHRR app as host + branded redesign, BunFest as themed sub-app. (#3)
4. Adopt page: live OHRR rabbits from Petfinder, in-app. (#4)
5. Happy Tails: adopter showcase + status timeline + follow. (#5)
6. BunFest Partners & Vendors detail pages, content in-app. (closed; work landed
   via the redesign/services line)
7. Bunny Services: bonding + vet-clinic scheduling & sign-ups. (closed; landed)
8. OHRR Learn & Volunteer content fully in-app. (#8)

---

## Known gaps / cleanup

- **README "Status" is stale** — it still says "No application code written yet."
  (Fixed in the commit that adds this log.)
- **Drive design docs (00, 02, 03) are stale** — they describe the Discovery
  phase ("no code yet"). They remain accurate as the *original strategy*, but a
  reader should treat this progress log as the live status. Consider refreshing
  them once we confirm with the sponsor.
- **No automated tests / CI** yet.
- **Public dynamic features are still client-only / Netlify Forms** — service
  sign-ups, follow, saved sessions, etc. have no database persistence. Supabase is
  now wired for the **staff** side; extending it to attendee-facing persistence is a
  separate, later step.
- **Staff backend not yet verified live** — auth + RLS + the RPCs are coded and
  build clean, but end-to-end (sign in → redeem master code → manage Hop Shop) needs
  the real `VITE_SUPABASE_*` env to exercise against the live project.

---

## Next steps (candidate, from the roadmap)

These are the sponsor-requested directions captured in project memory + the
strategy doc; not yet scheduled:

- **Donation tax-receipt flow** *(sponsor request 2026-06-17 → ON HOLD by sponsor
  decision same day)* — the plan is to **wire a real donation processor**
  (Donorbox / Givebutter / Stripe) so gifts are paid in-app and the processor
  auto-emails an **official, verified** tax receipt. The sponsor chose to defer this
  until a processor is set up, and explicitly **did not** want the interim
  self-reported PDF "acknowledgment" (to avoid OHRR issuing receipts for unverified
  amounts). OHRR has **no processor set up yet** (or it's unknown). Resume when a
  processor + its account/keys are available. Today the Give pages just deep-link to
  OHRR's own donation page.
- **Raffle / reservation ticketing — explore further** *(sponsor feedback 2026-06-18:
  "keep it as a note to come back to")* — the sponsor likes the in-app reserve /
  get-a-ticket flow for the **raffle, Bunny Spa, and Glamour Shots** (and that it
  lets people buy more tickets easily); **keep the current implementation as-is** for
  now. To work out next: the **ticket-number process** — how raffle ticket numbers
  are generated, made unique/verifiable, and especially **how a digital ticket ties
  into the in-person drawing** (so an app-issued ticket can be entered/win in the
  bucket draw). Pairs with wiring **in-app payment** so "get tickets" / reservations
  become real purchases (see the donation-processor item above). Today both reserve
  numbered tickets to pay for in person (`RaffleTickets` / `ReserveSession`).
- **Petfinder go-live** — set the real Petfinder credentials in Netlify so Adopt
  shows live inventory instead of samples. (Answered a sponsor question 2026-06-17:
  the Adopt page already uses the Petfinder feed via `netlify/functions/petfinder.js`;
  it only shows samples because `PETFINDER_CLIENT_ID/SECRET/ORG_ID` aren't set in
  Netlify yet. We use Petfinder, not the OHRR website, because the site blocks
  automated fetching and has no API.)
- **Engagement / follow** — turn the client-only follow into something durable.
- **Bonding & vet scheduling** — back the Services sign-ups with real persistence
  + notifications.
- **Content in-app** — continue migrating OHRR/BunFest content natively.
- **Backend decision** — choose and wire a backend (Supabase is the documented
  candidate) to persist sign-ups, follows, and any registration. The Volunteer
  sign-ups (`volunteer-signup`) and Service sign-ups currently post to Netlify
  Forms; a real backend would let shifts/runs show true remaining capacity.
- **Rabbit breed identifier / guide** *(sponsor request, 2026-06-17)* — a "what
  kind of bunny do I have?" feature OHRR's site doesn't have: the official list of
  rabbit breeds with a photo + short description of each. Research a good source
  (Wikipedia / Wikimedia Commons, ARBA breed list) for accurate details + freely
  licensed images. Scoped for later.
- **Dead external-link code cleanup** — remove unused `ExternalCard` (`ui.tsx`),
  `adoptLinks`/`learnLinks` (`ohrr.ts`), and stale `surrenderForms` URLs.
- **Amazon Wish List — deep links to items** *(sponsor request, later)* — instead of
  one link to the list, link directly to individual items (open in the Amazon app).
- **Hop Shop inventory back end** *(sponsor request; needs backend)* — the public
  **browse-only** Hop Shop view is **built** (`/hop-shop`, example data), and the
  **staff Hop Shop manager** (`/staff/hopshop`, Supabase-backed CRUD + stock) is now
  built behind the access-control model. Still to do: connect the **public** Hop Shop
  view to the live `hopshop_products`/`hopshop_inventory` tables (it currently reads
  static sample data), and add the nicer **scan-a-product + photograph + set-quantity**
  staff flow + product photos (Supabase Storage) on top of the basic manager.
- **In-app mailing-list signup** *(sponsor request, later; needs email backend)* —
  replace the outbound link with an in-app signup that uses the device profile email
  and **validates via an emailed code** entered back in the app.
- **Swap template volunteer data for OHRR's real schedule** — the shifts, runs,
  events, and socialization bunnies in `src/data/volunteer.ts` are clearly-labelled
  samples; replace with OHRR's actual calendar (or back them with the database).
- **Verify [VERIFY] facts with OHRR** — current hours; BunFest first year + edition
  count (matters for any anniversary feature).

---

## Working protocol (do not skip)

1. **On start:** pull `main`; read the four Drive docs (start with
   `03-conversation-summary.md`) and this log.
2. **Work on a branch**, keep a draft PR open; commit + push after every
   meaningful change — never leave work only in the session.
3. **End of each work chunk:** update this file, push it, and copy it to the Drive
   "OHRR App Design" folder as `04-progress-log.md`.
4. **Before ending a turn:** everything committed + pushed and this log current,
   so a fresh session can resume from GitHub + Drive alone.

## 2026-09-17 — Home screen: more above the fold
Sponsor: "the app has just BunFest above the fold — we need more ideas and options on the phone screen." Home now opens with a compact **My Bunny** strip (your bunny's photo or a rotating sample, greeting by name, next reminder / due badge, and a one-line "Today's tip" from OHRR's care topics that changes daily), then the hero slides as a **swipeable row** (BunFest first with a countdown; the next card peeks), then **quick actions 3-across**. The blue header is slimmer (its Adopt/Donate buttons duplicated the tab bar). Same data as before; hero/featured slides come from `hero_slides`.
