# OHRR App — Strategy & Findings

> Our thinking so far on **what we're trying to accomplish** and **how an app helps OHRR succeed**, derived from public research alone (no input required from OHRR yet). Companion to `01-OHRR-org-profile.md`. This is the idea-capture pass — we'll go deeper later.

---

## What we're trying to accomplish

Build an app that supports **all** of OHRR's efforts in one place:

1. **Rescue & adoption** — get more rabbits adopted into qualified homes, faster.
2. **Education** — teach good rabbit care so fewer rabbits are surrendered.
3. **Fundraising** — grow and diversify revenue, anchored by Midwest BunFest.
4. **Volunteer & foster capacity** — make it easy for people to give time.

### The core problem the app solves
OHRR is a small, volunteer-run operation **open only Sat/Sun noon–4, by appointment**, with its work scattered across a website, Facebook, Petfinder/Adoptapet, an Amazon wishlist, Kroger rewards, multiple donation pages, and a **separate BunFest website**. Every one of those is something a human must maintain or a supporter must hunt down. The single biggest thing an app does is **collapse that fragmentation into one always-on place**, so their reach isn't capped by two 4-hour windows a week and a handful of volunteers' spare time.

---

## Key components (candidate feature set)

| Component | What it does | Notes |
|---|---|---|
| **Adoptable-rabbit browser** | Browse available rabbits with photos, bios, status; request an appointment | Adoptions are appointment-only today (phone tag). Surface adoption requirements up front to pre-qualify adopters. |
| **Volunteer coordination** | Self-serve shift sign-up (e.g. the capped 1-hr socialization shifts), vet-transport scheduling, reminders | Auto-enforce the "max two 1-hour shifts/month" rule; cut no-shows. |
| **Foster management** | Foster intake, matching, tracking | Expands capacity beyond the center. |
| **Donations & recurring giving hub** | One place for every giving path: one-time, Kroger, workplace/matching, Legacy Fund, wishlist | Biggest leverage point — most donors never find the channels beyond a basic gift. |
| **Education hub** | Mobile-friendly care guides (diet, bonding, litter training, spay/neuter) + new-adopter onboarding | Serves the mission AND is preventive — informed owners surrender fewer rabbits. |
| **Midwest BunFest companion** | Session schedule, event map, vendor directory, silent auction & raffle, rescue-partner directory, sponsor recognition, registration, Rabbit Attendance Agreement | Highest-leverage single feature (see below). |
| **Surrender intake** | Guided, humane owner-surrender flow that routes some cases to education/resources first | May reduce staff load and prevent some surrenders. |

---

## Why an app helps — value mapped to their pillars

- **Adoptions.** An in-app browser + appointment request removes phone-tag friction and lets people commit to a specific bunny before they call. Showing the requirements (indoor; 4×4 or free-range; hay/pellets/daily salad) up front pre-qualifies adopters and cuts staff triage.
- **Volunteer & foster.** Capped 1-hour shifts and ad-hoc vet runs are exactly what humans manage badly over text/email. Self-serve sign-up with the cap auto-enforced, plus reminders, reduces no-shows and coordinator load.
- **Fundraising (biggest leverage point).** Revenue is spread across 6+ channels. Most donors never discover the ones beyond a basic gift. Surfacing them all in context — especially recurring giving and employer-match prompts — typically lifts donations more than any new campaign, because the money is lost to *obscurity*, not absent generosity.
- **Education.** Care content already exists. A mobile hub + new-adopter onboarding serves the mission and attacks the root cause (900+ annual local surrenders) the org was founded on.
- **Surrender intake.** A guided digital flow can reduce staff time and prevent some surrenders.

---

## What we can specifically leverage (assets that already exist)

- **Midwest BunFest is a ready-made flagship.** Largest rabbit expo in the Eastern US, every October, national/international draw. It's the one moment a year when thousands of exactly-the-right people are paying attention.
- **A built-in distribution network of 15–20 Midwest rescue partners** that already promote BunFest — the app launches with an audience instead of chasing one.
- **Existing content & listings** — care guides written, adoptable animals already syndicated to Petfinder/Adoptapet (mirror/link rather than re-key), merchandise already live as the Hop Shop. We package existing assets, not build from zero.
- **An annual heartbeat** — the October cadence gives a natural rhythm: pre-event hype → event → post-event retention → off-season giving.

---

## Honest caveats (limits without OHRR's cooperation)

Real-time adoptable inventory and medical/foster records live in whatever internal system they use; payment/donation processing needs their accounts; and any "live" data (current rabbits, this year's BunFest schedule) needs a feed or admin access.

So the realistic **v1 that needs nothing from them is read-only + outbound**:
- Education hub
- A BunFest companion built from public event info
- A giving-options directory deep-linking to their existing pages
- Adoptable listings mirrored from Petfinder

Deeper features (booking, shift sign-up, intake) need a small amount of cooperation.

---

## Recommended first move

**Build the BunFest companion first.** Use it to capture the once-a-year national audience into the app, then make **year-round giving + education** the thing that retains them. That turns OHRR's existing biggest asset into the engine for everything else.

---

## Open questions to confirm with OHRR

- What is their single biggest operational pain point right now?
- Who are the app's primary users first — staff, volunteers, adopters, donors, or BunFest attendees?
- What tools do they use today (adoption software, Petfinder/Adoptapet, donation platform, email, spreadsheets)? Any data to integrate or migrate?
- What's the actual first year and edition count of Midwest BunFest?
- Is the priority year-round operations, the BunFest event, or both equally?
- Budget, hosting, and who maintains the app after we build it?
