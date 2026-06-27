-- =============================================================
-- OHRR App — Volunteer opportunities (staff-editable public content)
--
-- Staff with `volunteers.shifts.manage` can manage the volunteer listings that
-- appear under each "way to help": socialization shifts, vet-transport runs, and
-- events. One flexible table covers all three categories. Visitors (anon) read
-- PUBLISHED rows; the public Volunteer pages fall back to the built-in sample
-- listings when a category has none.
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists volunteer_opportunities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  category     text not null,         -- 'socialization' | 'vet-transport' | 'events'
  title        text not null,
  detail       text,
  when_text    text,                  -- human-readable date/time
  where_text   text,                  -- location, or "from → to" for a run
  spots        text,                  -- free text, e.g. "2 open" / "3 needed"
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_vol_opps_org on volunteer_opportunities(org_id, category, sort_order);

drop trigger if exists trg_vol_opps_updated on volunteer_opportunities;
create trigger trg_vol_opps_updated before update on volunteer_opportunities
  for each row execute function set_updated_at();

alter table volunteer_opportunities enable row level security;

-- Public (incl. anonymous visitors) read PUBLISHED opportunities.
drop policy if exists vol_opps_public_select on volunteer_opportunities;
create policy vol_opps_public_select on volunteer_opportunities for select
  using (is_published);

-- Staff who manage volunteers also see drafts (OR'd with the public policy).
drop policy if exists vol_opps_staff_select on volunteer_opportunities;
create policy vol_opps_staff_select on volunteer_opportunities for select
  using (has_permission(org_id, 'volunteers.shifts.manage'));

-- Writes gated on volunteers.shifts.manage.
drop policy if exists vol_opps_insert on volunteer_opportunities;
create policy vol_opps_insert on volunteer_opportunities for insert
  with check (has_permission(org_id, 'volunteers.shifts.manage'));
drop policy if exists vol_opps_update on volunteer_opportunities;
create policy vol_opps_update on volunteer_opportunities for update
  using (has_permission(org_id, 'volunteers.shifts.manage'))
  with check (has_permission(org_id, 'volunteers.shifts.manage'));
drop policy if exists vol_opps_delete on volunteer_opportunities;
create policy vol_opps_delete on volunteer_opportunities for delete
  using (has_permission(org_id, 'volunteers.shifts.manage'));

grant select on volunteer_opportunities to anon, authenticated;
grant insert, update, delete on volunteer_opportunities to authenticated;
