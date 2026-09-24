-- =============================================================
-- OHRR — update 24: sponsor renewals list + sponsor logos
--
-- OHRR (2026-09-24): sponsorships already end on their own (term_end), but
-- "we will need a list generator on sponsors that are about to expire and
-- then we can reach out for a continued." And the sponsor list at the bottom
-- of the BunFest page "is a mass of words" — show each sponsor's logo.
--
-- Part 1 keeps, per sponsor, who to ask about renewing and where that stands.
--   STAFF ONLY: the public sponsors table is readable by anyone, so contact
--   details live in this separate table, which only staff who manage BunFest
--   can see or change. `status_for` is the term end the status is about, so
--   when a sponsor renews, the next term starts again at "not asked yet".
-- Part 2 is who may read and change it.
-- Part 3 gives the 2026 sponsors the logos on OHRR's own BunFest sponsors page
--   (midwestbunfest.org/2026-sponsors.html; copies ship with the app and both
--   websites at /img/sponsors/...), fills in the web addresses that page lists,
--   and corrects Norton Road's (nortonroadvet.com does not exist; it is
--   nortonroadvethospital.com). Supreme Pet Foods only has an advert there, so
--   it keeps showing its name until staff upload a logo.
-- Safe to run more than once. Paste + Run after update 23.
-- =============================================================

-- Part 1: renewal contact + status, one row per sponsor
create table if not exists public.sponsor_renewals (
  sponsor_id    uuid primary key references public.sponsors(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  contact_name  text,
  contact_email text,
  contact_phone text,
  status        text not null default 'not_asked'
                  check (status in ('not_asked', 'asked', 'renewing', 'not_renewing')),
  status_for    date,
  asked_on      date,
  note          text,
  updated_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_sponsor_renewals_updated_at on public.sponsor_renewals;
create trigger trg_sponsor_renewals_updated_at before update on public.sponsor_renewals
  for each row execute function set_updated_at();

-- Part 2: staff who manage BunFest only (no public read)
alter table public.sponsor_renewals enable row level security;

drop policy if exists sponsor_renewals_staff on public.sponsor_renewals;
create policy sponsor_renewals_staff on public.sponsor_renewals for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));

revoke all on public.sponsor_renewals from anon;
grant select, insert, update, delete on public.sponsor_renewals to authenticated;

-- Part 3: logos and web addresses (only fills blanks; never overwrites a logo staff uploaded).
-- Names match by their start, so the curly apostrophe in Buttercup’s cannot trip it.
update public.sponsors s
   set logo_url = v.logo
  from (values
    ('Oxbow Animal Health',               '/img/sponsors/oxbow-animal-health.jpg'),
    ('MedVet Hilliard',                   '/img/sponsors/medvet.jpg'),
    ('Animal Hospital of Pataskala',      '/img/sponsors/animal-hospital-of-pataskala.jpg'),
    ('Animal Care Unlimited',             '/img/sponsors/animal-care-unlimited.jpg'),
    ('Borders Veterinary Services',       '/img/sponsors/borders-veterinary-services.jpg'),
    ('Norton Road Veterinary Hospital',   '/img/sponsors/norton-road-veterinary-hospital.jpg'),
    ('Central Ohio Compounding Pharmacy', '/img/sponsors/central-ohio-compounding-pharmacy.jpg'),
    ('Small Pet Select',                  '/img/sponsors/small-pet-select.jpg'),
    ('Fun4Bunnies',                       '/img/sponsors/fun4bunnies.png'),
    ('Buttercup',                         '/img/sponsors/buttercups-bunny-boutique.png'),
    ('Ignyte Financial',                  '/img/sponsors/ignyte-financial.jpg')
  ) as v(name, logo)
 where s.org_id = '57afac34-004d-4e13-9a51-d174bbb40081'
   and s.name like v.name || '%'
   and (s.logo_url is null or s.logo_url = '');

update public.sponsors s
   set website = v.site
  from (values
    ('Central Ohio Compounding Pharmacy', 'https://www.cocprx.com'),
    ('Fun4Bunnies',                       'https://www.fun4bunnies.com'),
    ('Ignyte Financial',                  'https://www.ignytefinancial.com'),
    ('Borders Veterinary Services',       'https://www.facebook.com/profile.php?id=100076848312694')
  ) as v(name, site)
 where s.org_id = '57afac34-004d-4e13-9a51-d174bbb40081'
   and s.name = v.name
   and (s.website is null or s.website = '');

update public.sponsors
   set website = 'https://www.nortonroadvethospital.com'
 where org_id = '57afac34-004d-4e13-9a51-d174bbb40081'
   and name = 'Norton Road Veterinary Hospital'
   and website = 'https://www.nortonroadvet.com';
