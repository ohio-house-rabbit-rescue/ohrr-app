-- =============================================================
-- OHRR — Volunteer hours (with service-hours letters) and the yearly impact page
--
-- Hours come from two places: shifts people were checked in to (bookings +
-- booking_slots, kind = 'shift') and hours staff add by hand for things that
-- aren't booked (transport runs, events, orientation). Staff see totals per
-- person, print a signed service-hours letter, and the impact page can pull
-- the year's volunteer total automatically.
--
-- The impact page is one row per year: the numbers OHRR wants to show donors,
-- sponsors and volunteers, plus a few highlight lines. Public when published.
--
-- Apply AFTER 20260921110000_bookings.sql. Paste + Run. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Hours added by hand
-- -------------------------------------------------------------
create table if not exists volunteer_hours_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  name        text,
  on_date     date not null,
  hours       numeric(5,2) not null check (hours > 0 and hours <= 24),
  activity    text not null,                 -- "Vet transport", "BunFest set-up", "Buncare orientation"
  added_by    uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_vh_entries_org on volunteer_hours_entries(org_id, email, on_date desc);

alter table volunteer_hours_entries enable row level security;
drop policy if exists vh_entries_staff on volunteer_hours_entries;
create policy vh_entries_staff on volunteer_hours_entries for all
  using (has_permission(org_id, 'bookings.manage')) with check (has_permission(org_id, 'bookings.manage'));
grant select, insert, update, delete on volunteer_hours_entries to authenticated;

-- One person's hours, line by line (checked-in shifts + manual entries).
create or replace function volunteer_history(p_org uuid, p_email text, p_from date, p_to date)
returns table (
  source text, on_date date, hours numeric, activity text, ref_id uuid
) language sql stable security definer set search_path = public as $$
  select 'shift', (s.starts_at at time zone 'America/New_York')::date,
         round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 2) * b.party_size,
         t.name, b.id
    from bookings b
    join booking_slots s on s.id = b.slot_id
    join booking_types t on t.id = b.type_id
   where b.org_id = p_org and has_permission(p_org, 'bookings.manage')
     and lower(b.email) = lower(p_email) and b.status = 'checked_in' and t.kind = 'shift'
     and (s.starts_at at time zone 'America/New_York')::date between p_from and p_to
  union all
  select 'manual', e.on_date, e.hours, e.activity, e.id
    from volunteer_hours_entries e
   where e.org_id = p_org and has_permission(p_org, 'bookings.manage')
     and lower(e.email) = lower(p_email)
     and e.on_date between p_from and p_to
  order by 2 desc;
$$;
grant execute on function volunteer_history(uuid, text, date, date) to authenticated;

-- Everyone with hours in a period, totals per person.
create or replace function volunteer_hours_summary(p_org uuid, p_from date, p_to date)
returns table (
  email text, name text, total_hours numeric, shifts int, last_date date
) language sql stable security definer set search_path = public as $$
  with lines as (
    select lower(b.email) as email, b.name,
           (s.starts_at at time zone 'America/New_York')::date as on_date,
           round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 2) * b.party_size as hours
      from bookings b
      join booking_slots s on s.id = b.slot_id
      join booking_types t on t.id = b.type_id
     where b.org_id = p_org and b.status = 'checked_in' and t.kind = 'shift'
       and (s.starts_at at time zone 'America/New_York')::date between p_from and p_to
    union all
    select lower(e.email), e.name, e.on_date, e.hours
      from volunteer_hours_entries e
     where e.org_id = p_org and e.on_date between p_from and p_to
  )
  select email, max(name), sum(hours), count(*)::int, max(on_date)
    from lines
   where has_permission(p_org, 'bookings.manage')
   group by email
   order by sum(hours) desc, max(name);
$$;
grant execute on function volunteer_hours_summary(uuid, date, date) to authenticated;

-- The org-wide total for a year (for the impact page; readable by staff).
create or replace function volunteer_hours_total(p_org uuid, p_year int)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(total_hours), 0)
    from volunteer_hours_summary(p_org, make_date(p_year, 1, 1), make_date(p_year, 12, 31));
$$;
grant execute on function volunteer_hours_total(uuid, int) to authenticated;

-- -------------------------------------------------------------
-- Impact, one row per year
-- -------------------------------------------------------------
create table if not exists impact_years (
  org_id             uuid not null references organizations(id) on delete cascade,
  year               int  not null check (year between 2000 and 2100),
  adopted            int,
  taken_in           int,
  spay_neuter        int,
  vet_care_cents     bigint,
  volunteer_hours    numeric(8,1),
  fosters            int,
  bunfest_attendance int,
  highlights         text[] not null default '{}',   -- short lines: "First RHDV2 clinic", "New adoption pens"
  note               text,                            -- one sentence under the numbers
  is_published       boolean not null default false,
  updated_by         uuid references auth.users(id),
  updated_at         timestamptz not null default now(),
  primary key (org_id, year)
);
drop trigger if exists trg_impact_years_updated on impact_years;
create trigger trg_impact_years_updated before update on impact_years
  for each row execute function set_updated_at();

alter table impact_years enable row level security;
drop policy if exists impact_public_select on impact_years;
create policy impact_public_select on impact_years for select using (is_published);
drop policy if exists impact_staff_select on impact_years;
create policy impact_staff_select on impact_years for select using (has_permission(org_id, 'announcements.post'));
drop policy if exists impact_staff_write on impact_years;
create policy impact_staff_write on impact_years for all
  using (has_permission(org_id, 'announcements.post')) with check (has_permission(org_id, 'announcements.post'));
grant select on impact_years to anon, authenticated;
grant insert, update, delete on impact_years to authenticated;
