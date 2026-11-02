-- =============================================================
-- OHRR — update 49: the finished 2026 BunFest, and a 2027 draft built from it
--
-- PART 1  Brings 2026 up to what midwestbunfest.org finally says (read in full
--         on 2026-11-02; the first pull in September was missing pieces):
--           • vendor     Stitches Abound added; Bunny Beds and Beyond is not
--                        on the final 2026 list, so it is taken off 2026
--           • sponsors   Bunny Cafe San Francisco (first-time) and Lafeber
--                        Company added
--           • partner    Friends of Rabbits, Inc. was a 2026 partner
--           • pages      new "Senior & Special Needs Bunnies" (with Ask-A-Vet)
--                        and "Social events" pages + their cards; the Toymaking
--                        sign-up details, the Chillaxabun Lounge's room and the
--                        Bunny Spa's advance-booking rule filled in
--         Each step only fills what is still the September wording, so nothing
--         anyone typed in the app is overwritten.
--
-- PART 2  Midwest BunFest 2027 — Sunday, October 24, 2027, 10 AM – 4 PM.
--         • The event is added HIDDEN (Staff → Events: turn on "Shown" to
--           move the BunFest section of the app, and the website, to 2027).
--         • The venue is "To be announced" (OHRR said it is not The Makoy).
--         • Copied from 2026 as a starting point: the vendors and rescue
--           partners (as 2027 "to confirm"), and the talks, pages and "at the
--           festival" cards — those three are copied HIDDEN, so no 2026 dates
--           show until staff edit each one and tick "People can see this".
--         • Not copied: the table plan (a new venue needs a new one) and the
--           auction / raffle (items belong to one event).
--
-- Apply AFTER update 48. Safe to run twice. Run it as ONE paste.
-- =============================================================

do $u49$
declare
  v_org uuid;
  v_sort int;
  v_info jsonb;
  n_s int := 0; n_f int := 0; n_p int := 0; n_v int := 0; n_r int := 0;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then
    raise notice 'No OHRR organization row — nothing done.';
    return;
  end if;

  -- ===========================================================
  -- PART 1 — 2026 as the finished site has it
  -- ===========================================================

  -- Vendor added (the 2026 vendors page lists 27; this one was missing).
  select coalesce(max(vendor_sort), 0) + 10 into v_sort from suppliers where org_id = v_org and is_vendor;
  insert into suppliers (org_id, name, is_supplier, is_vendor, website, vendor_category, vendor_blurb, vendor_published, vendor_years, vendor_sort)
  select v_org, 'Stitches Abound', false, true, 'https://instagram.com/stitchesabound', 'Home & Apparel',
         'Homemade, cozy household decor — animal-related dream catchers, bottle lanterns, shadow boxes and greeting cards.',
         true, array[2026], v_sort
   where not exists (select 1 from suppliers s where s.org_id = v_org and s.name = 'Stitches Abound');
  update suppliers set is_vendor = true, vendor_published = true,
                       vendor_years = array_append(vendor_years, 2026)
   where org_id = v_org and name = 'Stitches Abound' and not (2026 = any (vendor_years));

  -- Not on the final 2026 vendors page.
  update suppliers set vendor_years = array_remove(vendor_years, 2026)
   where org_id = v_org and name = 'Bunny Beds and Beyond' and 2026 = any (vendor_years);

  -- Sponsors named on the final 2026 sponsors page.
  insert into sponsors (org_id, name, tier, blurb, website, term_start, term_end, is_active, sort_order, remind_days)
  select v_org, x.name, 'program', x.blurb, x.website, date '2026-01-01', date '2026-12-31', true, x.sort, 21
    from (values
      ('Bunny Cafe San Francisco',
       'A first-time Midwest BunFest sponsor. A reimagined pet adoption space focused on rabbits, working with local rescues on calm, education-centered adoption events.',
       'https://www.bunnycafesf.com/', 130),
      ('Lafeber Company',
       'Built by a father-and-son team of veterinarians; Dr. T.J. Lafeber made the first Lafeber food in the back room of his clinic in the early 1970s. Everything is made on the Lafeber family farmland.',
       'https://lafeber.com', 140)
    ) as x(name, blurb, website, sort)
   where not exists (select 1 from sponsors s where s.org_id = v_org and s.name = x.name);

  -- A 2026 rescue partner (the final partners page lists it; it was not marked).
  update rescue_partners set at_bunfest = true, bunfest_years = array_append(bunfest_years, 2026)
   where org_id = v_org and name = 'Friends of Rabbits, Inc.' and not (2026 = any (bunfest_years));

  -- New 2026 page: Senior & Special Needs Bunnies (+ Ask-A-Vet).
  insert into bunfest_pages (org_id, event_slug, year, slug, title, subtitle, icon, sponsor_note, chips, note, sections, related_label, related, is_published, sort_order)
  values (v_org, 'midwest-bunfest', 2026, 'senior-support', 'Senior & Special Needs Bunnies',
    'New in 2026: supportive products and expert advice for senior and special needs rabbits.',
    'heart', 'With Borders Veterinary Services and Art by Lisa Edwards / Bunny Boyz',
    '["New in 2026", "Ask-A-Vet: $25 for 10 minutes"]'::jsonb, null,
    '[
      {"heading": "What you will find", "body": "A new area in the Emerald Room (near the Hop Shop, Oxbow and the Silent Auction) where you can chat and find supportive products for senior and special needs rabbits — sore hock boots, first aid kits, medical bunny wraps and more. Dr. Susan Borders and Lisa Edwards developed the senior care and special needs products."},
      {"heading": "Bunny painting and art", "body": "Lisa Edwards runs Bunny Boyz, a private sanctuary for special needs rabbits. She has bunny painting, where bunnies make abstract art from atop a plastic covering that protects them from the paint, auctions a unique piece of art, and has other pieces for sale. Proceeds from her art fundraisers benefit the rescue rabbits of Columbus House Rabbit Society, Ohio House Rabbit Rescue and Bunny Boyz."},
      {"heading": "Ask-A-Vet", "body": "For more detailed or complicated questions about a senior or special needs bunny, sign up for a one-on-one 10-minute chat with a rabbit veterinarian between noon and 3 PM. The cost is $25 per session, donated to Ohio House Rabbit Rescue. It is a good place to learn if you do not have a rabbit-savvy vet nearby, or want a second opinion. Only verbal advice is provided."},
      {"heading": "About the organizers", "body": "Dr. Susan Borders has practiced rabbit medicine and surgery for over 27 years. She is an associate veterinarian at the Animal Hospital of Pataskala and runs Borders Veterinary Services, an exotic-only mobile practice serving much of central Ohio. Lisa Edwards is an award-winning local artist who provides a bunny-inspired haven for special-needs, senior and medical rabbits."}
    ]'::jsonb,
    'Related', '[{"to": "/bunfest/vendors", "label": "Vendors"}]'::jsonb, true, 55)
  on conflict (org_id, event_slug, year, slug) do nothing;

  -- New 2026 page: the social events around the weekend.
  insert into bunfest_pages (org_id, event_slug, year, slug, title, subtitle, icon, sponsor_note, chips, note, sections, related_label, related, is_published, sort_order)
  values (v_org, 'midwest-bunfest', 2026, 'social', 'Social events', 'Mini events around BunFest weekend for the bunny community.',
    'calendar', null, '["Saturday, Oct 24", "Sunday, Oct 25", "Monday, Oct 26"]'::jsonb,
    'All rabbits attending the Hospitality Room must be vaccinated for RHDV2, with proof required for entry.',
    '[
      {"heading": "Hoppy Hour — Saturday, October 24, 5:00 – 7:00 PM", "body": "The pre-event get-together at the hotel bar at Embassy Suites Dublin, 5100 Upper Metro Pl, Dublin, OH 43017. Come and go as you please. Bunny-themed drinks, a full bar, appetizers and a dinner menu are available to buy. Bunnies are not permitted in food service areas."},
      {"heading": "Hospitality Room — Saturday and Sunday, 5:00 – 9:30 PM", "body": "The Avery Room at Embassy Suites Dublin is open both nights for socializing. You and your bunnies are welcome."},
      {"heading": "OHRR Adoption Center tour — Monday, October 26, 10:00 AM – 12:00 PM", "body": "5485 N. High Street, Columbus, OH 43214. See what is new at the Adoption Center and snuggle some adoptable bunnies. The Hop Shop will be open too."}
    ]'::jsonb,
    'Hotel', '[{"to": "/bunfest/p/accommodations", "label": "Host hotel information"}]'::jsonb, true, 85)
  on conflict (org_id, event_slug, year, slug) do nothing;

  -- Toymaking: the real details (only while it still says "details to come").
  update bunfest_pages set
    chips = '["$20", "Sunday 12:05 – 1:00 PM", "30 spots"]'::jsonb,
    sections = '[
      {"heading": "When and where", "body": "Sunday, October 25, upstairs in the education session area at The Makoy. Check-in and kit hand-out are at 12:05 PM; the workshop runs 12:15 – 1:00 PM. There are 30 spots."},
      {"heading": "What you get", "body": "Buttercup’s Bunny Boutique guides you in building your own custom playmat, with tips, tricks and answers to your questions. The DIY toy and playmat kit comes with shapes and sizes of materials for a range of toys and playmat designs, and extras to take home for continued fun."},
      {"heading": "How to sign up", "body": "Use the sign-up link on midwestbunfest.org, choose Sign Up, and enter your name, email and number of spots. OHRR then emails you a PayPal payment link — write “Toy Workshop” in the note. The cost is $20."},
      {"heading": "Where the money goes", "body": "Buttercup’s Bunny Boutique donates all proceeds to Ohio House Rabbit Rescue."}
    ]'::jsonb
   where org_id = v_org and year = 2026 and slug = 'toymaking' and chips = '["Sign-up details to come"]'::jsonb;

  -- Chillaxabun Lounge: where it is.
  update bunfest_pages set sections = sections || '[{"heading": "Where it is", "body": "In the Burgundy Room, behind the Glamour Shots area, near the side entrance. No sign-up or reservation — use it as needed."}]'::jsonb
   where org_id = v_org and year = 2026 and slug = 'lounge' and sections::text not like '%Burgundy%';

  -- Bunny Spa: advance booking is for full packages only.
  update bunfest_pages set sections = sections || '[{"heading": "Advance appointments", "body": "Because of high demand, advance scheduling was offered for full spa packages only. Single-service appointments are scheduled on the day."}]'::jsonb
   where org_id = v_org and year = 2026 and slug = 'spa' and sections::text not like '%Advance appointments%';

  -- The two new "at the festival" cards.
  insert into event_features (org_id, event_slug, year, title, blurb, icon, link_url, is_published, sort_order)
  select v_org, 'midwest-bunfest', 2026, x.title, x.blurb, x.icon, x.link, true, x.sort
    from (values
      ('Senior & special needs bunnies', 'Products, art and a 10-minute Ask-A-Vet chat for senior and special needs rabbits.', 'heart', '/bunfest/p/senior-support', 55),
      ('Social events', 'Hoppy Hour, the Hospitality Room and an Adoption Center tour around the weekend.', 'calendar', '/bunfest/p/social', 95)
    ) as x(title, blurb, icon, link, sort)
   where not exists (select 1 from event_features f where f.org_id = v_org and f.year = 2026 and f.title = x.title);

  -- ===========================================================
  -- PART 2 — Midwest BunFest 2027 (hidden draft)
  -- ===========================================================

  -- Year-specific facts (parking at The Makoy, the 2026 hotel and merch links,
  -- the 2026 logo credit) are left out; the rest carries forward to edit.
  select coalesce(info, '{}'::jsonb) - 'parking' - 'hotel_url' - 'merch_url' - 'logo_credit' into v_info
    from events where org_id = v_org and slug = 'midwest-bunfest-2026';

  insert into events (org_id, slug, title, starts_at, ends_at, venue, address, city, summary, body, theme, url, is_published, sort_order, info)
  values (v_org, 'midwest-bunfest-2027', 'Midwest BunFest 2027',
          timestamptz '2027-10-24 10:00 America/New_York', timestamptz '2027-10-24 16:00 America/New_York',
          'To be announced', null, null,
          'Sunday, October 24, 2027, 10 AM – 4 PM. The 2027 venue will be announced.',
          'Mark your calendars! Midwest BunFest returns Sunday, October 24, 2027, 10am – 4pm. The venue will be announced soon.',
          null, 'https://www.midwestbunfest.org/', false, 0, coalesce(v_info, '{}'::jsonb))
  on conflict (org_id, slug) do nothing;

  -- The education program, the pages and the cards: copied hidden.
  insert into bunfest_sessions (org_id, year, start_time, end_time, title, presenter, presenter_ids, description, room, track, kind, is_published, sort_order)
  select s.org_id, 2027, s.start_time, s.end_time, s.title, s.presenter, s.presenter_ids, s.description, s.room, s.track, s.kind, false, s.sort_order
    from bunfest_sessions s
   where s.org_id = v_org and s.year = 2026
     and not exists (select 1 from bunfest_sessions t where t.org_id = v_org and t.year = 2027 and t.title = s.title and t.start_time = s.start_time);
  get diagnostics n_s = row_count;

  insert into bunfest_pages (org_id, event_slug, year, slug, title, subtitle, icon, sponsor_note, chips, note, sections, feature, reserve, email_signup, contact, related_label, related, is_published, sort_order)
  select p.org_id, p.event_slug, 2027, p.slug, p.title, p.subtitle, p.icon, p.sponsor_note, p.chips, p.note, p.sections, p.feature, p.reserve, p.email_signup, p.contact, p.related_label, p.related, false, p.sort_order
    from bunfest_pages p
   where p.org_id = v_org and p.year = 2026
  on conflict (org_id, event_slug, year, slug) do nothing;
  get diagnostics n_p = row_count;

  insert into event_features (org_id, event_slug, year, title, blurb, icon, link_url, is_published, sort_order)
  select f.org_id, f.event_slug, 2027, f.title, f.blurb, f.icon, f.link_url, false, f.sort_order
    from event_features f
   where f.org_id = v_org and f.year = 2026
     and not exists (select 1 from event_features t where t.org_id = v_org and t.year = 2027 and t.event_slug = f.event_slug and t.title = f.title);
  get diagnostics n_f = row_count;

  -- The rosters: everyone from 2026 is carried to 2027 to confirm.
  update suppliers set vendor_years = array_append(vendor_years, 2027)
   where org_id = v_org and is_vendor and 2026 = any (vendor_years) and not (2027 = any (vendor_years));
  get diagnostics n_v = row_count;

  update rescue_partners set bunfest_years = array_append(bunfest_years, 2027)
   where org_id = v_org and 2026 = any (bunfest_years) and not (2027 = any (bunfest_years));
  get diagnostics n_r = row_count;

  raise notice '2027 draft: % talks, % pages, % cards, % vendors, % rescue partners copied', n_s, n_p, n_f, n_v, n_r;
end $u49$;

-- -------------------------------------------------------------
-- Check (the last result): every number should be as shown
-- -------------------------------------------------------------
select
  (select count(*) from suppliers where is_vendor and 2026 = any (vendor_years))                  as vendors_2026_should_be_27,
  (select count(*) from sponsors where term_start = date '2026-01-01' and is_active)              as sponsors_2026_should_be_14,
  (select count(*) from bunfest_pages where year = 2026 and slug in ('senior-support', 'social')) as new_pages_should_be_2,
  (select count(*) from events where slug = 'midwest-bunfest-2027' and not is_published)          as event_2027_hidden_should_be_1,
  (select count(*) from bunfest_sessions where year = 2027)                                        as talks_2027_should_be_12,
  (select count(*) from bunfest_pages where year = 2027)                                           as pages_2027_should_be_11,
  (select count(*) from suppliers where is_vendor and 2027 = any (vendor_years))                  as vendors_2027_should_be_27;
