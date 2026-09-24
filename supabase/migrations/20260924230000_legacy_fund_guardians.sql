-- =============================================================
-- Update 29 (2026-09-24): the OHRR Legacy Fund and the Rescue Rabbit
-- Guardians honor roll.
--
-- OHRR (2026-09-24): "we need to look at how we can honor these people and
-- also promote this as an option" … "the legacy donors just follow the
-- existing website details for now". So, as the live site has it: one group,
-- the Rescue Rabbit Guardians (a planned gift, or $1,000 or more in a calendar
-- year), thanked by name on the website, a year at a time. The live site shows
-- the list as a picture; here it is text that staff keep (Staff → Guardians),
-- starting from the 47 names on the live site's 2026 graphic.
--
-- The table holds only what is shown in public: the name as the family wants
-- it, the year and how to sort it. Nothing about how or what anyone gave.
-- "Ask about the Legacy Fund" messages use the existing requests table (kind
-- 'legacy-info'), so they reach the staff Inbox with no change here.
-- Safe to run more than once.
-- =============================================================

-- Part 1 — who may keep the list (owners and admins already can)
insert into permissions(key, area, description) values
 ('giving.guardians', 'Giving', 'Keep the Rescue Rabbit Guardians list (the Legacy Fund thank-you)')
on conflict (key) do nothing;

-- Part 2 — the list
create table if not exists public.guardians (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  year         int  not null check (year between 2020 and 2100),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  sort_name    text not null default '',
  is_published boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, year, display_name)
);
create index if not exists idx_guardians_year on public.guardians(org_id, year desc);
drop trigger if exists trg_guardians_updated on public.guardians;
create trigger trg_guardians_updated before update on public.guardians
  for each row execute function set_updated_at();
alter table public.guardians enable row level security;
drop policy if exists guardians_public_select on public.guardians;
create policy guardians_public_select on public.guardians for select
  using (is_published or has_permission(org_id, 'giving.guardians'));
drop policy if exists guardians_staff_write on public.guardians;
create policy guardians_staff_write on public.guardians for all
  using (has_permission(org_id, 'giving.guardians'))
  with check (has_permission(org_id, 'giving.guardians'));
grant select on public.guardians to anon, authenticated;
grant insert, update, delete on public.guardians to authenticated;

-- Part 3 — the 2026 Rescue Rabbit Guardians, as on the live site's graphic
-- (ohiohouserabbitrescue.org, "Thank you to our Rescue Rabbit Guardians")
insert into public.guardians (org_id, year, display_name, sort_name)
select o.id, 2026, v.display_name, v.sort_name
  from (select id from public.organizations where name = 'Ohio House Rabbit Rescue' limit 1) o,
       (values
  ('Elizabeth Aino', 'Aino Elizabeth'),
  ('Joanne Allsop', 'Allsop Joanne'),
  ('Barb Armitage & Robert Shapter', 'Armitage Barb'),
  ('Ryan Ballantyne', 'Ballantyne Ryan'),
  ('Kim Banks', 'Banks Kim'),
  ('Bob & Inger Barron', 'Barron Bob & Inger'),
  ('Pat Barron', 'Barron Pat'),
  ('Pam Beegle', 'Beegle Pam'),
  ('Bellala Family', 'Bellala'),
  ('Nancy Betz', 'Betz Nancy'),
  ('Diane & Dirk Cantrell', 'Cantrell Diane & Dirk'),
  ('Ivy Conklan', 'Conklan Ivy'),
  ('Leslye Creek', 'Creek Leslye'),
  ('Kim Eplin', 'Eplin Kim'),
  ('Ruth Fassinger', 'Fassinger Ruth'),
  ('Katie Feick', 'Feick Katie'),
  ('David Fisher', 'Fisher David'),
  ('Kat Fliehman', 'Fliehman Kat'),
  ('Laura Ann Froehlich', 'Froehlich Laura Ann'),
  ('Andrea Garcia', 'Garcia Andrea'),
  ('Shauna Hann', 'Hann Shauna'),
  ('Beverly & James Harris', 'Harris Beverly & James'),
  ('Hayes Family', 'Hayes'),
  ('Dave & June Hinkle', 'Hinkle Dave & June'),
  ('Dan Kosinski', 'Kosinski Dan'),
  ('Anthony Leicher', 'Leicher Anthony'),
  ('Susan Martin', 'Martin Susan'),
  ('Beverly May', 'May Beverly'),
  ('Frank McMillan', 'McMillan Frank'),
  ('Lindsay & Aaron McPherson', 'McPherson Lindsay & Aaron'),
  ('Miglin Family', 'Miglin'),
  ('Mia Ng', 'Ng Mia'),
  ('Mary Beth Parisi', 'Parisi Mary Beth'),
  ('Holly & Matthew Renzi', 'Renzi Holly & Matthew'),
  ('Wendy Risner', 'Risner Wendy'),
  ('Todd & Lisa Rutherford', 'Rutherford Todd & Lisa'),
  ('Susanne St. Clair', 'St. Clair Susanne'),
  ('Adam & Kimberly Stang', 'Stang Adam & Kimberly'),
  ('Ann Stringer', 'Stringer Ann'),
  ('Vuppala Family', 'Vuppala'),
  ('Rosie Wendt', 'Wendt Rosie'),
  ('Heather & Jarod Whitaker', 'Whitaker Heather & Jarod'),
  ('Marissa White', 'White Marissa'),
  ('Karen & Carl Winstead', 'Winstead Karen & Carl'),
  ('Julie & Katie Wolfe', 'Wolfe Julie & Katie'),
  ('Wolff Family', 'Wolff'),
  ('Kevin Worobey', 'Worobey Kevin')
       ) as v(display_name, sort_name)
on conflict (org_id, year, display_name) do nothing;
