# OHRR App — Progress Log

> The single source of truth for "where is this project right now." A fresh
> session (human or AI) should be able to resume from **GitHub `main` + this file
> + the Drive design docs** alone. Keep it current: update and push at the end of
> every work chunk, and mirror a copy to the Drive folder "OHRR App Design" as
> `04-progress-log.md`.

- **Last updated:** 2026-06-17
- **Repo:** https://github.com/chasingtheunicorn/ohrr-app
- **Live site:** https://ohrr-app.netlify.app
- **Local working tree:** `C:\Users\johns\ohrr-app` (this is the git repo; the
  Google Drive "OHRR App Design" folder holds the canonical *design* docs only).
- **New here? Read [`START-HERE.md`](START-HERE.md) first** — storage map, how to
  resume, and why Claude sessions kept disappearing (open the project from the
  local repo path above, **not** the Google Drive Streaming path).

---

## Current state (at a glance)

- **Workflow:** finished, verified work is merged straight to `main` (auto-deploys
  to Netlify) — the sponsor is the only stakeholder, so we don't park work in draft
  PRs. Still branch + PR per change for clean history.
- **Latest on `main`:** [PR #11](https://github.com/chasingtheunicorn/ohrr-app/pull/11)
  (Volunteer hub in-app + realistic bunny photos + softer surrender framing) is
  **merged & live**. The **event map** (`feat/event-map`) is the next merge.
- **Merged & live:** #11, [#10](https://github.com/chasingtheunicorn/ohrr-app/pull/10)
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
- **Backend:** none yet. `.env.example` documents a future Supabase setup (public
  anon key in browser, service_role server-side only) but it is **not wired in** —
  v1 is read-only + outbound.

---

## What's been built

### OHRR host app (routes under `/`)
- **Home** (`OhrrHome`) — branded landing / hub.
- **Adopt** (`Adopt`, `AdoptRabbit`) — live adoptable rabbits via the Petfinder
  Netlify function, with sample fallback; per-rabbit detail pages. *(PR #11)* The
  sample rabbits now show **real, freely-licensed photos** (bundled in
  `public/sample-bunnies/`, mapped in `src/data/photos.ts`) instead of an emoji;
  `RabbitPhoto` falls back to the placeholder only if an image fails to load.
  Photo credits are listed on the Settings screen.
- **Happy Tails** (`Tails`, `TailDetail`) — adopter showcase with a bunny status
  timeline and a "follow" capability (`src/lib/follow.ts`).
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
- **Support / Give** (`Give`) — consolidated giving directory.
- **Settings** (`Settings`, gear icon in both top bars) — app version/build info,
  optional email identity (`src/lib/profile.ts`), and a saved-data summary.
- **About** (`About`), **NotFound** (`*`). *(PR #11)* The blunt "Surrender a
  rabbit" button is reframed as a compassionate **"Need help with your rabbit?"**
  card that leads with reaching out; the owner-surrender path stays available but
  de-emphasized as a small text link.
- **Top bar** *(PR #11)*: the outbound website link was removed from `OhrrTopBar`
  (Settings gear remains).

### Midwest BunFest sub-app (routes under `/bunfest`, distinct look & feel)
- **Home** (`BunfestHome`), **Schedule** (`Schedule`), **Vendors**
  (`Vendors`, `VendorDetail`), **Rescue Partners** (`Partners`, `PartnerDetail`),
  **Sponsors** (`Sponsors`), **Visit** (`Visit`), **Give**.
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

### Structure
- `src/pages/*` — route components (listed above).
- `src/components/*` — `OhrrLayout`/`OhrrTopBar`/`TabBar` (host shell),
  `BunfestLayout`/`BunfestTopBar` (sub-app shell), `RabbitPhoto`, `ScrollToTop`,
  `ui.tsx`, `tailbits.tsx`, `icons.tsx`.
- `src/data/*` — content/data modules: `adoptables`, `care`, `content`, `event`,
  `floorplan` (BunFest rooms/zones + vendor booth assignments), `giving`, `ohrr`,
  `partners`, `photos` (sample bunny images + credits), `services`, `sessions`,
  `sponsors`, `tails`, `vendors`, `volunteer` (ways + template
  shifts/runs/events/bunnies), `version`.
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
- **Dynamic features are mocked or client-only** — service sign-ups, follow, etc.
  have no backend persistence (no Supabase wired in).

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
