-- =============================================================
-- OHRR App — Raffle tickets (working version for the test app) + account deletion
--
-- Numbered raffle tickets people reserve in the app and pay for at the raffle
-- table (no card processing — that attaches later). Every ticket has its own
-- number in ONE sequence per event (A-0001, A-0002, …), so a digital ticket can
-- be written on a paper stub for the bucket, or drawn in the app among the
-- tickets that were paid. Staff run the desk on a phone:
--   * see who reserved, mark paid when the cash changes hands, void mistakes
--   * sell tickets at the table (paid straight away — paper buyers can be in
--     the same draw)
--   * draw a winner for a prize (random among paid, undrawn tickets), or enter
--     the number pulled from the physical bucket
--
--   raffle_ticket_orders  one reservation: a person, N tickets, amount due
--   raffle_tickets        one row per ticket number (order_id, prize when won)
--   raffle_counters       next number per event
--
-- Public RPCs: reserve_raffle_tickets, raffle_order_by_token.
-- Staff RPCs (events.bunfest.manage): sell_raffle_tickets_at_table,
--   set_raffle_order_status, draw_raffle_ticket, record_bucket_draw, undo_raffle_draw.
-- Also: delete_own_account() — Apple requires in-app account deletion when an
--   app offers sign-up (staff join via invite code).
--
-- Apply AFTER 20260920100000_item_tags.sql and 20260917170000_app_settings.sql.
-- Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

create table if not exists raffle_ticket_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  event_slug    text not null default 'midwest-bunfest-2026',
  name          text not null,
  phone         text,
  email         text,
  qty           int not null check (qty between 1 and 200),
  amount_cents  int check (amount_cents is null or amount_cents >= 0),
  status        text not null default 'reserved' check (status in ('reserved', 'paid', 'void')),
  source        text not null default 'app' check (source in ('app', 'table')),
  claim_token   uuid not null default gen_random_uuid() unique,
  paid_at       timestamptz,
  paid_by       uuid references auth.users(id),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_raffle_orders_org on raffle_ticket_orders(org_id, event_slug, created_at desc);
create index if not exists idx_raffle_orders_phone on raffle_ticket_orders(org_id, event_slug, phone);

drop trigger if exists trg_raffle_orders_updated on raffle_ticket_orders;
create trigger trg_raffle_orders_updated before update on raffle_ticket_orders
  for each row execute function set_updated_at();

create table if not exists raffle_tickets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  event_slug  text not null,
  order_id    uuid not null references raffle_ticket_orders(id) on delete cascade,
  ticket_no   int not null,
  prize_id    uuid references raffle_prizes(id) on delete set null,
  drawn_at    timestamptz,
  drawn_by    uuid references auth.users(id),
  unique (org_id, event_slug, ticket_no)
);
create index if not exists idx_raffle_tickets_order on raffle_tickets(order_id);

create table if not exists raffle_counters (
  org_id     uuid not null references organizations(id) on delete cascade,
  event_slug text not null,
  next_no    int not null default 1,
  primary key (org_id, event_slug)
);

alter table raffle_ticket_orders enable row level security;
alter table raffle_tickets enable row level security;
alter table raffle_counters enable row level security;

-- Staff read everything for the desk; the public only ever goes through the
-- functions below (a claim token is the "password" for one order).
drop policy if exists raffle_orders_staff_select on raffle_ticket_orders;
create policy raffle_orders_staff_select on raffle_ticket_orders for select
  using (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists raffle_tickets_staff_select on raffle_tickets;
create policy raffle_tickets_staff_select on raffle_tickets for select
  using (has_permission(org_id, 'events.bunfest.manage'));
grant select on raffle_ticket_orders, raffle_tickets to authenticated;

-- -------------------------------------------------------------
-- Pricing: the same rule the app shows — whole bundles first, then singles.
-- NULL when no single-ticket price is set (then nothing is quoted).
-- -------------------------------------------------------------
create or replace function raffle_quote_cents(p_org uuid, p_event text, p_qty int)
returns int language sql stable security definer set search_path = public as $$
  select case
    when s.raffle_ticket_price_cents is null then null
    when s.raffle_bundle_qty is not null and s.raffle_bundle_qty >= 2 and s.raffle_bundle_price_cents is not null
      then least(
        (p_qty / s.raffle_bundle_qty) * s.raffle_bundle_price_cents + (p_qty % s.raffle_bundle_qty) * s.raffle_ticket_price_cents,
        p_qty * s.raffle_ticket_price_cents)
    else p_qty * s.raffle_ticket_price_cents end
  from auction_settings s
  where s.org_id = p_org and s.event_slug = p_event;
$$;

-- Allocate p_qty consecutive numbers for an event (row-locked counter).
create or replace function raffle_alloc_numbers(p_org uuid, p_event text, p_qty int)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_first int;
begin
  insert into raffle_counters (org_id, event_slug) values (p_org, p_event) on conflict do nothing;
  select next_no into v_first from raffle_counters where org_id = p_org and event_slug = p_event for update;
  update raffle_counters set next_no = v_first + p_qty where org_id = p_org and event_slug = p_event;
  return v_first;
end $$;

create or replace function raffle_order_json(p_order raffle_ticket_orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p_order.id,
    'claim_token', p_order.claim_token,
    'event_slug', p_order.event_slug,
    'name', p_order.name,
    'phone', p_order.phone,
    'email', p_order.email,
    'qty', p_order.qty,
    'amount_cents', p_order.amount_cents,
    'status', p_order.status,
    'source', p_order.source,
    'paid_at', p_order.paid_at,
    'created_at', p_order.created_at,
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'no', t.ticket_no, 'prize', p.title, 'drawn_at', t.drawn_at) order by t.ticket_no)
      from raffle_tickets t left join raffle_prizes p on p.id = t.prize_id
      where t.order_id = p_order.id), '[]'::jsonb)
  );
$$;

-- -------------------------------------------------------------
-- Public: reserve tickets (pay at the table). 12 orders / phone / hour.
-- -------------------------------------------------------------
create or replace function reserve_raffle_tickets(p_event text, p_qty int, p_name text, p_phone text, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  v_first int;
  o raffle_ticket_orders;
begin
  if p_qty is null or p_qty < 1 or p_qty > 60 then raise exception 'Choose between 1 and 60 tickets'; end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Please give your name'; end if;
  if v_phone is null or length(v_phone) < 7 then raise exception 'Please give a phone number we can reach you on'; end if;
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if v_org is null then raise exception 'No organization'; end if;
  if (select count(*) from raffle_ticket_orders
       where org_id = v_org and event_slug = p_event and phone = v_phone and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'Too many reservations from this phone — please see the raffle table.';
  end if;

  v_first := raffle_alloc_numbers(v_org, p_event, p_qty);
  insert into raffle_ticket_orders (org_id, event_slug, name, phone, email, qty, amount_cents, status, source)
  values (v_org, p_event, left(btrim(p_name), 80), v_phone, nullif(lower(btrim(coalesce(p_email, ''))), ''), p_qty,
          raffle_quote_cents(v_org, p_event, p_qty), 'reserved', 'app')
  returning * into o;
  insert into raffle_tickets (org_id, event_slug, order_id, ticket_no)
  select v_org, p_event, o.id, g from generate_series(v_first, v_first + p_qty - 1) g;
  return raffle_order_json(o);
end $$;
grant execute on function reserve_raffle_tickets(text, int, text, text, text) to anon, authenticated;

-- Public: one order by its claim token (the ticket page / QR at the table).
create or replace function raffle_order_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o raffle_ticket_orders;
begin
  select * into o from raffle_ticket_orders where claim_token = p_token;
  if not found then return null; end if;
  return raffle_order_json(o);
end $$;
grant execute on function raffle_order_by_token(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- Staff desk
-- -------------------------------------------------------------

-- Sold at the table (cash in hand): allocated AND paid in one go, so paper
-- buyers are in the same draw as app buyers.
create or replace function sell_raffle_tickets_at_table(p_org uuid, p_event text, p_qty int, p_name text, p_phone text default null, p_amount_cents int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_first int;
  o raffle_ticket_orders;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
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

-- Mark paid (cash taken at the table), back to reserved, or void.
create or replace function set_raffle_order_status(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o raffle_ticket_orders;
begin
  select * into o from raffle_ticket_orders where id = p_id;
  if not found then raise exception 'No such reservation'; end if;
  if not has_permission(o.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if p_status not in ('reserved', 'paid', 'void') then raise exception 'Bad status'; end if;
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

create or replace function raffle_winner_json(p_ticket raffle_tickets)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ticket_id', p_ticket.id, 'no', p_ticket.ticket_no, 'drawn_at', p_ticket.drawn_at,
    'order_id', o.id, 'name', o.name, 'phone', o.phone, 'source', o.source,
    'prize_id', p_ticket.prize_id, 'prize', p.title)
  from raffle_ticket_orders o
  left join raffle_prizes p on p.id = p_ticket.prize_id
  where o.id = p_ticket.order_id;
$$;

-- Draw in the app: a random ticket among PAID, not-yet-drawn tickets.
create or replace function draw_raffle_ticket(p_org uuid, p_event text, p_prize_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_t raffle_tickets;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  select rt.* into v_t from raffle_tickets rt
    join raffle_ticket_orders o on o.id = rt.order_id
   where rt.org_id = p_org and rt.event_slug = p_event and rt.drawn_at is null and o.status = 'paid'
   order by random() limit 1;
  if not found then raise exception 'No paid tickets left to draw from'; end if;
  update raffle_tickets set drawn_at = now(), drawn_by = auth.uid(), prize_id = p_prize_id where id = v_t.id returning * into v_t;
  if p_prize_id is not null then update raffle_prizes set status = 'drawn' where id = p_prize_id; end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'raffle.drawn', 'raffle_ticket', v_t.id::text, jsonb_build_object('no', v_t.ticket_no, 'prize_id', p_prize_id));
  return raffle_winner_json(v_t);
end $$;
grant execute on function draw_raffle_ticket(uuid, text, uuid) to authenticated;

-- The number pulled from the physical bucket: if it is an app ticket, record
-- the win; if not (a paper-roll number), say so.
create or replace function record_bucket_draw(p_org uuid, p_event text, p_ticket_no int, p_prize_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t raffle_tickets;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  select * into t from raffle_tickets where org_id = p_org and event_slug = p_event and ticket_no = p_ticket_no;
  if not found then return jsonb_build_object('found', false, 'no', p_ticket_no); end if;
  if t.drawn_at is not null then raise exception 'Ticket A-% was already drawn', lpad(p_ticket_no::text, 4, '0'); end if;
  update raffle_tickets set drawn_at = now(), drawn_by = auth.uid(), prize_id = p_prize_id where id = t.id returning * into t;
  if p_prize_id is not null then update raffle_prizes set status = 'drawn' where id = p_prize_id; end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'raffle.bucket', 'raffle_ticket', t.id::text, jsonb_build_object('no', t.ticket_no, 'prize_id', p_prize_id));
  return raffle_winner_json(t) || jsonb_build_object('found', true);
end $$;
grant execute on function record_bucket_draw(uuid, text, int, uuid) to authenticated;

create or replace function undo_raffle_draw(p_ticket_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t raffle_tickets;
begin
  select * into t from raffle_tickets where id = p_ticket_id;
  if not found then raise exception 'No such ticket'; end if;
  if not has_permission(t.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if t.prize_id is not null then update raffle_prizes set status = 'available' where id = t.prize_id; end if;
  update raffle_tickets set drawn_at = null, drawn_by = null, prize_id = null where id = p_ticket_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'raffle.undraw', 'raffle_ticket', p_ticket_id::text, jsonb_build_object('no', t.ticket_no));
end $$;
grant execute on function undo_raffle_draw(uuid) to authenticated;

-- The desk list: orders with their ticket numbers, newest first, optional search.
create or replace function raffle_desk(p_org uuid, p_event text, p_query text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(raffle_order_json(o) order by o.created_at desc), '[]'::jsonb)
  from raffle_ticket_orders o
  where o.org_id = p_org and o.event_slug = p_event
    and has_permission(p_org, 'events.bunfest.manage')
    and (p_query is null or btrim(p_query) = ''
         or o.name ilike '%' || btrim(p_query) || '%'
         or coalesce(o.phone, '') like '%' || regexp_replace(p_query, '[^0-9+]', '', 'g') || '%'
         or exists (select 1 from raffle_tickets t where t.order_id = o.id
                     and t.ticket_no = nullif(regexp_replace(p_query, '[^0-9]', '', 'g'), '')::int));
$$;
grant execute on function raffle_desk(uuid, text, text) to authenticated;

-- Winners so far (for the Draw tab and the public prize list).
create or replace function raffle_winners(p_org uuid, p_event text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(raffle_winner_json(t) order by t.drawn_at desc), '[]'::jsonb)
  from raffle_tickets t
  where t.org_id = p_org and t.event_slug = p_event and t.drawn_at is not null
    and has_permission(p_org, 'events.bunfest.manage');
$$;
grant execute on function raffle_winners(uuid, text) to authenticated;

-- Counts for the desk header.
create or replace function raffle_desk_summary(p_org uuid, p_event text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reserved', (select count(*) from raffle_ticket_orders where org_id = p_org and event_slug = p_event and status = 'reserved'),
    'paid_tickets', (select count(*) from raffle_tickets t join raffle_ticket_orders o on o.id = t.order_id
                      where t.org_id = p_org and t.event_slug = p_event and o.status = 'paid'),
    'paid_cents', (select coalesce(sum(amount_cents), 0) from raffle_ticket_orders where org_id = p_org and event_slug = p_event and status = 'paid'),
    'drawn', (select count(*) from raffle_tickets where org_id = p_org and event_slug = p_event and drawn_at is not null))
  where has_permission(p_org, 'events.bunfest.manage');
$$;
grant execute on function raffle_desk_summary(uuid, text) to authenticated;

-- Switch the reservation form ON for the test build (staff can turn it off in
-- Settings → Test features).
insert into app_settings (org_id, key, value)
select id, 'raffle_tickets_enabled', '{"enabled": true}'::jsonb from organizations
on conflict (org_id, key) do nothing;

-- =============================================================
-- Delete my own staff account (App Store rule 5.1.1(v)). Refuses when the
-- person is the only active owner of an organisation — hand over first.
-- =============================================================
create or replace function delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if exists (
    select 1 from memberships m
     where m.user_id = v_uid and m.role = 'owner' and m.status = 'active'
       and not exists (select 1 from memberships o
                        where o.org_id = m.org_id and o.user_id <> v_uid and o.role = 'owner' and o.status = 'active')
  ) then
    raise exception 'You are the only owner — make someone else an owner first.';
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  select m.org_id, null, 'account.deleted', 'user', v_uid::text, '{}'::jsonb from memberships m where m.user_id = v_uid;
  -- Every public table that points at auth.users: the person's own rows go
  -- (NOT NULL columns such as memberships.user_id), references on shared
  -- content (created_by, updated_by, paid_by, …) are cleared so the content
  -- stays. Then the auth row itself; Supabase cascades sessions/identities.
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as notnull
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
  loop
    if r.notnull then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_uid;
    else
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v_uid;
    end if;
  end loop;
  delete from auth.users where id = v_uid;
end $$;
grant execute on function delete_own_account() to authenticated;
