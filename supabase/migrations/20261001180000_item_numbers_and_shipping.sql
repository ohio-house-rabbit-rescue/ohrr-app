-- =============================================================
-- Update 41 (2026-10-01): item numbers with a system behind them,
-- Hop Shop labels, product types, vendor numbers, supplier shipping.
--
--   Donations (and the auction or raffle items they become):
--       DON-00001 … a running number the database hands out.
--   Hop Shop products:  TYPE-VENDOR-ITEM, e.g. HAY-101-001
--       HAY = the product type · 101 = the vendor's number ·
--       001 = that vendor's first item of that type.
--       Vendor 000 = no supplier (donated, or OHRR's own).
--   A packet barcode stays as a product's second code: scanning either works.
--   A SKU follows the product's type and supplier until its label is
--   printed; after that it stays put (Make a new SKU changes it on purpose).
--
--   code_counters        the running numbers (DON, each TYPE-VENDOR, vendors)
--   product_types        HAY Hay, PEL Pellets, TRT Treats … (staff add more)
--   suppliers            + vendor_no (101, 102 … never changes)
--                        + ship_how, ship_cents, free_ship_over_cents
--   hopshop_products     + type_id, barcode
--   item_tags            + is_alias (a packet barcode, or the DON number a
--                          shop item came in with — never listed twice)
--
-- Existing items are renumbered (OHRR, 2026-10-01: no labels or codes are
-- in use yet) and the old random OHRR-XXXXX codes are retired.
--
-- Apply AFTER 20261001160000_donation_intake.sql. Paste + Run in the
-- Supabase SQL editor, part by part, in order. Safe to run twice.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Running numbers, product types, vendor numbers, new columns
-- -------------------------------------------------------------
create or replace function code_pad(p_n bigint, p_width int) returns text
language sql immutable as $$
  select case when p_n is null then null
              when length(p_n::text) >= p_width then p_n::text
              else lpad(p_n::text, p_width, '0') end;
$$;

create table if not exists code_counters (
  org_id  uuid not null references organizations(id) on delete cascade,
  scope   text not null,
  last_no bigint not null default 0,
  primary key (org_id, scope)
);
alter table code_counters enable row level security;   -- no policies: only the functions below use it

create or replace function next_code_no(p_org uuid, p_scope text) returns bigint
language sql volatile security definer set search_path = public as $$
  insert into code_counters as c (org_id, scope, last_no) values (p_org, p_scope, 1)
  on conflict (org_id, scope) do update set last_no = c.last_no + 1
  returning last_no;
$$;
revoke all on function next_code_no(uuid, text) from public, anon, authenticated;

create table if not exists product_types (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  code        text not null check (code ~ '^[A-Z]{3}$' and code not in ('DON', 'OHR')),
  name        text not null check (btrim(name) <> ''),
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);
create unique index if not exists idx_product_types_name on product_types(org_id, lower(name));
drop trigger if exists trg_product_types_updated on product_types;
create trigger trg_product_types_updated before update on product_types
  for each row execute function set_updated_at();
alter table product_types enable row level security;
drop policy if exists product_types_member_select on product_types;
create policy product_types_member_select on product_types for select using (is_org_member(org_id));
grant select on product_types to authenticated;

-- The starting list. Staff add more under Hop Shop inventory → Types.
create or replace function ensure_product_types(p_org uuid) returns void
language sql volatile security definer set search_path = public as $$
  insert into product_types (org_id, code, name, sort_order)
  select p_org, v.code, v.name, v.sort_order
    from (values ('HAY', 'Hay', 10), ('PEL', 'Pellets', 20), ('TRT', 'Treats', 30), ('TOY', 'Toys', 40),
                 ('LIT', 'Litter', 50), ('HSE', 'Housing', 60), ('GRM', 'Grooming', 70),
                 ('GFT', 'Gifts & merch', 80), ('OTH', 'Other', 900)) as v(code, name, sort_order)
   where not exists (select 1 from product_types x
                      where x.org_id = p_org and (x.code = v.code or lower(x.name) = lower(v.name)));
$$;
revoke all on function ensure_product_types(uuid) from public, anon, authenticated;

alter table suppliers add column if not exists vendor_no int check (vendor_no is null or vendor_no between 1 and 999);
create unique index if not exists idx_suppliers_vendor_no on suppliers(org_id, vendor_no) where vendor_no is not null;
alter table suppliers add column if not exists ship_how text check (ship_how is null or ship_how in ('free', 'flat', 'varies', 'pickup'));
alter table suppliers add column if not exists ship_cents int check (ship_cents is null or ship_cents >= 0);
alter table suppliers add column if not exists free_ship_over_cents int check (free_ship_over_cents is null or free_ship_over_cents >= 0);

alter table hopshop_products add column if not exists type_id uuid references product_types(id) on delete set null;
alter table hopshop_products add column if not exists barcode text;
alter table item_tags add column if not exists is_alias boolean not null default false;
create index if not exists idx_item_tags_product on item_tags(product_id) where product_id is not null;

-- Vendor numbers: 101, 102 … in the order companies are added. Never
-- changed once given, because every SKU carries it.
create or replace function next_vendor_no(p_org uuid) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
  i int;
begin
  for i in 1..900 loop
    n := 100 + next_code_no(p_org, 'VENDOR')::int;
    if n > 999 then raise exception 'Vendor numbers have run out (999)'; end if;
    if not exists (select 1 from suppliers where org_id = p_org and vendor_no = n) then return n; end if;
  end loop;
  raise exception 'Could not give a vendor number';
end $$;
revoke all on function next_vendor_no(uuid) from public, anon, authenticated;

create or replace function suppliers_keep_vendor_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.vendor_no is not null then
    new.vendor_no := old.vendor_no;
  elsif new.vendor_no is null then
    new.vendor_no := next_vendor_no(new.org_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_suppliers_vendor_no on suppliers;
create trigger trg_suppliers_vendor_no before insert or update on suppliers
  for each row execute function suppliers_keep_vendor_no();

-- -------------------------------------------------------------
-- 2. Reading codes, and making DON numbers and SKUs
-- -------------------------------------------------------------
-- Any way a code arrives (typed, scanned, from a label's QR link) → one spelling:
-- "don 42" → DON-00042 · "hay-101-1" → HAY-101-001 · packet barcodes stay digits.
create or replace function normalize_item_code(p_raw text)
returns text language plpgsql immutable as $$
declare
  s text := coalesce(p_raw, '');
  m text[];
begin
  -- a label's QR link: keep whatever follows the last "/t/"
  if position('/t/' in s) > 0 then
    s := coalesce(substring(s from '/t/([^/?#]+)'), '');
  end if;
  m := regexp_match(s, '^\s*[Dd][Oo][Nn][\s_-]*([0-9]{1,9})\s*$');
  if m is not null then return 'DON-' || code_pad(m[1]::bigint, 5); end if;
  m := regexp_match(s, '^\s*([A-Za-z]{3})[\s_-]+([0-9]{1,3})[\s_-]+([0-9]{1,6})\s*$');
  if m is not null then
    return upper(m[1]) || '-' || code_pad(m[2]::bigint, 3) || '-' || code_pad(m[3]::bigint, 3);
  end if;
  s := upper(regexp_replace(s, '[^A-Za-z0-9]', '', 'g'));
  if s = '' then return null; end if;
  if s ~ '^[A-Z]{3}[0-9]{6,9}$' then
    return substring(s from 1 for 3) || '-' || substring(s from 4 for 3) || '-' || substring(s from 7);
  end if;
  return s;   -- a maker's barcode (digits), or anything else as typed
end $$;

-- The next donation number: DON-00001, DON-00002 …
create or replace function new_item_code(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text;
  i int;
begin
  for i in 1..1000 loop
    v := 'DON-' || code_pad(next_code_no(p_org, 'DON'), 5);
    if not exists (select 1 from item_tags where org_id = p_org and code = v) then return v; end if;
  end loop;
  raise exception 'Could not make a new number — try again';
end $$;
revoke all on function new_item_code(uuid) from public, anon, authenticated;

-- A new SKU for a type and a supplier: HAY-101-001, HAY-101-002 …
create or replace function make_product_sku(p_org uuid, p_type_id uuid, p_supplier_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_type   text;
  v_vendor text;
  v        text;
  i        int;
begin
  select code into v_type from product_types where id = p_type_id and org_id = p_org;
  v_type := coalesce(v_type, 'OTH');
  select code_pad(vendor_no, 3) into v_vendor from suppliers where id = p_supplier_id and org_id = p_org;
  v_vendor := coalesce(v_vendor, '000');
  for i in 1..1000 loop
    v := v_type || '-' || v_vendor || '-' || code_pad(next_code_no(p_org, 'SKU:' || v_type || '-' || v_vendor), 3);
    if not exists (select 1 from item_tags where org_id = p_org and code = v) then return v; end if;
  end loop;
  raise exception 'Could not make a new SKU — try again';
end $$;
revoke all on function make_product_sku(uuid, uuid, uuid) from public, anon, authenticated;

-- Give a product its SKU, or bring it up to date: a SKU follows the type and
-- the supplier until its label is printed; p_force makes a new one anyway.
-- Returns the SKU.
create or replace function refresh_product_sku(p_product uuid, p_force boolean default false)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  p        hopshop_products;
  t        item_tags;
  v_prefix text;
  v_new    text;
begin
  select * into p from hopshop_products where id = p_product;
  if not found then return null; end if;
  v_prefix := coalesce((select code from product_types where id = p.type_id), 'OTH') || '-' ||
              coalesce((select code_pad(vendor_no, 3) from suppliers where id = p.supplier_id), '000') || '-';
  select * into t from item_tags
   where org_id = p.org_id and product_id = p.id and kind = 'stock' and not is_alias and code = p.sku;
  if t.id is not null and p.sku ~ '^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$' and not p_force then
    if left(p.sku, 8) = v_prefix or t.label_printed_at is not null then return p.sku; end if;
  end if;
  v_new := make_product_sku(p.org_id, p.type_id, p.supplier_id);
  -- The old SKU stops scanning (its label was never printed, or p_force).
  delete from item_tags where org_id = p.org_id and product_id = p.id and kind = 'stock' and not is_alias;
  insert into item_tags (org_id, code, kind, product_id, created_by)
  values (p.org_id, v_new, 'stock', p.id, auth.uid());
  update hopshop_products set sku = v_new where id = p.id;
  return v_new;
end $$;
revoke all on function refresh_product_sku(uuid, boolean) from public, anon, authenticated;

-- -------------------------------------------------------------
-- 3. Product types, and saving a product with its SKU and barcode
-- -------------------------------------------------------------
create or replace function product_type_json(t product_types) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'code', t.code, 'name', t.name, 'sort_order', t.sort_order,
    'is_active', t.is_active, 'items', (select count(*) from hopshop_products p where p.type_id = t.id));
$$;

create or replace function list_product_types(p_org uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  perform ensure_product_types(p_org);
  return coalesce((select jsonb_agg(product_type_json(t) order by t.sort_order, lower(t.name))
                     from product_types t where t.org_id = p_org), '[]'::jsonb);
end $$;
grant execute on function list_product_types(uuid) to authenticated;

-- Add or change a type. Its three letters can change only while no item uses it.
create or replace function save_product_type(p_org uuid, p_id uuid, p_name text, p_code text,
                                             p_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z]', '', 'g'));
  t product_types;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (has_permission(p_org, 'hopshop.products.create') or has_permission(p_org, 'hopshop.products.edit')) then
    raise exception 'Not allowed';
  end if;
  if v_name is null then raise exception 'Give the type a name'; end if;
  if v_code !~ '^[A-Z]{3}$' then raise exception 'The code is three letters, like HAY'; end if;
  if v_code in ('DON', 'OHR') then raise exception '% is kept for donations. Pick other letters.', v_code; end if;
  if exists (select 1 from product_types x where x.org_id = p_org and x.code = v_code and x.id is distinct from p_id) then
    raise exception 'Another type already uses %', v_code;
  end if;
  if exists (select 1 from product_types x where x.org_id = p_org and lower(x.name) = lower(v_name) and x.id is distinct from p_id) then
    raise exception 'There is already a type called %', v_name;
  end if;
  if p_id is null then
    insert into product_types (org_id, code, name, is_active, sort_order)
    values (p_org, v_code, v_name, coalesce(p_is_active, true),
            coalesce((select max(sort_order) + 10 from product_types where org_id = p_org and sort_order < 900), 10))
    returning * into t;
  else
    select * into t from product_types where id = p_id and org_id = p_org for update;
    if not found then raise exception 'No such type'; end if;
    if t.code <> v_code and exists (select 1 from hopshop_products p where p.type_id = t.id) then
      raise exception 'Items already use %, so its letters stay. Add a new type instead.', t.code;
    end if;
    update product_types set code = v_code, name = v_name, is_active = coalesce(p_is_active, is_active)
     where id = t.id returning * into t;
    update hopshop_products set category = v_name where type_id = t.id and category is distinct from v_name;
  end if;
  return product_type_json(t);
end $$;
grant execute on function save_product_type(uuid, uuid, text, text, boolean) to authenticated;

create or replace function delete_product_type(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (has_permission(p_org, 'hopshop.products.edit') or has_permission(p_org, 'hopshop.products.delete')) then
    raise exception 'Not allowed';
  end if;
  if exists (select 1 from hopshop_products p where p.type_id = p_id) then
    raise exception 'Items use this type. Hide it instead, or give those items another type first.';
  end if;
  delete from product_types where id = p_id and org_id = p_org;
end $$;
grant execute on function delete_product_type(uuid, uuid) to authenticated;

-- The product card: as before, plus the SKU (code), type, barcode, vendor
-- number, whether its label is printed, and the DON number it came in with.
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
    'code', coalesce((select t.code from item_tags t where t.product_id = p.id and t.kind = 'stock' and not t.is_alias
                       order by t.created_at limit 1), p.sku),
    'updated_at', p.updated_at,
    'order_url', p.order_url,
    'ordered_pack_id', p.ordered_pack_id,
    'ordered_packs', p.ordered_packs,
    'packs', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', k.id, 'label', k.label, 'units', k.units, 'cost_cents', k.cost_cents,
                 'supplier_sku', k.supplier_sku, 'min_packs', k.min_packs, 'is_default', k.is_default,
                 'notes', k.notes) order by k.is_default desc, k.sort_order, k.units)
               from product_packs k where k.product_id = p.id), '[]'::jsonb),
    'type_id', p.type_id,
    'type_code', (select pt.code from product_types pt where pt.id = p.type_id),
    'type_name', (select pt.name from product_types pt where pt.id = p.type_id),
    'barcode', p.barcode,
    'vendor_no', (select s.vendor_no from suppliers s where s.id = p.supplier_id),
    'label_printed_at', (select t.label_printed_at from item_tags t
                          where t.product_id = p.id and t.kind = 'stock' and not t.is_alias
                          order by t.created_at limit 1),
    'donation_code', (select t.code from item_tags t where t.product_id = p.id and t.code like 'DON-%'
                       order by t.created_at limit 1)
  );
$$;

-- -------------------------------------------------------------
-- 3b. Saving a product: the SKU from the type and supplier, the barcode
-- -------------------------------------------------------------
-- Save a product. The database makes the SKU from the type and the supplier;
-- p_barcode is the maker's barcode on the packet (a second code). p_sku is
-- still accepted from older screens: digits there are taken as the barcode.
-- p_new_sku makes a new SKU even after its label was printed.
drop function if exists save_product(uuid, uuid, text, int, text, text, text, boolean, uuid, text, int, text, text, text, int, int, int);
create or replace function save_product(
  p_org uuid, p_id uuid, p_name text, p_price_cents int,
  p_description text default null, p_sku text default null, p_photo_url text default null,
  p_is_active boolean default true,
  p_supplier_id uuid default null, p_supplier_sku text default null, p_cost_cents int default null,
  p_unit text default null, p_category text default null, p_shelf text default null,
  p_reorder_point int default null, p_reorder_qty int default null,
  p_quantity int default null,
  p_type_id uuid default null, p_barcode text default null, p_new_sku boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name    text := nullif(btrim(coalesce(p_name, '')), '');
  v_id      uuid := p_id;
  v_type    uuid := p_type_id;
  v_cat     text;
  v_old_bc  text;
  v_barcode text;
  v_legacy  text := normalize_item_code(p_sku);
  p         hopshop_products;
  t         item_tags;
  v_sku     text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_name is null then raise exception 'Give the item a name'; end if;
  if p_supplier_id is not null and not exists (select 1 from suppliers s where s.id = p_supplier_id and s.org_id = p_org) then
    raise exception 'That supplier is not in the list';
  end if;
  perform ensure_product_types(p_org);
  if v_type is not null and not exists (select 1 from product_types x where x.id = v_type and x.org_id = p_org) then
    raise exception 'That type is not in the list';
  end if;
  if v_type is null and nullif(btrim(coalesce(p_category, '')), '') is not null then
    select x.id into v_type from product_types x where x.org_id = p_org and lower(x.name) = lower(btrim(p_category));
  end if;
  v_cat := coalesce((select x.name from product_types x where x.id = v_type), nullif(btrim(coalesce(p_category, '')), ''));

  if v_id is not null then
    select barcode into v_old_bc from hopshop_products where id = v_id and org_id = p_org;
  end if;
  v_barcode := case
    when p_barcode is not null then nullif(normalize_item_code(p_barcode), '')
    when v_legacy ~ '^[0-9]{8,14}$' then v_legacy
    else v_old_bc end;
  if v_barcode ~ '^DON-' or v_barcode ~ '^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$' then
    raise exception '% is an OHRR number, not the barcode on the packet', v_barcode;
  end if;

  if v_id is null then
    if not has_permission(p_org, 'hopshop.products.create') then raise exception 'Not allowed to add products'; end if;
    insert into hopshop_products (org_id, name, description, price_cents, photo_url, is_active,
                                  supplier_id, supplier_sku, cost_cents, unit, category, shelf,
                                  reorder_point, reorder_qty, created_by, type_id)
    values (p_org, v_name, nullif(btrim(coalesce(p_description, '')), ''), greatest(0, coalesce(p_price_cents, 0)),
            p_photo_url, coalesce(p_is_active, true),
            p_supplier_id, nullif(btrim(coalesce(p_supplier_sku, '')), ''), p_cost_cents,
            nullif(btrim(coalesce(p_unit, '')), ''), v_cat, nullif(btrim(coalesce(p_shelf, '')), ''),
            p_reorder_point, p_reorder_qty, auth.uid(), v_type)
    returning id into v_id;
  else
    if not has_permission(p_org, 'hopshop.products.edit') then raise exception 'Not allowed to edit products'; end if;
    update hopshop_products set
      name = v_name, description = nullif(btrim(coalesce(p_description, '')), ''),
      price_cents = greatest(0, coalesce(p_price_cents, price_cents)),
      photo_url = p_photo_url, is_active = coalesce(p_is_active, is_active),
      supplier_id = p_supplier_id, supplier_sku = nullif(btrim(coalesce(p_supplier_sku, '')), ''),
      cost_cents = p_cost_cents, unit = nullif(btrim(coalesce(p_unit, '')), ''),
      category = v_cat, shelf = nullif(btrim(coalesce(p_shelf, '')), ''),
      reorder_point = p_reorder_point, reorder_qty = p_reorder_qty,
      type_id = v_type
    where id = v_id and org_id = p_org;
    if not found then raise exception 'No such product'; end if;
  end if;

  -- Stock count (optional; the stepper on the card also does this).
  if p_quantity is not null then
    if not (has_permission(p_org, 'hopshop.inventory.update') or has_permission(p_org, 'hopshop.products.create')) then
      raise exception 'Not allowed to change stock';
    end if;
    insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
    values (v_id, p_org, greatest(0, p_quantity), auth.uid())
    on conflict (product_id) do update set quantity = greatest(0, excluded.quantity), updated_by = auth.uid();
  end if;

  -- The packet barcode: a second code, so scanning the packet opens this product.
  if v_barcode is distinct from v_old_bc and v_old_bc is not null then
    delete from item_tags where org_id = p_org and product_id = v_id and is_alias and code = v_old_bc;
  end if;
  if v_barcode is not null then
    select * into t from item_tags where org_id = p_org and code = v_barcode;
    if found and (t.kind <> 'stock' or t.product_id <> v_id) then
      raise exception 'Barcode % is already on another item', v_barcode;
    end if;
    insert into item_tags (org_id, code, kind, product_id, created_by, is_alias)
    values (p_org, v_barcode, 'stock', v_id, auth.uid(), true)
    on conflict (org_id, code) do nothing;
  end if;
  update hopshop_products set barcode = v_barcode where id = v_id and barcode is distinct from v_barcode;

  -- The SKU: made now, or brought up to date with the type and supplier.
  v_sku := refresh_product_sku(v_id, coalesce(p_new_sku, false));

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), case when p_id is null then 'hopshop.product_created' else 'hopshop.product_updated' end,
          'hopshop_product', v_id::text, jsonb_build_object('name', v_name, 'code', v_sku, 'barcode', v_barcode));

  select * into p from hopshop_products where id = v_id;
  return product_admin_json(p);
end $$;
grant execute on function save_product(uuid, uuid, text, int, text, text, text, boolean, uuid, text, int, text, text, text, int, int, int, uuid, text, boolean) to authenticated;

-- -------------------------------------------------------------
-- 4. What the scan screens and lists see
-- -------------------------------------------------------------
create or replace function tagged_item_json(p_tag item_tags)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
  v_contents jsonb;
  v_main item_tags;
begin
  if p_tag.kind in ('auction', 'raffle') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'code', dt.code, 'title', d.title, 'quantity', d.quantity, 'size', d.size,
             'donated_by', d.donated_by,
             'value_total_cents', donation_value_total(d.value_cents, d.value_basis, d.quantity))
             order by d.created_at), '[]'::jsonb)
      into v_contents
      from donation_items d
      left join item_tags dt on dt.donation_id = d.id
     where d.sorted_tag_id = p_tag.id and d.outcome = 'basket';
  end if;

  if p_tag.kind = 'auction' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'photo_urls', to_jsonb(coalesce(r.photo_urls, '{}'::text[])),
      'status', r.status, 'is_published', r.is_published, 'session', r.session,
      'price_cents', null, 'quantity', null, 'contents', v_contents)
    into j from raffle_items r where r.id = p_tag.raffle_item_id;
  elsif p_tag.kind = 'raffle' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'photo_urls', to_jsonb(coalesce(r.photo_urls, '{}'::text[])),
      'status', r.status, 'is_published', r.is_published, 'session', null,
      'price_cents', null, 'quantity', null, 'contents', v_contents)
    into j from raffle_prizes r where r.id = p_tag.raffle_prize_id;
  elsif p_tag.kind = 'donation' then
    select jsonb_build_object(
      'ref_id', d.id, 'title', d.title, 'description', d.description,
      'donated_by', d.donated_by, 'value_cents', d.value_cents, 'photo_url', d.photo_url,
      'photo_urls', to_jsonb(coalesce(d.photo_urls, '{}'::text[])),
      'status', coalesce(d.outcome, 'unsorted'), 'is_published', false, 'session', null,
      'price_cents', d.price_cents, 'quantity', d.quantity,
      'condition', d.condition, 'category', d.category, 'location', d.location,
      'received_on', d.received_on,
      'headed_for', d.headed_for, 'value_basis', d.value_basis,
      'value_each_cents', donation_value_each(d.value_cents, d.value_basis, d.quantity),
      'value_total_cents', donation_value_total(d.value_cents, d.value_basis, d.quantity),
      'size', d.size, 'use_by', d.use_by,
      'outcome', d.outcome, 'outcome_at', d.outcome_at, 'outcome_note', d.outcome_note,
      'dropoff_id', d.dropoff_id, 'split_from', d.split_from,
      'in_basket', case when d.outcome = 'basket' and bt.id is not null then jsonb_build_object(
                     'code', bt.code, 'kind', bt.kind,
                     'title', coalesce((select r.title from raffle_items r where r.id = bt.raffle_item_id),
                                       (select r.title from raffle_prizes r where r.id = bt.raffle_prize_id))) end)
    into j from donation_items d
      left join item_tags bt on bt.id = d.sorted_tag_id
     where d.id = p_tag.donation_id;
  else
    select jsonb_build_object(
      'ref_id', p.id, 'title', p.name, 'description', p.description,
      'donated_by', null, 'value_cents', null, 'photo_url', p.photo_url,
      'photo_urls', to_jsonb(coalesce(p.photo_urls, '{}'::text[])),
      'status', case when p.is_active then 'active' else 'inactive' end,
      'is_published', p.is_active, 'session', null,
      'price_cents', p.price_cents, 'quantity', coalesce(i.quantity, 0),
      'category', p.category, 'location', p.shelf,
      'type_id', p.type_id, 'type_code', (select pt.code from product_types pt where pt.id = p.type_id),
      'barcode', p.barcode)
    into j from hopshop_products p
      left join hopshop_inventory i on i.product_id = p.id
     where p.id = p_tag.product_id;
  end if;
  if j is null then return null; end if;
  -- A shop item answers with its SKU, whichever of its codes was scanned.
  if p_tag.kind = 'stock' then
    select * into v_main from item_tags x
     where x.product_id = p_tag.product_id and x.kind = 'stock' and not x.is_alias
     order by x.created_at limit 1;
  end if;
  return j || jsonb_build_object(
    'tag_id', p_tag.id, 'code', coalesce(v_main.code, p_tag.code), 'kind', p_tag.kind,
    'scanned_code', p_tag.code,
    'label_printed_at', case when v_main.id is not null then v_main.label_printed_at else p_tag.label_printed_at end,
    'created_at', p_tag.created_at, 'updated_at', p_tag.updated_at);
end $$;
-- Lists show each item once: not its packet barcode or the number it came in with.
create or replace function list_tagged_items(p_org uuid, p_kind text default null, p_unprinted boolean default false)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  for t in
    select * from item_tags
     where org_id = p_org and (p_kind is null or kind = p_kind) and not is_alias
       and (not p_unprinted or label_printed_at is null)
     order by created_at desc
  loop
    return next tagged_item_json(t);
  end loop;
end $$;
grant execute on function list_tagged_items(uuid, text, boolean) to authenticated;

-- Condition, category and place. For a shop item the category is its type,
-- and the SKU follows it until the label is printed.
create or replace function set_item_extras(p_org uuid, p_code text, p_condition text default null,
                                           p_category text default null, p_location text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := normalize_item_code(p_code);
  v_cond text := nullif(btrim(coalesce(p_condition, '')), '');
  v_cat  text := nullif(btrim(coalesce(p_category, '')), '');
  v_type uuid;
  t item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from item_tags where org_id = p_org and code = v_code for update;
  if not found then raise exception 'No item has the code %', v_code; end if;
  if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
  if v_cond is not null and v_cond not in ('new', 'like_new', 'good', 'fair') then raise exception 'Unknown condition'; end if;
  if t.kind = 'donation' then
    update donation_items set
      condition = v_cond,
      category  = v_cat,
      location  = nullif(btrim(coalesce(p_location, '')), '')
    where id = t.donation_id;
  elsif t.kind = 'stock' then
    select x.id into v_type from product_types x where x.org_id = p_org and lower(x.name) = lower(coalesce(v_cat, ''));
    update hopshop_products set
      category = coalesce((select x.name from product_types x where x.id = v_type), v_cat),
      type_id  = v_type,
      shelf    = nullif(btrim(coalesce(p_location, '')), '')
    where id = t.product_id;
    perform refresh_product_sku(t.product_id);
  end if;
  return tagged_item_json(t);
end $$;
grant execute on function set_item_extras(uuid, text, text, text, text) to authenticated;

-- The till's "new item" (kept for older screens): a SKU, never a made-up code.
create or replace function counter_add_item(
  p_org uuid, p_name text, p_price_cents int, p_quantity int,
  p_photo_url text default null, p_code text default null, p_description text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_bc   text := normalize_item_code(p_code);
  v_id   uuid;
  v_sku  text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (has_permission(p_org, 'counter.use') or has_permission(p_org, 'hopshop.products.create')) then
    raise exception 'Not allowed';
  end if;
  if v_name is null then raise exception 'Give the item a name'; end if;
  if p_price_cents is null or p_price_cents < 0 then raise exception 'Give the item a price'; end if;
  insert into hopshop_products (org_id, name, description, price_cents, photo_url, photo_urls, created_by)
  values (p_org, left(v_name, 120), nullif(btrim(coalesce(p_description, '')), ''), p_price_cents, p_photo_url,
          case when p_photo_url is null then '{}'::text[] else array[p_photo_url] end, auth.uid())
  returning id into v_id;
  insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
  values (v_id, p_org, greatest(0, coalesce(p_quantity, 1)), auth.uid());
  if v_bc ~ '^[0-9]{8,14}$' and not exists (select 1 from item_tags where org_id = p_org and code = v_bc) then
    insert into item_tags (org_id, code, kind, product_id, created_by, is_alias)
    values (p_org, v_bc, 'stock', v_id, auth.uid(), true);
    update hopshop_products set barcode = v_bc where id = v_id;
  end if;
  v_sku := refresh_product_sku(v_id);
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'counter.item_added', 'hopshop_product', v_id::text,
          jsonb_build_object('name', v_name, 'code', v_sku, 'price_cents', p_price_cents));
  return jsonb_build_object('id', v_id, 'code', v_sku);
end $$;
grant execute on function counter_add_item(uuid, text, int, int, text, text, text) to authenticated;

-- A second code for a shop item (a packet barcode): scanning it opens the item.
create or replace function counter_link_code(p_org uuid, p_product uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code  text := normalize_item_code(p_code);
  v_other text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (has_permission(p_org, 'counter.use') or has_permission(p_org, 'hopshop.products.create')
          or has_permission(p_org, 'hopshop.products.edit')) then
    raise exception 'Not allowed';
  end if;
  if v_code is null then raise exception 'That code is empty'; end if;
  if not exists (select 1 from hopshop_products where id = p_product and org_id = p_org) then
    raise exception 'No such item';
  end if;
  select coalesce(p.name, 'another item') into v_other
    from item_tags t left join hopshop_products p on p.id = t.product_id
   where t.org_id = p_org and t.code = v_code and t.product_id is distinct from p_product;
  if found then raise exception 'That code is already on %', v_other; end if;
  insert into item_tags (org_id, code, kind, product_id, created_by, is_alias)
  values (p_org, v_code, 'stock', p_product, auth.uid(), true)
  on conflict (org_id, code) do nothing;
  update hopshop_products set barcode = v_code
   where id = p_product and barcode is null and v_code ~ '^[0-9]{8,14}$';
  return jsonb_build_object('product_id', p_product, 'code', v_code);
end $$;
grant execute on function counter_link_code(uuid, uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 5. Saving a scanned item: new donations get DON numbers; an item sorted
--    into the shop gets a SKU and keeps its DON number as a second code
--    (same arguments as update 40)
-- -------------------------------------------------------------
create or replace function save_scanned_item(
  p_org uuid, p_code text, p_kind text, p_title text,
  p_description text default null, p_donated_by text default null,
  p_value_cents int default null, p_photo_url text default null,
  p_price_cents int default null, p_quantity int default null,
  p_session text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code  text := normalize_item_code(p_code);
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  t       item_tags;
  d       donation_items;
  prior   donation_items;
  new_id  uuid;
  old_kind text;
  old_ref  uuid;
  old_photos text[] := '{}';
  v_photos text[];
  v_photo  text;
  v_desc   text := nullif(btrim(coalesce(p_description, '')), '');
  v_value  int := p_value_cents;
  v_price  int := p_price_cents;
  v_qty    int := p_quantity;
  v_cat    text;
  v_place  text;
  v_from_donation boolean := false;
  v_exists boolean;
  v_type   uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_code is null then raise exception 'That code is empty'; end if;
  if p_kind not in ('auction', 'raffle', 'stock', 'donation') then raise exception 'Unknown item type'; end if;
  if not can_manage_item_kind(p_org, p_kind) then raise exception 'Not allowed'; end if;
  if v_title is null then raise exception 'Give the item a name'; end if;
  if p_quantity is not null and (p_quantity < 0 or p_quantity > 9999) then raise exception 'How many must be between 0 and 9999'; end if;
  if p_price_cents is not null and p_price_cents < 0 then raise exception 'The price can''t be below zero'; end if;

  select * into t from item_tags where org_id = p_org and code = v_code for update;
  v_exists := found;

  -- A shop item leaving the shop moves on the DON number it came in with.
  if v_exists and t.kind = 'stock' and p_kind <> 'stock' then
    select * into t from item_tags x
     where x.org_id = p_org and x.product_id = t.product_id and x.kind = 'stock' and x.code like 'DON-%'
     order by x.created_at limit 1 for update;
    if not found then
      raise exception 'Shop items stay in Hop Shop inventory. To make one a prize, add it as a donation.';
    end if;
    v_code := t.code;
  end if;
  -- Anything new that isn't for the shop gets the next DON number (a packet
  -- barcode can't tell one donated bag from the next).
  if not v_exists and p_kind <> 'stock' and v_code !~ '^DON-[0-9]+$' then
    v_code := new_item_code(p_org);
  end if;

  -- Same kind: update in place. A new main photo replaces the first of the list.
  if v_exists and t.kind = p_kind then
    if p_kind = 'auction' then
      update raffle_items set
        title = v_title, description = p_description, donated_by = p_donated_by,
        value_cents = p_value_cents, photo_url = coalesce(p_photo_url, photo_url),
        photo_urls = case when p_photo_url is null then photo_urls else clean_photo_urls(array[p_photo_url] || photo_urls[2:]) end,
        session = coalesce(p_session, session)
      where id = t.raffle_item_id;
    elsif p_kind = 'raffle' then
      update raffle_prizes set
        title = v_title, description = p_description, donated_by = p_donated_by,
        value_cents = p_value_cents, photo_url = coalesce(p_photo_url, photo_url),
        photo_urls = case when p_photo_url is null then photo_urls else clean_photo_urls(array[p_photo_url] || photo_urls[2:]) end
      where id = t.raffle_prize_id;
    elsif p_kind = 'donation' then
      update donation_items set
        title = v_title, description = p_description, donated_by = p_donated_by,
        value_cents = p_value_cents, photo_url = coalesce(p_photo_url, photo_url),
        photo_urls = case when p_photo_url is null then photo_urls else clean_photo_urls(array[p_photo_url] || photo_urls[2:]) end,
        price_cents = coalesce(p_price_cents, price_cents),
        quantity = case when p_quantity is null then quantity else greatest(1, p_quantity) end
      where id = t.donation_id;
    else
      if p_price_cents is not null and not (has_permission(p_org, 'hopshop.products.edit') or has_permission(p_org, 'hopshop.products.create')) then
        raise exception 'Not allowed to change product details';
      end if;
      update hopshop_products set
        name = v_title, description = p_description,
        price_cents = coalesce(p_price_cents, price_cents),
        photo_url = coalesce(p_photo_url, photo_url),
        photo_urls = case when p_photo_url is null then photo_urls else clean_photo_urls(array[p_photo_url] || photo_urls[2:]) end
      where id = t.product_id;
      if p_quantity is not null then
        if not has_permission(p_org, 'hopshop.inventory.update') and not has_permission(p_org, 'hopshop.products.create') then
          raise exception 'Not allowed to change stock';
        end if;
        insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
        values (t.product_id, p_org, greatest(0, p_quantity), auth.uid())
        on conflict (product_id) do update
          set quantity = greatest(0, excluded.quantity), updated_by = auth.uid();
      end if;
    end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.updated', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'kind', p_kind, 'title', v_title));
    select * into t from item_tags where id = t.id;
    return tagged_item_json(t);
  end if;

  -- New item (or a kind change): create the linked row first. A move keeps
  -- the photo list; a main photo given with the move leads it. A donation
  -- being sorted hands on its details and stays on record.
  if v_exists then
    if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
    old_kind := t.kind;
    old_ref  := coalesce(t.raffle_item_id, t.raffle_prize_id, t.product_id, t.donation_id);
    if old_kind = 'auction' then select photo_urls into old_photos from raffle_items where id = old_ref;
    elsif old_kind = 'raffle' then select photo_urls into old_photos from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then
      select * into d from donation_items where id = old_ref;
      if d.outcome = 'basket' then
        raise exception 'This is in a basket. Take it out of the basket first.';
      end if;
      v_from_donation := true;
      old_photos := d.photo_urls;
      v_desc  := coalesce(v_desc, nullif(btrim(coalesce(d.description, '')), ''));
      v_value := coalesce(v_value, donation_value_total(d.value_cents, d.value_basis, d.quantity));
      v_price := coalesce(v_price, d.price_cents);
      v_qty   := coalesce(v_qty, d.quantity);
      v_cat   := d.category;
      v_place := d.location;
      if p_kind in ('auction', 'raffle') and d.condition is not null
         and position('condition:' in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Condition: ' || lower(condition_label(d.condition)) || '.');
      end if;
      if nullif(btrim(coalesce(d.size, '')), '') is not null
         and position(lower(btrim(d.size)) in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Size: ' || btrim(d.size) || '.');
      end if;
      if d.use_by is not null and position('use by' in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Use by ' || to_char(d.use_by, 'MM/DD/YYYY') || '.');
      end if;
    else select photo_urls into old_photos from hopshop_products where id = old_ref; end if;
    old_photos := coalesce(old_photos, '{}');
  end if;
  v_photos := case when p_photo_url is null then clean_photo_urls(old_photos)
                   else clean_photo_urls(array[p_photo_url] || old_photos[2:]) end;
  v_photo  := v_photos[1];

  if p_kind = 'auction' then
    insert into raffle_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, session, created_by,
                              sort_order)
    values (p_org, v_title, v_desc, p_donated_by, v_value, v_photo, v_photos,
            coalesce(p_session, 'all-day'), auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_items where org_id = p_org), 10))
    returning id into new_id;
  elsif p_kind = 'raffle' then
    insert into raffle_prizes (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by, sort_order)
    values (p_org, v_title, v_desc, p_donated_by, v_value, v_photo, v_photos, auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_prizes where org_id = p_org), 10))
    returning id into new_id;
  elsif p_kind = 'donation' then
    -- Back to a donation: re-open the record it came from, if there is one.
    if v_exists then
      select * into prior from donation_items
       where sorted_tag_id = t.id and outcome = 'sorted'
       order by outcome_at desc nulls last limit 1;
    end if;
    if prior.id is not null then
      update donation_items set
        title = v_title, description = v_desc, donated_by = p_donated_by,
        photo_url = v_photo, photo_urls = v_photos,
        value_cents = coalesce(p_value_cents, value_cents),
        value_basis = case when p_value_cents is not null then 'all' else value_basis end,
        price_cents = coalesce(v_price, price_cents),
        quantity = greatest(1, coalesce(v_qty, quantity)),
        outcome = null, outcome_at = null, outcome_note = null, sorted_kind = null, sorted_tag_id = null
      where id = prior.id;
      new_id := prior.id;
    else
      insert into donation_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by,
                                  price_cents, quantity)
      values (p_org, v_title, v_desc, p_donated_by, v_value, v_photo, v_photos, auth.uid(),
              v_price, greatest(1, coalesce(v_qty, 1)))
      returning id into new_id;
    end if;
  else
    if not has_permission(p_org, 'hopshop.products.create') then
      raise exception 'Not allowed to add products';
    end if;
    -- A donation moved into the shop without a price stays hidden until priced.
    -- Its type comes from the donation's sort of thing, when that names a type.
    select x.id into v_type from product_types x
     where x.org_id = p_org and lower(x.name) = lower(btrim(coalesce(v_cat, '')));
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, photo_urls, created_by, category, shelf,
                                  is_active, type_id)
    values (p_org, v_title, v_desc, coalesce(v_price, 0), null, v_photo, v_photos, auth.uid(),
            coalesce((select x.name from product_types x where x.id = v_type), v_cat), v_place,
            not (v_from_donation and coalesce(v_price, 0) = 0), v_type)
    returning id into new_id;
    insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
    values (new_id, p_org, greatest(0, coalesce(v_qty, 1)), auth.uid());
  end if;

  if v_exists then
    update item_tags set
      kind = p_kind,
      is_alias = (p_kind = 'stock'),
      raffle_item_id  = case when p_kind = 'auction'  then new_id end,
      raffle_prize_id = case when p_kind = 'raffle'   then new_id end,
      product_id      = case when p_kind = 'stock'    then new_id end,
      donation_id     = case when p_kind = 'donation' then new_id end
    where id = t.id;
    -- The old row goes; a donation stays on record as sorted into the new item.
    if old_kind = 'auction' then delete from raffle_items  where id = old_ref;
    elsif old_kind = 'raffle' then delete from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then
      update donation_items set outcome = 'sorted', outcome_at = now(), sorted_kind = p_kind, sorted_tag_id = t.id
       where id = old_ref;
    else delete from hopshop_products where id = old_ref; end if;
    -- Into the shop: a SKU of its own; the DON number keeps working too.
    if p_kind = 'stock' then perform refresh_product_sku(new_id); end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.moved', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'from', old_kind, 'to', p_kind, 'title', v_title));
  else
    if p_kind = 'stock' then
      -- A new shop item: a SKU; a packet barcode becomes its second code.
      if v_code ~ '^[0-9]{8,14}$' then
        insert into item_tags (org_id, code, kind, product_id, created_by, is_alias)
        values (p_org, v_code, 'stock', new_id, auth.uid(), true);
        update hopshop_products set barcode = v_code where id = new_id;
      end if;
      v_code := refresh_product_sku(new_id);
      select * into t from item_tags where org_id = p_org and code = v_code;
    else
      insert into item_tags (org_id, code, kind, raffle_item_id, raffle_prize_id, product_id, donation_id, created_by)
      values (p_org, v_code, p_kind,
              case when p_kind = 'auction'  then new_id end,
              case when p_kind = 'raffle'   then new_id end,
              null,
              case when p_kind = 'donation' then new_id end,
              auth.uid())
      returning * into t;
    end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.scanned', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'kind', p_kind, 'title', v_title));
  end if;

  select * into t from item_tags where org_id = p_org and code = v_code;
  return tagged_item_json(t);
end $$;
grant execute on function save_scanned_item(uuid, text, text, text, text, text, int, text, int, int, text) to authenticated;

-- -------------------------------------------------------------
-- 6. Catalog a donation: always the next DON number
-- -------------------------------------------------------------
create or replace function catalog_new_item(
  p_org uuid, p_title text, p_kind text default 'donation',
  p_description text default null, p_donated_by text default null,
  p_value_cents int default null, p_photo_url text default null,
  p_price_cents int default null, p_quantity int default null,
  p_code text default null,
  p_condition text default null, p_category text default null, p_location text default null,
  p_plan jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := nullif(normalize_item_code(p_code), '');
  v_item jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- A donation gets the next DON number (a scanned packet barcode isn't kept).
  if v_code is null or (coalesce(p_kind, 'donation') <> 'stock' and v_code !~ '^DON-[0-9]+$') then
    v_code := new_item_code(p_org);
  end if;
  if exists (select 1 from item_tags where org_id = p_org and code = v_code) then
    raise exception 'Code % is already on another item', v_code;
  end if;
  v_item := save_scanned_item(p_org, v_code, p_kind, p_title, p_description, p_donated_by,
                              p_value_cents, p_photo_url, p_price_cents, p_quantity, null);
  v_code := coalesce(v_item->>'code', v_code);
  if p_condition is not null or p_category is not null or p_location is not null then
    perform set_item_extras(p_org, v_code, p_condition, p_category, p_location);
  end if;
  if p_kind = 'donation' and p_plan is not null and jsonb_typeof(p_plan) = 'object' then
    perform set_donation_plan(p_org, v_code, p_plan);
  end if;
  return tagged_item_json((select x from item_tags x where x.org_id = p_org and x.code = v_code));
end $$;
grant execute on function catalog_new_item(uuid, text, text, text, text, int, text, int, int, text, text, text, text, jsonb) to authenticated;

-- -------------------------------------------------------------
-- 7. Renumber what's there (no labels are in use yet)
--    · types for every organisation; vendor numbers, oldest company first
--    · donations, auction and raffle items → DON numbers, oldest first
--    · shop items → a SKU each; packet barcodes kept as second codes; a shop
--      item that came in as a donation keeps that DON number too
--    · labels show as not printed, so they print with the new numbers
-- -------------------------------------------------------------
do $$
declare
  o record;
  r record;
begin
  for o in select id from organizations loop
    perform ensure_product_types(o.id);

    for r in select id from suppliers where org_id = o.id and vendor_no is null order by created_at, name loop
      update suppliers set vendor_no = next_vendor_no(o.id) where id = r.id;
    end loop;

    for r in
      select t.id, t.kind from item_tags t
       where t.org_id = o.id and t.code !~ '^DON-[0-9]+$'
         and (t.kind <> 'stock' or exists (select 1 from donation_items d where d.sorted_tag_id = t.id))
       order by t.created_at, t.id
    loop
      update item_tags set code = new_item_code(o.id), label_printed_at = null, is_alias = (r.kind = 'stock')
       where id = r.id;
    end loop;

    for r in select id from hopshop_products where org_id = o.id order by created_at, id loop
      update hopshop_products p
         set type_id = (select x.id from product_types x where x.org_id = o.id and lower(x.name) = lower(btrim(p.category)))
       where p.id = r.id and p.type_id is null and nullif(btrim(coalesce(p.category, '')), '') is not null;
      update hopshop_products p
         set category = (select x.name from product_types x where x.id = p.type_id)
       where p.id = r.id and p.type_id is not null;
      update item_tags set is_alias = true
       where product_id = r.id and kind = 'stock' and code ~ '^[0-9]{8,14}$';
      update hopshop_products
         set barcode = (select min(t.code) from item_tags t where t.product_id = r.id and t.code ~ '^[0-9]{8,14}$')
       where id = r.id and barcode is null;
      delete from item_tags
       where product_id = r.id and kind = 'stock' and not is_alias and code !~ '^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$';
      perform refresh_product_sku(r.id);
    end loop;
  end loop;
end $$;

-- Check: every count should be 0.
select
  (select count(*) from item_tags where code !~ '^DON-[0-9]+$' and code !~ '^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$' and not is_alias) as old_codes_left,
  (select count(*) from hopshop_products where sku is null or sku !~ '^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$') as products_without_sku,
  (select count(*) from suppliers where vendor_no is null) as companies_without_number;
