-- =============================================================
-- OHRR — update 27: fuller vendor records (staff only) and the case / box
-- sizes things are ordered in
--
-- OHRR (2026-09-24): "the vendors need additional details. things like photo,
-- address, [donations] they might have done and so forth … they dont need to
-- [be] on the site but we need it in the staff backend." And for the Hop Shop:
-- "on the ordering process we need the case count or boxes it can come in.
-- more details will be needed."
--
-- Vendors and suppliers are one list (`suppliers`: is_supplier / is_vendor),
-- readable only by OHRR's own members; the public vendor list shows just the
-- name, category, blurb and website. Nothing here reaches the public site.
--
-- Part 1 More on each company: a photo, social links, an online shop, a
--        mailing address, the paperwork (agreement signed, insurance, vendor's
--        licence), booth needs (power, set-up notes) and "invite again?".
-- Part 2 Each BunFest year with a company: tables, booth, the table fee and
--        when it was paid.
-- Part 3 What a company has given: auction items, raffle prizes, goods for the
--        rabbits, money, sponsorship, services — with a value if they gave one
--        and when OHRR thanked them. Silent-auction items can name the company
--        that donated them.
-- Part 4 Photos for company cards (a bucket only staff can add to).
-- Part 5 Pack sizes for Hop Shop products: each product can come as a single,
--        a box, a case of 12 … with the supplier's item number and cost for
--        that pack, and a minimum. The reorder list suggests whole packs.
--
-- Safe to run more than once. Paste + Run after update 26.
-- =============================================================

-- Who may see and edit the extra company details: the people who run the shop or BunFest.
create or replace function supplier_staff(p_org uuid) returns boolean
language sql stable as $$
  select has_permission(p_org, 'hopshop.products.edit') or has_permission(p_org, 'events.bunfest.manage');
$$;

-- -------------------------------------------------------------
-- Part 1: more on each company
-- -------------------------------------------------------------
alter table public.suppliers add column if not exists photo_url           text;
alter table public.suppliers add column if not exists instagram           text;
alter table public.suppliers add column if not exists facebook            text;
alter table public.suppliers add column if not exists shop_url            text;   -- Etsy / their online shop
alter table public.suppliers add column if not exists mailing_address     text;   -- when it differs from the address
alter table public.suppliers add column if not exists license_number      text;   -- vendor's licence, if they have one
alter table public.suppliers add column if not exists agreement_signed_on date;   -- vendor agreement
alter table public.suppliers add column if not exists insurance_expires   date;
alter table public.suppliers add column if not exists needs_power         boolean not null default false;
alter table public.suppliers add column if not exists booth_notes         text;   -- "brings a tent", "needs a wall"
alter table public.suppliers add column if not exists invite_again        text
  check (invite_again is null or invite_again in ('yes', 'maybe', 'no'));

-- BunFest vendors are also looked after by the BunFest team, not only the shop.
drop policy if exists suppliers_staff_update on public.suppliers;
create policy suppliers_staff_update on public.suppliers for update
  using (supplier_staff(org_id)) with check (supplier_staff(org_id));
drop policy if exists suppliers_staff_insert on public.suppliers;
create policy suppliers_staff_insert on public.suppliers for insert
  with check (supplier_staff(org_id) or has_permission(org_id, 'hopshop.products.create'));

-- -------------------------------------------------------------
-- Part 2: each BunFest year with a company
-- -------------------------------------------------------------
create table if not exists public.vendor_years_detail (
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  year        int  not null check (year between 2009 and 2100),
  tables      int  check (tables is null or tables between 0 and 20),
  booth       text,
  fee_cents   int  check (fee_cents is null or fee_cents >= 0),
  paid_on     date,
  paid_how    text,                 -- "cash", "check 1042", "PayPal"
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (supplier_id, year)
);
alter table public.vendor_years_detail enable row level security;
drop policy if exists vendor_years_detail_staff on public.vendor_years_detail;
create policy vendor_years_detail_staff on public.vendor_years_detail for all
  using (supplier_staff(org_id)) with check (supplier_staff(org_id));
revoke all on public.vendor_years_detail from anon;
grant select, insert, update, delete on public.vendor_years_detail to authenticated;

-- -------------------------------------------------------------
-- Part 3: what a company has given
-- -------------------------------------------------------------
create table if not exists public.supplier_donations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  given_on        date not null default ((now() at time zone 'America/New_York')::date),
  kind            text not null
                    check (kind in ('auction', 'raffle', 'goods', 'money', 'sponsorship', 'services', 'other')),
  description     text not null,
  value_cents     int  check (value_cents is null or value_cents >= 0),   -- the value they gave, if any
  event_year      int  check (event_year is null or event_year between 2009 and 2100),
  acknowledged_on date,                                                    -- thank-you sent
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_supplier_donations on public.supplier_donations(supplier_id, given_on desc);
alter table public.supplier_donations enable row level security;
drop policy if exists supplier_donations_staff on public.supplier_donations;
create policy supplier_donations_staff on public.supplier_donations for all
  using (supplier_staff(org_id)) with check (supplier_staff(org_id));
revoke all on public.supplier_donations from anon;
grant select, insert, update, delete on public.supplier_donations to authenticated;

-- A silent-auction item can name the company that gave it.
alter table public.raffle_items add column if not exists donor_supplier_id uuid
  references public.suppliers(id) on delete set null;

-- -------------------------------------------------------------
-- Part 4: photos for company cards
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-photos', 'vendor-photos', true)
on conflict (id) do nothing;

drop policy if exists "vendor photos read" on storage.objects;
create policy "vendor photos read" on storage.objects for select
  using (bucket_id = 'vendor-photos');
drop policy if exists "vendor photos staff insert" on storage.objects;
create policy "vendor photos staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-photos'
    and exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.status = 'active'
                   and m.org_id::text = (storage.foldername(name))[1]
                   and public.supplier_staff(m.org_id)));
drop policy if exists "vendor photos staff delete" on storage.objects;
create policy "vendor photos staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-photos'
    and exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.status = 'active'
                   and m.org_id::text = (storage.foldername(name))[1]
                   and public.supplier_staff(m.org_id)));

-- -------------------------------------------------------------
-- Part 5: the packs a product comes in
-- -------------------------------------------------------------
create table if not exists public.product_packs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  product_id    uuid not null references public.hopshop_products(id) on delete cascade,
  label         text not null,                  -- "Single", "Box", "Case"
  units         int  not null check (units between 1 and 10000),   -- how many sellable items in it
  cost_cents    int  check (cost_cents is null or cost_cents >= 0), -- what OHRR pays for one pack
  supplier_sku  text,                           -- the supplier's number for this pack
  min_packs     int  not null default 1 check (min_packs between 1 and 1000),
  is_default    boolean not null default false, -- the pack the reorder list suggests
  notes         text,                           -- "10 lb bags", "ships on a pallet"
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_product_packs on public.product_packs(product_id, sort_order);
drop trigger if exists trg_product_packs_updated on public.product_packs;
create trigger trg_product_packs_updated before update on public.product_packs
  for each row execute function set_updated_at();
alter table public.product_packs enable row level security;
drop policy if exists product_packs_member_select on public.product_packs;
create policy product_packs_member_select on public.product_packs for select using (is_org_member(org_id));
drop policy if exists product_packs_staff_write on public.product_packs;
create policy product_packs_staff_write on public.product_packs for all
  using (has_permission(org_id, 'hopshop.products.edit'))
  with check (has_permission(org_id, 'hopshop.products.edit'));
revoke all on public.product_packs from anon;
grant select, insert, update, delete on public.product_packs to authenticated;

alter table public.hopshop_products add column if not exists order_url       text;   -- the supplier's page for it
alter table public.hopshop_products add column if not exists ordered_pack_id uuid references public.product_packs(id) on delete set null;
alter table public.hopshop_products add column if not exists ordered_packs   int check (ordered_packs is null or ordered_packs >= 0);

-- The manager screens' shape, now with the packs and what was ordered.
create or replace function product_admin_json(p hopshop_products)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'price_cents', p.price_cents,
    'sku', p.sku, 'is_active', p.is_active, 'photo_url', p.photo_url,
    'supplier_id', p.supplier_id,
    'supplier_name', (select s.name from suppliers s where s.id = p.supplier_id),
    'supplier_sku', p.supplier_sku, 'cost_cents', p.cost_cents, 'unit', p.unit,
    'category', p.category, 'shelf', p.shelf,
    'reorder_point', p.reorder_point, 'reorder_qty', p.reorder_qty,
    'on_order_qty', p.on_order_qty, 'ordered_at', p.ordered_at,
    'quantity', (select i.quantity from hopshop_inventory i where i.product_id = p.id),
    'code', (select t.code from item_tags t where t.product_id = p.id and t.kind = 'stock' limit 1),
    'updated_at', p.updated_at,
    'order_url', p.order_url,
    'ordered_pack_id', p.ordered_pack_id,
    'ordered_packs', p.ordered_packs,
    'packs', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', k.id, 'label', k.label, 'units', k.units, 'cost_cents', k.cost_cents,
                 'supplier_sku', k.supplier_sku, 'min_packs', k.min_packs, 'is_default', k.is_default,
                 'notes', k.notes) order by k.is_default desc, k.sort_order, k.units)
               from product_packs k where k.product_id = p.id), '[]'::jsonb)
  );
$$;

-- Order in packs: "2 cases of 12" puts 24 on order and remembers the packs.
create or replace function hopshop_order_packs(p_product_id uuid, p_pack_id uuid, p_packs int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p hopshop_products;
  k product_packs;
begin
  select * into p from hopshop_products where id = p_product_id;
  if not found then raise exception 'No such product'; end if;
  if not (has_permission(p.org_id, 'hopshop.inventory.update') or has_permission(p.org_id, 'hopshop.products.edit')) then
    raise exception 'Not allowed';
  end if;
  select * into k from product_packs where id = p_pack_id and product_id = p.id;
  if not found then raise exception 'Pick one of this product’s pack sizes.'; end if;
  if p_packs is null or p_packs < k.min_packs then
    raise exception 'The supplier’s minimum is % %.', k.min_packs, lower(k.label);
  end if;
  update hopshop_products
     set on_order_qty = p_packs * k.units, ordered_pack_id = k.id, ordered_packs = p_packs, ordered_at = now()
   where id = p.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p.org_id, auth.uid(), 'hopshop.order_ordered', 'hopshop_product', p.id::text,
          jsonb_build_object('name', p.name, 'packs', p_packs, 'pack', k.label, 'units', p_packs * k.units));
  select * into p from hopshop_products where id = p.id;
  return product_admin_json(p);
end $$;
grant execute on function hopshop_order_packs(uuid, uuid, int) to authenticated;

-- Receiving or clearing an order also forgets which packs it was.
create or replace function clear_ordered_packs() returns trigger
language plpgsql as $$
begin
  if new.on_order_qty = 0 then
    new.ordered_pack_id := null;
    new.ordered_packs := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_clear_ordered_packs on public.hopshop_products;
create trigger trg_clear_ordered_packs before update of on_order_qty on public.hopshop_products
  for each row execute function clear_ordered_packs();
