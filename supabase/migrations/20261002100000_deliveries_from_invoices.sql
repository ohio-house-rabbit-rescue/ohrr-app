-- =============================================================
-- Update 42 (2026-10-01): deliveries — add Hop Shop stock from a supplier's
-- invoice.
--
-- Staff add the invoice (a PDF from email, or photos of a paper one). The
-- app reads it on the phone or laptop (no outside service), matches each
-- line to a Hop Shop product, they check the list and tap Add to stock.
-- This keeps the record:
--
--   supplier_deliveries        one per invoice: supplier, invoice number and
--                              date, subtotal, shipping, tax, total, the files
--   supplier_delivery_lines    what came in: the product, the sellable items
--                              added, the cost of one, and the line as read
--   supplier_invoice_matches   lines matched by hand, remembered per supplier,
--                              so the next invoice from them matches itself
--   storage bucket 'invoices'  private: the invoice files
--
--   receive_delivery()   save it and add the items to stock in one go; the
--                        same invoice number from the same supplier is
--                        refused a second time unless asked
--   list_deliveries(), delivery_detail(), undo_delivery()
--
-- Apply AFTER 20261001180000_item_numbers_and_shipping.sql. Paste + Run in
-- the Supabase SQL editor, part by part. Safe to run twice.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Tables and the private file bucket
-- -------------------------------------------------------------
create or replace function can_receive_stock(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_permission(p_org, 'hopshop.inventory.update') or has_permission(p_org, 'hopshop.products.edit')
      or has_permission(p_org, 'hopshop.products.create');
$$;

create table if not exists supplier_deliveries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  supplier_id     uuid references suppliers(id) on delete set null,
  invoice_no      text,
  invoice_date    date,
  received_on     date not null default ((now() at time zone 'America/New_York')::date),
  subtotal_cents  int check (subtotal_cents is null or subtotal_cents >= 0),
  shipping_cents  int check (shipping_cents is null or shipping_cents >= 0),
  tax_cents       int check (tax_cents is null or tax_cents >= 0),
  total_cents     int check (total_cents is null or total_cents >= 0),
  file_paths      text[] not null default '{}',   -- in the private 'invoices' bucket
  note            text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_supplier_deliveries_org on supplier_deliveries(org_id, received_on desc, created_at desc);
create index if not exists idx_supplier_deliveries_supplier on supplier_deliveries(supplier_id, received_on desc);
alter table supplier_deliveries enable row level security;
drop policy if exists supplier_deliveries_staff_select on supplier_deliveries;
create policy supplier_deliveries_staff_select on supplier_deliveries for select using (can_receive_stock(org_id));
grant select on supplier_deliveries to authenticated;

create table if not exists supplier_delivery_lines (
  id               uuid primary key default gen_random_uuid(),
  delivery_id      uuid not null references supplier_deliveries(id) on delete cascade,
  product_id       uuid references hopshop_products(id) on delete set null,
  read_as          text,          -- the line as read from the invoice
  supplier_sku     text,          -- their item number, when the line had one
  qty_invoiced     numeric,       -- what the invoice says: 2 (cases)
  units_added      int not null default 0 check (units_added >= 0),   -- sellable items added: 24
  unit_cost_cents  int check (unit_cost_cents is null or unit_cost_cents >= 0),   -- one sellable item
  line_total_cents int,
  sort_order       int not null default 0
);
create index if not exists idx_supplier_delivery_lines_delivery on supplier_delivery_lines(delivery_id, sort_order);
create index if not exists idx_supplier_delivery_lines_product on supplier_delivery_lines(product_id);
alter table supplier_delivery_lines enable row level security;
drop policy if exists supplier_delivery_lines_staff_select on supplier_delivery_lines;
create policy supplier_delivery_lines_staff_select on supplier_delivery_lines for select
  using (exists (select 1 from supplier_deliveries d where d.id = delivery_id and can_receive_stock(d.org_id)));
grant select on supplier_delivery_lines to authenticated;

create table if not exists supplier_invoice_matches (
  org_id      uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  match_key   text not null,     -- their item number, or the line's words, lower-case
  product_id  uuid not null references hopshop_products(id) on delete cascade,
  units_per   int not null default 1 check (units_per between 1 and 10000),   -- sellable items per invoice unit
  updated_at  timestamptz not null default now(),
  primary key (org_id, supplier_id, match_key)
);
alter table supplier_invoice_matches enable row level security;
drop policy if exists supplier_invoice_matches_staff_select on supplier_invoice_matches;
create policy supplier_invoice_matches_staff_select on supplier_invoice_matches for select using (can_receive_stock(org_id));
grant select on supplier_invoice_matches to authenticated;

-- Invoice files: private; the first folder is the organisation's id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "invoices staff read" on storage.objects;
create policy "invoices staff read" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] in (
    select m.org_id::text from public.memberships m
     where m.user_id = auth.uid() and m.status = 'active' and public.can_receive_stock(m.org_id)));
drop policy if exists "invoices staff insert" on storage.objects;
create policy "invoices staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] in (
    select m.org_id::text from public.memberships m
     where m.user_id = auth.uid() and m.status = 'active' and public.can_receive_stock(m.org_id)));
drop policy if exists "invoices staff delete" on storage.objects;
create policy "invoices staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] in (
    select m.org_id::text from public.memberships m
     where m.user_id = auth.uid() and m.status = 'active' and public.can_receive_stock(m.org_id)));

-- -------------------------------------------------------------
-- 2. A delivery as JSON, the list, and adding one
-- -------------------------------------------------------------
create or replace function delivery_json(p_id uuid, p_with_lines boolean default true)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', d.id, 'supplier_id', d.supplier_id,
    'supplier_name', (select s.name from suppliers s where s.id = d.supplier_id),
    'invoice_no', d.invoice_no, 'invoice_date', d.invoice_date, 'received_on', d.received_on,
    'subtotal_cents', d.subtotal_cents, 'shipping_cents', d.shipping_cents,
    'tax_cents', d.tax_cents, 'total_cents', d.total_cents,
    'file_paths', to_jsonb(d.file_paths), 'note', d.note, 'created_at', d.created_at,
    'lines_count', (select count(*) from supplier_delivery_lines l where l.delivery_id = d.id and l.product_id is not null),
    'units', (select coalesce(sum(l.units_added), 0) from supplier_delivery_lines l where l.delivery_id = d.id),
    'lines', case when p_with_lines then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'product_id', l.product_id, 'product_name', p.name, 'sku', p.sku,
               'read_as', l.read_as, 'supplier_sku', l.supplier_sku, 'qty_invoiced', l.qty_invoiced,
               'units_added', l.units_added, 'unit_cost_cents', l.unit_cost_cents,
               'line_total_cents', l.line_total_cents) order by l.sort_order)
        from supplier_delivery_lines l left join hopshop_products p on p.id = l.product_id
       where l.delivery_id = d.id), '[]'::jsonb) end)
  from supplier_deliveries d where d.id = p_id;
$$;

-- Newest first; one supplier's when p_supplier is given.
create or replace function list_deliveries(p_org uuid, p_supplier uuid default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not can_receive_stock(p_org) then raise exception 'Not allowed'; end if;
  return coalesce((
    select jsonb_agg(delivery_json(x.id, false) order by x.received_on desc, x.created_at desc)
      from (select d.id, d.received_on, d.created_at from supplier_deliveries d
             where d.org_id = p_org and (p_supplier is null or d.supplier_id = p_supplier)
             order by d.received_on desc, d.created_at desc
             limit greatest(1, least(coalesce(p_limit, 100), 500))) x), '[]'::jsonb);
end $$;
grant execute on function list_deliveries(uuid, uuid, int) to authenticated;

create or replace function delivery_detail(p_org uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not can_receive_stock(p_org) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from supplier_deliveries where id = p_id and org_id = p_org) then return null; end if;
  return delivery_json(p_id, true);
end $$;
grant execute on function delivery_detail(uuid, uuid) to authenticated;

-- Save a delivery and add its items to stock. p_delivery:
--   { supplier_id, invoice_no, invoice_date, subtotal_cents, shipping_cents,
--     tax_cents, total_cents, file_paths: [...], note, allow_duplicate,
--     lines: [{ product_id, read_as, supplier_sku, qty_invoiced, units,
--               unit_cost_cents, line_total_cents, update_cost,
--               match_key, units_per, remember }] }
-- A line without a product is kept on the record but adds nothing.
create or replace function receive_delivery(p_org uuid, p_delivery jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sup   uuid := nullif(btrim(coalesce(p_delivery->>'supplier_id', '')), '')::uuid;
  v_no    text := nullif(btrim(coalesce(p_delivery->>'invoice_no', '')), '');
  v_id    uuid;
  v_prev  supplier_deliveries;
  l       jsonb;
  i       int := 0;
  v_prod  uuid;
  v_units int;
  v_cost  int;
  v_left  int;
  v_key   text;
  n_units int := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_receive_stock(p_org) then raise exception 'Not allowed'; end if;
  if v_sup is not null and not exists (select 1 from suppliers where id = v_sup and org_id = p_org) then
    raise exception 'That supplier is not in the list';
  end if;
  if jsonb_typeof(p_delivery->'lines') is distinct from 'array' then raise exception 'There are no lines to add'; end if;

  -- The same invoice twice would add the stock twice.
  if v_no is not null and not coalesce((p_delivery->>'allow_duplicate')::boolean, false) then
    select * into v_prev from supplier_deliveries
     where org_id = p_org and supplier_id is not distinct from v_sup and lower(invoice_no) = lower(v_no)
     order by created_at limit 1;
    if found then
      raise exception 'Invoice % was already added on %.', v_no, to_char(v_prev.received_on, 'Mon FMDD, YYYY');
    end if;
  end if;

  insert into supplier_deliveries (org_id, supplier_id, invoice_no, invoice_date, subtotal_cents, shipping_cents,
                                   tax_cents, total_cents, file_paths, note, created_by)
  values (p_org, v_sup, v_no,
          nullif(btrim(coalesce(p_delivery->>'invoice_date', '')), '')::date,
          nullif(btrim(coalesce(p_delivery->>'subtotal_cents', '')), '')::int,
          nullif(btrim(coalesce(p_delivery->>'shipping_cents', '')), '')::int,
          nullif(btrim(coalesce(p_delivery->>'tax_cents', '')), '')::int,
          nullif(btrim(coalesce(p_delivery->>'total_cents', '')), '')::int,
          coalesce((select array_agg(x) from jsonb_array_elements_text(
                      case when jsonb_typeof(p_delivery->'file_paths') = 'array' then p_delivery->'file_paths' else '[]'::jsonb end) x
                     where x like p_org::text || '/%'), '{}'),
          nullif(btrim(coalesce(p_delivery->>'note', '')), ''),
          auth.uid())
  returning id into v_id;

  for l in select value from jsonb_array_elements(p_delivery->'lines') loop
    i := i + 1;
    v_prod  := nullif(btrim(coalesce(l->>'product_id', '')), '')::uuid;
    v_units := greatest(0, coalesce(nullif(btrim(coalesce(l->>'units', '')), '')::int, 0));
    v_cost  := nullif(btrim(coalesce(l->>'unit_cost_cents', '')), '')::int;
    if v_prod is not null and not exists (select 1 from hopshop_products where id = v_prod and org_id = p_org) then
      raise exception 'Line %: that product is not in the list', i;
    end if;
    if v_units > 100000 then raise exception 'Line %: % items is too many', i, v_units; end if;
    insert into supplier_delivery_lines (delivery_id, product_id, read_as, supplier_sku, qty_invoiced, units_added,
                                         unit_cost_cents, line_total_cents, sort_order)
    values (v_id, v_prod, left(nullif(btrim(coalesce(l->>'read_as', '')), ''), 500),
            nullif(btrim(coalesce(l->>'supplier_sku', '')), ''),
            nullif(btrim(coalesce(l->>'qty_invoiced', '')), '')::numeric,
            case when v_prod is null then 0 else v_units end,
            case when v_cost is null or v_cost < 0 then null else v_cost end,
            nullif(btrim(coalesce(l->>'line_total_cents', '')), '')::int, i);

    if v_prod is not null and v_units > 0 then
      insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
      values (v_prod, p_org, v_units, auth.uid())
      on conflict (product_id) do update
        set quantity = hopshop_inventory.quantity + excluded.quantity, updated_by = auth.uid();
      -- What arrives comes off "on order".
      select greatest(0, on_order_qty - v_units) into v_left from hopshop_products where id = v_prod;
      update hopshop_products set
        on_order_qty  = v_left,
        ordered_at    = case when v_left > 0 then ordered_at end,
        ordered_packs = case when v_left > 0 then null else ordered_packs end
      where id = v_prod and on_order_qty > 0;
      if v_cost is not null and v_cost >= 0 and coalesce((l->>'update_cost')::boolean, true) then
        update hopshop_products set cost_cents = v_cost where id = v_prod and cost_cents is distinct from v_cost;
      end if;
      n_units := n_units + v_units;
    end if;

    -- A line matched by hand: remember it for this supplier's next invoice.
    v_key := lower(btrim(coalesce(l->>'match_key', '')));
    if v_sup is not null and v_prod is not null and v_key <> '' and coalesce((l->>'remember')::boolean, false) then
      insert into supplier_invoice_matches (org_id, supplier_id, match_key, product_id, units_per)
      values (p_org, v_sup, left(v_key, 200), v_prod,
              greatest(1, least(10000, coalesce(nullif(btrim(coalesce(l->>'units_per', '')), '')::int, 1))))
      on conflict (org_id, supplier_id, match_key) do update
        set product_id = excluded.product_id, units_per = excluded.units_per, updated_at = now();
    end if;
  end loop;

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'hopshop.delivery_received', 'supplier_delivery', v_id::text,
          jsonb_build_object('invoice_no', v_no, 'supplier_id', v_sup, 'units', n_units));
  return delivery_json(v_id, true);
end $$;
grant execute on function receive_delivery(uuid, jsonb) to authenticated;

-- Take a delivery back off: its items come off stock (never below 0) and the
-- record goes. Returns the invoice file paths, for the app to delete.
create or replace function undo_delivery(p_org uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d supplier_deliveries;
  l supplier_delivery_lines;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_receive_stock(p_org) then raise exception 'Not allowed'; end if;
  select * into d from supplier_deliveries where id = p_id and org_id = p_org for update;
  if not found then raise exception 'No such delivery'; end if;
  for l in select * from supplier_delivery_lines where delivery_id = d.id and product_id is not null and units_added > 0 loop
    update hopshop_inventory set quantity = greatest(0, quantity - l.units_added), updated_by = auth.uid()
     where product_id = l.product_id;
  end loop;
  delete from supplier_deliveries where id = d.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'hopshop.delivery_undone', 'supplier_delivery', d.id::text,
          jsonb_build_object('invoice_no', d.invoice_no, 'supplier_id', d.supplier_id));
  return to_jsonb(d.file_paths);
end $$;
grant execute on function undo_delivery(uuid, uuid) to authenticated;

-- Forget one remembered match (it pointed at the wrong product).
create or replace function forget_invoice_match(p_org uuid, p_supplier uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_receive_stock(p_org) then raise exception 'Not allowed'; end if;
  delete from supplier_invoice_matches where org_id = p_org and supplier_id = p_supplier and match_key = lower(btrim(p_key));
end $$;
grant execute on function forget_invoice_match(uuid, uuid, text) to authenticated;

-- Check: three answers, all "yes".
select
  exists (select 1 from pg_tables where tablename = 'supplier_deliveries') as deliveries_table,
  exists (select 1 from storage.buckets where id = 'invoices' and not public) as private_invoice_bucket,
  exists (select 1 from pg_proc where proname = 'receive_delivery') as receive_function;
