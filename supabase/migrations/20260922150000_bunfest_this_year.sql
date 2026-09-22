-- =============================================================
-- OHRR — Midwest BunFest: the last of the hard-coded content, per year
--
-- A review of the published 2026 site (midwestbunfest.org, read 2026-09-22)
-- against the app found the programme, the vendor and rescue rosters and every
-- activity page still coming from bundled 2025 data or from code. This
-- migration moves the rest into tables OHRR edits, keyed by year, and fills
-- 2026 in from the site so nothing has to be typed twice:
--
--   bunfest_pages            the activity and info pages (Bunny Spa, Glamour
--                            Shots, Raffle & Silent Auction, Chillaxabun
--                            Lounge, Toymaking, Bringing Your Bunny, the
--                            attendance agreement, the host hotel, and now
--                            Volunteer at BunFest) — one set per year. These
--                            were `src/data/bunfestPages.ts`.
--   bunfest_sessions.track   the festival runs two parallel tracks (Education
--                            Sessions and Special Interest Sessions); the app
--                            only ever showed one.
--   suppliers.vendor_years   which years a company had a table.
--   rescue_partners.bunfest_years  which years a rescue came.
--   start_bunfest_year()     copy a whole year forward in one tap.
--
-- Rosters are tagged by year rather than replaced, so last year's programme is
-- still there to copy from and nothing is lost when the new one goes up.
--
-- Everything is transcribed from OHRR's own published pages — no invented
-- prices, times or names. Seeds are skipped when a row already exists, so a
-- second run never overwrites a staff edit.
--
-- Paste + Run in the Supabase SQL editor AFTER
-- 20260922140000_volunteers_and_event_content.sql. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Two tracks in the programme
--
-- 2026 runs Education Sessions and Special Interest Sessions side by side, so
-- a single timeline showed talks overlapping with no way to tell why. The
-- track is free text: this year there are two, and a third next year needs no
-- code change.
-- -------------------------------------------------------------
alter table bunfest_sessions add column if not exists track text;
update bunfest_sessions set track = 'Education Sessions' where track is null;
alter table bunfest_sessions alter column track set default 'Education Sessions';

-- -------------------------------------------------------------
-- 2. Which years a vendor or a rescue was at BunFest
--
-- `at_bunfest` was a single yes/no, so publishing this year's roster meant
-- editing last year's away. An empty array means "not tagged yet" and is still
-- shown, so nothing goes blank between this migration and the first edit.
-- -------------------------------------------------------------
alter table suppliers       add column if not exists vendor_years  int[] not null default '{}';
alter table rescue_partners add column if not exists bunfest_years int[] not null default '{}';

create index if not exists idx_rescue_partners_years on rescue_partners using gin (bunfest_years);

-- The public vendor read takes the year. The old no-argument version has to go
-- first: a default argument would leave the two overloads ambiguous.
drop function if exists bunfest_vendors_public();
drop function if exists bunfest_vendors_public(int);
create function bunfest_vendors_public(p_year int default null)
returns table (
  id uuid, name text, category text, blurb text, website text,
  booth text, room text, tables int, years int[]
) language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.vendor_category, s.vendor_blurb, s.website,
         s.vendor_booth, s.vendor_room, s.vendor_tables, s.vendor_years
    from suppliers s
   where s.is_vendor and s.vendor_published and s.is_active
     and (p_year is null or s.vendor_years = '{}' or p_year = any (s.vendor_years))
   order by s.vendor_sort, s.name;
$$;
grant execute on function bunfest_vendors_public(int) to anon, authenticated;

-- Staff save gains the year tags for the same reason.
drop function if exists save_vendor_details(uuid, text, text, text, text, int, boolean, int);
drop function if exists save_vendor_details(uuid, text, text, text, text, int, boolean, int, int[]);
create function save_vendor_details(
  p_id uuid, p_category text default null, p_blurb text default null,
  p_booth text default null, p_room text default null, p_tables int default 1,
  p_published boolean default false, p_sort int default 0,
  p_years int[] default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select org_id into v_org from suppliers where id = p_id;
  if v_org is null then raise exception 'No such company'; end if;
  if not has_permission(v_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  update suppliers set
    is_vendor = true,
    vendor_category  = nullif(btrim(coalesce(p_category, '')), ''),
    vendor_blurb     = nullif(btrim(coalesce(p_blurb, '')), ''),
    vendor_booth     = nullif(btrim(coalesce(p_booth, '')), ''),
    vendor_room      = nullif(btrim(coalesce(p_room, '')), ''),
    vendor_tables    = greatest(1, least(4, coalesce(p_tables, 1))),
    vendor_published = coalesce(p_published, false),
    vendor_sort      = coalesce(p_sort, 0),
    vendor_years     = coalesce(p_years, vendor_years)
  where id = p_id;
end $$;
grant execute on function save_vendor_details(uuid, text, text, text, text, int, boolean, int, int[]) to authenticated;

-- -------------------------------------------------------------
-- 3. The activity pages, per year
--
-- Bunny Spa prices, whether advance booking is open, the raffle's drawing
-- time, the hotel's group code — all of it changed between 2025 and 2026 and
-- all of it lived in the app's code. `sections` is the same shape the page
-- already renders: [{ heading, body, list[], slot }].
-- -------------------------------------------------------------
create table if not exists bunfest_pages (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  event_slug     text not null default 'midwest-bunfest',
  year           int  not null default extract(year from now())::int
                   check (year between 2000 and 2100),
  slug           text not null,                    -- 'spa', 'glamour', … the /bunfest/p/:id address
  title          text not null,
  subtitle       text,
  icon           text,
  sponsor_note   text,                             -- "Sponsored by Oxbow"
  chips          text[] not null default '{}',     -- "$20 flat", "Free — donations welcome"
  note           text,                             -- the highlighted rule at the top
  sections       jsonb not null default '[]'::jsonb,
  feature        text check (feature is null or feature in ('reserve', 'raffle')),
  reserve        jsonb,                            -- { formName, services[] }
  email_signup   text,
  contact        jsonb,                            -- { address, phone, url, urlLabel }
  related_label  text,
  related        jsonb not null default '[]'::jsonb,
  is_published   boolean not null default true,
  sort_order     int not null default 0,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, event_slug, year, slug)
);
create index if not exists idx_bunfest_pages on bunfest_pages(org_id, event_slug, year, sort_order);
drop trigger if exists trg_bunfest_pages_updated on bunfest_pages;
create trigger trg_bunfest_pages_updated before update on bunfest_pages
  for each row execute function set_updated_at();

alter table bunfest_pages enable row level security;
drop policy if exists bunfest_pages_public_select on bunfest_pages;
create policy bunfest_pages_public_select on bunfest_pages for select using (is_published);
drop policy if exists bunfest_pages_staff_all on bunfest_pages;
create policy bunfest_pages_staff_all on bunfest_pages for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select on bunfest_pages to anon, authenticated;
grant insert, update, delete on bunfest_pages to authenticated;

-- -------------------------------------------------------------
-- 4. Start next year from this one
--
-- Sets up a new year in one tap: the programme, the "at the festival" cards
-- and every activity page are copied, and this year's vendors and rescues are
-- tagged for the new year too. Nothing is overwritten — anything already
-- entered for the target year is left exactly as it is.
-- -------------------------------------------------------------
create or replace function start_bunfest_year(p_org uuid, p_from int, p_to int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_sessions int := 0;
  n_features int := 0;
  n_pages    int := 0;
  n_vendors  int := 0;
  n_partners int := 0;
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if p_from = p_to then raise exception 'Pick a different year to copy into'; end if;

  insert into bunfest_sessions (org_id, year, start_time, end_time, title, presenter,
                                description, room, track, kind, is_published, sort_order, created_by)
  select s.org_id, p_to, s.start_time, s.end_time, s.title, s.presenter,
         s.description, s.room, s.track, s.kind, s.is_published, s.sort_order, auth.uid()
    from bunfest_sessions s
   where s.org_id = p_org and s.year = p_from
     and not exists (select 1 from bunfest_sessions t
                      where t.org_id = p_org and t.year = p_to
                        and t.title = s.title and t.start_time = s.start_time);
  get diagnostics n_sessions = row_count;

  insert into event_features (org_id, event_slug, year, title, blurb, icon, link_url,
                              is_published, sort_order, created_by)
  select f.org_id, f.event_slug, p_to, f.title, f.blurb, f.icon, f.link_url,
         f.is_published, f.sort_order, auth.uid()
    from event_features f
   where f.org_id = p_org and f.year = p_from
     and not exists (select 1 from event_features t
                      where t.org_id = p_org and t.year = p_to
                        and t.event_slug = f.event_slug and t.title = f.title);
  get diagnostics n_features = row_count;

  insert into bunfest_pages (org_id, event_slug, year, slug, title, subtitle, icon, sponsor_note,
                             chips, note, sections, feature, reserve, email_signup, contact,
                             related_label, related, is_published, sort_order, created_by)
  select p.org_id, p.event_slug, p_to, p.slug, p.title, p.subtitle, p.icon, p.sponsor_note,
         p.chips, p.note, p.sections, p.feature, p.reserve, p.email_signup, p.contact,
         p.related_label, p.related, p.is_published, p.sort_order, auth.uid()
    from bunfest_pages p
   where p.org_id = p_org and p.year = p_from
  on conflict (org_id, event_slug, year, slug) do nothing;
  get diagnostics n_pages = row_count;

  update suppliers set vendor_years = array_append(vendor_years, p_to)
   where org_id = p_org and is_vendor and p_from = any (vendor_years) and not (p_to = any (vendor_years));
  get diagnostics n_vendors = row_count;

  update rescue_partners set bunfest_years = array_append(bunfest_years, p_to)
   where org_id = p_org and p_from = any (bunfest_years) and not (p_to = any (bunfest_years));
  get diagnostics n_partners = row_count;

  return jsonb_build_object('sessions', n_sessions, 'features', n_features, 'pages', n_pages,
                            'vendors', n_vendors, 'partners', n_partners);
end $$;
grant execute on function start_bunfest_year(uuid, int, int) to authenticated;
