-- =============================================================
-- OHRR App — Announcements (first staff-editable PUBLIC content area)
--
-- Staff with the `announcements.post` capability can post short notices that show
-- up in the public app (closures, urgent needs, "we're at BunFest this weekend").
-- Visitors (anon) can read PUBLISHED announcements; only staff with the capability
-- can see drafts or write. Same RLS pattern as the Hop Shop, extended to allow
-- public reads of published rows.
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists announcements (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  title        text not null,
  body         text not null,
  is_published boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_announcements_org on announcements(org_id, created_at desc);

drop trigger if exists trg_announcements_updated on announcements;
create trigger trg_announcements_updated before update on announcements
  for each row execute function set_updated_at();

alter table announcements enable row level security;

-- Public (incl. anonymous visitors) can read PUBLISHED announcements.
drop policy if exists announcements_public_select on announcements;
create policy announcements_public_select on announcements for select
  using (is_published);

-- Staff who can post also see drafts (for management). SELECT policies are OR'd,
-- so this widens visibility for staff without exposing drafts to the public.
drop policy if exists announcements_staff_select on announcements;
create policy announcements_staff_select on announcements for select
  using (has_permission(org_id, 'announcements.post'));

-- Writes are gated on the announcements.post capability.
drop policy if exists announcements_insert on announcements;
create policy announcements_insert on announcements for insert
  with check (has_permission(org_id, 'announcements.post'));
drop policy if exists announcements_update on announcements;
create policy announcements_update on announcements for update
  using (has_permission(org_id, 'announcements.post'))
  with check (has_permission(org_id, 'announcements.post'));
drop policy if exists announcements_delete on announcements;
create policy announcements_delete on announcements for delete
  using (has_permission(org_id, 'announcements.post'));

-- Explicit table grants (RLS still applies on top). Supabase usually grants these
-- by default for new public-schema tables; included here to be safe + portable.
grant select on announcements to anon, authenticated;
grant insert, update, delete on announcements to authenticated;
