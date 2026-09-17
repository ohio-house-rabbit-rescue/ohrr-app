-- =============================================================
-- OHRR App — Care topics ("Bunny Help": the "My bunny is…" search)
--
-- Staff with `content.education.edit` manage short, symptom-shaped topics that
-- route people to OHRR's own care guidance — never a diagnosis. Visitors (anon)
-- read PUBLISHED topics; the app falls back to an identical built-in seed
-- (src/features/bunnyhelp/seedTopics.ts) when this table is missing or empty.
--
-- `what_to_do` is light markdown: blank-line-separated paragraphs, `## `
-- headings, and `- ` bullet lines. `aliases` are the words people actually
-- type. `urgency`: emergency | vet-today | watch | tip. Health-category rows
-- with reviewed_by NULL show "Not yet vet-reviewed" in the app.
--
-- Apply AFTER 20260627065720_care_articles.sql (needs organizations,
-- set_updated_at() and has_permission()). Paste + Run in the Supabase SQL
-- editor, or `supabase db push`. Idempotent.
--
-- GENERATED FILE — edit src/features/bunnyhelp/seedTopics.ts and re-run
-- `node scripts/bunnyhelp-seed-sql.ts > supabase/migrations/20260917140000_care_topics.sql`.
-- =============================================================

create table if not exists care_topics (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  slug          text not null,
  title         text not null,
  aliases       text[] not null default '{}',
  category      text not null check (category in ('health','behavior','diet','litter','bonding','grooming','housing')),
  urgency       text not null check (urgency in ('emergency','vet-today','watch','tip')),
  summary       text not null default '',
  what_to_do    text not null default '',
  article_slug  text,
  show_vets     boolean not null default false,
  hopshop_note  text,
  reviewed_by   text,
  reviewed_at   date,
  is_published  boolean not null default true,
  sort_order    int not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_care_topics_org on care_topics(org_id, sort_order);

drop trigger if exists trg_care_topics_updated on care_topics;
create trigger trg_care_topics_updated before update on care_topics
  for each row execute function set_updated_at();

alter table care_topics enable row level security;

drop policy if exists care_topics_public_select on care_topics;
create policy care_topics_public_select on care_topics for select
  using (is_published);

drop policy if exists care_topics_staff_select on care_topics;
create policy care_topics_staff_select on care_topics for select
  using (has_permission(org_id, 'content.education.edit'));

drop policy if exists care_topics_insert on care_topics;
create policy care_topics_insert on care_topics for insert
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists care_topics_update on care_topics;
create policy care_topics_update on care_topics for update
  using (has_permission(org_id, 'content.education.edit'))
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists care_topics_delete on care_topics;
create policy care_topics_delete on care_topics for delete
  using (has_permission(org_id, 'content.education.edit'));

grant select on care_topics to anon, authenticated;
grant insert, update, delete on care_topics to authenticated;

-- -------------------------------------------------------------
-- Seed: the built-in topics, drawn only from OHRR's live-site care guides
-- (https://ohiohouserabbitrescue.org/rabbit-care/resources/ and the articles it
-- links) plus the emergency warning signs in the app's emergency card.
-- reviewed_by / reviewed_at are NULL on purpose. Org looked up by name.
-- -------------------------------------------------------------

-- not-eating: Not eating, or not pooping
--   source: Emergency warning signs (OHRR app emergency card); OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/) (#9)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'not-eating', 'Not eating, or not pooping', array['not eating', 'won’t eat', 'wont eat', 'stopped eating', 'refusing food', 'off food', 'no poop', 'not pooping', 'no droppings', 'hasn’t pooped', 'tiny poops', 'GI stasis', 'stasis', 'bloat']::text[], 'health', 'emergency',
  'Not eating, or no poops, for around 12 hours can be life-threatening for a rabbit.',
  'Call a rabbit-savvy vet right away.

After hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.

OHRR’s Top Ten Tips ask every owner to read up on GI stasis and bloat and to have an emergency plan ready before it’s needed.',
  'health', true, null, 0
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- lethargic: Lethargic, or hiding more than usual
--   source: Emergency warning signs (OHRR app emergency card)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'lethargic', 'Lethargic, or hiding more than usual', array['lethargic', 'tired', 'hiding', 'listless', 'not moving much', 'quiet', 'won’t come out', 'sleeping a lot', 'not himself', 'not herself', 'acting off', 'sad']::text[], 'health', 'vet-today',
  'Lethargy or hiding is a warning sign rabbit-savvy vets ask owners to act on quickly.',
  'Call a rabbit-savvy vet today and describe what you’re seeing.

If your rabbit is also not eating or not pooping, treat it as an emergency: MedVet Hilliard, 614-870-0480, is open 24/7 for exotics emergencies.',
  'health', true, null, 1
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- breathing: Laboured or open-mouth breathing
--   source: Emergency warning signs (OHRR app emergency card)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'breathing', 'Laboured or open-mouth breathing', array['breathing hard', 'open mouth breathing', 'mouth breathing', 'wheezing', 'gasping', 'panting', 'struggling to breathe', 'noisy breathing', 'can’t breathe']::text[], 'health', 'emergency',
  'Laboured or open-mouth breathing can be life-threatening for rabbits.',
  'Call a rabbit-savvy vet right away.

After hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.',
  'health', true, null, 2
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- head-tilt: Head tilt
--   source: Emergency warning signs (OHRR app emergency card)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'head-tilt', 'Head tilt', array['head tilt', 'tilted head', 'head is tilted', 'losing balance', 'falling over', 'rolling', 'wobbly']::text[], 'health', 'vet-today',
  'A head tilt is a warning sign to act on the same day.',
  'Call a rabbit-savvy vet today.

If your rabbit can’t stay upright or isn’t eating, don’t wait: MedVet Hilliard, 614-870-0480, is open 24/7 for exotics emergencies.',
  'health', true, null, 3
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- bleeding: Bleeding
--   source: Emergency warning signs (OHRR app emergency card)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'bleeding', 'Bleeding', array['bleeding', 'blood', 'cut', 'wound', 'injured', 'injury', 'bitten', 'attacked']::text[], 'health', 'emergency',
  'Bleeding is an emergency for rabbits.',
  'Call a rabbit-savvy vet right away.

After hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.',
  'health', true, null, 4
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- cant-move: Unable to move, or dragging the back legs
--   source: Emergency warning signs (OHRR app emergency card)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'cant-move', 'Unable to move, or dragging the back legs', array['can’t move', 'cant move', 'not moving', 'paralysed', 'paralyzed', 'dragging legs', 'back legs not working', 'collapsed', 'limp', 'fell', 'dropped']::text[], 'health', 'emergency',
  'A rabbit that can’t move needs a vet immediately.',
  'Call a rabbit-savvy vet right away.

After hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.',
  'health', true, null, 5
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- soft-stools: Diarrhea or very soft stools
--   source: Emergency warning signs (OHRR app emergency card); OHRR — Foods to Avoid (ohiohouserabbitrescue.org/i-want-to-learn/foods-to-avoid/)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'soft-stools', 'Diarrhea or very soft stools', array['diarrhea', 'diarrhoea', 'runny poop', 'soft poop', 'mushy poop', 'loose stools', 'watery poop', 'messy bottom', 'poopy butt', 'sticky poop']::text[], 'health', 'vet-today',
  'Very soft or watery stools are a warning sign; OHRR says to act on loose stools right away.',
  'Call a rabbit-savvy vet today. After hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.

OHRR’s Foods to Avoid guide: remove any food that causes loose or mushy stools from the diet immediately.',
  'health', true, null, 6
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- litter-box-stopped: Stopped using the litter box
--   source: OHRR — Wait, Bunnies Can Be Litter Box Trained? (ohiohouserabbitrescue.org/litterbox/); Small Pet Select — Help… My Rabbit Stopped Using the Litter Box! (linked from OHRR’s resources page)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'litter-box-stopped', 'Stopped using the litter box', array['not using litter box', 'stopped using litter box', 'peeing outside the box', 'peeing everywhere', 'pooping everywhere', 'poop everywhere', 'accidents', 'peeing on the couch', 'peeing on the bed', 'litter box problems', 'marking', 'poops outside box']::text[], 'litter', 'watch',
  'A change in litter habits usually has a reason — hormones, a change at home, the box itself, age, or something a vet should check.',
  '## First, rule out a health cause
OHRR’s litter box guide says a sudden change in habits — especially after spay/neuter — is worth a vet visit to rule out a urinary tract infection or bladder problem. If the change is sudden, or your rabbit seems unwell, call a rabbit-savvy vet.

## Common reasons OHRR and its resources list
- Not spayed or neutered yet: hormones drive marking. Spay/neuter is the first step to reliable litter habits.
- Something changed: a move, a new pet or person, a new routine. Rabbits mark territory when their world shifts.
- The box changed: a new litter brand, a moved box, or a box that isn’t cleaned as often. Make any change gradually.
- Age: young rabbits have less control; adolescents (about 4–6 months) mark; older rabbits may need a box with lower sides.

## Retraining
- Put hay in one half of the box — rabbits like to eat while they go.
- Move the box to where the accidents happen, and add a second box if needed.
- Confine to a smaller space (OHRR suggests a 4×4 pen) and expand it gradually as habits improve.
- Clean the box at least every other day with vinegar, baking soda, or an animal-safe cleaner.
- A few poops outside the box is normal territory-marking, not a training failure.',
  'litter', true, 'Litter and hay for the box — see what the Hop Shop has.', 7
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- litter-training: Litter training a bunny
--   source: OHRR — Wait, Bunnies Can Be Litter Box Trained? (ohiohouserabbitrescue.org/litterbox/); OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/) (#6)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'litter-training', 'Litter training a bunny', array['litter train', 'litter training', 'how to litter box train', 'litter box setup', 'which litter', 'what litter is safe', 'cedar', 'pine', 'clumping litter', 'hay in litter box']::text[], 'litter', 'tip',
  'Rabbits naturally pick one spot — with the right box and litter, most learn quickly.',
  '## The box
- A plastic cat litter box that fits inside a 4×4 pen works well. A low storage tub or dog-crate tray suits older rabbits with achy joints.
- Fill one half with litter and the other half with hay — bunnies like to eat while they go, and it encourages hay eating. Refill the hay daily.

## Safe litter
- Paper-based litter (such as CareFresh) or shredded newspaper; kiln-dried pine or aspen pellets.
- Avoid clumping litter, clay, cedar, non-kiln-dried softwoods, and corncob — they can be breathed in or eaten.

## Training
- Spay/neuter first — it makes the biggest difference.
- Start in a confined 4×4 space; put the box where your rabbit chooses to go.
- Expand the space gradually as habits hold. Praise successes; a firm ‘No’ only if you catch an accident in progress.
- Clean at least every other day with vinegar, baking soda, or an animal-safe cleaner.',
  'litter', false, 'Paper-based litter and hay — check the Hop Shop.', 8
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- digging-chewing: Digging and chewing
--   source: OHRR — Staying Friends with your Bunny: How to Deal with Bunnies that Dig and Chew (ohiohouserabbitrescue.org/diggingandchewing/); OHRR — Spay/Neuter: It’s More than Population Control (ohiohouserabbitrescue.org/spayneuter/)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'digging-chewing', 'Digging and chewing', array['chewing', 'digging', 'chewing cords', 'chewing wires', 'chewing baseboards', 'digging carpet', 'destroying carpet', 'chewing furniture', 'destructive', 'eating the wall', 'chewing everything', 'chews', 'digs']::text[], 'behavior', 'tip',
  'Chewing and digging are natural — the goal is to redirect them, not stop them.',
  'OHRR’s guide has three steps: teach what’s allowed, block the temptations, and give approved outlets.

## Bunny-proofing
- Baseboards sit right at nose level — cover them with wooden boards or plastic guards.
- Wires: move them out of reach, block access, or run them through protective tubing.
- Carpet: tightly woven carpet resists damage better than shag; an area rug is easier to replace. Corners get dug most — a litter box in the corner can help.
- Furniture: protect legs and cushions, and block the space underneath.

## Approved outlets
- Cardboard boxes, stuffed toilet-paper and paper-towel rolls, a box of shredded paper or play sand for digging.
- Willow or twig chews (pesticide-free, non-toxic only) and small-animal toys.

## Teaching
- Speak bunny: a clap or a thump redirects attention, then offer an approved toy right at their nose.
- Supervise until the boundaries stick. Spay/neuter also reduces destructive chewing and digging, per OHRR’s spay/neuter guide.',
  'housing', false, 'Chew toys and hay — see the Hop Shop.', 9
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- spraying-mounting: Spraying, mounting, or aggression
--   source: OHRR — Spay/Neuter: It’s More than Population Control (ohiohouserabbitrescue.org/spayneuter/); OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/) (#2)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'spraying-mounting', 'Spraying, mounting, or aggression', array['spraying', 'spraying urine', 'spray', 'mounting', 'humping', 'aggressive', 'aggression', 'lunging', 'biting me', 'bites', 'grunting', 'boxing', 'territorial', 'cage aggressive', 'circling my feet', 'hormonal', 'honking']::text[], 'behavior', 'watch',
  'Unaltered rabbits spray, mount, and can be aggressive. OHRR’s answer is spay/neuter.',
  'OHRR’s spay/neuter guide: altered rabbits are calmer because they no longer have the urge to mate. Spaying/neutering:
- prevents territorial spraying in males and reduces mounting and aggression;
- reduces destructive chewing and digging and improves litter training;
- virtually eliminates the risk of reproductive cancers;
- makes bonding with another rabbit possible.

OHRR connects owners with experienced rabbit vets for the surgery — use Find a rabbit-savvy vet below.

If your rabbit is already fixed and the behaviour is new or sudden, mention it to your vet.',
  null, true, null, 10
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- bored-toys: Bored bunny — toys and play
--   source: OHRR — Do-it-Yourself Bunny Toys (ohiohouserabbitrescue.org/diy-bunny-toys/); OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/) (#7)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'bored-toys', 'Bored bunny — toys and play', array['bored', 'boredom', 'toys', 'enrichment', 'play', 'playing', 'DIY toys', 'what do rabbits play with', 'tossing', 'throwing things', 'entertain', 'keep busy']::text[], 'behavior', 'tip',
  'Cheap, safe, home-made toys — matched to how your rabbit likes to play.',
  'Watch what your rabbit does — dig, chew, or toss — and build toys for that. OHRR’s Top Ten Tips: at least an hour out of the pen every day.

## Safe materials (from OHRR’s DIY toys guide)
- Cardboard with tape and adhesive removed: boxes with doors cut in, platforms, or boxes filled with paper or hay to dig in.
- Toilet-paper and paper-towel rolls stuffed with hay for foraging.
- Kraft paper and soy-ink newspaper to rip, dig, and toss.
- Polar fleece — the only safe fabric, because its short fibres don’t cause digestive problems. Knot a blanket to chew, or make strip balls.
- Untreated pinecones and untreated willow baskets — check they’re untreated and animal-safe.
- Toddler teething toys and wooden blocks.
- Phone books only with supervision, with the covers and spine adhesive removed.

And you: playing with your rabbit is enrichment too.',
  null, false, 'Toys and chews — see the Hop Shop.', 11
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- bonding: Bonding with a new rabbit (bunny dating)
--   source: OHRR — The Art of Bunny Dating: Tips for Bonding Bunnies (ohiohouserabbitrescue.org/bondingbunnies/); OHRR Bunny Services as listed in this app (vet clinic days, bonding sessions)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'bonding', 'Bonding with a new rabbit (bunny dating)', array['bonding', 'bond', 'second bunny', 'second rabbit', 'new rabbit', 'introduce', 'introducing rabbits', 'bunny dating', 'companion', 'pair', 'friend', 'lonely', 'alone']::text[], 'bonding', 'tip',
  'Let your rabbit choose their friend, then introduce slowly on neutral ground.',
  '## Before you start
- Both rabbits must be spayed/neutered, then wait a few weeks for hormones to settle.
- Let your rabbit pick: OHRR suggests meeting 2–3 potential partners — personality matters more than size or breed. OHRR runs guided bonding sessions (see Bunny Services in this app).

## At home
- Keep the two pens about 3 inches apart; place food bowls facing each other at mealtimes.
- Hold ‘dates’ in neutral territory such as a bathtub — the footing prevents serious injuries. Start with 10–15 minutes and grow from there.
- Always supervise. Keep a broom or spray bottle handy to interrupt a fight — never use your bare hands.
- Petting both bunnies during a session helps keep them calm.

## What’s normal
- Nipping, mounting (dominance), and pooping near the pen edges (marking) are normal and fade as the bond forms.
- Expect setbacks and ‘bad dates’. Bonding can take months.
- For tough pairs, OHRR suggests stress bonding: a car ride, sitting on a running washer, a basket carry, or a stroller walk together.',
  'bonding', false, null, 12
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- fighting: Fighting with their partner
--   source: OHRR — The Art of Bunny Dating: Tips for Bonding Bunnies (ohiohouserabbitrescue.org/bondingbunnies/); OHRR Bunny Services as listed in this app (vet clinic days, bonding sessions)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'fighting', 'Fighting with their partner', array['fighting', 'fight', 'attacking each other', 'bonded pair fighting', 'chasing', 'biting each other', 'fur pulling', 'fur flying', 'nipping', 'bond broke', 'unbonded', 'won’t get along', 'not getting along']::text[], 'bonding', 'watch',
  'Separate safely, then go back a step in bonding. Injuries need a vet.',
  '- If either rabbit is bleeding or injured, that’s a vet visit — bleeding is an emergency for rabbits.
- Break up a fight with a broom, a towel, or a spray bottle — never with bare hands.
- Nipping and chasing on their own are normal parts of bonding; fur pulling and real fighting mean the pair needs more time.

## Going back a step
- Make sure both are spayed/neutered and it has been a few weeks since surgery.
- Return to short, supervised dates (10–15 minutes) in neutral territory like a bathtub.
- Keep the pens 3 inches apart between dates, with bowls facing each other.
- Try stress bonding: a car ride, sitting on a running washer, or a stroller walk together.
- OHRR runs guided bonding sessions — see Bunny Services in this app.',
  'bonding', true, null, 13
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- hay-pellets: Hay and pellets — which, and how much
--   source: OHRR — Timothy? Alfalfa? What You Should Know About Your Bunny’s Diet! (ohiohouserabbitrescue.org/bunnydiet/); OHRR — Bunny Diet (ohiohouserabbitrescue.org/i-want-to-learn/bunny-diet/)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'hay-pellets', 'Hay and pellets — which, and how much', array['hay', 'timothy', 'alfalfa', 'orchard grass', 'oat hay', 'won’t eat hay', 'not eating hay', 'how much hay', 'pellets', 'how many pellets', 'pellet amount', 'food', 'what to feed', 'diet', 'water', 'water bottle']::text[], 'diet', 'tip',
  'Unlimited timothy hay, limited timothy pellets, and a daily salad — OHRR’s three-part diet.',
  '## Hay
- Unlimited grass hay, refreshed daily. OHRR feeds Oxbow timothy; orchard grass and oat hay also work depending on your rabbit’s taste.
- A rabbit should eat a pile of hay about the size of its body every day. Hay’s fibre keeps the gut moving and wears the teeth down.
- Alfalfa is for babies and underweight rabbits — OHRR reserves it for gaining weight, not for adults.

## Pellets
- Plain timothy-based pellets only (OHRR suggests Oxbow or Small Pet Select). No corn, seeds, or colourful pieces.
- OHRR’s rule of thumb: about 1/8 cup per 4 lb of rabbit per day, and many rabbits do fine on less. Pellets are a supplement — hay is the diet.

## Water
- Change the water daily; rinse and wipe the bowl to prevent algae.

Some rabbits have special dietary needs — work with your vet or adoption coordinator.',
  'diet', false, 'Hay and pellets — see what the Hop Shop has in stock.', 14
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- greens-fruit: Safe vegetables, greens, and fruit
--   source: OHRR — Timothy? Alfalfa? What You Should Know About Your Bunny’s Diet! (ohiohouserabbitrescue.org/bunnydiet/); OHRR — Bunny Diet (ohiohouserabbitrescue.org/i-want-to-learn/bunny-diet/); House Rabbit Society — Suggested Vegetables and Fruits for a Rabbit Diet (rabbit.org, linked from OHRR’s resources page); OHRR — Foods to Avoid (ohiohouserabbitrescue.org/i-want-to-learn/foods-to-avoid/)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'greens-fruit', 'Safe vegetables, greens, and fruit', array['vegetables', 'veggies', 'greens', 'salad', 'lettuce', 'fruit', 'treats', 'banana', 'carrot', 'carrots', 'kale', 'spinach', 'cilantro', 'parsley', 'what can bunny eat', 'can rabbits eat', 'new food', 'how much salad']::text[], 'diet', 'tip',
  'A daily salad of leafy greens, new foods one at a time, and fruit only as a treat.',
  '## Daily greens
- OHRR: about 1 cup of greens per 3 lb of body weight each day. Start with green leaf lettuce and add variety slowly.
- Introduce one new green at a time and wait 24 hours before adding another (House Rabbit Society).
- Almost all leafy greens are fine — cilantro, mint, and parsley are OHRR favourites. Skip iceberg lettuce (no nutrition). Go easy on spinach, mustard greens, and kale (high calcium), and on cabbage.

## Fruit and treats
- Treats only: a raisin or craisin, a baby carrot, a small banana slice, or a strawberry. One baby carrot or banana slice a day is plenty.
- Ration sugary vegetables like carrots, bell peppers, beets, parsnips, and squash.

## If something disagrees
- Remove any food that causes loose or mushy stools from the diet right away. See ‘Foods to avoid’ for what should never be fed.',
  'diet', false, null, 15
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- foods-to-avoid: Foods to avoid — and what if they ate one
--   source: OHRR — Foods to Avoid (ohiohouserabbitrescue.org/i-want-to-learn/foods-to-avoid/)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'foods-to-avoid', 'Foods to avoid — and what if they ate one', array['ate something', 'ate chocolate', 'poisonous', 'toxic', 'avocado', 'onion', 'bread', 'crackers', 'houseplant', 'ate a plant', 'cabbage', 'iceberg', 'corn', 'nuts', 'yogurt drops', 'seeds', 'dog food', 'cat food', 'mouldy', 'moldy']::text[], 'diet', 'watch',
  'OHRR’s list of foods that should never be fed to a rabbit.',
  '## Never feed
- Avocado, bamboo shoots, dried or raw beans (lima, kidney, soy), bracken fern, cabbage, chocolate, coffee beans or plant, corn in any form, dog or cat food, grains, honey/seed sticks, most house plants, iceberg lettuce, meat, millet, nuts, onions, dried peas, people food, potatoes (including peels), refined sugar, rhubarb, sweet peas, sweet potatoes, tea leaves, whole seeds, yogurt drops.
- Anything mouldy.
- Nursery flowers usually carry pesticides — only organic flowers.

## If your rabbit ate something on the list
- Call a rabbit-savvy vet and tell them what and how much. After hours: MedVet Hilliard, 614-870-0480 (open 24/7 for exotics emergencies).
- Remove any food that causes loose or mushy stools from the diet immediately.',
  'foods-to-avoid', true, null, 16
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- nails-grooming: Overgrown nails, shedding, and grooming
--   source: OHRR Bunny Services as listed in this app (vet clinic days, bonding sessions); OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/) (#1)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'nails-grooming', 'Overgrown nails, shedding, and grooming', array['nails', 'nail trim', 'clip nails', 'long nails', 'overgrown nails', 'claws', 'shedding', 'moulting', 'molting', 'brushing', 'fur everywhere', 'grooming', 'matted fur', 'bath']::text[], 'grooming', 'tip',
  'OHRR’s vet clinic days offer nail trims; a rabbit-savvy vet can show you a safe home routine.',
  '- OHRR hosts mobile vet-clinic days with a rabbit-savvy vet for nail trims, wellness checks, and microchipping — by appointment. See Bunny Services in this app.
- Ask the vet to show you a safe home routine, and use My Bunny’s ‘Nail trim’ reminder (typically every 6 weeks) so trims don’t slip.
- Rabbits are exotic pets with different needs from dogs and cats, so a rabbit-savvy vet is your new best friend (OHRR’s Top Ten Tips).',
  null, true, null, 17
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

-- new-bunny: New bunny basics
--   source: OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/)
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, 'new-bunny', 'New bunny basics', array['new bunny', 'just adopted', 'first rabbit', 'getting started', 'setup', 'cage', 'hutch', 'pen size', 'how big', 'outside', 'outdoors', 'where should my bunny live', 'bunny proof', 'exercise', 'how long do rabbits live', 'lifespan']::text[], 'housing', 'tip',
  'OHRR’s Top Ten Tips for new bunny owners, in short.',
  '- A rabbit-savvy vet is your new best friend — rabbits are exotic pets with different needs from dogs and cats.
- Get them fixed: spay/neuter cuts aggression and other unwanted behaviour and lowers cancer risk.
- Inside the house, not a hutch: indoors protects from disease, predators, and weather — and you’ll see their personality.
- Housing: at least a 4×4 space on the floor with no wire bottom. An exercise pen works; some owners give a whole room.
- Bunny-proof: secure cords, baseboards, house plants, and anything harmful.
- Litter box: rabbits naturally pick one spot. Use paper-based litter; avoid cedar and non-kiln-dried pine.
- Play: at least an hour a day outside their space, plus a variety of safe toys.
- Diet: limited pellets, unlimited hay, daily vegetables; treats about a teaspoon per 2 lb.
- Do your research — read about GI stasis and bloat and have an emergency plan.
- It’s a commitment: rabbits can live 8–12 years. Enjoy it.',
  'housing', false, null, 18
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;
