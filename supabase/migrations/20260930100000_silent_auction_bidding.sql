-- =============================================================
-- Update 35 (2026-09-30): Silent auction — online bidding, Buy Now, cards on
-- file, pickup or shipping.
--
-- The catalog stays in `raffle_items` (the app, website and BunFest site all
-- read it). This adds:
--   auction_settings   + bidding switch, opening time, "going once" extension,
--                        default bid step, Stripe publishable key, notes
--   raffle_items       + starting bid, bid step, Buy Now price, shipping fee
--                        (null = pickup only), current bid, bid count, the high
--                        bidder, a close-time extension, how it was won
--   auction_bidders    people who registered to bid: name, contact, pickup or
--                        shipping, a private link (access_token) and the card
--                        Stripe holds for them (ids only — never card numbers)
--   auction_bids       every bid, with the ones that were outbid marked
--   auction_sales      one active sale per item: who won, what they owe
--                        (hammer + shipping), payment state, pickup/shipping state
--
-- Who does what:
--   Visitors (anon) read the catalog through auction_catalog(), register through
--     the payment server (the website's /api/auction/*), bid through place_bid()
--     with their private token, and see their bids and wins through
--     auction_bidder_by_token().
--   The payment server (service_role) creates bidders, stores the card ids,
--     starts and finalizes sales, and answers Stripe's confirmations.
--   Staff with events.bunfest.manage set prices, run the desk (close and charge,
--     paper-bidder sales, pickup, shipping, refunds) and see every bidder.
--
-- No card number ever touches the database: Stripe keeps the card and gives us
-- a customer id and a payment-method id.
--
-- Apply AFTER 20260921170000_raffle_tickets.sql. Paste + Run in the Supabase SQL
-- editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Settings for the event's auction
-- -------------------------------------------------------------
alter table auction_settings add column if not exists bidding_enabled boolean not null default false;
alter table auction_settings add column if not exists bidding_opens_at timestamptz;
alter table auction_settings add column if not exists extend_minutes int not null default 5
  check (extend_minutes between 0 and 60);
alter table auction_settings add column if not exists default_increment_cents int not null default 500
  check (default_increment_cents > 0);
alter table auction_settings add column if not exists stripe_publishable_key text;
alter table auction_settings add column if not exists bidding_note text;
alter table auction_settings add column if not exists pickup_note text;
alter table auction_settings add column if not exists shipping_note text;

comment on column auction_settings.bidding_enabled is 'Online bidding and Buy Now are on. Off = the catalog is a preview only.';
comment on column auction_settings.bidding_opens_at is 'Bidding starts at this time (null = as soon as it is switched on).';
comment on column auction_settings.extend_minutes is '"Going once": a bid in the last N minutes pushes that item''s close N minutes out. 0 = off.';
comment on column auction_settings.default_increment_cents is 'Minimum step between bids when an item has none of its own.';
comment on column auction_settings.stripe_publishable_key is 'Stripe PUBLISHABLE key (pk_live_… / pk_test_…). Safe to be public. The secret key lives only on the payment server.';

-- -------------------------------------------------------------
-- 2. Items: prices, the running bid, the close
-- -------------------------------------------------------------
alter table raffle_items add column if not exists starting_bid_cents int
  check (starting_bid_cents is null or starting_bid_cents >= 0);
alter table raffle_items add column if not exists min_increment_cents int
  check (min_increment_cents is null or min_increment_cents > 0);
alter table raffle_items add column if not exists buy_now_cents int
  check (buy_now_cents is null or buy_now_cents > 0);
alter table raffle_items add column if not exists ship_fee_cents int
  check (ship_fee_cents is null or ship_fee_cents >= 0);
alter table raffle_items add column if not exists closes_at_override timestamptz;
alter table raffle_items add column if not exists current_bid_cents int;
alter table raffle_items add column if not exists bid_count int not null default 0;
alter table raffle_items add column if not exists high_bidder_id uuid;
alter table raffle_items add column if not exists high_bidder_no int;
alter table raffle_items add column if not exists won_kind text
  check (won_kind is null or won_kind in ('bid', 'buy_now', 'desk'));

comment on column raffle_items.ship_fee_cents is 'Flat shipping fee for this item. Null = pickup only.';
comment on column raffle_items.closes_at_override is 'Set by "going once" extensions (or staff); wins over the session close time.';
comment on column raffle_items.high_bidder_no is 'The public "Bidder #N" of the current high bidder.';

-- -------------------------------------------------------------
-- 3. Bidders
-- -------------------------------------------------------------
create sequence if not exists auction_bidder_no_seq;

create table if not exists auction_bidders (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references organizations(id) on delete cascade,
  event_slug                text not null default 'midwest-bunfest-2026',
  bidder_no                 int not null default nextval('auction_bidder_no_seq'),
  name                      text not null,
  email                     text not null,
  phone                     text,
  fulfil                    text not null default 'pickup' check (fulfil in ('pickup', 'ship')),
  address                   jsonb,
  access_token              uuid not null default gen_random_uuid() unique,
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  card_brand                text,
  card_last4                text,
  card_ready                boolean not null default false,
  is_blocked                boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_auction_bidders_org on auction_bidders(org_id, event_slug, created_at desc);
create index if not exists idx_auction_bidders_email on auction_bidders(org_id, event_slug, lower(email));

drop trigger if exists trg_auction_bidders_updated on auction_bidders;
create trigger trg_auction_bidders_updated before update on auction_bidders
  for each row execute function set_updated_at();

alter table raffle_items drop constraint if exists raffle_items_high_bidder_fk;
alter table raffle_items add constraint raffle_items_high_bidder_fk
  foreign key (high_bidder_id) references auction_bidders(id) on delete set null;

-- -------------------------------------------------------------
-- 4. Bids
-- -------------------------------------------------------------
create table if not exists auction_bids (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  event_slug    text not null,
  item_id       uuid not null references raffle_items(id) on delete cascade,
  bidder_id     uuid references auction_bidders(id) on delete set null,
  amount_cents  int not null check (amount_cents > 0),
  kind          text not null default 'bid' check (kind in ('bid', 'buy_now', 'desk')),
  outbid_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_auction_bids_item on auction_bids(item_id, amount_cents desc, created_at);
create index if not exists idx_auction_bids_bidder on auction_bids(bidder_id, created_at desc);

-- -------------------------------------------------------------
-- 5. Sales (one active sale per item)
-- -------------------------------------------------------------
create table if not exists auction_sales (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references organizations(id) on delete cascade,
  event_slug                text not null,
  item_id                   uuid not null references raffle_items(id) on delete cascade,
  bidder_id                 uuid references auction_bidders(id) on delete set null,
  buyer_name                text,
  buyer_phone               text,
  buyer_email               text,
  kind                      text not null check (kind in ('bid', 'buy_now', 'desk')),
  amount_cents              int not null check (amount_cents >= 0),
  ship_fee_cents            int not null default 0 check (ship_fee_cents >= 0),
  fulfil                    text not null default 'pickup' check (fulfil in ('pickup', 'ship')),
  ship_address              jsonb,
  payment_status            text not null default 'pending'
                            check (payment_status in ('pending', 'paid', 'failed', 'cash', 'refunded', 'void')),
  stripe_payment_intent_id  text,
  failure_message           text,
  paid_at                   timestamptz,
  fulfil_status             text not null default 'pending'
                            check (fulfil_status in ('pending', 'picked_up', 'shipped')),
  tracking                  text,
  shipped_at                timestamptz,
  fulfilled_by              uuid references auth.users(id),
  note                      text,
  created_by                uuid references auth.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_auction_sales_org on auction_sales(org_id, event_slug, created_at desc);
create index if not exists idx_auction_sales_pi on auction_sales(stripe_payment_intent_id);
-- one live sale per item; voided ones stay for the record
create unique index if not exists idx_auction_sales_item_active on auction_sales(item_id)
  where payment_status <> 'void';

drop trigger if exists trg_auction_sales_updated on auction_sales;
create trigger trg_auction_sales_updated before update on auction_sales
  for each row execute function set_updated_at();

-- -------------------------------------------------------------
-- 6. Row security: staff read; everyone else goes through the functions
-- -------------------------------------------------------------
alter table auction_bidders enable row level security;
alter table auction_bids enable row level security;
alter table auction_sales enable row level security;

drop policy if exists auction_bidders_staff_select on auction_bidders;
create policy auction_bidders_staff_select on auction_bidders for select
  using (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists auction_bids_staff_select on auction_bids;
create policy auction_bids_staff_select on auction_bids for select
  using (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists auction_sales_staff_select on auction_sales;
create policy auction_sales_staff_select on auction_sales for select
  using (has_permission(org_id, 'events.bunfest.manage'));

grant select on auction_bidders, auction_bids, auction_sales to authenticated;

-- -------------------------------------------------------------
-- 7. Helpers
-- -------------------------------------------------------------

-- When this item stops taking bids: its own extension, else the session's close.
create or replace function auction_effective_close(p_item raffle_items)
returns timestamptz language sql stable set search_path = public as $$
  select coalesce(
    p_item.closes_at_override,
    (select case p_item.session when 'morning' then s.morning_closes_at else s.afternoon_closes_at end
       from auction_settings s where s.org_id = p_item.org_id and s.event_slug = p_item.event_slug));
$$;

create or replace function auction_increment_cents(p_item raffle_items, p_settings auction_settings)
returns int language sql immutable as $$
  select coalesce(p_item.min_increment_cents, p_settings.default_increment_cents, 500);
$$;

-- The smallest bid that beats the current one.
create or replace function auction_next_min_cents(p_item raffle_items, p_settings auction_settings)
returns int language sql immutable as $$
  select case
    when p_item.current_bid_cents is null then coalesce(p_item.starting_bid_cents, auction_increment_cents(p_item, p_settings))
    else p_item.current_bid_cents + auction_increment_cents(p_item, p_settings)
  end;
$$;

-- Is this item taking bids right now?
create or replace function auction_is_open(p_item raffle_items, p_settings auction_settings)
returns boolean language sql stable set search_path = public as $$
  select p_settings is not null
     and p_settings.bidding_enabled
     and p_item.is_published
     and p_item.status = 'available'
     and (p_settings.bidding_opens_at is null or now() >= p_settings.bidding_opens_at)
     and (auction_effective_close(p_item) is null or now() < auction_effective_close(p_item));
$$;

-- What the public sees of one item (no names, no card details).
create or replace function auction_item_json(p_item raffle_items, p_settings auction_settings)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', p_item.id,
    'title', p_item.title,
    'description', p_item.description,
    'donated_by', p_item.donated_by,
    'value_cents', p_item.value_cents,
    'photo_url', p_item.photo_url,
    'session', p_item.session,
    'status', p_item.status,
    'won_kind', p_item.won_kind,
    'sort_order', p_item.sort_order,
    'starting_bid_cents', p_item.starting_bid_cents,
    'increment_cents', auction_increment_cents(p_item, p_settings),
    'buy_now_cents', p_item.buy_now_cents,
    'ship_fee_cents', p_item.ship_fee_cents,
    'current_bid_cents', p_item.current_bid_cents,
    'next_min_cents', auction_next_min_cents(p_item, p_settings),
    'bid_count', p_item.bid_count,
    'high_bidder_no', p_item.high_bidder_no,
    'closes_at', auction_effective_close(p_item),
    'is_open', auction_is_open(p_item, p_settings)
  );
$$;

create or replace function auction_settings_json(p_settings auction_settings)
returns jsonb language sql immutable as $$
  select case when p_settings is null then null else jsonb_build_object(
    'bidding_enabled', p_settings.bidding_enabled,
    'bidding_opens_at', p_settings.bidding_opens_at,
    'morning_closes_at', p_settings.morning_closes_at,
    'afternoon_closes_at', p_settings.afternoon_closes_at,
    'extend_minutes', p_settings.extend_minutes,
    'default_increment_cents', p_settings.default_increment_cents,
    'stripe_publishable_key', p_settings.stripe_publishable_key,
    'intro_text', p_settings.intro_text,
    'bidding_note', p_settings.bidding_note,
    'pickup_note', p_settings.pickup_note,
    'shipping_note', p_settings.shipping_note
  ) end;
$$;

-- Bring an item's running bid back in line with its bids (after a voided sale).
create or replace function auction_recompute_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  top auction_bids;
begin
  select b.* into top from auction_bids b
   where b.item_id = p_item_id and b.kind = 'bid' and b.bidder_id is not null
   order by b.amount_cents desc, b.created_at asc limit 1;
  update auction_bids set outbid_at = coalesce(outbid_at, now())
   where item_id = p_item_id and outbid_at is null and (top.id is null or id <> top.id);
  if top.id is not null then
    update auction_bids set outbid_at = null where id = top.id;
  end if;
  update raffle_items r set
    current_bid_cents = top.amount_cents,
    high_bidder_id = top.bidder_id,
    high_bidder_no = (select bidder_no from auction_bidders where id = top.bidder_id),
    bid_count = (select count(*) from auction_bids where item_id = p_item_id and kind = 'bid')
  where r.id = p_item_id;
end $$;

-- -------------------------------------------------------------
-- 8. Public: the catalog
-- -------------------------------------------------------------
create or replace function auction_catalog(p_event text default 'midwest-bunfest-2026')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid;
  s auction_settings;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  select * into s from auction_settings where org_id = v_org and event_slug = p_event;
  return jsonb_build_object(
    'now', now(),
    'settings', auction_settings_json(s),
    'items', coalesce((
      select jsonb_agg(auction_item_json(r, s) order by r.session, r.sort_order, r.created_at)
        from raffle_items r where r.org_id = v_org and r.event_slug = p_event and r.is_published), '[]'::jsonb)
  );
end $$;
grant execute on function auction_catalog(text) to anon, authenticated;

-- A printed OHRR tag on the table: scan it, land on the item, bid.
create or replace function auction_item_by_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
  r raffle_items;
  s auction_settings;
begin
  select * into t from item_tags where code = normalize_item_code(p_code) and kind = 'auction' limit 1;
  if not found then return null; end if;
  select * into r from raffle_items where id = t.raffle_item_id and is_published;
  if not found then return null; end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  return auction_item_json(r, s);
end $$;
grant execute on function auction_item_by_code(text) to anon, authenticated;

-- Bid history for one item: amounts and bidder numbers only.
create or replace function auction_item_bids(p_item_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'amount_cents', b.amount_cents, 'kind', b.kind, 'at', b.created_at,
      'bidder_no', d.bidder_no, 'is_high', b.outbid_at is null)
      order by b.created_at desc), '[]'::jsonb)
    from auction_bids b
    left join auction_bidders d on d.id = b.bidder_id
    join raffle_items r on r.id = b.item_id
   where b.item_id = p_item_id and r.is_published;
$$;
grant execute on function auction_item_bids(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- 9. Bidders: register (payment server), see and update (private link)
-- -------------------------------------------------------------
create or replace function auction_bidder_json(p_b auction_bidders)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', p_b.id, 'bidder_no', p_b.bidder_no, 'event_slug', p_b.event_slug,
    'name', p_b.name, 'email', p_b.email, 'phone', p_b.phone,
    'fulfil', p_b.fulfil, 'address', p_b.address,
    'card_ready', p_b.card_ready, 'card_brand', p_b.card_brand, 'card_last4', p_b.card_last4,
    'is_blocked', p_b.is_blocked, 'access_token', p_b.access_token, 'created_at', p_b.created_at
  );
$$;

-- Payment server only: make a bidder record before the card is saved.
create or replace function auction_register_bidder(p_event text, p_name text, p_email text, p_phone text,
                                                   p_fulfil text, p_address jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  b auction_bidders;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Please give your name'; end if;
  if v_email is null or position('@' in v_email) = 0 then raise exception 'Please give an email address'; end if;
  if p_fulfil not in ('pickup', 'ship') then raise exception 'Choose pickup or shipping'; end if;
  if p_fulfil = 'ship' and (p_address is null or nullif(btrim(coalesce(p_address->>'line1', '')), '') is null
                            or nullif(btrim(coalesce(p_address->>'zip', '')), '') is null) then
    raise exception 'Please give a shipping address';
  end if;
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if v_org is null then raise exception 'No organization'; end if;
  insert into auction_bidders (org_id, event_slug, name, email, phone, fulfil, address)
  values (v_org, p_event, left(btrim(p_name), 80), v_email,
          nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''),
          p_fulfil, case when p_fulfil = 'ship' then p_address end)
  returning * into b;
  return auction_bidder_json(b);
end $$;
revoke all on function auction_register_bidder(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function auction_register_bidder(text, text, text, text, text, jsonb) to service_role;

-- Payment server only: the card Stripe now holds for this bidder.
create or replace function auction_set_card(p_bidder_id uuid, p_customer text, p_payment_method text,
                                            p_brand text, p_last4 text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b auction_bidders;
begin
  update auction_bidders set
    stripe_customer_id = coalesce(p_customer, stripe_customer_id),
    stripe_payment_method_id = coalesce(p_payment_method, stripe_payment_method_id),
    card_brand = coalesce(p_brand, card_brand), card_last4 = coalesce(p_last4, card_last4),
    card_ready = (coalesce(p_payment_method, stripe_payment_method_id) is not null)
  where id = p_bidder_id returning * into b;
  if not found then raise exception 'Bidder not found'; end if;
  return auction_bidder_json(b);
end $$;
revoke all on function auction_set_card(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function auction_set_card(uuid, text, text, text, text) to service_role;

-- Payment server only: a bidder with the ids the server needs, by id or by token.
create or replace function auction_bidder_secure(p_bidder_id uuid default null, p_token uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select auction_bidder_json(b) || jsonb_build_object(
           'stripe_customer_id', b.stripe_customer_id,
           'stripe_payment_method_id', b.stripe_payment_method_id)
    from auction_bidders b
   where (p_bidder_id is not null and b.id = p_bidder_id) or (p_token is not null and b.access_token = p_token)
   limit 1;
$$;
revoke all on function auction_bidder_secure(uuid, uuid) from public, anon, authenticated;
grant execute on function auction_bidder_secure(uuid, uuid) to service_role;

-- Private link: the bidder's own page — their details, bids and wins.
create or replace function auction_bidder_by_token(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  b auction_bidders;
  s auction_settings;
begin
  select * into b from auction_bidders where access_token = p_token;
  if not found then return null; end if;
  select * into s from auction_settings where org_id = b.org_id and event_slug = b.event_slug;
  return jsonb_build_object(
    'bidder', auction_bidder_json(b),
    'now', now(),
    'settings', auction_settings_json(s),
    'bids', coalesce((
      select jsonb_agg(jsonb_build_object(
          'bid_id', x.id, 'amount_cents', x.amount_cents, 'kind', x.kind, 'at', x.created_at,
          'is_high', x.outbid_at is null, 'item', auction_item_json(r, s))
        order by x.created_at desc)
        from auction_bids x join raffle_items r on r.id = x.item_id
       where x.bidder_id = b.id), '[]'::jsonb),
    'won', coalesce((
      select jsonb_agg(jsonb_build_object(
          'sale_id', sa.id, 'kind', sa.kind, 'amount_cents', sa.amount_cents,
          'ship_fee_cents', sa.ship_fee_cents, 'total_cents', sa.amount_cents + sa.ship_fee_cents,
          'fulfil', sa.fulfil, 'payment_status', sa.payment_status, 'failure_message', sa.failure_message,
          'paid_at', sa.paid_at, 'fulfil_status', sa.fulfil_status, 'tracking', sa.tracking,
          'shipped_at', sa.shipped_at, 'created_at', sa.created_at, 'item', auction_item_json(r, s))
        order by sa.created_at desc)
        from auction_sales sa join raffle_items r on r.id = sa.item_id
       where sa.bidder_id = b.id and sa.payment_status <> 'void'), '[]'::jsonb)
  );
end $$;
grant execute on function auction_bidder_by_token(uuid) to anon, authenticated;

-- Private link: change name, phone, pickup/shipping (not the card).
create or replace function auction_update_bidder(p_token uuid, p_name text, p_phone text, p_fulfil text, p_address jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b auction_bidders;
begin
  if p_fulfil not in ('pickup', 'ship') then raise exception 'Choose pickup or shipping'; end if;
  if p_fulfil = 'ship' and (p_address is null or nullif(btrim(coalesce(p_address->>'line1', '')), '') is null
                            or nullif(btrim(coalesce(p_address->>'zip', '')), '') is null) then
    raise exception 'Please give a shipping address';
  end if;
  update auction_bidders set
    name = coalesce(nullif(left(btrim(p_name), 80), ''), name),
    phone = nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''),
    fulfil = p_fulfil,
    address = case when p_fulfil = 'ship' then p_address else address end
  where access_token = p_token returning * into b;
  if not found then raise exception 'We could not find your bidder registration.'; end if;
  return auction_bidder_json(b);
end $$;
grant execute on function auction_update_bidder(uuid, text, text, text, jsonb) to anon, authenticated;

-- -------------------------------------------------------------
-- 10. Public: place a bid
-- -------------------------------------------------------------
create or replace function place_bid(p_token uuid, p_item_id uuid, p_amount_cents int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b auction_bidders;
  r raffle_items;
  s auction_settings;
  v_close timestamptz;
  v_min int;
  v_now timestamptz := now();
  new_bid auction_bids;
begin
  select * into b from auction_bidders where access_token = p_token;
  if not found then raise exception 'We could not find your bidder registration. Please register again.'; end if;
  if b.is_blocked then raise exception 'Bidding is not available for this registration. Please see the auction desk.'; end if;
  if not b.card_ready then raise exception 'Please add a card before bidding.'; end if;

  select * into r from raffle_items where id = p_item_id for update;
  if not found or not r.is_published then raise exception 'That item is not in the auction.'; end if;
  if r.event_slug <> b.event_slug then raise exception 'This registration is for a different event.'; end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  if s is null or not s.bidding_enabled then raise exception 'Online bidding is not open yet.'; end if;
  if s.bidding_opens_at is not null and v_now < s.bidding_opens_at then raise exception 'Bidding has not opened yet.'; end if;
  if r.status <> 'available' then raise exception 'This item has been sold.'; end if;
  v_close := auction_effective_close(r);
  if v_close is not null and v_now >= v_close then raise exception 'Bidding on this item has closed.'; end if;

  v_min := auction_next_min_cents(r, s);
  if p_amount_cents is null or p_amount_cents < v_min then
    raise exception 'The next bid is at least $%', to_char(v_min / 100.0, 'FM999,999,990.00');
  end if;
  if r.buy_now_cents is not null and p_amount_cents >= r.buy_now_cents then
    raise exception 'That is the Buy Now price or more — use Buy Now instead.';
  end if;
  if p_amount_cents > 10000000 then raise exception 'That bid is too large.'; end if;

  insert into auction_bids (org_id, event_slug, item_id, bidder_id, amount_cents, kind)
  values (r.org_id, r.event_slug, r.id, b.id, p_amount_cents, 'bid') returning * into new_bid;
  update auction_bids set outbid_at = v_now where item_id = r.id and outbid_at is null and id <> new_bid.id;

  -- "Going once": a late bid gives everyone a few more minutes.
  if v_close is not null and s.extend_minutes > 0 and v_close - v_now < make_interval(mins => s.extend_minutes) then
    update raffle_items set closes_at_override = v_now + make_interval(mins => s.extend_minutes) where id = r.id;
  end if;
  update raffle_items set current_bid_cents = p_amount_cents, bid_count = bid_count + 1,
                          high_bidder_id = b.id, high_bidder_no = b.bidder_no
   where id = r.id;
  select * into r from raffle_items where id = r.id;
  return jsonb_build_object('ok', true, 'bid_id', new_bid.id, 'item', auction_item_json(r, s));
end $$;
grant execute on function place_bid(uuid, uuid, int) to anon, authenticated;

-- -------------------------------------------------------------
-- 11. Sales: start, finalize, void (payment server and staff)
-- -------------------------------------------------------------
create or replace function auction_sale_json(p_sale auction_sales)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r raffle_items;
  s auction_settings;
  b auction_bidders;
begin
  select * into r from raffle_items where id = p_sale.item_id;
  select * into s from auction_settings where org_id = p_sale.org_id and event_slug = p_sale.event_slug;
  if p_sale.bidder_id is not null then select * into b from auction_bidders where id = p_sale.bidder_id; end if;
  return jsonb_build_object(
    'sale_id', p_sale.id, 'item_id', p_sale.item_id, 'bidder_id', p_sale.bidder_id,
    'kind', p_sale.kind, 'amount_cents', p_sale.amount_cents, 'ship_fee_cents', p_sale.ship_fee_cents,
    'total_cents', p_sale.amount_cents + p_sale.ship_fee_cents,
    'fulfil', p_sale.fulfil, 'ship_address', p_sale.ship_address,
    'payment_status', p_sale.payment_status, 'stripe_payment_intent_id', p_sale.stripe_payment_intent_id,
    'failure_message', p_sale.failure_message, 'paid_at', p_sale.paid_at,
    'fulfil_status', p_sale.fulfil_status, 'tracking', p_sale.tracking, 'shipped_at', p_sale.shipped_at,
    'note', p_sale.note, 'created_at', p_sale.created_at,
    'buyer', jsonb_build_object(
      'name', coalesce(b.name, p_sale.buyer_name), 'email', coalesce(b.email, p_sale.buyer_email),
      'phone', coalesce(b.phone, p_sale.buyer_phone), 'bidder_no', b.bidder_no,
      'card_brand', b.card_brand, 'card_last4', b.card_last4,
      'stripe_customer_id', b.stripe_customer_id, 'stripe_payment_method_id', b.stripe_payment_method_id),
    'item', case when r.id is null then null else auction_item_json(r, s) end
  );
end $$;

-- Start a sale: Buy Now (server, for the bidder) or the winning bid at close.
-- Locks the item so two buyers can't both get it. Returns the sale to charge.
create or replace function auction_begin_sale(p_item_id uuid, p_bidder_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  s auction_settings;
  b auction_bidders;
  sa auction_sales;
  v_amount int;
  v_fee int := 0;
  v_fulfil text := 'pickup';
  v_close timestamptz;
begin
  if p_kind not in ('buy_now', 'bid') then raise exception 'Unknown sale kind'; end if;
  select * into r from raffle_items where id = p_item_id for update;
  if not found or not r.is_published then raise exception 'That item is not in the auction.'; end if;
  if r.status <> 'available' then raise exception 'This item has already been sold.'; end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  select * into b from auction_bidders where id = p_bidder_id;
  if not found then raise exception 'Bidder not found'; end if;
  if b.is_blocked then raise exception 'Bidding is not available for this registration.'; end if;
  if not b.card_ready then raise exception 'Please add a card first.'; end if;
  v_close := auction_effective_close(r);

  if p_kind = 'buy_now' then
    if r.buy_now_cents is null then raise exception 'This item has no Buy Now price.'; end if;
    if s is null or not s.bidding_enabled then raise exception 'Online bidding is not open yet.'; end if;
    if s.bidding_opens_at is not null and now() < s.bidding_opens_at then raise exception 'Bidding has not opened yet.'; end if;
    if v_close is not null and now() >= v_close then raise exception 'Bidding on this item has closed.'; end if;
    v_amount := r.buy_now_cents;
  else
    if v_close is null or now() < v_close then raise exception 'Bidding on this item has not closed yet.'; end if;
    if r.high_bidder_id is distinct from b.id then raise exception 'This bidder is not the high bidder.'; end if;
    v_amount := r.current_bid_cents;
  end if;

  if b.fulfil = 'ship' and r.ship_fee_cents is not null then
    v_fulfil := 'ship'; v_fee := r.ship_fee_cents;
  end if;

  insert into auction_sales (org_id, event_slug, item_id, bidder_id, kind, amount_cents, ship_fee_cents, fulfil, ship_address)
  values (r.org_id, r.event_slug, r.id, b.id, p_kind, v_amount, v_fee, v_fulfil,
          case when v_fulfil = 'ship' then b.address end)
  returning * into sa;

  if p_kind = 'buy_now' then
    insert into auction_bids (org_id, event_slug, item_id, bidder_id, amount_cents, kind)
    values (r.org_id, r.event_slug, r.id, b.id, v_amount, 'buy_now');
    update auction_bids set outbid_at = now() where item_id = r.id and outbid_at is null and kind = 'bid';
    update raffle_items set status = 'won', won_kind = 'buy_now', current_bid_cents = v_amount,
                            high_bidder_id = b.id, high_bidder_no = b.bidder_no
     where id = r.id;
  else
    update raffle_items set status = 'won', won_kind = 'bid' where id = r.id;
  end if;
  return auction_sale_json(sa);
end $$;
revoke all on function auction_begin_sale(uuid, uuid, text) from public, anon, authenticated;
grant execute on function auction_begin_sale(uuid, uuid, text) to service_role;

-- Record what Stripe said (or a void). 'void' puts the item back up for sale.
create or replace function auction_finalize_sale(p_sale_id uuid, p_status text, p_payment_intent text default null,
                                                 p_failure text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sa auction_sales;
begin
  if p_status not in ('pending', 'paid', 'failed', 'refunded', 'void', 'cash') then raise exception 'Unknown status'; end if;
  select * into sa from auction_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sa.payment_status = 'void' then return auction_sale_json(sa); end if;
  update auction_sales set
    payment_status = p_status,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    failure_message = case when p_status = 'failed' then left(coalesce(p_failure, 'Payment failed'), 300)
                           when p_status = 'paid' then null else failure_message end,
    paid_at = case when p_status in ('paid', 'cash') then coalesce(paid_at, now()) else paid_at end
  where id = p_sale_id returning * into sa;
  if p_status = 'void' then
    update raffle_items set status = 'available', won_kind = null where id = sa.item_id;
    perform auction_recompute_item(sa.item_id);
  end if;
  return auction_sale_json(sa);
end $$;
revoke all on function auction_finalize_sale(uuid, text, text, text) from public, anon, authenticated;
grant execute on function auction_finalize_sale(uuid, text, text, text) to service_role;

-- Payment server: a sale by its Stripe payment id (for Stripe's confirmations).
create or replace function auction_sale_by_pi(p_payment_intent text)
returns jsonb language sql stable security definer set search_path = public as $$
  select auction_sale_json(sa) from auction_sales sa where sa.stripe_payment_intent_id = p_payment_intent limit 1;
$$;
revoke all on function auction_sale_by_pi(text) from public, anon, authenticated;
grant execute on function auction_sale_by_pi(text) to service_role;

create or replace function auction_sale_get(p_sale_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select auction_sale_json(sa) from auction_sales sa where sa.id = p_sale_id;
$$;
revoke all on function auction_sale_get(uuid) from public, anon, authenticated;
grant execute on function auction_sale_get(uuid) to service_role;

-- -------------------------------------------------------------
-- 12. Staff: the desk
-- -------------------------------------------------------------

-- Close every item whose time has passed: start a sale for each high bidder.
-- Returns the sales the payment server should now charge.
create or replace function auction_close_ready(p_org uuid, p_event text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  out_sales jsonb := '[]'::jsonb;
  sale jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  for r in
    select i.* from raffle_items i
     where i.org_id = p_org and i.event_slug = p_event and i.is_published
       and i.status = 'available' and i.high_bidder_id is not null
       and auction_effective_close(i) is not null and now() >= auction_effective_close(i)
       and not exists (select 1 from auction_sales sa where sa.item_id = i.id and sa.payment_status <> 'void')
     order by i.session, i.sort_order
  loop
    begin
      sale := auction_begin_sale(r.id, r.high_bidder_id, 'bid');
      out_sales := out_sales || jsonb_build_array(sale);
    exception when others then
      out_sales := out_sales || jsonb_build_array(jsonb_build_object('item_id', r.id, 'error', sqlerrm));
    end;
  end loop;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'auction.closed', 'auction', p_event, jsonb_build_object('sales', jsonb_array_length(out_sales)));
  return out_sales;
end $$;
grant execute on function auction_close_ready(uuid, text) to authenticated;

-- After a failed charge: offer the item to the next-highest bidder with a card.
-- Voids the failed sale and returns the new one to charge (or null if nobody).
create or replace function auction_offer_next(p_sale_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sa auction_sales;
  r raffle_items;
  nb record;
  new_sale jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into sa from auction_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if not has_permission(sa.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if sa.payment_status not in ('failed', 'pending') then raise exception 'Only a failed or unpaid sale can be passed on'; end if;
  select * into r from raffle_items where id = sa.item_id for update;

  update auction_sales set payment_status = 'void', note = concat_ws(' · ', note, 'Passed to the next bidder') where id = sa.id;
  update raffle_items set status = 'available', won_kind = null where id = r.id;

  select b.bidder_id, b.amount_cents, d.bidder_no into nb
    from auction_bids b join auction_bidders d on d.id = b.bidder_id
   where b.item_id = r.id and b.kind = 'bid' and b.bidder_id <> coalesce(sa.bidder_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and d.card_ready and not d.is_blocked
   order by b.amount_cents desc, b.created_at asc limit 1;
  if nb.bidder_id is null then
    perform auction_recompute_item(r.id);
    return null;
  end if;
  update raffle_items set current_bid_cents = nb.amount_cents, high_bidder_id = nb.bidder_id, high_bidder_no = nb.bidder_no,
                          closes_at_override = coalesce(closes_at_override, now())
   where id = r.id;
  new_sale := auction_begin_sale(r.id, nb.bidder_id, 'bid');
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (sa.org_id, auth.uid(), 'auction.offered_next', 'auction_sale', p_sale_id::text, jsonb_build_object('item', r.title));
  return new_sale;
end $$;
grant execute on function auction_offer_next(uuid) to authenticated;

-- A paper bidder or walk-up: staff record the winner and how they paid.
create or replace function auction_desk_sale(p_item_id uuid, p_name text, p_phone text, p_email text,
                                             p_amount_cents int, p_fulfil text default 'pickup',
                                             p_paid boolean default true, p_ship_fee_cents int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  sa auction_sales;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into r from raffle_items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if not has_permission(r.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if r.status <> 'available' then raise exception 'This item has already been sold.'; end if;
  if p_amount_cents is null or p_amount_cents < 0 then raise exception 'Enter the amount'; end if;
  if p_fulfil not in ('pickup', 'ship') then raise exception 'Choose pickup or shipping'; end if;
  insert into auction_sales (org_id, event_slug, item_id, buyer_name, buyer_phone, buyer_email, kind, amount_cents,
                             ship_fee_cents, fulfil, payment_status, paid_at, created_by)
  values (r.org_id, r.event_slug, r.id, left(coalesce(nullif(btrim(p_name), ''), 'Walk-up'), 80),
          nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''),
          nullif(lower(btrim(coalesce(p_email, ''))), ''), 'desk', p_amount_cents,
          case when p_fulfil = 'ship' then coalesce(p_ship_fee_cents, r.ship_fee_cents, 0) else 0 end,
          p_fulfil, case when p_paid then 'cash' else 'pending' end, case when p_paid then now() end, auth.uid())
  returning * into sa;
  insert into auction_bids (org_id, event_slug, item_id, bidder_id, amount_cents, kind)
  values (r.org_id, r.event_slug, r.id, null, greatest(p_amount_cents, 1), 'desk');
  update auction_bids set outbid_at = now() where item_id = r.id and outbid_at is null and kind = 'bid';
  update raffle_items set status = 'won', won_kind = 'desk', current_bid_cents = greatest(p_amount_cents, coalesce(current_bid_cents, 0))
   where id = r.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'auction.desk_sale', 'auction_sale', sa.id::text,
          jsonb_build_object('item', r.title, 'amount_cents', p_amount_cents, 'paid', p_paid));
  return auction_sale_json(sa);
end $$;
grant execute on function auction_desk_sale(uuid, text, text, text, int, text, boolean, int) to authenticated;

-- Staff: pickup / shipping / payment bookkeeping on one sale.
create or replace function auction_update_sale(p_sale_id uuid, p_payment_status text default null,
                                               p_fulfil_status text default null, p_tracking text default null,
                                               p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sa auction_sales;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into sa from auction_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if not has_permission(sa.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if p_payment_status is not null then
    -- staff record cash, a refund made in Stripe, or void; 'paid' comes from Stripe itself
    if p_payment_status not in ('cash', 'refunded', 'void', 'pending') then raise exception 'That payment status is set by Stripe'; end if;
    if p_payment_status = 'void' then
      update auction_sales set payment_status = 'void' where id = sa.id;
      update raffle_items set status = 'available', won_kind = null where id = sa.item_id;
      perform auction_recompute_item(sa.item_id);
    else
      update auction_sales set payment_status = p_payment_status,
             paid_at = case when p_payment_status = 'cash' then coalesce(paid_at, now()) else paid_at end
       where id = sa.id;
    end if;
  end if;
  if p_fulfil_status is not null then
    if p_fulfil_status not in ('pending', 'picked_up', 'shipped') then raise exception 'Unknown pickup/shipping status'; end if;
    update auction_sales set fulfil_status = p_fulfil_status,
           shipped_at = case when p_fulfil_status = 'shipped' then coalesce(shipped_at, now()) else null end,
           fulfilled_by = case when p_fulfil_status = 'pending' then null else auth.uid() end
     where id = sa.id;
  end if;
  if p_tracking is not null then update auction_sales set tracking = nullif(btrim(p_tracking), '') where id = sa.id; end if;
  if p_note is not null then update auction_sales set note = nullif(btrim(p_note), '') where id = sa.id; end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (sa.org_id, auth.uid(), 'auction.sale_updated', 'auction_sale', sa.id::text,
          jsonb_strip_nulls(jsonb_build_object('payment_status', p_payment_status, 'fulfil_status', p_fulfil_status,
                                               'tracking', p_tracking)));
  select * into sa from auction_sales where id = p_sale_id;
  return auction_sale_json(sa);
end $$;
grant execute on function auction_update_sale(uuid, text, text, text, text) to authenticated;

-- Staff: block or unblock a bidder.
create or replace function auction_set_bidder_blocked(p_bidder_id uuid, p_blocked boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b auction_bidders;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into b from auction_bidders where id = p_bidder_id;
  if not found then raise exception 'Bidder not found'; end if;
  if not has_permission(b.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  update auction_bidders set is_blocked = p_blocked where id = p_bidder_id returning * into b;
  return auction_bidder_json(b);
end $$;
grant execute on function auction_set_bidder_blocked(uuid, boolean) to authenticated;

-- Staff: everything the desk shows — items with bidder names, sales and totals.
create or replace function auction_desk(p_org uuid, p_event text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  select * into s from auction_settings where org_id = p_org and event_slug = p_event;
  return jsonb_build_object(
    'now', now(),
    'settings', auction_settings_json(s),
    'items', coalesce((
      select jsonb_agg(
        auction_item_json(r, s) || jsonb_build_object(
          'is_published', r.is_published,
          'high_bidder', (select jsonb_build_object('id', d.id, 'name', d.name, 'email', d.email, 'phone', d.phone,
                                                    'bidder_no', d.bidder_no, 'fulfil', d.fulfil)
                            from auction_bidders d where d.id = r.high_bidder_id),
          'bids', (select coalesce(jsonb_agg(jsonb_build_object(
                       'amount_cents', x.amount_cents, 'kind', x.kind, 'at', x.created_at, 'is_high', x.outbid_at is null,
                       'bidder_no', d.bidder_no, 'name', d.name) order by x.created_at desc), '[]'::jsonb)
                     from auction_bids x left join auction_bidders d on d.id = x.bidder_id where x.item_id = r.id),
          'sale', (select auction_sale_json(sa) from auction_sales sa
                    where sa.item_id = r.id and sa.payment_status <> 'void' limit 1))
        order by r.session, r.sort_order, r.created_at)
      from raffle_items r where r.org_id = p_org and r.event_slug = p_event), '[]'::jsonb),
    'bidders', coalesce((
      select jsonb_agg(auction_bidder_json(d) - 'access_token' || jsonb_build_object(
               'bids', (select count(*) from auction_bids x where x.bidder_id = d.id),
               'won', (select count(*) from auction_sales sa where sa.bidder_id = d.id and sa.payment_status <> 'void'))
             order by d.created_at desc)
      from auction_bidders d where d.org_id = p_org and d.event_slug = p_event), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'paid_cents', coalesce(sum(case when sa.payment_status in ('paid', 'cash') then sa.amount_cents + sa.ship_fee_cents end), 0),
        'pending_cents', coalesce(sum(case when sa.payment_status = 'pending' then sa.amount_cents + sa.ship_fee_cents end), 0),
        'failed', count(*) filter (where sa.payment_status = 'failed'),
        'sold', count(*) filter (where sa.payment_status <> 'void'),
        'to_ship', count(*) filter (where sa.payment_status in ('paid', 'cash') and sa.fulfil = 'ship' and sa.fulfil_status <> 'shipped'),
        'to_pick_up', count(*) filter (where sa.payment_status in ('paid', 'cash') and sa.fulfil = 'pickup' and sa.fulfil_status <> 'picked_up'))
      from auction_sales sa where sa.org_id = p_org and sa.event_slug = p_event)
  );
end $$;
grant execute on function auction_desk(uuid, text) to authenticated;

-- Staff: the auction switches and notes (the setup panel).
create or replace function auction_save_settings(p_org uuid, p_event text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  insert into auction_settings (org_id, event_slug) values (p_org, p_event) on conflict (org_id, event_slug) do nothing;
  update auction_settings set
    bidding_enabled = coalesce((p_patch->>'bidding_enabled')::boolean, bidding_enabled),
    bidding_opens_at = case when p_patch ? 'bidding_opens_at' then nullif(p_patch->>'bidding_opens_at', '')::timestamptz else bidding_opens_at end,
    morning_closes_at = case when p_patch ? 'morning_closes_at' then nullif(p_patch->>'morning_closes_at', '')::timestamptz else morning_closes_at end,
    afternoon_closes_at = case when p_patch ? 'afternoon_closes_at' then nullif(p_patch->>'afternoon_closes_at', '')::timestamptz else afternoon_closes_at end,
    extend_minutes = coalesce((p_patch->>'extend_minutes')::int, extend_minutes),
    default_increment_cents = coalesce((p_patch->>'default_increment_cents')::int, default_increment_cents),
    stripe_publishable_key = case when p_patch ? 'stripe_publishable_key' then nullif(btrim(p_patch->>'stripe_publishable_key'), '') else stripe_publishable_key end,
    intro_text = case when p_patch ? 'intro_text' then nullif(btrim(p_patch->>'intro_text'), '') else intro_text end,
    bidding_note = case when p_patch ? 'bidding_note' then nullif(btrim(p_patch->>'bidding_note'), '') else bidding_note end,
    pickup_note = case when p_patch ? 'pickup_note' then nullif(btrim(p_patch->>'pickup_note'), '') else pickup_note end,
    shipping_note = case when p_patch ? 'shipping_note' then nullif(btrim(p_patch->>'shipping_note'), '') else shipping_note end
  where org_id = p_org and event_slug = p_event returning * into s;
  if s.stripe_publishable_key is not null and s.stripe_publishable_key !~ '^pk_(live|test)_' then
    raise exception 'That is not a Stripe publishable key (it starts with pk_live_ or pk_test_).';
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'auction.settings', 'auction', p_event, p_patch - 'stripe_publishable_key');
  return auction_settings_json(s);
end $$;
grant execute on function auction_save_settings(uuid, text, jsonb) to authenticated;

-- Staff: prices on one item (the item editor's auction fields).
create or replace function auction_set_item_prices(p_item_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into r from raffle_items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if not has_permission(r.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  update raffle_items set
    starting_bid_cents = case when p_patch ? 'starting_bid_cents' then nullif(p_patch->>'starting_bid_cents', '')::int else starting_bid_cents end,
    min_increment_cents = case when p_patch ? 'min_increment_cents' then nullif(p_patch->>'min_increment_cents', '')::int else min_increment_cents end,
    buy_now_cents = case when p_patch ? 'buy_now_cents' then nullif(p_patch->>'buy_now_cents', '')::int else buy_now_cents end,
    ship_fee_cents = case when p_patch ? 'ship_fee_cents' then nullif(p_patch->>'ship_fee_cents', '')::int else ship_fee_cents end,
    closes_at_override = case when p_patch ? 'closes_at_override' then nullif(p_patch->>'closes_at_override', '')::timestamptz else closes_at_override end
  where id = p_item_id returning * into r;
  if r.buy_now_cents is not null and r.current_bid_cents is not null and r.buy_now_cents <= r.current_bid_cents then
    raise exception 'The Buy Now price must be above the current bid.';
  end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  return auction_item_json(r, s);
end $$;
grant execute on function auction_set_item_prices(uuid, jsonb) to authenticated;
