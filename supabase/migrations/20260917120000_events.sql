-- =============================================================
-- OHRR App + Website — Events (staff-editable, shared data contract)
--
-- Staff with `events.bunfest.manage` manage the events shown in the app's
-- Events screen and on the website. The Midwest BunFest sub-app reads its
-- date / time / venue / theme from the BunFest event row (slug
-- `midwest-bunfest-2026`) so it is never stale. Visitors (anon) read PUBLISHED
-- rows; the app falls back to its bundled seed until the table exists.
--
-- `body` is light markdown: blank-line-separated paragraphs, `## ` headings,
-- and `- ` bullet lines. `slug` is stable per event (unique per org).
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  slug         text not null,
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  venue        text,
  address      text,
  city         text,
  summary      text,
  body         text,
  theme        text,
  url          text,
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_events_org_starts on events(org_id, starts_at);

drop trigger if exists trg_events_updated on events;
create trigger trg_events_updated before update on events
  for each row execute function set_updated_at();

alter table events enable row level security;

-- Public (incl. anonymous visitors) read PUBLISHED events.
drop policy if exists events_public_select on events;
create policy events_public_select on events for select
  using (is_published);

-- Staff who manage events also see drafts (OR'd with the public policy).
drop policy if exists events_staff_select on events;
create policy events_staff_select on events for select
  using (has_permission(org_id, 'events.bunfest.manage'));

-- Writes gated on events.bunfest.manage.
drop policy if exists events_insert on events;
create policy events_insert on events for insert
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists events_update on events;
create policy events_update on events for update
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists events_delete on events;
create policy events_delete on events for delete
  using (has_permission(org_id, 'events.bunfest.manage'));

grant select on events to anon, authenticated;
grant insert, update, delete on events to authenticated;
