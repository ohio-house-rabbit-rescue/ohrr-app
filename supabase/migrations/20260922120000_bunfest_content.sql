-- =============================================================
-- OHRR — Midwest BunFest content staff can edit
--
-- The BunFest schedule, vendor list, rescue-partner directory and booth map
-- were hard-coded 2025 data with a "the 2026 roster is announced closer to the
-- event" note — the only way to publish this year's programme was a code
-- change. Now each lives in a table OHRR edits from Staff → BunFest:
--
--   bunfest_sessions  the education programme: time, title, presenter, room,
--                     and `year` so next year's programme replaces this one
--                     without deleting the record of the last.
--   rescue_partners   the rescue directory (BunFest partners + "find a rescue
--                     near you"): name, city/state/region, contact, website.
--   suppliers.vendor_*  a company already in the supplier/vendor list becomes
--                     a BunFest vendor page: public blurb, category, booth and
--                     room. Contact details, account numbers and ordering
--                     notes stay staff-only — the public read goes through
--                     bunfest_vendors_public(), which returns only the public
--                     columns.
--
-- Sponsors already live in `sponsors` (20260917150000) and are publicly
-- readable; this migration doesn't change them — the BunFest Sponsors page now
-- reads that table instead of its bundled list.
--
-- Every public read falls back to the bundled 2025 seed in the app until rows
-- exist here, so nothing goes blank between pasting this and OHRR typing the
-- 2026 programme in.
--
-- Paste + Run in the Supabase SQL editor AFTER 20260922110000_hopshop_suppliers.sql.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- The education programme
-- -------------------------------------------------------------
create table if not exists bunfest_sessions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  year         int  not null default extract(year from now())::int
                 check (year between 2000 and 2100),
  start_time   time not null,
  end_time     time,
  title        text not null,
  presenter    text,
  description  text,
  room         text,                 -- "Upstairs · Education Room", "Emerald Room stage"
  kind         text not null default 'session'
                 check (kind in ('session', 'break', 'activity')),
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_time is null or end_time > start_time)
);
create index if not exists idx_bunfest_sessions_year on bunfest_sessions(org_id, year, start_time);
drop trigger if exists trg_bunfest_sessions_updated on bunfest_sessions;
create trigger trg_bunfest_sessions_updated before update on bunfest_sessions
  for each row execute function set_updated_at();

alter table bunfest_sessions enable row level security;
drop policy if exists bunfest_sessions_public_select on bunfest_sessions;
create policy bunfest_sessions_public_select on bunfest_sessions for select using (is_published);
drop policy if exists bunfest_sessions_staff_select on bunfest_sessions;
create policy bunfest_sessions_staff_select on bunfest_sessions for select
  using (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists bunfest_sessions_staff_write on bunfest_sessions;
create policy bunfest_sessions_staff_write on bunfest_sessions for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select on bunfest_sessions to anon, authenticated;
grant insert, update, delete on bunfest_sessions to authenticated;

-- -------------------------------------------------------------
-- The rescue directory
-- -------------------------------------------------------------
create table if not exists rescue_partners (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  location     text,                 -- the label on the card ("Columbus, OH")
  city         text,
  state        text,                 -- 2-letter
  region       text check (region is null or region in ('Midwest', 'Northeast', 'South', 'West')),
  phone        text,
  email        text,
  address      text,
  website      text,
  blurb        text,
  is_host      boolean not null default false,   -- OHRR itself
  at_bunfest   boolean not null default true,    -- a BunFest rescue partner this year
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_rescue_partners_org on rescue_partners(org_id, sort_order, name);
drop trigger if exists trg_rescue_partners_updated on rescue_partners;
create trigger trg_rescue_partners_updated before update on rescue_partners
  for each row execute function set_updated_at();

alter table rescue_partners enable row level security;
drop policy if exists rescue_partners_public_select on rescue_partners;
create policy rescue_partners_public_select on rescue_partners for select using (is_published);
drop policy if exists rescue_partners_staff_select on rescue_partners;
create policy rescue_partners_staff_select on rescue_partners for select
  using (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists rescue_partners_staff_write on rescue_partners;
create policy rescue_partners_staff_write on rescue_partners for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select on rescue_partners to anon, authenticated;
grant insert, update, delete on rescue_partners to authenticated;

-- -------------------------------------------------------------
-- A supplier/vendor's BunFest booth
-- -------------------------------------------------------------
alter table suppliers add column if not exists vendor_category  text;
alter table suppliers add column if not exists vendor_blurb     text;
alter table suppliers add column if not exists vendor_booth     text;
alter table suppliers add column if not exists vendor_room      text
  check (vendor_room is null or vendor_room in ('burgundy', 'emerald'));
alter table suppliers add column if not exists vendor_tables    int not null default 1
  check (vendor_tables between 1 and 4);
alter table suppliers add column if not exists vendor_published boolean not null default false;
alter table suppliers add column if not exists vendor_sort      int not null default 0;

-- Public: only the columns a visitor should see, only for published vendors.
create or replace function bunfest_vendors_public()
returns table (
  id uuid, name text, category text, blurb text, website text,
  booth text, room text, tables int
) language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.vendor_category, s.vendor_blurb, s.website,
         s.vendor_booth, s.vendor_room, s.vendor_tables
    from suppliers s
   where s.is_vendor and s.vendor_published and s.is_active
   order by s.vendor_sort, s.name;
$$;
grant execute on function bunfest_vendors_public() to anon, authenticated;

-- Staff: the vendor side of a supplier row, without touching the buying side.
create or replace function save_vendor_details(
  p_id uuid, p_category text default null, p_blurb text default null,
  p_booth text default null, p_room text default null, p_tables int default 1,
  p_published boolean default false, p_sort int default 0
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
    vendor_sort      = coalesce(p_sort, 0)
  where id = p_id;
end $$;
grant execute on function save_vendor_details(uuid, text, text, text, text, int, boolean, int) to authenticated;
