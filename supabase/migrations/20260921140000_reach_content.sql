-- =============================================================
-- OHRR — education pages for the audiences the market data says OHRR is
-- missing: families before Easter, renters and students, would-be fosters.
-- Editable articles (care_articles, section 'adopt' / 'volunteer'), shown at
-- /info/<slug> on the website and the app. Plain words, OHRR's own rules;
-- the market figures behind them live in the briefing data file, not here.
--
-- Apply AFTER 20260921120000_site_pages.sql. Paste + Run. Idempotent.
-- =============================================================

alter table care_articles drop constraint if exists care_articles_section_check;
alter table care_articles add constraint care_articles_section_check
  check (section in ('care', 'give', 'about', 'adopt', 'volunteer'));

do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;

  insert into care_articles (org_id, slug, section, title, icon, summary, body, sort_order, is_published) values

  (v_org, 'is-a-rabbit-right-for-us', 'adopt', 'Is a rabbit right for us?', 'help',
   'Read this before Easter, before the pet store, before the kids ask twice.',
   $body$Rabbits are wonderful companions — quiet, clever, funny, and affectionate on their own terms. They are also one of the most surrendered pets in Ohio, and almost always for human reasons: a move, a new baby, a child who lost interest, a home that was never set up for a rabbit. Ten minutes of honest reading now saves a rabbit a second uprooting later.

## Five things that surprise new rabbit families

- A rabbit lives 10 years or more. That is a middle-schooler’s whole childhood.
- Rabbits live indoors, in a space at least 4 feet by 4 feet, with time out of the pen every day. A hutch in the yard is not a home.
- Rabbits are prey animals. They are fragile, they startle easily, and most do not like being picked up. They show love by sitting near you, not by cuddling on demand.
- They chew and dig. Cords, baseboards and carpet corners need bunny-proofing.
- Not every vet treats rabbits. You will need a rabbit-savvy vet, a spay or neuter, and an RHDV2 vaccination.

## A rabbit and a child

Children can adore a rabbit and learn a great deal from one. But the adult in the house owns the care — feeding hay every day, cleaning the litter box, noticing when the rabbit stops eating (an emergency in rabbits). If that adult is you and you are glad to do it, keep reading. If the plan is “the kids will take care of it,” a rabbit is not the right pet yet.

## What a rabbit costs

Set-up: a pen, litter box, bowls, hidey box and hay feeder. Every month: hay, pellets, greens and litter. Every year: a check-up. Once: spay or neuter and vaccination — OHRR’s rabbits come already done, which is one of the best reasons to adopt rather than buy.

## Still a yes?

Wonderful. Come and meet the rabbits. Adoptions at OHRR are by appointment on Saturdays and Sundays: read the adoption policy, send the application, and an adoption facilitator will talk it through with you and set up a two-hour visit. If you already have a rabbit, we run bonding dates so your bunny helps choose.

## Not yet?

Come and volunteer instead. Bunny socialization shifts are open from age 6 (10 and under with an adult) — an hour of quiet company that helps a rescued rabbit get ready for a home, and the best way to find out whether a rabbit is right for your family: https://ohrr-website.pages.dev/book/bunny-socialization$body$, 20, true),

  (v_org, 'rabbits-for-renters-and-students', 'adopt', 'Rabbits for renters and students', 'home',
   'Quiet, litter-trained, no walks — and allowed by many leases that say no to dogs.',
   $body$If you rent, share a place, or live near campus, a rabbit may be the pet that actually fits your life. Here is the honest version.

## Why rabbits suit a small home

- They are quiet. No barking, no early-morning walks.
- They use a litter box. Most rabbits learn quickly, especially once spayed or neutered.
- Many leases that refuse dogs and cats allow a caged small animal. Check yours — and get the landlord’s yes in writing.
- They are happy with a pen and daily free time in a bunny-proofed room; they do not need a yard.

## What they do need

- Space: a pen at least 4 feet by 4 feet, plus time out of it every day.
- Hay, all day, every day, and fresh greens. Pellets are a side dish.
- A rabbit-savvy vet. Not every clinic sees rabbits — find one before you need one.
- Bunny-proofing: cords, cables and chair legs will be chewed if you let them.
- Ten years of you. Moving out, a new roommate, graduation — plan for the rabbit to move with you.

## Two is company

Rabbits are social. If you can, adopt a bonded pair: the hard work of matching is already done, and two rabbits keep each other company while you are in class or at work.

## Not ready to adopt?

Foster. A few weeks with a rabbit in your home, with OHRR arranging the vet care and a team member a message away, while they recover from surgery or learn to trust people. It is the easiest first step there is, and it helps a rabbit right now: https://ohrr-website.pages.dev/volunteer/foster — or come and sit with the bunnies, an hour at a time: https://ohrr-website.pages.dev/book/bunny-socialization$body$, 30, true),

  (v_org, 'foster-a-rabbit', 'volunteer', 'Foster a rabbit', 'heart',
   'A few weeks with a rabbit in your home, with OHRR behind you — and a rabbit gets out of the center.',
   $body$OHRR’s Adoption Center holds about 35 rabbits at a time, and there is a waiting list to get in. Fostering is how a rescue this size does more: a rabbit recovering from a spay or neuter, a shy rabbit who needs a quiet house, a bonded pair waiting for the right family — all do better in a home than in a pen at the center.

## What fostering looks like

- A few weeks to a couple of months, agreed in advance.
- The rabbit stays OHRR’s responsibility: vet care is arranged by OHRR, and an OHRR team member is your contact for questions. Ask what supplies OHRR can lend — a pen can often be borrowed.
- You supply a quiet, bunny-proofed room, daily hay and greens, and company.
- You bring the rabbit to adoption appointments or events when asked, or OHRR arranges transport.

## Who can foster

- Adults 18 and over, with a rabbit-safe indoor space (a bunny-proofed room or a pen at least 4 feet by 4 feet).
- Renters are welcome — with the landlord’s permission.
- Students are welcome, as long as the rabbit has a home over breaks.
- Other pets are fine when they can be kept apart.

## The honest part

Fostering means letting go when a family is found. Most fosters say goodbye with a full heart and take the next one. Some adopt — that is fine too.

## Interested?

Tell us a little about yourself and your space with the foster form — https://ohrr-website.pages.dev/volunteer/foster — and OHRR will be in touch to explain what it supplies and expects. If you would like to try something smaller first, book a bunny socialization shift: https://ohrr-website.pages.dev/book/bunny-socialization$body$, 10, true)

  on conflict (org_id, slug) do nothing;
end $$;
