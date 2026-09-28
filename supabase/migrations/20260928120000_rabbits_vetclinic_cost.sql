-- =============================================================
-- Update 33 (2026-09-28): three content changes OHRR asked for.
--   1. Adoptable rabbits brought up to date from OHRR's RescueGroups listing
--      (new: Mackenzie, Rachel, Tobias; no longer listed: Edmund, Leo, Monty and
--      the older Nimbus entry, hidden for staff to check, never marked adopted).
--      The daily check (ohrr-jobs function) will keep this current once it's set up.
--   2. The mobile vet clinic as a bookable appointment: Saturdays, noon–4 PM,
--      15-minute times, confirmed by staff (booking type `vet-clinic`).
--   3. Rabbit care: the cost article in OHRR's own words, replacing Binkybunny.com.
-- Safe to run more than once.
-- =============================================================

-- OHRR's adoptable rabbits, brought up to date from RescueGroups (read Sep 28, 2026).
-- New: Mackenzie, Rachel, Tobias. No longer listed: Edmund, Leo, Monty and the older Nimbus entry —
-- hidden with the "no longer on RescueGroups" badge for staff to check, never marked adopted.
with o as (select id from organizations where name = 'Ohio House Rabbit Rescue' limit 1),
     m as (select coalesce(max(sort_order), 0) as top from rabbits where org_id = (select id from o))
insert into rabbits (org_id, source_id, name, status, sex, age, breed, size, spayed_neutered,
                     house_trained, bonded, description, tags, photos, sort_order, is_published, source_seen_at)
select (select id from o), v.source_id, v.name, v.status, v.sex, v.age, v.breed, v.size, v.spayed, v.house_trained, v.bonded,
       v.description, v.tags, v.photos, (select top from m) + v.n * 10, true, now()
from (values
  ($t$rescuegroups:22728517$t$, $t$Mackenzie$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$Californian$t$, $t$Medium$t$, true, true, false, $t$Meet Mackenzie, a gorgeous Californian girl estimated to be about a year old. With her beautiful coloring and striking appearance, she's definitely a head-turner—but it's her sweet personality that will win you over.

Mackenzie was rescued by volunteers after being abandoned as a stray. She was found seeking shelter under a car, trying to find a safe place to hide from the world. Thankfully, she landed at OHRR, where she could finally be safe, warm, and cared for.

Mackenzie can be a little skittish when she's meeting someone new or isn't quite sure about her surroundings. Give her some patience and a chance to get comfortable, though, and you'll see her sweet side emerge. Once she knows she's safe, Mackenzie is a lovely bunny who enjoys the attention and care of her trusted people.

At just about a year old, Mackenzie has her whole life ahead of her and is ready for a fresh start. She's looking for a home that will give her the time and patience to build trust and allow her sweet personality to shine. We think the person who earns Mackenzie's trust will discover just how special this beautiful girl truly is.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22728/22728517/103712989.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22728/22728517/103712990.jpg$t$]::text[], 1),
  ($t$rescuegroups:18118431$t$, $t$Rachel$t$, $t$Available$t$, $t$Female$t$, $t$Adult$t$, $t$American Sable$t$, $t$Medium$t$, true, true, false, $t$Meet Rachel! When Rachel’s family moved, they left her with a friend. After the move, her family never returned to retrieve her, and Rachel’s new caretakers quickly realized they were not equipped to care for her. Despite this setback in her life, Rachel has quickly come to enjoy the attention of volunteers at the Center. She is an extremely sweet bunny who is just looking for the opportunity to be wanted by a Furever Family who will truly cherish her for the special girl she is.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/18118/18118431/88285829.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/18118/18118431/88285831.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/18118/18118431/88285832.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/18118/18118431/88285833.jpg$t$]::text[], 2),
  ($t$rescuegroups:22621204$t$, $t$Tobias$t$, $t$Available$t$, $t$Male$t$, $t$Adult$t$, $t$Holland Lop$t$, $t$Medium$t$, true, true, false, $t$Meet Tobias, a very sweet Holland Lop with an irresistible personality and an even bigger love for people. Tobias came to the Center in rough condition, with a severely matted undercoat caused by improper housing and diet. Thanks to the dedication of OHRR's volunteers and the care he's received, he's looking and feeling so much better.

Tobias absolutely adores attention and isn't shy about asking for it. Whether he's hopping over for pets or simply wanting to be near his favorite people, this affectionate little guy is happiest when he's the center of someone's world. His friendly, outgoing personality has quickly made him a volunteer favorite.

When Tobias isn't busy charming everyone around him, you'll often find him stretched out in his pen, peacefully snoozing away—sometimes with the cutest little snores! It's just one more thing that makes this lovable bunny so endearing.

Now Tobias is ready for the next chapter of his life with a family who will continue giving him the love, care, and attention he deserves. In return, he'll reward them with endless affection, plenty of adorable moments, and maybe even a few tiny snores.$t$, '{}'::text[], array[$t$https://cdn.rescuegroups.org/6091/pictures/animals/22621/22621204/103468706.jpg$t$, $t$https://cdn.rescuegroups.org/6091/pictures/animals/22621/22621204/103468703.jpg$t$]::text[], 3)
) as v(source_id, name, status, sex, age, breed, size, spayed, house_trained, bonded, description, tags, photos, n)
on conflict (org_id, source_id) do nothing;

update rabbits set is_published = false, auto_hidden = true, source_missing_since = coalesce(source_missing_since, now())
 where source_id in ('rescuegroups:22789280', 'rescuegroups:22757500', 'rescuegroups:22789281', 'rescuegroups:22773321') and is_published and status <> 'Adopted';

update rabbits set source_seen_at = now(), source_missing_since = null where source_id in ('rescuegroups:19140503', 'rescuegroups:22283159', 'rescuegroups:22640155', 'rescuegroups:22527782', 'rescuegroups:22283157', 'rescuegroups:22789276', 'rescuegroups:22757527', 'rescuegroups:22728517', 'rescuegroups:22659183', 'rescuegroups:22773330', 'rescuegroups:22757534', 'rescuegroups:19140502', 'rescuegroups:18118431', 'rescuegroups:22745083', 'rescuegroups:22745076', 'rescuegroups:22621204');

-- The mobile vet clinic as a bookable appointment (OHRR, 2026-09-28): Saturdays,
-- noon–4 PM at the Adoption Center, one rabbit per 15-minute time, confirmed by staff.
-- Staff can change the days, times or anything else in Staff → Bookings → Set up.
insert into booking_types (org_id, slug, name, kind, description, location, duration_min, capacity, max_party,
                           min_lead_hours, confirm_mode, ask_reason, weekly, sort_order, is_published)
select id, 'vet-clinic', 'Mobile vet clinic', 'appointment',
       'A rabbit-savvy vet at the OHRR Adoption Center on Saturdays for nail trims, wellness checks and microchipping. One rabbit per 15-minute time.',
       'OHRR Adoption Center', 15, 1, 1, 12, 'staff',
       'What does your rabbit need? (nail trim, wellness check, microchip)',
       '[{"days":[6],"start":"12:00","end":"12:15","capacity":1},{"days":[6],"start":"12:15","end":"12:30","capacity":1},{"days":[6],"start":"12:30","end":"12:45","capacity":1},{"days":[6],"start":"12:45","end":"13:00","capacity":1},{"days":[6],"start":"13:00","end":"13:15","capacity":1},{"days":[6],"start":"13:15","end":"13:30","capacity":1},{"days":[6],"start":"13:30","end":"13:45","capacity":1},{"days":[6],"start":"13:45","end":"14:00","capacity":1},{"days":[6],"start":"14:00","end":"14:15","capacity":1},{"days":[6],"start":"14:15","end":"14:30","capacity":1},{"days":[6],"start":"14:30","end":"14:45","capacity":1},{"days":[6],"start":"14:45","end":"15:00","capacity":1},{"days":[6],"start":"15:00","end":"15:15","capacity":1},{"days":[6],"start":"15:15","end":"15:30","capacity":1},{"days":[6],"start":"15:30","end":"15:45","capacity":1},{"days":[6],"start":"15:45","end":"16:00","capacity":1}]'::jsonb, 40, true
  from organizations where name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;

select fill_booking_slots(id, false) as times_made from booking_types where slug = 'vet-clinic';

-- Rabbit care: "How much does having a house rabbit really cost?" in OHRR's own words
-- (2026-09-28), replacing the pointer to Binkybunny.com.
update care_articles
   set summary = $c$What a rabbit really costs — setting up, food and litter, and vet care over 8–12 years.$c$,
       tip = $c$Rabbits live 8–12 years, and vet care for an exotic pet is the biggest variable — budget for a yearly wellness check and an emergency fund.$c$,
       body = $c$A rabbit is not a starter pet, and not a small expense. Our buns live 8–12 years, and a happy house rabbit needs room to run, fresh food every day and a vet who knows rabbits — for every one of those years. We would much rather you know the real cost now than find out after you bring a bunny home.

## Adopting from OHRR
Our adoption fee is $60 for a single rabbit and $75 for a bonded pair (Adoption Policy, revised January 2022). Every OHRR rabbit comes to you already spayed or neutered — one of the biggest vet bills a new bunny parent would otherwise face.

## Setting up, once
- An exercise pen for the 4 ft × 4 ft indoor space we ask every home to have: $40 to $100
- A litter box: $5 to $10
- A water crock and a food crock: $6 to $10 each
- Throw rugs, so your bun has grip on slippery floors: $5 to $15
- Toys: $3 to $16 each (cardboard boxes are free, and much loved)
- Bunny-proofing, such as cord covers: $10 to $45
- Nail clippers: about $5

## Food and litter, all the time
- Unlimited grass hay, the biggest part of your bunny's diet: $15 to $75, depending on how much you buy at once
- High-quality timothy pellets, in small amounts: $8 to $15 a bag
- A fresh salad every day: $10 to $25 a week
- Paper-based litter: $8 to $20

## Vet care
Plan on a wellness check with a rabbit-savvy vet every year — twice a year once your bunny is 6 or older. A visit runs about $100. Rabbits hide illness well, and something like GI stasis can turn into an emergency overnight, so set aside an emergency fund or look into pet insurance that covers rabbits.

## Two cost about the same as one
Pellets, hay, greens and litter for two bonded rabbits put little extra strain on the budget. The exception is medical care.

## Ways to keep costs down
- Buy hay in bulk, from a local feed store or from our Hop Shop at the Adoption Center
- Use a rabbit-safe, paper-based litter, and never clay litter
- Look for a secondhand exercise pen or carrier
- Make toys from cardboard boxes and paper-towel rolls
- Keep up with yearly vet visits: catching a problem early costs far less than an emergency

The supply and vet prices above come from our friends at the Missouri House Rabbit Society (2022), and the money-saving ideas from the House Rabbit Society. Prices vary by store and year. Questions before you adopt? Email us at ohrrcontact@ohiohouserabbitrescue.org — we're happy to help you plan.$c$
 where slug = 'cost-of-a-house-rabbit';
