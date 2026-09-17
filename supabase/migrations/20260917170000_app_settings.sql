-- =============================================================
-- OHRR App — app_settings (owner-controlled flags) + raffle-ticket pricing
--
-- 1. A new capability `settings.manage` (Staff area). Owners/admins hold every
--    key implicitly (has_permission()); a staff member can be granted it from
--    the Team screen.
-- 2. `app_settings`: one row per (org, key) holding a small JSON value. The
--    /staff/settings screen writes it; the public app reads it to decide what
--    to show. First use: the TEST feature flag `raffle_tickets_enabled`
--    ({"enabled": true}) that reveals the raffle-ticket reservation form on the
--    BunFest raffle page. ONLY NON-SECRET FLAGS BELONG HERE — every row is
--    publicly readable (anon select).
-- 3. `auction_settings` gains the raffle-ticket pricing + details columns so
--    staff enter the price (nothing is hard-coded in the app). All nullable:
--    when unset the public form shows no price line at all.
--
-- Apply AFTER 20260917130000_raffle_items.sql (auction_settings) and
-- 20260627052536_hopshop_backend.sql (organizations, permissions,
-- set_updated_at, has_permission). Apply once via the Supabase SQL editor
-- (paste + Run) or `supabase db push`. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Capability
-- -------------------------------------------------------------
insert into permissions(key, area, description) values
 ('settings.manage','Staff','Change app settings and turn test features on/off')
on conflict (key) do nothing;

-- -------------------------------------------------------------
-- app_settings
-- -------------------------------------------------------------
create table if not exists app_settings (
  org_id      uuid not null references organizations(id) on delete cascade,
  key         text not null,                       -- e.g. 'raffle_tickets_enabled'
  value       jsonb not null default '{}'::jsonb,  -- e.g. {"enabled": true}
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (org_id, key)
);
comment on table app_settings is
  'Org-wide app flags/settings (public feature toggles, display options). Only NON-SECRET values belong here: every row is readable by anonymous visitors.';

drop trigger if exists trg_app_settings_updated on app_settings;
create trigger trg_app_settings_updated before update on app_settings
  for each row execute function set_updated_at();

alter table app_settings enable row level security;

-- Public (incl. anonymous visitors) read every setting — the app needs the
-- flags before anyone signs in.
drop policy if exists app_settings_public_select on app_settings;
create policy app_settings_public_select on app_settings for select
  using (true);

-- Writes gated on settings.manage (owners/admins implicitly).
drop policy if exists app_settings_insert on app_settings;
create policy app_settings_insert on app_settings for insert
  with check (has_permission(org_id, 'settings.manage'));
drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings for update
  using (has_permission(org_id, 'settings.manage'))
  with check (has_permission(org_id, 'settings.manage'));
drop policy if exists app_settings_delete on app_settings;
create policy app_settings_delete on app_settings for delete
  using (has_permission(org_id, 'settings.manage'));

grant select on app_settings to anon, authenticated;
grant insert, update, delete on app_settings to authenticated;

-- -------------------------------------------------------------
-- auction_settings: raffle-ticket pricing + details (staff-entered; nullable)
-- -------------------------------------------------------------
alter table auction_settings
  add column if not exists raffle_ticket_price_cents int
    check (raffle_ticket_price_cents is null or raffle_ticket_price_cents >= 0);
alter table auction_settings
  add column if not exists raffle_bundle_qty int
    check (raffle_bundle_qty is null or raffle_bundle_qty >= 2);
alter table auction_settings
  add column if not exists raffle_bundle_price_cents int
    check (raffle_bundle_price_cents is null or raffle_bundle_price_cents >= 0);
alter table auction_settings
  add column if not exists raffle_details text;

comment on column auction_settings.raffle_ticket_price_cents is 'Price of ONE raffle ticket, in cents. Null = not announced (the app shows no price).';
comment on column auction_settings.raffle_bundle_qty is 'Optional bundle size (e.g. 6) priced at raffle_bundle_price_cents.';
comment on column auction_settings.raffle_bundle_price_cents is 'Price of one bundle of raffle_bundle_qty tickets, in cents.';
comment on column auction_settings.raffle_details is 'Free text shown in the Raffle section of the BunFest raffle page (where tickets are sold, drawing time, ...).';
