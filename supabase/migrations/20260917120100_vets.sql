-- =============================================================
-- OHRR App + Website — Rabbit-savvy vets (staff-editable, shared data contract)
--
-- The vet directory from ohiohouserabbitrescue.org/rabbit-care/vets, managed by
-- staff with `content.education.edit`. Visitors (anon) read PUBLISHED rows and
-- filter by `region` (Central Ohio, Cincinnati, Dayton Area, Toledo, Northeast
-- Ohio). `is_emergency` marks 24/7 / after-hours exotics care; `is_low_cost_spay`
-- marks the low-cost spay/neuter section. The app falls back to its bundled
-- seed until the table exists.
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists vets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  name             text not null,
  doctors          text,
  address          text,
  city             text,
  region           text not null,
  phone            text,
  phone2           text,
  email            text,
  website          text,
  notes            text,
  is_emergency     boolean not null default false,
  is_low_cost_spay boolean not null default false,
  is_published     boolean not null default true,
  sort_order       int not null default 0,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_vets_org_region on vets(org_id, region, sort_order);

drop trigger if exists trg_vets_updated on vets;
create trigger trg_vets_updated before update on vets
  for each row execute function set_updated_at();

alter table vets enable row level security;

-- Public (incl. anonymous visitors) read PUBLISHED vets.
drop policy if exists vets_public_select on vets;
create policy vets_public_select on vets for select
  using (is_published);

-- Staff who edit education content also see drafts (OR'd with the public policy).
drop policy if exists vets_staff_select on vets;
create policy vets_staff_select on vets for select
  using (has_permission(org_id, 'content.education.edit'));

-- Writes gated on content.education.edit.
drop policy if exists vets_insert on vets;
create policy vets_insert on vets for insert
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists vets_update on vets;
create policy vets_update on vets for update
  using (has_permission(org_id, 'content.education.edit'))
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists vets_delete on vets;
create policy vets_delete on vets for delete
  using (has_permission(org_id, 'content.education.edit'));

grant select on vets to anon, authenticated;
grant insert, update, delete on vets to authenticated;
