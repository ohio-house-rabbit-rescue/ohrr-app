# OHRR App — Working Summary & Context

> A running record of what we've discussed and decided, so anyone (including a future AI session) can pick up without starting from scratch. Updated 2026-06-16.

---

## The ask

The sponsor runs / supports **Ohio House Rabbit Rescue (OHRR)**, a nonprofit rabbit rescue, and wants to build an **app** that supports all of their efforts — including their long-running annual fundraiser, **Midwest BunFest**. First step was to research the organization (starting from their website) and capture who they are and what they're trying to achieve, as a foundation for designing the app.

---

## What we did

1. **Researched OHRR and Midwest BunFest** from public sources (their own site, the BunFest site, GuideStar, GreatNonprofits, Yelp, Petfinder, and related rabbit orgs). The org's site blocked automated fetching, so facts were gathered via web search across those pages.
2. **Produced an organization profile** — see `01-OHRR-org-profile.md`.
3. **Worked through app strategy** — answered: "assuming we can't ask the org more questions, what advantages would an app bring and what can we leverage?" Captured in `02-app-strategy-and-findings.md`.
4. **Set this Shared Drive folder ("OHRR App Design") as the canonical home** for project documents, stored as real Markdown files.

---

## Key findings (the short version)

- **OHRR**: Columbus, OH 501(c)(3) (EIN 27-0830606), founded 2009 by Beverly May; opened Ohio's first rabbit-only adoption center in 2013. Mission = rescue + adoption + public education on rabbits as indoor companions. Open Sat/Sun noon–4, by appointment. Goal: 125+ adoptions/year.
- **Programs**: adoption (spay/neuter + vaccinated), fostering, volunteering (capped 1-hr socialization shifts, vet transport), Fix-a-Bun low-cost spay/neuter, owner-surrender intake, Hop Shop, online care resources.
- **Revenue**: online gifts, Kroger Community Rewards, workplace/matching gifts, Legacy Fund (planned giving), Amazon wishlist, host-a-fundraiser, Hop Shop, and Midwest BunFest.
- **Midwest BunFest**: largest rabbit expo in the Eastern US, every October, national/international draw, promoted by 15–20 Midwest rescue partners. Features vendors, 10–15 education sessions, Bunny Spa, Glamour Shots, silent auction/raffle, Hop Shop, Chilaxabun Lounge.
- **Strategy**: the app's core value is collapsing OHRR's scattered, weekend-bound operations into one always-on hub. **Highest-leverage first move = build the BunFest companion**, capture the once-a-year national audience, then retain them with year-round giving + education.

---

## Decisions & project context

- **Canonical document home:** this Shared Drive folder, "OHRR App Design." Documents live here as `.md` files.
- **New code repository:** the sponsor will set up a dedicated Git repo for the OHRR app later (working remotely at the time). Not created yet.
- **Connected Google account for this workspace:** `gadgetguyaddict@gmail.com` (granted Content Manager on the Shared Drive).
- **Scratch history:** early research drafts were committed to an unrelated existing repo (`the-perfect-pour`, PR #2) before this Shared Drive folder existed. That repo is *not* the OHRR project home; treat these Drive `.md` files as the source of truth.

---

## Open items / next steps

- [ ] Sponsor to create the dedicated OHRR app Git repo; copy these `.md` files in as the project's `docs/`.
- [ ] Confirm the **[VERIFY]** items with OHRR (current hours; first year + edition count of BunFest).
- [ ] Answer the open questions in `02-app-strategy-and-findings.md` (primary users, current tools, priorities, budget, hosting, maintenance).
- [ ] Decide the v1 scope — recommendation on file is the **BunFest companion** as the first build.
- [ ] Go deeper on research once the above direction is confirmed.
