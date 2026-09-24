-- =============================================================
-- OHRR — update 23: "What's happening at OHRR" picture cards
--
-- OHRR (2026-09-24): the new website had the right information but "very
-- little image". The website home now shows picture cards like the current
-- site's post grid — events, fundraisers and news, each with its own artwork.
-- Staff pick them in Staff -> Homepage features (website) / Home screen (app),
-- in a new group, "What's happening". They show on the website only; the
-- app's Home keeps its big and featured cards.
--
-- Part 1 opens the new group. Part 2 adds the five posts from the current
-- OHRR home page (the same ones the website shows until then), so staff can
-- edit, reorder or hide them. The BunFest card hides itself after the
-- festival day. Images are the site's own copies (/img/...). Safe to run
-- more than once.
-- =============================================================

-- Part 1: allow placement 'happening' (drop the old two-value rule, whatever it is called)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.hero_slides'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%placement%'
  loop
    execute format('alter table public.hero_slides drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.hero_slides
  add constraint hero_slides_placement_check check (placement in ('hero', 'featured', 'happening'));

-- Part 2: the five cards (only those not already there)
insert into public.hero_slides
  (org_id, placement, headline, subline, image_url, cta_label, cta_url, ends_at, is_published, sort_order)
select '57afac34-004d-4e13-9a51-d174bbb40081', 'happening', v.headline, v.subline, v.image_url,
       v.cta_label, v.cta_url, v.ends_at::timestamptz, true, v.sort_order
  from (values
    ('Midwest BunFest is Sunday, October 25th!',
     'Binky On! 10am – 4pm at The Makoy in Hilliard: rescues, vendors, a silent auction, raffle, bunny spa and educational sessions all day.',
     '/img/bunfest-2026-logo.png', 'About BunFest', '/bunfest', '2026-10-25 23:59:00-04', 50),
    ('Beach Bunny Vibes – new OHRR merch',
     'A retro beach cruiser, a surfboard and a cool bunny. Proceeds help OHRR care for rabbits waiting for their forever families.',
     '/img/news/beach-bunny-vibes.jpg', 'Shop the shirt', 'https://www.bonfire.com/beach-bunny-vibes/', null, 40),
    ('They Still Talk About You',
     'A shirt that honors the rabbits we’ve loved and lost. All proceeds support OHRR’s adoption activities.',
     '/img/news/they-still-talk-about-you-shirt.png', 'Shop the shirt', 'https://www.bonfire.com/they-still-talk-about-you/', null, 30),
    ('Drive for the Bunnies',
     'The official OHRR license plate, with a Dutch rabbit. OHRR receives a portion of each sale.',
     '/img/news/license-plate-drive-for-the-bunnies.jpg', 'About the plate', '/info/license-plate', null, 20),
    ('Link OHRR to your Kroger card',
     'Every shopping trip donates to the rescue rabbits, at no cost to you.',
     '/img/news/kroger-community-rewards.jpg', 'Link your card', '/info/kroger-rewards', null, 10)
  ) as v(headline, subline, image_url, cta_label, cta_url, ends_at, sort_order)
 where not exists (
   select 1 from public.hero_slides h where h.placement = 'happening' and h.headline = v.headline
 );
