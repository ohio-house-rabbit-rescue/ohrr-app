-- =============================================================
-- OHRR App — Backend & Access Control: Hop Shop slice
-- Target: Supabase (PostgreSQL 15+). Apply as a migration or paste
-- into the Supabase SQL editor.
--
-- Source of truth: "OHRR App Design/06-hopshop-backend.sql" (Drive).
-- This file version-controls the schema that is ALREADY APPLIED to the
-- live Supabase project, so the repo matches the database. It is written
-- to be idempotent (create ... if not exists / on conflict do nothing),
-- so re-applying is safe.
--
-- What this delivers (matches 05-backend-and-access-control.md):
--   * organizations, memberships (owner/admin/staff roles)
--   * capability permissions catalog + per-worker grants + presets
--   * invite codes: master (bootstrap owners) and worker invites
--   * audit log of every grant/revoke and privileged action
--   * Hop Shop products + inventory as the first CAPABILITY-GATED
--     feature, enforced by Row-Level Security (not just the UI)
--
-- Security model:
--   * Owners & admins implicitly have every capability.
--   * Staff have ONLY the capabilities granted to them.
--   * All membership/permission/invite writes go through
--     SECURITY DEFINER functions; direct client writes are blocked.
--   * service_role (server side) bypasses RLS for admin tooling.
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin create type membership_role as enum ('owner','admin','staff');
exception when duplicate_object then null; end $$;
do $$ begin create type membership_status as enum ('active','disabled');
exception when duplicate_object then null; end $$;
do $$ begin create type invite_kind as enum ('master','worker');
exception when duplicate_object then null; end $$;

-- ---------- Core tables ----------
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       membership_role   not null default 'staff',
  status     membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_memberships_user on memberships(user_id);
create index if not exists idx_memberships_org  on memberships(org_id);

create table if not exists permissions (
  key         text primary key,
  area        text not null,
  description text not null
);

create table if not exists membership_permissions (
  membership_id  uuid not null references memberships(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  granted_by     uuid references auth.users(id),
  granted_at     timestamptz not null default now(),
  primary key (membership_id, permission_key)
);

create table if not exists permission_presets (
  preset         text not null,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (preset, permission_key)
);

create table if not exists invite_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  org_id       uuid not null references organizations(id) on delete cascade,
  kind         invite_kind     not null default 'worker',
  role         membership_role not null default 'staff',
  capabilities text[]          not null default '{}',
  preset       text,
  max_uses     int  not null default 1,
  used_count   int  not null default 0,
  expires_at   timestamptz,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id),
  action        text not null,
  target_type   text,
  target_id     text,
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_org on audit_log(org_id, created_at desc);

-- ---------- Hop Shop (first gated feature) ----------
create table if not exists hopshop_products (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  description text,
  price_cents int  not null default 0 check (price_cents >= 0),
  sku         text,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_products_org on hopshop_products(org_id);

-- Inventory is a SEPARATE table so "update stock" can be a distinct
-- capability from "edit product details" (a worker can have one, not the other).
create table if not exists hopshop_inventory (
  product_id uuid primary key references hopshop_products(id) on delete cascade,
  org_id     uuid not null references organizations(id) on delete cascade,
  quantity   int  not null default 0 check (quantity >= 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_products_updated on hopshop_products;
create trigger trg_products_updated before update on hopshop_products
  for each row execute function set_updated_at();
drop trigger if exists trg_inventory_updated on hopshop_inventory;
create trigger trg_inventory_updated before update on hopshop_inventory
  for each row execute function set_updated_at();

-- =============================================================
-- Helper functions (SECURITY DEFINER => bypass RLS, avoid recursion)
-- =============================================================
create or replace function is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Owners & admins implicitly hold every capability; staff need explicit grants.
create or replace function has_permission(p_org uuid, p_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships
   where org_id = p_org and user_id = auth.uid() and status = 'active';
  if not found then return false; end if;
  if m.role in ('owner','admin') then return true; end if;
  return exists (
    select 1 from membership_permissions mp
     where mp.membership_id = m.id and mp.permission_key = p_key
  );
end $$;

-- =============================================================
-- Privileged operations (called from client via RPC, or Edge Functions)
-- =============================================================

-- First owner(s) redeem the one-time master code to bootstrap the org.
create or replace function redeem_master_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c invite_codes; mid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into c from invite_codes where code = p_code and kind = 'master' for update;
  if not found then raise exception 'Invalid master code'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Code expired'; end if;
  if c.used_count >= c.max_uses then raise exception 'Code already used'; end if;

  insert into memberships(org_id, user_id, role, status)
  values (c.org_id, auth.uid(), 'owner', 'active')
  on conflict (org_id, user_id) do update set role='owner', status='active'
  returning id into mid;

  update invite_codes set used_count = used_count + 1 where id = c.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (c.org_id, auth.uid(), 'redeem_master_code', 'membership', mid::text,
          jsonb_build_object('code_id', c.id));
  return mid;
end $$;

-- An owner/admin generates a worker invite (preset and/or explicit capabilities).
create or replace function create_invite_code(
  p_org uuid, p_role membership_role, p_capabilities text[], p_preset text,
  p_max_uses int default 1, p_expires_at timestamptz default now() + interval '14 days'
) returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if not has_permission(p_org, 'staff.invite') then raise exception 'Not allowed'; end if;
  new_code := upper(encode(gen_random_bytes(5), 'hex'));      -- 10-char code
  insert into invite_codes(code, org_id, kind, role, capabilities, preset, max_uses, expires_at, created_by)
  values (new_code, p_org, 'worker', coalesce(p_role,'staff'),
          coalesce(p_capabilities,'{}'), p_preset, coalesce(p_max_uses,1), p_expires_at, auth.uid());
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'create_invite_code', 'invite', new_code,
          jsonb_build_object('role',p_role,'preset',p_preset,'capabilities',p_capabilities));
  return new_code;
end $$;

-- A worker redeems the invite; capabilities = explicit list + expanded preset.
create or replace function redeem_invite_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c invite_codes; mid uuid; caps text[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into c from invite_codes where code = p_code and kind = 'worker' for update;
  if not found then raise exception 'Invalid code'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Code expired'; end if;
  if c.used_count >= c.max_uses then raise exception 'Code fully used'; end if;

  insert into memberships(org_id, user_id, role, status)
  values (c.org_id, auth.uid(), c.role, 'active')
  on conflict (org_id, user_id) do update set status='active'
  returning id into mid;

  caps := coalesce(c.capabilities, '{}');
  if c.preset is not null then
    caps := caps || array(select permission_key from permission_presets where preset = c.preset);
  end if;

  insert into membership_permissions(membership_id, permission_key, granted_by)
  select mid, k, c.created_by from unnest(caps) as k
  where k in (select key from permissions)
  on conflict do nothing;

  update invite_codes set used_count = used_count + 1 where id = c.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (c.org_id, auth.uid(), 'redeem_invite_code', 'membership', mid::text,
          jsonb_build_object('code', p_code));
  return mid;
end $$;

-- Grant (p_grant=true) or revoke (false) a single capability on a worker.
create or replace function set_membership_permission(p_membership uuid, p_key text, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from memberships where id = p_membership;
  if v_org is null then raise exception 'Membership not found'; end if;
  if not has_permission(v_org, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;

  if p_grant then
    insert into membership_permissions(membership_id, permission_key, granted_by)
    values (p_membership, p_key, auth.uid()) on conflict do nothing;
  else
    delete from membership_permissions where membership_id = p_membership and permission_key = p_key;
  end if;

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (v_org, auth.uid(), case when p_grant then 'grant_permission' else 'revoke_permission' end,
          'membership', p_membership::text, jsonb_build_object('key', p_key));
end $$;

-- Activate / disable a worker (immediate, reversible; preserves audit trail).
create or replace function set_membership_status(p_membership uuid, p_status membership_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from memberships where id = p_membership;
  if v_org is null then raise exception 'Membership not found'; end if;
  if not has_permission(v_org, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;
  update memberships set status = p_status where id = p_membership;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (v_org, auth.uid(), 'set_membership_status', 'membership', p_membership::text,
          jsonb_build_object('status', p_status));
end $$;

-- =============================================================
-- Row-Level Security
-- =============================================================
alter table organizations        enable row level security;
alter table memberships           enable row level security;
alter table permissions           enable row level security;
alter table membership_permissions enable row level security;
alter table permission_presets    enable row level security;
alter table invite_codes          enable row level security;
alter table audit_log             enable row level security;
alter table hopshop_products      enable row level security;
alter table hopshop_inventory     enable row level security;

-- Orgs: members can see their own org. (Creation is bootstrap/service_role only.)
drop policy if exists org_select on organizations;
create policy org_select on organizations for select using (is_org_member(id));

-- Memberships: visible to fellow org members. Writes go through functions only.
drop policy if exists mem_select on memberships;
create policy mem_select on memberships for select using (is_org_member(org_id));

-- Capability catalog & presets: readable by any signed-in user (for the admin UI).
drop policy if exists perm_select on permissions;
create policy perm_select on permissions for select using (auth.uid() is not null);
drop policy if exists preset_select on permission_presets;
create policy preset_select on permission_presets for select using (auth.uid() is not null);

-- A worker's granted capabilities: visible to members of that org. Writes via functions.
drop policy if exists memperm_select on membership_permissions;
create policy memperm_select on membership_permissions for select using (
  exists (select 1 from memberships m where m.id = membership_id and is_org_member(m.org_id))
);

-- Invite codes: only those who can invite may list them. Writes via functions.
drop policy if exists invite_select on invite_codes;
create policy invite_select on invite_codes for select using (has_permission(org_id, 'staff.invite'));

-- Audit log: owners/admins (or anyone explicitly granted audit.view).
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select using (has_permission(org_id, 'audit.view'));

-- Hop Shop products: any active member can view; writes gated per capability.
drop policy if exists products_select on hopshop_products;
create policy products_select on hopshop_products for select using (is_org_member(org_id));
drop policy if exists products_insert on hopshop_products;
create policy products_insert on hopshop_products for insert
  with check (has_permission(org_id, 'hopshop.products.create'));
drop policy if exists products_update on hopshop_products;
create policy products_update on hopshop_products for update
  using (has_permission(org_id, 'hopshop.products.edit'))
  with check (has_permission(org_id, 'hopshop.products.edit'));
drop policy if exists products_delete on hopshop_products;
create policy products_delete on hopshop_products for delete
  using (has_permission(org_id, 'hopshop.products.delete'));

-- Hop Shop inventory: view as member; create/update gated on inventory.update.
drop policy if exists inv_select on hopshop_inventory;
create policy inv_select on hopshop_inventory for select using (is_org_member(org_id));
drop policy if exists inv_insert on hopshop_inventory;
create policy inv_insert on hopshop_inventory for insert
  with check (has_permission(org_id, 'hopshop.inventory.update'));
drop policy if exists inv_update on hopshop_inventory;
create policy inv_update on hopshop_inventory for update
  using (has_permission(org_id, 'hopshop.inventory.update'))
  with check (has_permission(org_id, 'hopshop.inventory.update'));

-- =============================================================
-- Function execution grants (Supabase: callable by signed-in users)
-- =============================================================
grant execute on function is_org_member(uuid)                         to authenticated;
grant execute on function has_permission(uuid, text)                  to authenticated;
grant execute on function redeem_master_code(text)                    to authenticated;
grant execute on function create_invite_code(uuid, membership_role, text[], text, int, timestamptz) to authenticated;
grant execute on function redeem_invite_code(text)                    to authenticated;
grant execute on function set_membership_permission(uuid, text, boolean) to authenticated;
grant execute on function set_membership_status(uuid, membership_status) to authenticated;

-- =============================================================
-- Seed: capability catalog + presets
-- =============================================================
insert into permissions(key, area, description) values
 ('hopshop.products.create','Hop Shop','Add new products'),
 ('hopshop.products.edit','Hop Shop','Edit product details'),
 ('hopshop.products.delete','Hop Shop','Delete products'),
 ('hopshop.inventory.update','Hop Shop','Update stock quantities'),
 ('hopshop.orders.view','Hop Shop','View orders'),
 ('adoptions.listings.create','Adoptions','Create adoptable rabbit listings'),
 ('adoptions.listings.edit','Adoptions','Edit adoptable rabbit listings'),
 ('adoptions.status.change','Adoptions','Change a rabbit''s adoption status'),
 ('volunteers.shifts.manage','Volunteers','Create/manage volunteer shifts'),
 ('volunteers.signups.approve','Volunteers','Approve volunteer sign-ups'),
 ('content.education.edit','Content','Edit education / care content'),
 ('events.bunfest.manage','Events','Manage Midwest BunFest info'),
 ('announcements.post','Content','Post announcements'),
 ('staff.invite','Staff','Invite workers'),
 ('staff.permissions.manage','Staff','Grant/revoke worker permissions & status'),
 ('audit.view','Staff','View the activity log')
on conflict (key) do nothing;

insert into permission_presets(preset, permission_key) values
 ('Hop Shop Manager','hopshop.products.create'),
 ('Hop Shop Manager','hopshop.products.edit'),
 ('Hop Shop Manager','hopshop.products.delete'),
 ('Hop Shop Manager','hopshop.inventory.update'),
 ('Hop Shop Manager','hopshop.orders.view'),
 ('Adoptions Coordinator','adoptions.listings.create'),
 ('Adoptions Coordinator','adoptions.listings.edit'),
 ('Adoptions Coordinator','adoptions.status.change'),
 ('Volunteer Lead','volunteers.shifts.manage'),
 ('Volunteer Lead','volunteers.signups.approve'),
 ('Content Editor','content.education.edit'),
 ('Content Editor','announcements.post'),
 ('Content Editor','events.bunfest.manage')
on conflict do nothing;

-- =============================================================
-- BOOTSTRAP (run ONCE by a developer in the SQL editor / service role).
-- Solves the chicken-and-egg: the first master code is seeded by hand.
-- NOTE: For the live OHRR project this has ALREADY been done — the org row
-- and a one-time master code exist. Do not re-run for OHRR.
-- =============================================================
-- 1) Create the organization:
--    insert into organizations(name) values ('Ohio House Rabbit Rescue')
--    returning id;   -- copy the returned <ORG_ID>
--
-- 2) Seed a one-time master code for that org (use a strong random value):
--    insert into invite_codes(code, org_id, kind, role, max_uses, expires_at)
--    values ('CHANGE-ME-STRONG-CODE', '<ORG_ID>', 'master', 'owner', 1,
--            now() + interval '7 days');
--
-- 3) The first owner signs in (Supabase Auth), then calls:
--    select redeem_master_code('CHANGE-ME-STRONG-CODE');
--    -> they are now an Owner and can invite workers via create_invite_code(...).
--
-- Example: invite a Hop Shop-only worker (owner/admin runs this):
--    select create_invite_code('<ORG_ID>', 'staff', '{}', 'Hop Shop Manager', 1, now() + interval '14 days');
--    -> share the returned code; the worker calls redeem_invite_code('<code>').
-- =============================================================
