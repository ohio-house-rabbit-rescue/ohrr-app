-- =============================================================
-- OHRR — Midwest BunFest 2026, from OHRR's own published pages
--
-- Everything below is transcribed from midwestbunfest.org on 2026-09-22: the
-- two education tracks, the activity pages with this year's prices and times,
-- the 2026 rescue partners, the 2026 vendor roster and the 2026 sponsors.
-- Nothing here is invented — where the site doesn't say, the column is left
-- empty rather than guessed.
--
-- Every insert is guarded, so running this twice changes nothing and a staff
-- edit is never overwritten.
--
-- Paste + Run AFTER 20260922150000_bunfest_this_year.sql. Idempotent.
-- =============================================================

do $seed$
declare
  v_org   uuid;
  v_event uuid;
  v_year  int := 2026;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then
    raise notice 'No OHRR organization row — skipping the BunFest 2026 seed.';
    return;
  end if;

  -- -----------------------------------------------------------
  -- Two corrections to this year's facts
  --
  -- The hotel link pointed at a page that doesn't exist (the real one is
  -- /accommodations.html) and the merch link went to the store's front door
  -- rather than this year's collection.
  -- -----------------------------------------------------------
  select id into v_event from events where org_id = v_org and slug like '%bunfest%'
   order by starts_at desc limit 1;
  if v_event is not null then
    update events set info = info
      || jsonb_build_object('hotel_url', 'https://www.midwestbunfest.org/accommodations.html')
      || jsonb_build_object('merch_url', 'https://www.bonfire.com/midwest-bunfest-2026/')
     where id = v_event
       and coalesce(info ->> 'hotel_url', '') = 'https://www.midwestbunfest.org/hotel-information.html';
  end if;

  -- -----------------------------------------------------------
  -- The 2026 programme — two tracks running side by side
  -- -----------------------------------------------------------
  if not exists (select 1 from bunfest_sessions where org_id = v_org and year = v_year) then
    insert into bunfest_sessions (org_id, year, track, start_time, end_time, title, presenter, description, kind, sort_order)
    values
      (v_org, v_year, 'Education Sessions', '10:30', '11:15',
       'I’m All Ears: Understanding and Treating Rabbit Ear Infections',
       'Nicholas Jew, DVM · MedVet Hilliard',
       'A dive down the rabbit hole into rabbit ear infections: how to know when there’s a problem and what to expect at the vet. Covers external and middle ear infections, and the challenges of diagnosing and treating the dreaded vestibular rabbit.',
       'session', 10),
      (v_org, v_year, 'Education Sessions', '11:30', '12:15',
       'Hare-Raising Issues: The Lowdown on Liver Lobe Torsions',
       'Nicholas Jew, DVM · MedVet Hilliard',
       'A walk through a liver lobe torsion from start to finish, demystifying this life-threatening condition and how to navigate it with your bunny family. Highs, lows, heartbreak and hopefully some laughs.',
       'session', 20),
      (v_org, v_year, 'Education Sessions', '12:15', '13:15',
       'Break', null, null, 'break', 30),
      (v_org, v_year, 'Education Sessions', '13:15', '14:00',
       'Digestive Issues You Absolutely Should Know About — GI Stasis and Bloat',
       'Barbara Oglesbee, DVM, DABVP (Avian) · MedVet Hilliard',
       'Digestive problems are very common in rabbits and can have serious consequences if not treated properly. If your rabbit stops eating, get to a veterinarian immediately. The signs to watch for, treatment options, and what you can do to make these less likely.',
       'session', 40),
      (v_org, v_year, 'Education Sessions', '14:15', '15:00',
       'Fluffy or Fat? Unraveling the Health Hazards of Obesity in Rabbits',
       'Barbara Oglesbee, DVM, DABVP (Avian) · MedVet Hilliard',
       'Under all that fur it can be hard to tell if your bunny is overweight. The most common health risks and consequences of obesity in rabbits, and strategies for treatment and prevention.',
       'session', 50),
      (v_org, v_year, 'Education Sessions', '15:15', '16:00',
       'Best Friends Forever: Bonding Rabbits',
       'Karen Winsted and Ryan Terebesi · Rabbit Expert Volunteers, Columbus Humane and Ohio House Rabbit Rescue',
       'Rabbits are usually happiest with another bun to pal around with — the trick is finding the right one. The do’s and don’t’s of bonding, from chaperoning first dates to knowing when your rabbits can safely move in together.',
       'session', 60),

      (v_org, v_year, 'Special Interest Sessions', '10:45', '11:15',
       'Administering Meds at Home',
       'Emily Fagundo, DVM · MedVet Hilliard',
       'Caring for your bunny after a vet visit: techniques and tips for giving oral meds, fluids and shots.',
       'session', 10),
      (v_org, v_year, 'Special Interest Sessions', '11:30', '12:00',
       'An Integrative Approach to Rabbit Medicine',
       'Susan Borders, DVM and Kaylee Vanhorenbeck, DVM · Animal Hospital of Pataskala',
       'How laser and acupuncture can be used for bunnies — what each treatment involves and the conditions they commonly treat.',
       'session', 20),
      (v_org, v_year, 'Special Interest Sessions', '12:15', '12:45',
       'What is Hay?',
       'Daniel C. Brenner · Hay Farmer and Educator',
       'The definitions and varieties of hay, how it is grown and harvested, and the difference between 1st, 2nd and 3rd cuttings — plus how to identify good hay for bunnies. Questions welcome, time permitting.',
       'session', 30),
      (v_org, v_year, 'Special Interest Sessions', '12:45', '13:15',
       'Break', null, null, 'break', 40),
      (v_org, v_year, 'Special Interest Sessions', '13:15', '13:45',
       'More Than Toys: Creating Meaningful Enrichment for Pet Rabbits',
       'Tess Keener · Columbus House Rabbit Society and the Humane Society of Greater Dayton’s Bunny Brigade',
       'Enrichment is more than a pile of toys — it is opportunities to forage, dig, chew, explore and make choices. Practical, affordable ways to add enrichment to your rabbit’s everyday environment, and how to spot what your own bunny enjoys most.',
       'session', 50),
      (v_org, v_year, 'Special Interest Sessions', '14:00', '14:30',
       'Fun Facets of Field Rescue',
       'Shanleigh Knittel, Founder of Operation Obi and HRS Educator, and Danielle Patterson, CHRS Chapter Manager and HRS Educator',
       'A lot of preparation goes into catching dumped domestic rabbits besides the rescue itself. The work before and after a field rescue, as well as the physical rescues themselves.',
       'session', 60);
  end if;

  -- -----------------------------------------------------------
  -- Point the "at the festival" cards at the pages they describe
  --
  -- The cards were seeded without links, so tapping one did nothing. Only a
  -- card that is still unlinked is touched, in case staff have already set one.
  -- -----------------------------------------------------------
  update event_features f set link_url = l.url
    from (values
      ('Education sessions',          '/bunfest/schedule'),
      ('Bunny Spa',                   '/bunfest/p/spa'),
      ('Glamour Shots',               '/bunfest/p/glamour'),
      ('Raffle & Silent Auction',     '/bunfest/p/raffle'),
      ('Toymaking workshop',          '/bunfest/p/toymaking'),
      ('Chillaxabun Lounge',          '/bunfest/p/lounge'),
      ('OHRR Hop Shop',               '/shop'),
      ('Rescue Partners & Vendors',   '/bunfest/vendors')
    ) as l(title, url)
   where f.org_id = v_org and f.year = v_year and f.title = l.title and f.link_url is null;

  -- Volunteering is on OHRR's own BunFest site but was never a card here.
  insert into event_features (org_id, event_slug, year, title, blurb, icon, link_url, sort_order)
  select v_org, 'midwest-bunfest', v_year, 'Volunteer at BunFest',
         'Work a three-hour shift and get in free — four areas need help.',
         'users', '/bunfest/p/volunteer', 90
   where not exists (select 1 from event_features
                      where org_id = v_org and year = v_year and title = 'Volunteer at BunFest');

  -- -----------------------------------------------------------
  -- This year's activity pages
  --
  -- Note what changed from the app's bundled copy: advance booking for the
  -- Bunny Spa and Glamour Shots has closed for 2026 (both are day-of,
  -- first-come now), and the raffle and silent auction times are published.
  --
  -- Both pages still arrive with their advance-booking set-up filled in —
  -- services, times and what to say once it shuts — just switched off. Turning
  -- it on another year is picking "A form to request a time" and setting the
  -- last day to take them; the form then takes itself down on that day.
  -- -----------------------------------------------------------
  if not exists (select 1 from bunfest_pages where org_id = v_org and year = v_year) then
    insert into bunfest_pages (org_id, year, slug, title, subtitle, icon, sponsor_note, chips, note, sections, feature, reserve, email_signup, contact, related_label, related, sort_order)
    values
      (v_org, v_year, 'spa', 'Bunny Spa',
       'Grooming and hygiene for your rabbit, staffed by trained volunteers.',
       'sparkles', 'Sponsored by Oxbow',
       array['$12 per service', '$20 full spa package'],
       'For the safety of all rabbits, any rabbit attending Midwest BunFest must be vaccinated against RHDV2 and current on the annual booster — proof is required at entry.',
       '[{"heading":"Services","list":["Nail trims","Light grooming","Gland cleaning"]},
         {"heading":"Prices","list":["$12.00 — individual services","$20.00 — full spa package (nail clipping, gland cleaning and light grooming)"]},
         {"heading":"On the day","body":"Day-of appointments are first-come, first-served: hop by the Bunny Spa as soon as you arrive to sign up in person. They fill up quickly. You pay at the table, and all proceeds benefit OHRR."}]'::jsonb,
       null,
       '{"formName":"spa-reservation",
         "services":["Nail trims","Light grooming","Gland cleaning","Full spa package"],
         "slots":["10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM"],
         "closedNote":"Advance scheduling has closed for this year — sign up in person at the Bunny Spa on the day."}'::jsonb,
       null, null,
       'Pairs well with', '[{"label":"Glamour Shots","to":"/bunfest/p/glamour"}]'::jsonb, 10),

      (v_org, v_year, 'glamour', 'Glamour Shots',
       'Professional photos of your bunny — always a BunFest favorite.',
       'star', 'Sponsored by Oxbow',
       array['$20 flat — all your photos'],
       'For the safety of all rabbits, any rabbit attending Midwest BunFest must be vaccinated against RHDV2 and current on the annual booster — proof is required at entry.',
       '[{"heading":"How it works","list":["Two photo booths run all day so every bunny who wants a photo can have one","10-minute sessions; arrive 5–10 minutes early to check in and settle your bunny","Bring your own props, or choose from the wide variety of props and themes available","Single bunnies or bonded pairs, trios, quartets — all welcome","$20 flat rate, and you take home a thumb drive with every photo from the session"]},
         {"heading":"On the day","body":"Glamour Shots fills up quickly, so hop by as soon as you arrive to sign up in person — day-of appointments are first-come, first-served. Proceeds help OHRR save abandoned, abused and unwanted bunnies in central Ohio."}]'::jsonb,
       null,
       '{"formName":"glamour-reservation",
         "slots":["10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM"],
         "closedNote":"Advance scheduling has closed for this year — sign up in person at the Glamour Shots table on the day."}'::jsonb,
       null, null,
       'Pairs well with', '[{"label":"Bunny Spa","to":"/bunfest/p/spa"}]'::jsonb, 20),

      (v_org, v_year, 'raffle', 'Raffle & Silent Auction',
       'Bid and win — proceeds support Ohio House Rabbit Rescue.',
       'ticket', null,
       array['Raffle tickets $1 each, 6 for $5'],
       null,
       '[{"heading":"Raffle","body":"There is one raffle session this year. Ticket sales begin at 10:00 and the drawing is at 12:30. Tickets are $1 each, or 6 for $5. Write your name and phone number on each ticket and drop them in the buckets for the prizes you want — any number of tickets in any bucket. Winners are announced after the 12:30 draw.","slot":"raffle-details"},
         {"heading":"Silent Auction","body":"Bid early and often on bunny toys and treats, jewelry, gift baskets and more. There are two sessions: the first set of items runs 10:00 – 12:15, and a new set 1:00 – 3:15. As always you can “buy it now” to be sure of your favorite treasure."}]'::jsonb,
       'raffle', null, null, null,
       'Silent auction', '[{"label":"Browse the silent auction items","to":"/bunfest/auction"}]'::jsonb, 30),

      (v_org, v_year, 'toymaking', 'Toymaking Workshop',
       'Build an enrichment toy and playmat to take home for your bunny.',
       'gift', 'Run by Buttercup’s Bunny Boutique', array['Sign-up details to come'], null,
       '[{"heading":"It’s back for 2026","body":"The DIY Toymaking Workshop by Buttercup’s Bunny Boutique returns this year. Sign-up details are still to come — check back closer to the festival."},
         {"heading":"What you get","body":"Buttercup’s Bunny Boutique guides you in building your own custom playmat, with the tips and tricks and any questions answered. The DIY toy and playmat kit comes with shapes and sizes of materials for crafting a range of toys and playmat designs, and there are extras to take home for continued fun."},
         {"heading":"Where the money goes","body":"Buttercup’s Bunny Boutique donates all proceeds to Ohio House Rabbit Rescue."}]'::jsonb,
       null, null, null, null, null, '[]'::jsonb, 40),

      (v_org, v_year, 'lounge', 'Chillaxabun Lounge',
       'A calm space for your rabbit to stretch out and unwind during the day.',
       'heart', null, array['Free — donations welcome'],
       'For the safety of all rabbits, any rabbit attending Midwest BunFest must be vaccinated against RHDV2 and current on the annual booster — proof is required at entry.',
       '[{"heading":"What it offers","body":"A place for your bunny to relax and stretch their legs. Each bunny gets their own exercise pen with a litter box, water and tasty hay — a quiet spot away from the sights and sounds of the festival. The service is free of charge; donations are welcomed."},
         {"heading":"Before you use it","body":"Please read the Bringing Your Bunny guidelines first — the same health and vaccination rules apply."}]'::jsonb,
       null, null, null, null,
       'Read first', '[{"label":"Bringing Your Bunny","to":"/bunfest/p/bringing-bunny"}]'::jsonb, 50),

      (v_org, v_year, 'volunteer', 'Volunteer at BunFest',
       'An event this size runs on volunteers — come and be part of the team.',
       'users', null,
       array['Free admission', 'Free BunFest lanyard', 'Shifts of at least 3 hours'],
       null,
       '[{"heading":"What you get","body":"Volunteers receive free admission to the event and a free Midwest BunFest lanyard. We ask for a shift of at least three hours between 10am and 4pm — the rest of the day is yours to enjoy BunFest for as long as you like."},
         {"heading":"Where help is needed","list":["Glamour Shots — check people in for their appointment, help the photographer with the bunnies, choose props and costumes, load pictures onto a jump drive","Hop Shop — stocking merchandise, answering questions, checkout","Registration / Check-in — selling tickets, distributing wristbands, handing out programs, general information and directions","Silent Auction / Raffle — selling raffle tickets, watching over the auction items, helping with purchases"]},
         {"heading":"Time slots","list":["10:00 AM – 1:00 PM","1:00 PM – 4:00 PM"]},
         {"heading":"Who we’re looking for","body":"People who love bunnies. You can choose an area with minimal or with plenty of hands-on contact with the rabbits. We need volunteers who are friendly, enthusiastic and happy to work as part of a team. A few roles suit someone with leadership or event-planning experience, but most need nothing more than an interest in helping out."}]'::jsonb,
       null, null, null, null,
       'Also', '[{"label":"Other ways to volunteer with OHRR","to":"/volunteer"}]'::jsonb, 60),

      (v_org, v_year, 'bringing-bunny', 'Bringing Your Bunny',
       'Planning to bring your rabbit? Here’s everything required before you go.',
       'heart', null, array[]::text[],
       'For the safety of all rabbits, any rabbit attending Midwest BunFest must be vaccinated against RHDV2 and current on the annual booster — proof is required at entry.',
       '[{"heading":"Vaccination is required","body":"All rabbits attending the October 25, 2026 event must be vaccinated against RHDV2 — a virus that is very deadly to rabbits — and be up to date on an annual booster. That means a two-vaccine series within the last year, or proof of an annual booster within the last year. It applies everywhere, including the Bunny Spa, Glamour Shots and the Hospitality Room on Friday and Saturday nights."},
         {"heading":"Acceptable proof (bring one)","list":["A vaccination or booster certification form","A bill from the vet office or clinic showing the vaccination or booster was purchased","Documentation from your vet’s pet portal"]},
         {"heading":"Supply biosecurity","body":"Know the source of all bedding, hay and food you bring to the event or the hotel Hospitality Room. Confirm the source is not in an RHDV2 outbreak area, or that the company follows stringent RHDV2 control practices — as Oxbow and other larger companies do."},
         {"heading":"Sign the agreement","body":"Everyone bringing a rabbit signs the Rabbit Attendance Agreement, confirming health, vaccination, supply source and the event rules."},
         {"heading":"If your rabbit isn’t vaccinated","body":"Please make an informed decision and leave your rabbit at home. Needing a vaccination? Your own veterinarian can advise, and OHRR publishes a list of vaccination sites in central Ohio."}]'::jsonb,
       null, null, null, null,
       'Next', '[{"label":"Rabbit Attendance Agreement","to":"/bunfest/p/attendance-agreement"},{"label":"Find a rabbit vet","to":"/vets"}]'::jsonb, 70),

      (v_org, v_year, 'attendance-agreement', 'Rabbit Attendance Agreement',
       'The terms every attendee agrees to when bringing a rabbit to BunFest.',
       'book', null, array[]::text[], null,
       '[{"list":["My rabbit is in good health; OHRR may ask an ill rabbit to leave.","My rabbit is vaccinated for RHDV2 and current on the annual booster, with proof provided.","I will not bring bedding, hay, or food whose source I don’t know, or that comes from an RHDV2 outbreak area.","My rabbit will not be loose in the venue at any time — they stay in a carrier, stroller, or harness.","I will not allow interaction between rabbits that aren’t already bonded, to prevent injuries.","I will clean up after my rabbit right away to help prevent the spread of disease.","I will watch my bunny’s behavior closely and take a stressed rabbit home.","I will keep my rabbit well hydrated and fed at all times.","I understand OHRR does not accept responsibility or liability for injuries or illnesses incurred at the event."]}]'::jsonb,
       null, null, null, null, null, '[]'::jsonb, 80),

      (v_org, v_year, 'accommodations', 'Accommodations',
       'The host hotel and where to stay near the festival.',
       'home', null, array['$134 / night group rate', 'Book by September 25'], null,
       '[{"heading":"Host hotel — Embassy Suites Dublin","body":"A 3-Diamond property and this year’s host hotel for out-of-town guests. It offers a complimentary hot buffet breakfast each morning, a complimentary evening reception and free parking. All rooms have a sleeper sofa to add more people, if they are willing to be in close quarters."},
         {"heading":"Group rate","list":["$134 per night plus applicable taxes, for a king suite or a suite with two double beds","Group name: 2026 MidwestBunfest","Group code: MWF","Bringing your bunny? A refundable $35 pet deposit applies for the stay, returned after hotel staff check the room","The block closes Friday, September 25 — after that the reduced rate is gone and rooms may sell out"]},
         {"heading":"Booking","body":"Use the group booking link below to land directly in the Midwest BunFest room block and get the group rate, or call central reservations on 1-800-220-9219."}]'::jsonb,
       null, null, null,
       '{"address":"5100 Upper Metro Pl, Dublin, OH 43017","phone":"1-800-220-9219","url":"https://www.hilton.com/en/attend-my-event/midwestbunfest2026-mwf/","urlLabel":"Book the group rate"}'::jsonb,
       null, '[]'::jsonb, 90);
  end if;

  -- -----------------------------------------------------------
  -- The 2026 rescue partners
  --
  -- Tag the ones already in the directory, then add the two that are new this
  -- year. Rescues that came in 2025 but not 2026 keep their directory entry —
  -- they are simply not tagged for this year.
  -- -----------------------------------------------------------
  -- -----------------------------------------------------------
  -- The rescue directory, with the years each one came to BunFest
  --
  -- This is the whole directory the app ships (it doubles as "find a rescue
  -- near you"), plus the two that are new for 2026 — Happy Horizon Hamster
  -- Haven and Rabbit Angels. The 2026 roster is the 18 tagged below; the rest
  -- stay in the directory untagged, so last year's partners aren't lost.
  -- -----------------------------------------------------------
  insert into rescue_partners (org_id, name, location, city, state, region, phone, email,
                               address, website, blurb, is_host, bunfest_years, at_bunfest, sort_order)
  select v_org, r.name, r.location, r.city, r.state, r.region, r.phone, r.email,
         r.address, r.website, r.blurb, r.is_host, r.years, cardinality(r.years) > 0, r.sort
    from (values
      ('Ohio House Rabbit Rescue', 'Columbus, OH', 'Columbus', 'OH', 'Midwest', '614-263-8557', 'ohrrcontact@ohiohouserabbitrescue.org', '5485 N. High Street, Columbus, OH 43214', 'https://www.ohiohouserabbitrescue.org/', null, true, array[2026], 10),
      ('A Home for EveryBunny', 'Iowa', null, 'IA', 'Midwest', null, null, null, 'https://www.iowarabbitrescue.org', null, false, array[2026], 20),
      ('Buckeye House Rabbit Society', 'Ohio · since 1997', null, 'OH', 'Midwest', null, null, null, 'https://www.ohare.org/wordpress', null, false, array[2026], 30),
      ('Bunnies on Board', 'Animal transport', null, null, null, null, null, null, 'https://www.facebook.com/bunniesonboard', null, false, array[2026], 40),
      ('Columbus House Rabbit Society', 'Westerville, OH', 'Westerville', 'OH', 'Midwest', null, null, 'PO Box 2863, Westerville, OH 43086', 'https://www.columbusrabbit.org', null, false, array[2026], 50),
      ('Columbus Humane', 'Hilliard, OH · since 1883', 'Hilliard', 'OH', 'Midwest', '614-777-7387', 'questions@columbushumane.org', '3015 Scioto Darby Executive Ct, Hilliard, OH 43026', 'https://www.columbushumane.org', null, false, array[2026], 60),
      ('Destiny’s Safe Haven Inc.', 'West Virginia', null, 'WV', 'South', null, null, null, 'https://www.destinyssafehaven.com', null, false, array[2026], 70),
      ('Dolly’s Dream Home Rabbit Rescue', 'St. Charles, MO', 'St. Charles', 'MO', 'Midwest', null, null, null, 'https://www.DollysDreamHome.org', null, false, array[2026], 80),
      ('E.A.R.S. — Erie Area Rabbit Society & Rescue', 'Erie, PA', 'Erie', 'PA', 'Northeast', '814-838-9732', null, '2316 W. 38th St., Erie, PA 16506', 'https://www.eriearearabbitsociety.org', null, false, array[2026], 90),
      ('F5RS — Frisky Ferrets, Fuzzies & Feathered Friends', 'North Lima, OH', 'North Lima', 'OH', 'Midwest', null, null, null, 'https://www.facebook.com/F5RS1/', null, false, array[2026], 100),
      ('Friends of Rabbits, Inc.', 'DC · MD · VA · since 1997', null, 'VA', 'South', null, 'info@friendsofrabbits.org', null, 'https://www.friendsofrabbits.org', null, false, array[]::int[], 110),
      ('Great Lakes Rabbit Sanctuary', 'Whittaker, MI · since 1995', 'Whittaker', 'MI', 'Midwest', null, null, 'P.O. Box 7, Whittaker, MI 48190', 'https://www.rabbitsanctuary.org', null, false, array[2026], 120),
      ('Humane Society of Greater Dayton', 'Dayton, OH · since 1902', 'Dayton', 'OH', 'Midwest', '937-268-7387', null, '1661 Nicholas Road, Dayton, OH 45417', 'https://www.hsdayton.org', null, false, array[2026], 130),
      ('Indiana House Rabbit Society', 'Indianapolis, IN', 'Indianapolis', 'IN', 'Midwest', null, null, '1032 S Shelby St, Indianapolis, IN', 'https://indianahrs.org', null, false, array[2026], 140),
      ('Missouri House Rabbit Rescue', 'Fenton, MO', 'Fenton', 'MO', 'Midwest', '314-995-1457', 'mo_hrs@hotmail.com', '75 Elizabeth Dr., Fenton, MO 63026', 'https://www.morabbit.org', null, false, array[2026], 150),
      ('Operation Obi', 'Pittsburgh, PA', 'Pittsburgh', 'PA', 'Northeast', null, null, null, 'https://linktr.ee/operationobi', null, false, array[]::int[], 160),
      ('Saving Rabbits', 'Advocacy & education', null, null, null, null, null, null, 'https://www.savingrabbits.org', null, false, array[2026], 170),
      ('Save the Buns, Inc.', 'Research-rabbit rescue', null, null, null, null, null, null, 'https://www.savethebuns.org/', null, false, array[]::int[], 180),
      ('Snickerdoodles’ Rabbit Rescue', 'Stark County, OH', 'Stark County', 'OH', 'Midwest', null, null, null, 'https://snickerdoodlesrescue.org', null, false, array[2026], 190),
      ('Happy Horizon Hamster Haven', 'Cincinnati, OH', 'Cincinnati', 'OH', 'Midwest', null, null, null, 'https://happyhorizonhamsterhaven.org', 'A foster-based nonprofit small-animal rescue near Cincinnati, opened in March 2024, which has already helped over 400 small pets find homes. They rescue, rehabilitate and rehome hamsters, mice, rats, guinea pigs, rabbits and other small mammals, with in-depth experience of special needs.', false, array[]::int[], 200),
      ('Rabbit Angels Rabbit Rescue', 'Southwest Michigan', null, 'MI', 'Midwest', null, null, null, 'https://rabbitangelsrabbitrescue.com', 'A volunteer-based nonprofit in southwest Michigan dedicated to rescuing, rehabilitating and rehoming domestic rabbits, and to educating the community about proper rabbit care and responsible pet ownership.', false, array[]::int[], 210)
    ) as r(name, location, city, state, region, phone, email, address, website, blurb,
           is_host, years, sort)
   where not exists (select 1 from rescue_partners p where p.org_id = v_org and p.name = r.name);

  -- A rescue OHRR had already entered by hand just gets this year added.
  update rescue_partners set bunfest_years = array_append(bunfest_years, v_year), at_bunfest = true
   where org_id = v_org and not (v_year = any (bunfest_years))
     and name in (
       'Ohio House Rabbit Rescue', 'A Home for EveryBunny', 'Buckeye House Rabbit Society',
       'Bunnies on Board', 'Columbus House Rabbit Society', 'Columbus Humane',
       'Destiny’s Safe Haven Inc.', 'Dolly’s Dream Home Rabbit Rescue',
       'E.A.R.S. — Erie Area Rabbit Society & Rescue',
       'F5RS — Frisky Ferrets, Fuzzies & Feathered Friends',
       'Great Lakes Rabbit Sanctuary', 'Happy Horizon Hamster Haven',
       'Humane Society of Greater Dayton', 'Indiana House Rabbit Society',
       'Missouri House Rabbit Rescue', 'Rabbit Angels Rabbit Rescue',
       'Saving Rabbits', 'Snickerdoodles’ Rabbit Rescue');

  -- -----------------------------------------------------------
  -- The 2026 vendor roster
  --
  -- A BunFest vendor is not automatically a company OHRR buys from, so these
  -- go in as vendors only (is_supplier false). Staff tick "we buy from them"
  -- in Staff → Hop Shop if that changes.
  -- -----------------------------------------------------------
  insert into suppliers (org_id, name, is_supplier, is_vendor, website, vendor_category, vendor_blurb, vendor_published, vendor_years, vendor_sort)
  select v_org, x.name, false, true, x.website, x.category, x.blurb, true, array[v_year], x.sort
    from (values
      ('Art by Lisa Edwards / Bunny Boyz', 'Art', 'https://www.instagram.com/artbylisamedwards',
       'An award-winning local artist whose exclusive art collection sits alongside custom-designed medical equipment, enrichment toys and lifestyle products for disabled and elderly rabbits. Sign your bun up to create their own “Bun Painting” during BunFest. 100% of sales are donated to OHRR and CHRS.', 10),
      ('Bowie’s Snuffle Buddies', 'Toys & Enrichment', 'https://bowiesbuddies.etsy.com',
       'Snuffle balls and mats — interactive enrichment that mimics foraging in the wild. Hide treats, kibble or greens in the soft fleece and let your pet sniff, search and discover.', 20),
      ('Brown Dog Bandanas', 'Beds & Comfort', 'https://www.facebook.com/browndogbandanas',
       'Fleece snuggle pouches, ornaments, window decals, hay bags, U-haul pads, cage pads and other rabbit-themed items.', 30),
      ('Bubble & Beam', 'Jewelry & Gifts', 'https://www.bubbleandbeam.com',
       'A wife-and-husband team making quirky, stylish acrylic jewelry with pearl and mirror finishes, assembled and painted by hand — plus vegan leather notebooks, vinyl stickers and small gifts. Bunnies feature heavily.', 40),
      ('Bunny Beds and Beyond', 'Beds & Comfort', 'https://www.bunnybedsbeyond.com',
       'An online shop of custom handmade items for your pampered house rabbit — helping make your home their home.', 50),
      ('Bunny Brook Designs', 'Jewelry & Gifts', 'https://bunnybrookdesigns.com',
       'Handmade and custom jewelry, home decor, art journals, ornaments and more, all bunny themed. Any item can be personalised if you contact them before BunFest. 20% of profits at BunFest are donated to Columbus House Rabbit Society.', 60),
      ('Charlie Foxtrot Laser Engraving', 'Jewelry & Gifts', 'https://www.facebook.com/CharlieFoxtrotLaserEngraving',
       'Back for a third year with custom laser-engraved keepsakes: bunny name tags, lamps, pens, hair clips, picture frames, wall décor and more. If it can be engraved, they are probably bringing it.', 70),
      ('Crafty Mermaid Sara’s Bunny Boutique', 'Beds & Comfort', 'https://craftymermaidsara.etsy.com',
       'Fun, enriching products for house rabbits — the Bunny Lounger Bed in several sizes, foraging mats, hay feeder bags and wood enrichment toys that encourage natural rabbit instincts. Over 5,000 Etsy sales.', 80),
      ('Essence of Beauty', 'Home & Apparel', 'https://www.facebook.com/groups/essenceofbeauty4bunnies',
       'Senegence skincare and cosmetics, not tested on animals. 100% of profits are donated to the Hippity Hop Fund, created to advance veterinary knowledge of proper rabbit care.', 90),
      ('Evil Twin Arts', 'Art', 'https://www.etsy.com/shop/eviltwinarts',
       'Thrown and hand-built high-fired pottery that is functional for bunnies and people alike — mugs, plates, bowls, ornaments and more.', 100),
      ('Farmer Dave Pet Supply', 'Treats & Food', 'https://www.farmerdavepetsupply.com/',
       'A small family-owned farm and business founded in 2004. Hay grown in western New York, naturally watered by rains off Lake Erie, with no pesticides, herbicides or additives — straight from the farm to your door.', 110),
      ('Firefly Frippery', 'Jewelry & Gifts', 'https://www.fireflyfrippery.com',
       'Handcrafted clay jewelry and figurines, plus bunny-themed charms, keyrings, magnets and jewelry.', 120),
      ('For the Love of Animals', 'Jewelry & Gifts', null,
       'Jewelry, pens, pencils, bookmarks, can openers, wine corks, make-up brushes, crossbody bags, pencil bags, tape measures, bag charms, signs, towels, key chains, sympathy cards, note cards and more.', 130),
      ('Fuzsbunnyboutique', 'Toys & Enrichment', null,
       'A small business making handmade, all-natural toys — foraging toys, their fan-favourite seagrass mats packed with natural materials, and a selection of wooden toys this year.', 140),
      ('Katie’s Willow Wreaths', 'Treats & Food', 'https://katieswillowwreath.etsy.com',
       'Founded in 2022 in Parma Heights, Ohio, making high-quality willow wreaths and willow treats at fair prices — now shipped across the USA and beyond, and given back to rabbit rescues.', 150),
      ('Krystaline Studio', 'Art', 'https://linktr.ee/krystalinestudio',
       'Handmade, whimsical, one-of-a-kind food-animal mashups called “foodie familiars”, up for adoption at each event. Custom orders and requests always welcome.', 160),
      ('Lavender Rabbit', 'Jewelry & Gifts', 'https://www.lavenderrabbit.etsy.com',
       'Handcrafted, unique jewelry for avid bunny lovers and anyone after something cute or whimsical — from the mind, heart and hands of a rabbit devotee.', 170),
      ('Mairzy Doats Designs', 'Art', null,
       'Hand-painted bunny-themed rocks and homemade bunny cards. Individual commissions accepted.', 180),
      ('NerdyCute', 'Jewelry & Gifts', 'https://nerdycute.com',
       'Two sisters creating nerdy, science- and nature-inspired designs for stationery, stickers, magnets, planners, cards and accessories — featuring animals strange and not-so-strange, and a lot of bunnies.', 190),
      ('Punkin’s Patch', 'Home & Apparel', null,
       'Sewn items for bunny lovers — tote bags, purses, wristlets, pouches, coin purses, bowl cozies, postcards and more, with a couple of new items this year.', 200),
      ('Regarding Comic', 'Art', 'https://www.sammys.club',
       'Penny Collin’s chronicle of life with three furry roommates, on cards, mugs, bags and more — plus her other creative works. Her designs have appeared on past Midwest BunFest t-shirts.', 210),
      ('Sew Ruth: Quilts for Causes', 'Home & Apparel', null,
       'Beautiful handmade quilts and bunny-themed fabric items, with custom orders taken for anything you want. All proceeds are donated to the bunnies of Ohio House Rabbit Rescue.', 220),
      ('Sherwood Pet Health', 'Treats & Food', 'https://sherwoodpethealth.com',
       'Maker of the only soy- and grain-free small-pet food and nutrition products in the US, backed by research and recommended by vet offices and rescue groups including House Rabbit Society centers.', 230),
      ('Tattoos by Jillian Lisska', 'Art', 'https://www.instagram.com/jillianlisska',
       'A central Ohio native who tattoos at a private studio in Clintonville, Ohio, and most enjoys cute and fun designs in colour and black & grey. She designed this year’s “Binky On” BunFest logo.', 240),
      ('The Bun Buddies', 'Jewelry & Gifts', 'https://thebunbuddies.square.site',
       'A small online business designing and making homemade items for bunny lovers — figurines, keychains, stickers and more. A portion of all sales goes to OHRR and CHRS.', 250),
      ('The Cozy Carrot', 'Beds & Comfort', 'https://cozy-carrot.com/',
       'Bunny beds since 2020, including the popular Bunny Snoozer and replacement covers (waterproof ones too), plus other bed and mat styles and herb and forage mixes.', 260),
      ('The Healthy Hare', 'Treats & Food', 'https://thehealthyhare.etsy.com',
       'A Cleveland, Ohio business making nutritious, all-natural treats for rabbits and small animals — handmade in small batches with organic ingredients and no preservatives, fillers or artificial additives.', 270)
    ) as x(name, category, website, blurb, sort)
   where not exists (select 1 from suppliers s where s.org_id = v_org and s.name = x.name);

  -- A company already in the list (OHRR buys from some of them) just gets
  -- tagged for this year rather than added again.
  update suppliers set is_vendor = true, vendor_published = true,
                       vendor_years = array_append(vendor_years, v_year)
   where org_id = v_org and not (v_year = any (vendor_years))
     and name in ('Sherwood Pet Health', 'Farmer Dave Pet Supply', 'The Healthy Hare');

  -- -----------------------------------------------------------
  -- The 2026 sponsors
  --
  -- Oxbow is this year's Lead Sponsor; the rest are event sponsors. Terms run
  -- to the end of the year so they drop off the app by themselves, with the
  -- renewal reminder built last round.
  -- -----------------------------------------------------------
  insert into sponsors (org_id, name, tier, blurb, website, term_start, term_end, sort_order)
  select v_org, sp.name, sp.tier, sp.blurb, sp.website,
         date '2026-01-01', date '2026-12-31', sp.sort
    from (values
      ('Oxbow Animal Health', 'presenting',
       'This year’s Lead Midwest BunFest Sponsor. For more than 30 years Oxbow has dedicated each day to growing good in the lives of small pets and the people who love them — with quality products, sound education and a supportive network. Oxbow also sponsors the Bunny Spa and Glamour Shots.',
       'https://www.oxbowanimalhealth.com', 10),
      ('MedVet Hilliard', 'program',
       'A long-time supporter and returning sponsor. MedVet is the leading veterinarian-owned family of specialty and emergency hospitals and urgent cares. The Avian & Exotics team at MedVet Hilliard is highly skilled in the specific medical and surgical needs of rabbits and other exotic pets.',
       'https://www.medvet.com/location/medvet-hilliard', 20),
      ('Animal Hospital of Pataskala', 'program',
       'Serving Pataskala and surrounding communities since 1973, with top-quality communication and client care. Dr. Susan Borders, DVM, has over 28 years of experience with small animals and exotics and focuses much of her professional time on rabbits.',
       'https://www.pataskalavet.com', 30),
      ('Animal Care Unlimited', 'program',
       'Serving central Ohio since 1986. An AAHA-accredited practice with Certified Fear Free® professionals, seeing dogs, cats, rabbits, ferrets, other small mammals, birds and reptiles, with advanced diagnostics and full surgical, medical and critical care.',
       'https://www.animalcareunlimited.com', 40),
      ('Borders Veterinary Services', 'program',
       'A mobile, exotic-only wellness practice based in Columbus and serving much of central Ohio. Dr. Susan Borders sponsors regular local vaccine clinics to help protect rabbits against RHDV.',
       null, 50),
      ('Norton Road Veterinary Hospital', 'program',
       'Founded in 1998 in Galloway, Ohio. Dr. Logan has cared for rabbits since 1993 — dental care, surgery and wellness services including the RHDV2 vaccine — and has worked with many central Ohio rescue groups including OHRR.',
       'https://www.nortonroadvet.com', 60),
      ('Central Ohio Compounding Pharmacy', 'program',
       'Over 40 years of combined experience serving patients across Ohio, customizing medications for animals of all sizes and filling the gaps when medications are discontinued or back-ordered.',
       null, 70),
      ('Supreme Pet Foods', 'program',
       'Award-winning food and treats for pet rabbits, recommended by veterinary experts and enjoyed by millions of pets worldwide for over 30 years. Their Science Selective range is formulated for junior, adult and mature rabbits.',
       'https://www.supremepetfoods.com', 80),
      ('Small Pet Select', 'program',
       'A family-owned business with a hands-on commitment to rabbits and other small animals. Hay is chosen field by field in the Kittitas Valley and hand-packed, so it reaches you fresh rather than out of a warehouse.',
       'https://smallpetselect.com', 90),
      ('Fun4Bunnies', 'program',
       'Fruit- and veggie-flavoured chew toys for small pets, made with real fruit and juice and no artificial flavouring, colouring or added sugar — in wood, grapevine and loofah.',
       null, 100),
      ('Buttercup’s Bunny Boutique', 'program',
       'Quality handmade all-natural toys and locally grown organic dried fruit treats for exotic pets, from San Diego since 2017 — famous for hay-centric designs like the oversized hay-rito. They also run the BunFest Toymaking Workshop.',
       'https://www.buttercupsbunnyboutique.com', 110),
      ('Ignyte Financial', 'program',
       'A collaborative, relationship-centred financial planning firm in Powell, Ohio. Katie Wolfe, CFP® and COO, has been part of the Columbus rescue community for more than 20 years, caring for rescue rabbits and supporting local house rabbit rescues.',
       null, 120)
    ) as sp(name, tier, blurb, website, sort)
   where not exists (select 1 from sponsors s where s.org_id = v_org and s.name = sp.name);

  -- Show them on the BunFest pages.
  insert into sponsor_placements (org_id, sponsor_id, surface)
  select v_org, s.id, 'bunfest'
    from sponsors s
   where s.org_id = v_org
     and s.term_end = date '2026-12-31'
     and not exists (select 1 from sponsor_placements p
                      where p.sponsor_id = s.id and p.surface = 'bunfest');

end $seed$;
