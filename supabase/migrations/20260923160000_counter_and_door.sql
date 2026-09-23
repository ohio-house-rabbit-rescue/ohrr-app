-- =============================================================
-- OHRR — the Counter: a separate staff area for store operations and the
-- BunFest door, built so a volunteer isn't overwhelmed.
--
--   A "Counter volunteer" role (counter.use) that can add items, ring up
--   sales, take tickets at the door and sell raffle tickets — and nothing
--   else: no website editing, no deleting, no voiding.
--
--   Add an item first, code second: photo, name, price, how many — the app
--   gives it an OHRR item number (the SKU). The maker's barcode, or a printed
--   OHRR label, can be added to it afterwards (counter_link_code).
--
--   Sales (counter_sales / counter_sale_lines): each sale is made on the
--   phone with its own id, so a phone that lost signal can send it later
--   without it ever counting twice. A sale lowers the stock. The money still
--   goes through the cash box or the card reader; the sale records which.
--
--   The door (door_tickets / door_entries): the advance tickets (receipt
--   numbers from the ticket shop, with the name and how many adults and
--   children each covers) are downloaded to every door phone before doors
--   open, so a receipt can be checked with no signal. Every check-in and
--   door sale is saved on the phone first and sent when there is signal;
--   door_sync() takes a phone's new entries and hands back everyone's, so a
--   receipt used at one door is soon refused at the others. If two phones
--   were both offline and took the same receipt, both entries are kept and
--   the Door screen lists it as used twice, with the times and phones.
--
--   Door prices are OHRR's published BunFest 2026 admission
--   (midwestbunfest.org/purchase-tickets.html, 2026-09-23): adults $10,
--   ages 5–12 $5, under 5 free. Staff change them in the app.
--
-- Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. The role
-- -------------------------------------------------------------
insert into permissions(key, area, description) values
 ('counter.use', 'Counter', 'The Counter: add items, ring up sales, take tickets at the door, sell raffle tickets')
on conflict (key) do nothing;
insert into permission_presets(preset, permission_key) values
 ('Counter volunteer', 'counter.use')
on conflict do nothing;

-- Who may use the till: counter volunteers and the Hop Shop's own people.
create or replace function counter_can_sell(p_org uuid) returns boolean
language sql stable as $$
  select has_permission(p_org, 'counter.use')
      or has_permission(p_org, 'hopshop.products.create')
      or has_permission(p_org, 'hopshop.inventory.update');
$$;

-- Who may work the door: counter volunteers and BunFest managers.
create or replace function door_can(p_org uuid) returns boolean
language sql stable as $$
  select has_permission(p_org, 'counter.use') or has_permission(p_org, 'events.bunfest.manage');
$$;

-- Counter volunteers may upload an item's photo (as Hop Shop staff already can).
drop policy if exists "item photos counter insert" on storage.objects;
create policy "item photos counter insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'counter.use')
    )
  );

-- -------------------------------------------------------------
-- 2. Items: add first, code second
-- -------------------------------------------------------------

-- Everything the till needs, in one go (the phone keeps a copy for when the
-- signal drops).
create or replace function counter_products(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'price_cents', p.price_cents, 'photo_url', p.photo_url,
           'quantity', coalesce(i.quantity, 0), 'sku', p.sku, 'category', p.category,
           'codes', coalesce((select jsonb_agg(t.code order by t.created_at) from item_tags t where t.product_id = p.id), '[]'::jsonb))
         order by lower(p.name)), '[]'::jsonb)
    from hopshop_products p
    left join hopshop_inventory i on i.product_id = p.id
   where p.org_id = p_org and p.is_active and counter_can_sell(p_org);
$$;
grant execute on function counter_products(uuid) to authenticated;

-- A new item from the phone. p_code is the OHRR item number the app made
-- (OHRR-XXXXX); it becomes the SKU and the item's first code.
create or replace function counter_add_item(
  p_org uuid, p_name text, p_price_cents int, p_quantity int,
  p_photo_url text default null, p_code text default null, p_description text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_code text := normalize_item_code(p_code);
  v_id   uuid;
  v_tag  item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (has_permission(p_org, 'counter.use') or has_permission(p_org, 'hopshop.products.create')) then
    raise exception 'Not allowed';
  end if;
  if v_name is null then raise exception 'Give the item a name'; end if;
  if p_price_cents is null or p_price_cents < 0 then raise exception 'Give the item a price'; end if;
  if v_code is null then raise exception 'The item number is missing'; end if;
  if exists (select 1 from item_tags where org_id = p_org and code = v_code) then
    raise exception 'That number is already on another item — try again';
  end if;

  insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, created_by)
  values (p_org, left(v_name, 120), nullif(btrim(coalesce(p_description, '')), ''), p_price_cents, v_code, p_photo_url, auth.uid())
  returning id into v_id;
  insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
  values (v_id, p_org, greatest(0, coalesce(p_quantity, 1)), auth.uid());
  insert into item_tags (org_id, code, kind, product_id, created_by)
  values (p_org, v_code, 'stock', v_id, auth.uid())
  returning * into v_tag;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'counter.item_added', 'hopshop_product', v_id::text,
          jsonb_build_object('name', v_name, 'code', v_code, 'price_cents', p_price_cents));
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;
grant execute on function counter_add_item(uuid, text, int, int, text, text, text) to authenticated;

-- A second code for an item: the maker's barcode on the packet, or a printed
-- OHRR label. Scanning either opens the same item.
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
  insert into item_tags (org_id, code, kind, product_id, created_by)
  values (p_org, v_code, 'stock', p_product, auth.uid())
  on conflict (org_id, code) do nothing;
  return jsonb_build_object('product_id', p_product, 'code', v_code);
end $$;
grant execute on function counter_link_code(uuid, uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 3. Sales
-- -------------------------------------------------------------
create table if not exists counter_sales (
  id           uuid primary key,              -- made on the phone: a resend never counts twice
  org_id       uuid not null references organizations(id) on delete cascade,
  sold_at      timestamptz not null,          -- the phone's clock, when it happened
  method       text not null check (method in ('cash', 'card', 'other')),
  total_cents  int  not null check (total_cents >= 0),
  device       text,
  note         text,
  sold_by      uuid references auth.users(id),
  received_at  timestamptz not null default now()
);
create index if not exists idx_counter_sales_org on counter_sales(org_id, sold_at desc);

create table if not exists counter_sale_lines (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references counter_sales(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  product_id   uuid references hopshop_products(id) on delete set null,
  name         text not null,
  price_cents  int  not null check (price_cents >= 0),
  qty          int  not null check (qty > 0)
);
create index if not exists idx_counter_lines_sale on counter_sale_lines(sale_id);

alter table counter_sales enable row level security;
alter table counter_sale_lines enable row level security;
drop policy if exists counter_sales_staff_select on counter_sales;
create policy counter_sales_staff_select on counter_sales for select
  using (counter_can_sell(org_id) or has_permission(org_id, 'hopshop.orders.view'));
drop policy if exists counter_lines_staff_select on counter_sale_lines;
create policy counter_lines_staff_select on counter_sale_lines for select
  using (counter_can_sell(org_id) or has_permission(org_id, 'hopshop.orders.view'));
grant select on counter_sales, counter_sale_lines to authenticated;

-- p_sale = {id, sold_at, method, device, note, lines: [{product_id?, name, price_cents, qty}]}
create or replace function record_counter_sale(p_org uuid, p_sale jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := (p_sale ->> 'id')::uuid;
  v_method text := coalesce(p_sale ->> 'method', 'cash');
  v_total  int := 0;
  l        jsonb;
  v_pid    uuid;
  v_qty    int;
  v_short  jsonb := '[]'::jsonb;
  v_left   int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not counter_can_sell(p_org) then raise exception 'Not allowed'; end if;
  if v_id is null then raise exception 'The sale has no id'; end if;
  if exists (select 1 from counter_sales where id = v_id) then
    return jsonb_build_object('id', v_id, 'already', true);
  end if;
  if v_method not in ('cash', 'card', 'other') then raise exception 'Unknown payment method'; end if;
  if jsonb_array_length(coalesce(p_sale -> 'lines', '[]'::jsonb)) = 0 then raise exception 'The sale is empty'; end if;

  for l in select * from jsonb_array_elements(p_sale -> 'lines') loop
    v_qty := greatest(1, coalesce((l ->> 'qty')::int, 1));
    v_total := v_total + greatest(0, coalesce((l ->> 'price_cents')::int, 0)) * v_qty;
  end loop;

  insert into counter_sales (id, org_id, sold_at, method, total_cents, device, note, sold_by)
  values (v_id, p_org, coalesce((p_sale ->> 'sold_at')::timestamptz, now()), v_method, v_total,
          left(p_sale ->> 'device', 40), left(nullif(btrim(coalesce(p_sale ->> 'note', '')), ''), 200), auth.uid());

  for l in select * from jsonb_array_elements(p_sale -> 'lines') loop
    v_pid := nullif(l ->> 'product_id', '')::uuid;
    if v_pid is not null and not exists (select 1 from hopshop_products where id = v_pid and org_id = p_org) then
      v_pid := null;
    end if;
    v_qty := greatest(1, coalesce((l ->> 'qty')::int, 1));
    insert into counter_sale_lines (sale_id, org_id, product_id, name, price_cents, qty)
    values (v_id, p_org, v_pid, left(coalesce(nullif(btrim(l ->> 'name'), ''), 'Item'), 120),
            greatest(0, coalesce((l ->> 'price_cents')::int, 0)), v_qty);
    if v_pid is not null then
      update hopshop_inventory set quantity = greatest(0, quantity - v_qty), updated_by = auth.uid()
       where product_id = v_pid
       returning quantity into v_left;
      if found and v_left = 0 then
        v_short := v_short || jsonb_build_array(l ->> 'name');
      end if;
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'total_cents', v_total, 'now_out', v_short);
end $$;
grant execute on function record_counter_sale(uuid, jsonb) to authenticated;

-- One day at the till, to check against the cash box and the card reader.
create or replace function counter_day(p_org uuid, p_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select * from counter_sales
     where org_id = p_org and (sold_at at time zone 'America/New_York')::date = p_day
  )
  select jsonb_build_object(
    'sales', (select count(*) from s),
    'cash_cents', (select coalesce(sum(total_cents), 0) from s where method = 'cash'),
    'card_cents', (select coalesce(sum(total_cents), 0) from s where method = 'card'),
    'other_cents', (select coalesce(sum(total_cents), 0) from s where method = 'other'),
    'items', coalesce((select jsonb_agg(x order by x.cents desc) from (
                select l.name, sum(l.qty)::int as qty, sum(l.qty * l.price_cents)::int as cents
                  from counter_sale_lines l join s on s.id = l.sale_id
                 group by l.name) x), '[]'::jsonb))
  where counter_can_sell(p_org) or has_permission(p_org, 'hopshop.orders.view');
$$;
grant execute on function counter_day(uuid, date) to authenticated;

-- -------------------------------------------------------------
-- 4. The door
-- -------------------------------------------------------------
create table if not exists door_tickets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  event_key   text not null,                 -- 'bunfest-2026'
  code        text not null,                 -- the receipt number, letters and digits only
  name        text,
  adults      int not null default 0 check (adults >= 0),
  children    int not null default 0 check (children >= 0),
  under5      int not null default 0 check (under5 >= 0),
  source      text not null default 'import',
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (org_id, event_key, code)
);

create table if not exists door_entries (
  id              uuid primary key,          -- made on the phone: a resend never counts twice
  org_id          uuid not null references organizations(id) on delete cascade,
  event_key       text not null,
  kind            text not null check (kind in ('ticket', 'walkup', 'void')),
  ticket_code     text,
  adults          int not null default 0 check (adults >= 0),
  children        int not null default 0 check (children >= 0),
  under5          int not null default 0 check (under5 >= 0),
  method          text check (method in ('cash', 'card', 'free')),
  amount_cents    int not null default 0 check (amount_cents >= 0),
  override_reason text,                      -- let in although the receipt showed as used / not found
  voids           uuid,                      -- kind 'void': the entry it takes back
  device          text,
  at              timestamptz not null,      -- the phone's clock
  recorded_by     uuid references auth.users(id),
  received_at     timestamptz not null default now()
);
create index if not exists idx_door_entries_event on door_entries(org_id, event_key, at);

alter table door_tickets enable row level security;
alter table door_entries enable row level security;
drop policy if exists door_tickets_staff_select on door_tickets;
create policy door_tickets_staff_select on door_tickets for select using (door_can(org_id));
drop policy if exists door_entries_staff_select on door_entries;
create policy door_entries_staff_select on door_entries for select using (door_can(org_id));
grant select on door_tickets, door_entries to authenticated;

-- Everything a door phone keeps: the tickets, and every entry so far.
create or replace function door_pack(p_org uuid, p_event text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tickets', coalesce((select jsonb_agg(jsonb_build_object(
                  'code', t.code, 'name', t.name, 'adults', t.adults, 'children', t.children, 'under5', t.under5)
                  order by t.code)
                from door_tickets t where t.org_id = p_org and t.event_key = p_event), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', e.id, 'kind', e.kind, 'ticket_code', e.ticket_code, 'adults', e.adults,
                  'children', e.children, 'under5', e.under5, 'method', e.method,
                  'amount_cents', e.amount_cents, 'override_reason', e.override_reason,
                  'voids', e.voids, 'device', e.device, 'at', e.at)
                  order by e.at)
                from door_entries e where e.org_id = p_org and e.event_key = p_event), '[]'::jsonb),
    'server_time', now())
  where door_can(p_org);
$$;
grant execute on function door_pack(uuid, text) to authenticated;

-- A phone's new entries in, everyone's out — one round trip.
create or replace function door_sync(p_org uuid, p_event text, p_entries jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not door_can(p_org) then raise exception 'Not allowed'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    if coalesce(e ->> 'kind', '') not in ('ticket', 'walkup', 'void') or nullif(e ->> 'id', '') is null then continue; end if;
    insert into door_entries (id, org_id, event_key, kind, ticket_code, adults, children, under5,
                              method, amount_cents, override_reason, voids, device, at, recorded_by)
    values ((e ->> 'id')::uuid, p_org, p_event, e ->> 'kind',
            nullif(upper(regexp_replace(coalesce(e ->> 'ticket_code', ''), '[^A-Za-z0-9]', '', 'g')), ''),
            greatest(0, coalesce((e ->> 'adults')::int, 0)), greatest(0, coalesce((e ->> 'children')::int, 0)),
            greatest(0, coalesce((e ->> 'under5')::int, 0)),
            case when e ->> 'method' in ('cash', 'card', 'free') then e ->> 'method' end,
            greatest(0, coalesce((e ->> 'amount_cents')::int, 0)),
            left(nullif(btrim(coalesce(e ->> 'override_reason', '')), ''), 200),
            nullif(e ->> 'voids', '')::uuid, left(e ->> 'device', 40),
            coalesce((e ->> 'at')::timestamptz, now()), auth.uid())
    on conflict (id) do nothing;
  end loop;
  return door_pack(p_org, p_event);
end $$;
grant execute on function door_sync(uuid, text, jsonb) to authenticated;

-- Load advance tickets (from the ticket shop's order export, or typed in).
-- p_rows = [{code, name, adults, children, under5}]. A receipt already on the
-- list is updated, never duplicated.
create or replace function door_import(p_org uuid, p_event text, p_rows jsonb, p_source text default 'import')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_code text;
  v_new int := 0;
  v_upd int := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not door_can(p_org) then raise exception 'Not allowed'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_code := nullif(upper(regexp_replace(coalesce(r ->> 'code', ''), '[^A-Za-z0-9]', '', 'g')), '');
    if v_code is null then continue; end if;
    if exists (select 1 from door_tickets where org_id = p_org and event_key = p_event and code = v_code) then
      update door_tickets set
        name = coalesce(nullif(btrim(coalesce(r ->> 'name', '')), ''), name),
        adults = greatest(0, coalesce((r ->> 'adults')::int, adults)),
        children = greatest(0, coalesce((r ->> 'children')::int, children)),
        under5 = greatest(0, coalesce((r ->> 'under5')::int, under5))
      where org_id = p_org and event_key = p_event and code = v_code;
      v_upd := v_upd + 1;
    else
      insert into door_tickets (org_id, event_key, code, name, adults, children, under5, source, created_by)
      values (p_org, p_event, v_code, left(nullif(btrim(coalesce(r ->> 'name', '')), ''), 120),
              greatest(0, coalesce((r ->> 'adults')::int, 0)), greatest(0, coalesce((r ->> 'children')::int, 0)),
              greatest(0, coalesce((r ->> 'under5')::int, 0)), left(coalesce(p_source, 'import'), 20), auth.uid());
      v_new := v_new + 1;
    end if;
  end loop;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'door.import', 'door_tickets', p_event, jsonb_build_object('new', v_new, 'updated', v_upd));
  return jsonb_build_object('new', v_new, 'updated', v_upd);
end $$;
grant execute on function door_import(uuid, text, jsonb, text) to authenticated;

-- Take a receipt off the list (typed wrongly, refunded). BunFest managers only.
create or replace function door_remove_ticket(p_org uuid, p_event text, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  delete from door_tickets
   where org_id = p_org and event_key = p_event
     and code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
end $$;
grant execute on function door_remove_ticket(uuid, text, text) to authenticated;

-- The door's settings: which event, and the prices. Everyone can read them
-- (app_settings is public); BunFest managers change them.
create or replace function save_door_settings(p_org uuid, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  insert into app_settings (org_id, key, value, updated_by)
  values (p_org, 'door', p_value, auth.uid())
  on conflict (org_id, key) do update set value = excluded.value, updated_by = auth.uid();
end $$;
grant execute on function save_door_settings(uuid, jsonb) to authenticated;

insert into app_settings (org_id, key, value)
select id, 'door', jsonb_build_object(
  'event_key', 'bunfest-2026',
  'event_name', 'Midwest BunFest 2026',
  'prices', jsonb_build_object('adult', 1000, 'child', 500, 'under5', 0))
from organizations where name = 'Ohio House Rabbit Rescue'
on conflict (org_id, key) do nothing;

-- -------------------------------------------------------------
-- 5. Raffle tickets at the counter
--
-- Counter volunteers can sell at the table, take payment for reservations and
-- see the desk. Voiding and drawing winners stay with BunFest managers.
-- -------------------------------------------------------------
create or replace function raffle_desk_can(p_org uuid) returns boolean
language sql stable as $$
  select has_permission(p_org, 'events.bunfest.manage') or has_permission(p_org, 'counter.use');
$$;

create or replace function sell_raffle_tickets_at_table(p_org uuid, p_event text, p_qty int, p_name text, p_phone text default null, p_amount_cents int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_first int;
  o raffle_ticket_orders;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not raffle_desk_can(p_org) then raise exception 'Not allowed'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 200 then raise exception 'Choose between 1 and 200 tickets'; end if;
  v_first := raffle_alloc_numbers(p_org, p_event, p_qty);
  insert into raffle_ticket_orders (org_id, event_slug, name, phone, qty, amount_cents, status, source, paid_at, paid_by)
  values (p_org, p_event, left(coalesce(nullif(btrim(p_name), ''), 'Walk-up'), 80),
          nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''), p_qty,
          coalesce(p_amount_cents, raffle_quote_cents(p_org, p_event, p_qty)), 'paid', 'table', now(), auth.uid())
  returning * into o;
  insert into raffle_tickets (org_id, event_slug, order_id, ticket_no)
  select p_org, p_event, o.id, g from generate_series(v_first, v_first + p_qty - 1) g;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'raffle.sold', 'raffle_order', o.id::text, jsonb_build_object('qty', p_qty, 'name', o.name));
  return raffle_order_json(o);
end $$;
grant execute on function sell_raffle_tickets_at_table(uuid, text, int, text, text, int) to authenticated;

create or replace function set_raffle_order_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o raffle_ticket_orders;
begin
  select * into o from raffle_ticket_orders where id = p_id;
  if not found then raise exception 'No such reservation'; end if;
  if p_status not in ('reserved', 'paid', 'void') then raise exception 'Bad status'; end if;
  if p_status = 'void' or o.status = 'void' then
    if not has_permission(o.org_id, 'events.bunfest.manage') then raise exception 'Only a BunFest manager can void tickets'; end if;
  elsif not raffle_desk_can(o.org_id) then
    raise exception 'Not allowed';
  end if;
  update raffle_ticket_orders set
    status = p_status,
    paid_at = case when p_status = 'paid' then now() when p_status = 'reserved' then null else paid_at end,
    paid_by = case when p_status = 'paid' then auth.uid() when p_status = 'reserved' then null else paid_by end
  where id = p_id returning * into o;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (o.org_id, auth.uid(), 'raffle.' || p_status, 'raffle_order', p_id::text, jsonb_build_object('name', o.name, 'qty', o.qty));
  return raffle_order_json(o);
end $$;
grant execute on function set_raffle_order_status(uuid, text) to authenticated;

create or replace function raffle_desk(p_org uuid, p_event text, p_query text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(raffle_order_json(o) order by o.created_at desc), '[]'::jsonb)
  from raffle_ticket_orders o
  where o.org_id = p_org and o.event_slug = p_event
    and raffle_desk_can(p_org)
    and (p_query is null or btrim(p_query) = ''
         or o.name ilike '%' || btrim(p_query) || '%'
         or coalesce(o.phone, '') like '%' || regexp_replace(p_query, '[^0-9+]', '', 'g') || '%'
         or exists (select 1 from raffle_tickets t where t.order_id = o.id
                     and t.ticket_no = nullif(regexp_replace(p_query, '[^0-9]', '', 'g'), '')::int));
$$;
grant execute on function raffle_desk(uuid, text, text) to authenticated;

create or replace function raffle_desk_summary(p_org uuid, p_event text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reserved', (select count(*) from raffle_ticket_orders where org_id = p_org and event_slug = p_event and status = 'reserved'),
    'paid_tickets', (select count(*) from raffle_tickets t join raffle_ticket_orders o on o.id = t.order_id
                      where t.org_id = p_org and t.event_slug = p_event and o.status = 'paid'),
    'paid_cents', (select coalesce(sum(amount_cents), 0) from raffle_ticket_orders where org_id = p_org and event_slug = p_event and status = 'paid'),
    'drawn', (select count(*) from raffle_tickets where org_id = p_org and event_slug = p_event and drawn_at is not null))
  where raffle_desk_can(p_org);
$$;
grant execute on function raffle_desk_summary(uuid, text) to authenticated;
