-- =============================================================
-- OHRR — Hop Shop: suppliers, item details and a reorder list
--
-- The Hop Shop manager grows from name / price / SKU into a real stock card:
--
--   suppliers          who OHRR buys from (is_supplier) and/or who sells at
--                      Midwest BunFest (is_vendor) — one list, two tick boxes,
--                      because some companies are both (Small Pet Select…).
--                      Contact, website, account number, how to order, lead
--                      time, minimum order.
--   hopshop_products   + supplier_id, supplier_sku (their item number),
--                      cost_cents (what OHRR pays), unit ("bag", "case of 12"),
--                      category, shelf ("where it sits"), reorder_point
--                      (order when stock is at or below this), reorder_qty
--                      (how many to order), on_order_qty / ordered_at.
--
--   save_product()          create or update a product from the manager, with
--                           its photo, its code (an OHRR tag or a retail
--                           barcode — registered in item_tags so scanning
--                           opens it) and its stock count, in one call.
--   list_products_admin()   every product with stock, supplier name and code.
--   hopshop_reorder()       the reorder list: at or below the reorder point,
--                           or already on order — grouped by supplier.
--   hopshop_set_order()     mark a product ordered / received / not ordered.
--
-- Capabilities: the existing hopshop.* keys. Reading suppliers = any member;
-- editing suppliers = hopshop.products.edit.
--
-- Paste + Run in the Supabase SQL editor AFTER 20260921160000_public_shop.sql.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
create table if not exists suppliers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  is_supplier     boolean not null default true,    -- OHRR buys from them
  is_vendor       boolean not null default false,   -- they sell at BunFest
  contact_name    text,
  email           text,
  phone           text,
  website         text,
  address         text,
  account_number  text,
  order_how       text check (order_how is null or order_how in ('website', 'email', 'phone', 'rep', 'in_person')),
  order_notes     text,       -- "log in as ohrr@…, free shipping over $75"
  lead_days       int check (lead_days is null or lead_days between 0 and 365),
  min_order       text,       -- "$75" / "6 bags"
  notes           text,
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, name)
);
drop trigger if exists trg_suppliers_updated on suppliers;
create trigger trg_suppliers_updated before update on suppliers
  for each row execute function set_updated_at();

alter table suppliers enable row level security;
drop policy if exists suppliers_member_select on suppliers;
create policy suppliers_member_select on suppliers for select using (is_org_member(org_id));
drop policy if exists suppliers_staff_insert on suppliers;
create policy suppliers_staff_insert on suppliers for insert
  with check (has_permission(org_id, 'hopshop.products.edit') or has_permission(org_id, 'hopshop.products.create'));
drop policy if exists suppliers_staff_update on suppliers;
create policy suppliers_staff_update on suppliers for update
  using (has_permission(org_id, 'hopshop.products.edit')) with check (has_permission(org_id, 'hopshop.products.edit'));
drop policy if exists suppliers_staff_delete on suppliers;
create policy suppliers_staff_delete on suppliers for delete using (has_permission(org_id, 'hopshop.products.delete'));
grant select, insert, update, delete on suppliers to authenticated;

-- -------------------------------------------------------------
alter table hopshop_products add column if not exists supplier_id   uuid references suppliers(id) on delete set null;
alter table hopshop_products add column if not exists supplier_sku  text;
alter table hopshop_products add column if not exists cost_cents    int check (cost_cents is null or cost_cents >= 0);
alter table hopshop_products add column if not exists unit          text;
alter table hopshop_products add column if not exists category      text;
alter table hopshop_products add column if not exists shelf         text;
alter table hopshop_products add column if not exists reorder_point int check (reorder_point is null or reorder_point >= 0);
alter table hopshop_products add column if not exists reorder_qty   int check (reorder_qty is null or reorder_qty >= 0);
alter table hopshop_products add column if not exists on_order_qty  int not null default 0 check (on_order_qty >= 0);
alter table hopshop_products add column if not exists ordered_at    timestamptz;
create index if not exists idx_products_supplier on hopshop_products(supplier_id);

-- -------------------------------------------------------------
-- One JSON shape for the manager screens
-- -------------------------------------------------------------
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
    'updated_at', p.updated_at
  );
$$;

create or replace function list_products_admin(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_org_member(p_org)
    then coalesce((select jsonb_agg(product_admin_json(p) order by p.is_active desc, p.name)
                     from hopshop_products p where p.org_id = p_org), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
grant execute on function list_products_admin(uuid) to authenticated;

-- -------------------------------------------------------------
-- Create / update a product with everything on its card
-- -------------------------------------------------------------
create or replace function save_product(
  p_org uuid, p_id uuid, p_name text, p_price_cents int,
  p_description text default null, p_sku text default null, p_photo_url text default null,
  p_is_active boolean default true,
  p_supplier_id uuid default null, p_supplier_sku text default null, p_cost_cents int default null,
  p_unit text default null, p_category text default null, p_shelf text default null,
  p_reorder_point int default null, p_reorder_qty int default null,
  p_quantity int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_code text := normalize_item_code(p_sku);
  v_id   uuid := p_id;
  p      hopshop_products;
  t      item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_name is null then raise exception 'Give the item a name'; end if;
  if p_supplier_id is not null and not exists (select 1 from suppliers s where s.id = p_supplier_id and s.org_id = p_org) then
    raise exception 'That supplier is not in the list';
  end if;

  if v_id is null then
    if not has_permission(p_org, 'hopshop.products.create') then raise exception 'Not allowed to add products'; end if;
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, is_active,
                                  supplier_id, supplier_sku, cost_cents, unit, category, shelf,
                                  reorder_point, reorder_qty, created_by)
    values (p_org, v_name, nullif(btrim(coalesce(p_description, '')), ''), greatest(0, coalesce(p_price_cents, 0)),
            v_code, p_photo_url, coalesce(p_is_active, true),
            p_supplier_id, nullif(btrim(coalesce(p_supplier_sku, '')), ''), p_cost_cents,
            nullif(btrim(coalesce(p_unit, '')), ''), nullif(btrim(coalesce(p_category, '')), ''), nullif(btrim(coalesce(p_shelf, '')), ''),
            p_reorder_point, p_reorder_qty, auth.uid())
    returning id into v_id;
  else
    if not has_permission(p_org, 'hopshop.products.edit') then raise exception 'Not allowed to edit products'; end if;
    update hopshop_products set
      name = v_name, description = nullif(btrim(coalesce(p_description, '')), ''),
      price_cents = greatest(0, coalesce(p_price_cents, price_cents)),
      sku = v_code, photo_url = p_photo_url, is_active = coalesce(p_is_active, is_active),
      supplier_id = p_supplier_id, supplier_sku = nullif(btrim(coalesce(p_supplier_sku, '')), ''),
      cost_cents = p_cost_cents, unit = nullif(btrim(coalesce(p_unit, '')), ''),
      category = nullif(btrim(coalesce(p_category, '')), ''), shelf = nullif(btrim(coalesce(p_shelf, '')), ''),
      reorder_point = p_reorder_point, reorder_qty = p_reorder_qty
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

  -- The code: register it so scanning the tag / barcode opens this product.
  -- A code already on another item is refused; a product's old code is freed.
  if v_code is not null then
    select * into t from item_tags where org_id = p_org and code = v_code;
    if found and (t.kind <> 'stock' or t.product_id <> v_id) then
      raise exception 'Code % is already on another item', v_code;
    end if;
    delete from item_tags where org_id = p_org and kind = 'stock' and product_id = v_id and code <> v_code;
    insert into item_tags (org_id, code, kind, product_id, created_by)
    values (p_org, v_code, 'stock', v_id, auth.uid())
    on conflict (org_id, code) do nothing;
  else
    delete from item_tags where org_id = p_org and kind = 'stock' and product_id = v_id;
  end if;

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), case when p_id is null then 'hopshop.product_created' else 'hopshop.product_updated' end,
          'hopshop_product', v_id::text, jsonb_build_object('name', v_name, 'code', v_code));

  select * into p from hopshop_products where id = v_id;
  return product_admin_json(p);
end $$;
grant execute on function save_product(uuid, uuid, text, int, text, text, text, boolean, uuid, text, int, text, text, text, int, int, int) to authenticated;

-- -------------------------------------------------------------
-- Reorder list: at or below the reorder point, or on order
-- -------------------------------------------------------------
create or replace function hopshop_reorder(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_org_member(p_org)
    then coalesce((
      select jsonb_agg(product_admin_json(p) order by (select s.name from suppliers s where s.id = p.supplier_id) nulls last, p.name)
        from hopshop_products p
        left join hopshop_inventory i on i.product_id = p.id
       where p.org_id = p_org and p.is_active
         and (p.on_order_qty > 0
              or (p.reorder_point is not null and coalesce(i.quantity, 0) <= p.reorder_point))
    ), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
grant execute on function hopshop_reorder(uuid) to authenticated;

-- ordered: p_qty on order (default reorder_qty); received: stock += on order
-- (or p_qty), on order cleared; clear: forget the order.
create or replace function hopshop_set_order(p_product_id uuid, p_action text, p_qty int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p hopshop_products;
  v_qty int;
begin
  select * into p from hopshop_products where id = p_product_id;
  if not found then raise exception 'No such product'; end if;
  if not (has_permission(p.org_id, 'hopshop.inventory.update') or has_permission(p.org_id, 'hopshop.products.edit')) then
    raise exception 'Not allowed';
  end if;
  if p_action = 'ordered' then
    v_qty := greatest(1, coalesce(p_qty, p.reorder_qty, 1));
    update hopshop_products set on_order_qty = v_qty, ordered_at = now() where id = p.id;
  elsif p_action = 'received' then
    v_qty := greatest(0, coalesce(p_qty, p.on_order_qty));
    insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
    values (p.id, p.org_id, v_qty, auth.uid())
    on conflict (product_id) do update
      set quantity = hopshop_inventory.quantity + excluded.quantity, updated_by = auth.uid();
    update hopshop_products set on_order_qty = 0, ordered_at = null where id = p.id;
  elsif p_action = 'clear' then
    update hopshop_products set on_order_qty = 0, ordered_at = null where id = p.id;
  else
    raise exception 'Unknown action';
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p.org_id, auth.uid(), 'hopshop.order_' || p_action, 'hopshop_product', p.id::text,
          jsonb_build_object('name', p.name, 'qty', v_qty));
  select * into p from hopshop_products where id = p.id;
  return product_admin_json(p);
end $$;
grant execute on function hopshop_set_order(uuid, text, int) to authenticated;
