-- =============================================================
-- OHRR App — Midwest BunFest Silent Auction catalog (staff-managed)
--
-- Two tables:
--   raffle_items      the items on the auction tables (photo, title, donor,
--                     value, session). The table keeps the name `raffle_items`
--                     on purpose: the OHRR website reads it (read-only) as a
--                     pre-event preview, so the column names must stay exactly
--                     id, org_id, event_slug, title, description, donated_by,
--                     value_cents, photo_url, session, status, is_published,
--                     sort_order.
--   auction_settings  one row per (org, event): the morning/afternoon close
--                     times and an optional intro line for the public catalog.
--
-- Staff with `events.bunfest.manage` manage both. Visitors (anon) see every
-- PUBLISHED item — won items stay visible with a "Won" badge (no winner is ever
-- stored); hiding an item is is_published = false. Item photos go to a public
-- bucket.
--
-- Apply AFTER the events/vets migrations (20260917120000 / 20260917120100) and
-- after 20260627072524_rabbits.sql (this copies its bucket pattern; the helper
-- functions set_updated_at() / has_permission() come from the Hop Shop backend).
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Items
-- -------------------------------------------------------------
create table if not exists raffle_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  event_slug    text not null default 'midwest-bunfest-2026',   -- plain text on purpose (no FK yet)
  title         text not null,
  description   text,
  donated_by    text,
  value_cents   int check (value_cents is null or value_cents >= 0),
  photo_url     text,
  session       text not null default 'all-day'
                check (session in ('morning', 'afternoon', 'all-day')),
  status        text not null default 'available'
                check (status in ('available', 'won')),
  is_published  boolean not null default true,
  sort_order    int not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Close times live in auction_settings (per session), not per item.
alter table raffle_items drop column if exists closes_at;
create index if not exists idx_raffle_items_org
  on raffle_items(org_id, event_slug, session, sort_order);

drop trigger if exists trg_raffle_items_updated on raffle_items;
create trigger trg_raffle_items_updated before update on raffle_items
  for each row execute function set_updated_at();

alter table raffle_items enable row level security;

-- Public (incl. anonymous visitors) read every PUBLISHED item, whatever its status.
drop policy if exists raffle_items_public_select on raffle_items;
create policy raffle_items_public_select on raffle_items for select
  using (is_published);

-- Staff who manage BunFest also see unpublished items — OR'd with the public policy.
drop policy if exists raffle_items_staff_select on raffle_items;
create policy raffle_items_staff_select on raffle_items for select
  using (has_permission(org_id, 'events.bunfest.manage'));

-- Writes gated on events.bunfest.manage.
drop policy if exists raffle_items_insert on raffle_items;
create policy raffle_items_insert on raffle_items for insert
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists raffle_items_update on raffle_items;
create policy raffle_items_update on raffle_items for update
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists raffle_items_delete on raffle_items;
create policy raffle_items_delete on raffle_items for delete
  using (has_permission(org_id, 'events.bunfest.manage'));

grant select on raffle_items to anon, authenticated;
grant insert, update, delete on raffle_items to authenticated;

-- -------------------------------------------------------------
-- Auction setup: session close times + optional intro line
-- -------------------------------------------------------------
create table if not exists auction_settings (
  org_id              uuid not null references organizations(id) on delete cascade,
  event_slug          text not null default 'midwest-bunfest-2026',
  morning_closes_at   timestamptz,
  afternoon_closes_at timestamptz,
  intro_text          text,
  updated_at          timestamptz not null default now(),
  primary key (org_id, event_slug)
);

drop trigger if exists trg_auction_settings_updated on auction_settings;
create trigger trg_auction_settings_updated before update on auction_settings
  for each row execute function set_updated_at();

alter table auction_settings enable row level security;

drop policy if exists auction_settings_public_select on auction_settings;
create policy auction_settings_public_select on auction_settings for select
  using (true);

drop policy if exists auction_settings_insert on auction_settings;
create policy auction_settings_insert on auction_settings for insert
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists auction_settings_update on auction_settings;
create policy auction_settings_update on auction_settings for update
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists auction_settings_delete on auction_settings;
create policy auction_settings_delete on auction_settings for delete
  using (has_permission(org_id, 'events.bunfest.manage'));

grant select on auction_settings to anon, authenticated;
grant insert, update, delete on auction_settings to authenticated;

-- =============================================================
-- Storage: a public bucket for auction item photos. Public read; uploads/edits
-- limited to staff who hold events.bunfest.manage (same pattern as rabbit-photos,
-- narrowed from "any active member" to the BunFest capability).
-- =============================================================
insert into storage.buckets (id, name, public)
values ('raffle-photos', 'raffle-photos', true)
on conflict (id) do nothing;

drop policy if exists "raffle photos public read" on storage.objects;
create policy "raffle photos public read" on storage.objects for select
  using (bucket_id = 'raffle-photos');

drop policy if exists "raffle photos staff insert" on storage.objects;
create policy "raffle photos staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'raffle-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'events.bunfest.manage')
    )
  );

drop policy if exists "raffle photos staff update" on storage.objects;
create policy "raffle photos staff update" on storage.objects for update to authenticated
  using (
    bucket_id = 'raffle-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'events.bunfest.manage')
    )
  );

drop policy if exists "raffle photos staff delete" on storage.objects;
create policy "raffle photos staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'raffle-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'events.bunfest.manage')
    )
  );
