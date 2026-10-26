-- =============================================================
-- Update 45 (2026-10-26): the OHRR Online Auction, paid with Square.
--
-- A second auction, separate from BunFest's: online only, its own items and
-- its own closing time. A bidder registers with a card first (Square keeps it;
-- OHRR stores only Square's ids and the last four digits). When the auction
-- closes, every winner's card is charged automatically — the database checks
-- every five minutes and asks the "ohrr-auction" Edge Function to do it.
--
-- Square replaces Stripe for card payments in BOTH auctions (OHRR already
-- takes payments with Square). The old stripe_* columns keep their names and
-- now hold Square's ids: stripe_customer_id = Square customer, stripe_payment_
-- method_id = Square card on file, stripe_payment_intent_id = Square payment.
--
--   auction_settings  + title                 "OHRR Online Auction"
--                     + auto_charge            charge the winners at the close
--                     + square_application_id  public (sandbox-sq0idb-… / sq0idp-…)
--                     + square_location_id     public (the Square location paid into)
--   auction_sales     + receipt_url            Square's receipt for a card payment
--   raffle_items        event_slug 'ohrr-online-auction' = an online item
--
--   auction_public_on(org, event)    the right feature switch for the event:
--                                    BunFest → silent_auction_enabled (on until
--                                    switched off), online → online_auction_enabled
--                                    (OFF until a Founder/Developer switches it on)
--   auction_close_due()              Edge Function: close and start the winning
--                                    sales of every auto-charge auction past its time
--   auction_due_exists()             the five-minute check (nothing is called
--                                    while no auction is waiting to close)
--   auction_set_receipt(sale, url)   Edge Function
--   auction_claim_stuck_sales()      Edge Function: charges started but never
--                                    answered, retried for about an hour
--   auction_charge_begin(sale)       Edge Function: one charge at a time per sale
--   auction_card_attempt(bidder)     Edge Function: five new cards an hour
--   auction_finalize_sale            re-made: a paid sale can't be reopened
--   auction_register_bidder          re-made: refuses a flood of sign-ups
--   auction_move_item(item, event)   staff: move an item between the auctions
--                                    (only while nobody has bid on it)
--
-- The Square ACCESS TOKEN is a secret. It goes only in Supabase → Edge
-- Functions → Secrets as SQUARE_ACCESS_TOKEN — never in this file or the app.
--
-- Apply AFTER update 44. Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

alter table auction_settings add column if not exists title text;
alter table auction_settings add column if not exists auto_charge boolean not null default false;
alter table auction_settings add column if not exists square_application_id text;
alter table auction_settings add column if not exists square_location_id text;
alter table auction_sales add column if not exists receipt_url text;

comment on column auction_settings.auto_charge is 'Charge the winners'' saved cards automatically when the auction closes (the online auction).';
comment on column auction_settings.square_application_id is 'Square APPLICATION id (sandbox-sq0idb-… or sq0idp-…). Public. The access token lives only in the Edge Function secrets.';
comment on column auction_settings.square_location_id is 'The Square location the auction is paid into. Public.';

-- The online auction's settings row (bidding off until staff set it up).
insert into auction_settings (org_id, event_slug, title, auto_charge, extend_minutes)
select o.id, 'ohrr-online-auction', 'OHRR Online Auction', true, 5
  from organizations o where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, event_slug) do nothing;

-- -------------------------------------------------------------
-- 1. Which feature switch an auction answers to
-- -------------------------------------------------------------
create or replace function auction_public_on(p_org uuid, p_event text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_event like 'midwest-bunfest%'
    then feature_on(p_org, 'silent_auction_enabled')
    else feature_on(p_org, 'online_auction_enabled', false) end;
$$;
grant execute on function auction_public_on(uuid, text) to anon, authenticated;

create or replace function app_settings_switch_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_on boolean := case when jsonb_typeof(new.value -> 'enabled') = 'boolean' then (new.value ->> 'enabled')::boolean end;
begin
  if new.key not like '%\_enabled' escape '\' then return null; end if;
  if tg_op = 'UPDATE' and old.value is not distinct from new.value then return null; end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (new.org_id, auth.uid(), 'feature.switched', 'app_setting', new.key,
          jsonb_build_object('key', new.key, 'enabled', v_on));
  if new.key = 'silent_auction_enabled' and v_on is false then
    update auction_settings set bidding_enabled = false
     where org_id = new.org_id and bidding_enabled and event_slug like 'midwest-bunfest%';
  end if;
  if new.key = 'online_auction_enabled' and v_on is false then
    update auction_settings set bidding_enabled = false
     where org_id = new.org_id and bidding_enabled and event_slug not like 'midwest-bunfest%';
  end if;
  return null;
end $$;

-- Online bidding can't be switched on while the auction's switch is off.
create or replace function auction_settings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.bidding_enabled, false) then return new; end if;
  if tg_op = 'UPDATE' then
    if coalesce(old.bidding_enabled, false) then return new; end if;  -- already on: other edits pass
  end if;
  if not auction_public_on(new.org_id, new.event_slug) then
    raise exception '% is switched off. A Founder or Developer can switch it on in Staff → Features first.',
      case when new.event_slug like 'midwest-bunfest%' then 'The Silent Auction' else 'The Online Auction' end;
  end if;
  return new;
end $$;

-- -------------------------------------------------------------
-- 2. What the public and the desk see
-- -------------------------------------------------------------
create or replace function auction_item_json(p_item raffle_items, p_settings auction_settings)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', p_item.id,
    'event_slug', p_item.event_slug,
    'title', p_item.title,
    'description', p_item.description,
    'donated_by', p_item.donated_by,
    'value_cents', p_item.value_cents,
    'photo_url', p_item.photo_url,
    'photo_urls', to_jsonb(coalesce(p_item.photo_urls, '{}'::text[])),
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
    'event_slug', p_settings.event_slug,
    'title', p_settings.title,
    'bidding_enabled', p_settings.bidding_enabled,
    'bidding_opens_at', p_settings.bidding_opens_at,
    'morning_closes_at', p_settings.morning_closes_at,
    'afternoon_closes_at', p_settings.afternoon_closes_at,
    'extend_minutes', p_settings.extend_minutes,
    'default_increment_cents', p_settings.default_increment_cents,
    'stripe_publishable_key', p_settings.stripe_publishable_key,
    'square_application_id', p_settings.square_application_id,
    'square_location_id', p_settings.square_location_id,
    'auto_charge', p_settings.auto_charge,
    'intro_text', p_settings.intro_text,
    'bidding_note', p_settings.bidding_note,
    'pickup_note', p_settings.pickup_note,
    'shipping_note', p_settings.shipping_note,
    'buy_now_at_table', p_settings.buy_now_at_table
  ) end;
$$;

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
    'event_slug', p_sale.event_slug,
    'kind', p_sale.kind, 'amount_cents', p_sale.amount_cents, 'ship_fee_cents', p_sale.ship_fee_cents,
    'total_cents', p_sale.amount_cents + p_sale.ship_fee_cents,
    'fulfil', p_sale.fulfil, 'ship_address', p_sale.ship_address,
    'payment_status', p_sale.payment_status, 'stripe_payment_intent_id', p_sale.stripe_payment_intent_id,
    'failure_message', p_sale.failure_message, 'paid_at', p_sale.paid_at, 'receipt_url', p_sale.receipt_url,
    'fulfil_status', p_sale.fulfil_status, 'tracking', p_sale.tracking, 'shipped_at', p_sale.shipped_at,
    'note', p_sale.note, 'created_at', p_sale.created_at,
    'at_table', p_sale.claim_token is not null, 'pickup_no', p_sale.pickup_no,
    'buyer', jsonb_build_object(
      'name', coalesce(b.name, p_sale.buyer_name), 'email', coalesce(b.email, p_sale.buyer_email),
      'phone', coalesce(b.phone, p_sale.buyer_phone), 'bidder_no', b.bidder_no,
      'card_brand', b.card_brand, 'card_last4', b.card_last4,
      'stripe_customer_id', b.stripe_customer_id, 'stripe_payment_method_id', b.stripe_payment_method_id),
    'item', case when r.id is null then null else auction_item_json(r, s) end
  );
end $$;

create or replace function auction_catalog(p_event text default 'midwest-bunfest-2026')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid;
  v_on  boolean;
  s auction_settings;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  v_on := auction_public_on(v_org, p_event);
  select * into s from auction_settings where org_id = v_org and event_slug = p_event;
  return jsonb_build_object(
    'now', now(),
    'enabled', v_on,
    'settings', auction_settings_json(s),
    'items', case when v_on or is_org_member(v_org) then coalesce((
      select jsonb_agg(auction_item_json(r, s) order by r.session, r.sort_order, r.created_at)
        from raffle_items r where r.org_id = v_org and r.event_slug = p_event and r.is_published), '[]'::jsonb)
      else '[]'::jsonb end
  );
end $$;
grant execute on function auction_catalog(text) to anon, authenticated;

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
  if not auction_public_on(r.org_id, r.event_slug) and not is_org_member(r.org_id) then return null; end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  return auction_item_json(r, s);
end $$;
grant execute on function auction_item_by_code(text) to anon, authenticated;

-- The bidder's own page, now with the Square receipt for each paid win.
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
          'paid_at', sa.paid_at, 'receipt_url', sa.receipt_url, 'fulfil_status', sa.fulfil_status,
          'tracking', sa.tracking, 'shipped_at', sa.shipped_at, 'created_at', sa.created_at,
          'item', auction_item_json(r, s))
        order by sa.created_at desc)
        from auction_sales sa join raffle_items r on r.id = sa.item_id
       where sa.bidder_id = b.id and sa.payment_status <> 'void'), '[]'::jsonb)
  );
end $$;
grant execute on function auction_bidder_by_token(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- 3. Staff: the setup panel, now with the auction's name, Square and auto-charge
-- -------------------------------------------------------------
create or replace function auction_save_settings(p_org uuid, p_event text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  insert into auction_settings (org_id, event_slug) values (p_org, p_event) on conflict (org_id, event_slug) do nothing;
  update auction_settings set
    title = case when p_patch ? 'title' then nullif(btrim(p_patch->>'title'), '') else title end,
    bidding_enabled = coalesce((p_patch->>'bidding_enabled')::boolean, bidding_enabled),
    auto_charge = coalesce((p_patch->>'auto_charge')::boolean, auto_charge),
    bidding_opens_at = case when p_patch ? 'bidding_opens_at' then nullif(p_patch->>'bidding_opens_at', '')::timestamptz else bidding_opens_at end,
    morning_closes_at = case when p_patch ? 'morning_closes_at' then nullif(p_patch->>'morning_closes_at', '')::timestamptz else morning_closes_at end,
    afternoon_closes_at = case when p_patch ? 'afternoon_closes_at' then nullif(p_patch->>'afternoon_closes_at', '')::timestamptz else afternoon_closes_at end,
    extend_minutes = coalesce((p_patch->>'extend_minutes')::int, extend_minutes),
    default_increment_cents = coalesce((p_patch->>'default_increment_cents')::int, default_increment_cents),
    stripe_publishable_key = case when p_patch ? 'stripe_publishable_key' then nullif(btrim(p_patch->>'stripe_publishable_key'), '') else stripe_publishable_key end,
    square_application_id = case when p_patch ? 'square_application_id' then nullif(btrim(p_patch->>'square_application_id'), '') else square_application_id end,
    square_location_id = case when p_patch ? 'square_location_id' then nullif(btrim(p_patch->>'square_location_id'), '') else square_location_id end,
    intro_text = case when p_patch ? 'intro_text' then nullif(btrim(p_patch->>'intro_text'), '') else intro_text end,
    bidding_note = case when p_patch ? 'bidding_note' then nullif(btrim(p_patch->>'bidding_note'), '') else bidding_note end,
    pickup_note = case when p_patch ? 'pickup_note' then nullif(btrim(p_patch->>'pickup_note'), '') else pickup_note end,
    shipping_note = case when p_patch ? 'shipping_note' then nullif(btrim(p_patch->>'shipping_note'), '') else shipping_note end
  where org_id = p_org and event_slug = p_event returning * into s;
  if s.square_application_id is not null and s.square_application_id !~ '^(sandbox-)?sq0id[a-z]-' then
    raise exception 'That is not a Square application id (it starts with sq0idp- or sandbox-sq0idb-). The access token never goes here.';
  end if;
  if s.square_location_id is not null and s.square_location_id !~ '^[A-Za-z0-9]{8,40}$' then
    raise exception 'That is not a Square location id (letters and numbers, from Square → Locations).';
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'auction.settings', 'auction', p_event, p_patch);
  return auction_settings_json(s);
end $$;
grant execute on function auction_save_settings(uuid, text, jsonb) to authenticated;

-- Staff: move an item to the other auction — only while nobody has bid on it.
create or replace function auction_move_item(p_item_id uuid, p_event text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_event not in ('midwest-bunfest-2026', 'ohrr-online-auction') then raise exception 'Unknown auction'; end if;
  select * into r from raffle_items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if not has_permission(r.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if r.event_slug = p_event then
    select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
    return auction_item_json(r, s);
  end if;
  if r.bid_count > 0 or exists (select 1 from auction_bids b where b.item_id = r.id) then
    raise exception 'Someone has bid on this item, so it stays in its auction.';
  end if;
  if exists (select 1 from auction_sales sa where sa.item_id = r.id and sa.payment_status <> 'void') then
    raise exception 'This item has been sold.';
  end if;
  -- The online auction has one closing time; BunFest items keep their session.
  update raffle_items set event_slug = p_event, closes_at_override = null,
                          session = case when p_event = 'ohrr-online-auction' then 'all-day' else session end
   where id = r.id returning * into r;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'auction.item_moved', 'raffle_item', r.id::text, jsonb_build_object('to', p_event, 'title', r.title));
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  return auction_item_json(r, s);
end $$;
grant execute on function auction_move_item(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 4. The automatic close (Edge Function only)
-- -------------------------------------------------------------
-- Only winners who can be charged: a blocked bidder or one with no card stays
-- on the desk for staff ("Pass to the next bidder" or cash).
create or replace function auction_due_items()
returns setof raffle_items language sql stable security definer set search_path = public as $$
  select i.* from raffle_items i
    join auction_settings s on s.org_id = i.org_id and s.event_slug = i.event_slug
    join auction_bidders d on d.id = i.high_bidder_id
   where s.auto_charge and i.is_published and i.status = 'available'
     and d.card_ready and not d.is_blocked
     and auction_effective_close(i) is not null and now() >= auction_effective_close(i)
     and not exists (select 1 from auction_sales sa where sa.item_id = i.id and sa.payment_status <> 'void')
   order by auction_effective_close(i), i.sort_order;
$$;
revoke all on function auction_due_items() from public, anon, authenticated;

-- -------------------------------------------------------------
-- 5. Charging safely
-- -------------------------------------------------------------
-- decline_count   how many times the card was declined (part of Square's
--                 idempotency key, so a new attempt is a new payment and a
--                 repeat of the same attempt is never charged twice)
-- charge_attempts how many times the five-minute check retried a stuck charge
-- last_charge_at  a charge is being made right now (held for two minutes, or
--                 until Square answers), so two charges never run side by side
alter table auction_sales add column if not exists decline_count int not null default 0;
alter table auction_sales add column if not exists charge_attempts int not null default 0;
alter table auction_sales add column if not exists last_charge_at timestamptz;
-- New cards per bidder: at most five an hour.
alter table auction_bidders add column if not exists card_changes int not null default 0;
alter table auction_bidders add column if not exists card_window_at timestamptz;

-- Record what Square said. A settled sale stays settled: paid or cash can only
-- become refunded, and nothing reopens a refunded or void sale.
create or replace function auction_finalize_sale(p_sale_id uuid, p_status text, p_payment_intent text default null,
                                                 p_failure text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sa auction_sales;
begin
  if p_status not in ('pending', 'paid', 'failed', 'refunded', 'void', 'cash') then raise exception 'Unknown status'; end if;
  select * into sa from auction_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sa.payment_status in ('void', 'refunded') then return auction_sale_json(sa); end if;
  if sa.payment_status in ('paid', 'cash') and p_status <> 'refunded' then return auction_sale_json(sa); end if;
  update auction_sales set
    payment_status = p_status,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    failure_message = case when p_status = 'failed' then left(coalesce(p_failure, 'Payment failed'), 300)
                           when p_status = 'paid' then null else failure_message end,
    decline_count = decline_count + case when p_status = 'failed' then 1 else 0 end,
    last_charge_at = case when p_status = 'pending' then last_charge_at end,
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

-- Charges that were started but never answered (Square was slow, or the
-- function stopped half-way). Picked up again after three minutes, for about
-- an hour; after that the desk shows them for staff.
create or replace function auction_stuck_sales()
returns setof auction_sales language sql stable security definer set search_path = public as $$
  select y.* from auction_sales y
   where y.payment_status = 'pending' and y.bidder_id is not null and y.claim_token is null
     and y.kind in ('bid', 'buy_now') and y.charge_attempts < 12
     and coalesce(y.last_charge_at, y.created_at) < now() - interval '3 minutes'
     and (y.kind = 'buy_now' or exists (select 1 from auction_settings s
                                         where s.org_id = y.org_id and s.event_slug = y.event_slug and s.auto_charge));
$$;
revoke all on function auction_stuck_sales() from public, anon, authenticated;

-- Edge Function: up to twenty stuck charges to try again (each still takes
-- the charge lock below before Square is called).
create or replace function auction_claim_stuck_sales(p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sa auction_sales;
  out_sales jsonb := '[]'::jsonb;
begin
  for sa in
    update auction_sales x set charge_attempts = x.charge_attempts + 1
     where x.id in (select y.id from auction_sales y
                     where y.id in (select z.id from auction_stuck_sales() z)
                     order by y.created_at limit greatest(1, least(coalesce(p_limit, 20), 50))
                     for update skip locked)
    returning x.*
  loop
    out_sales := out_sales || jsonb_build_array(auction_sale_json(sa));
  end loop;
  return out_sales;
end $$;
revoke all on function auction_claim_stuck_sales(int) from public, anon, authenticated;
grant execute on function auction_claim_stuck_sales(int) to service_role;

create or replace function auction_due_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auction_due_items()) or exists (select 1 from auction_stuck_sales());
$$;
revoke all on function auction_due_exists() from public, anon, authenticated;

-- Edge Function: take the charge lock on a sale. Null = someone else is
-- charging it right now (or it is no longer unpaid). Returns the sale with
-- what Square's idempotency key is made from.
create or replace function auction_charge_begin(p_sale_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sa auction_sales;
begin
  update auction_sales set last_charge_at = now()
   where id = p_sale_id and payment_status in ('pending', 'failed')
     and (last_charge_at is null or last_charge_at < now() - interval '2 minutes')
  returning * into sa;
  if not found then return null; end if;
  return auction_sale_json(sa) || jsonb_build_object('decline_count', sa.decline_count);
end $$;
revoke all on function auction_charge_begin(uuid) from public, anon, authenticated;
grant execute on function auction_charge_begin(uuid) to service_role;

-- Edge Function: may this bidder save another card? (five an hour)
create or replace function auction_card_attempt(p_bidder_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  update auction_bidders set
    card_changes = case when card_window_at is null or card_window_at < now() - interval '1 hour' then 1 else card_changes + 1 end,
    card_window_at = case when card_window_at is null or card_window_at < now() - interval '1 hour' then now() else card_window_at end
  where id = p_bidder_id returning card_changes into v_n;
  return coalesce(v_n, 0) between 1 and 5;
end $$;
revoke all on function auction_card_attempt(uuid) from public, anon, authenticated;
grant execute on function auction_card_attempt(uuid) to service_role;

-- Payment server only: make a bidder record before the card is saved.
-- Now refuses a flood of sign-ups (40 to one auction in ten minutes).
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
  if not exists (select 1 from auction_settings s where s.org_id = v_org and s.event_slug = p_event) then
    raise exception 'That auction is not set up.';
  end if;
  if (select count(*) from auction_bidders x
       where x.org_id = v_org and x.event_slug = p_event and x.created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'A lot of people are signing up right now. Please try again in a few minutes.';
  end if;
  insert into auction_bidders (org_id, event_slug, name, email, phone, fulfil, address)
  values (v_org, p_event, left(btrim(p_name), 80), v_email,
          nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''),
          p_fulfil, case when p_fulfil = 'ship' then p_address end)
  returning * into b;
  return auction_bidder_json(b);
end $$;
revoke all on function auction_register_bidder(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function auction_register_bidder(text, text, text, text, text, jsonb) to service_role;

-- Inside helpers: only other database functions use them.
revoke all on function auction_recompute_item(uuid) from public, anon, authenticated;
revoke all on function auction_sale_json(auction_sales) from public, anon, authenticated;

-- Start the sale for each winner; the Edge Function charges them.
create or replace function auction_close_due()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  out_sales jsonb := '[]'::jsonb;
  sale jsonb;
begin
  for r in select * from auction_due_items() loop
    begin
      sale := auction_begin_sale(r.id, r.high_bidder_id, 'bid');
      out_sales := out_sales || jsonb_build_array(sale);
    exception when others then
      out_sales := out_sales || jsonb_build_array(jsonb_build_object('item_id', r.id, 'error', sqlerrm));
    end;
  end loop;
  if jsonb_array_length(out_sales) > 0 then
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    select distinct i.org_id, null::uuid, 'auction.auto_closed', 'auction', i.event_slug,
           jsonb_build_object('sales', jsonb_array_length(out_sales))
      from raffle_items i
     where i.id in (select (x->>'item_id')::uuid from jsonb_array_elements(out_sales) x);
  end if;
  return out_sales;
end $$;
revoke all on function auction_close_due() from public, anon, authenticated;
grant execute on function auction_close_due() to service_role;

create or replace function auction_set_receipt(p_sale_id uuid, p_receipt_url text)
returns void language sql security definer set search_path = public as $$
  update auction_sales set receipt_url = left(p_receipt_url, 500) where id = p_sale_id;
$$;
revoke all on function auction_set_receipt(uuid, text) from public, anon, authenticated;
grant execute on function auction_set_receipt(uuid, text) to service_role;

-- The database calls the "ohrr-auction" Edge Function with the shared secret.
create or replace function call_ohrr_auction(p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  select * into c from push_config where id = 1;
  if not found then return; end if;
  perform net.http_post(
    -- The function reads the action from the last part of the address (…/ohrr-auction/close-due).
    url := replace(c.function_url, '/ohrr-jobs', '/ohrr-auction/' || coalesce(p_body->>'action', 'close-due')),
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ohrr-secret', c.trigger_secret),
    timeout_milliseconds := 120000);
end $$;
revoke execute on function call_ohrr_auction(jsonb) from public, anon, authenticated;

-- Every five minutes: if an auto-charge auction has winners waiting, charge them.
select cron.unschedule('ohrr-auction-close') where exists (select 1 from cron.job where jobname = 'ohrr-auction-close');
select cron.schedule('ohrr-auction-close', '*/5 * * * *',
  $$select public.call_ohrr_auction('{"action": "close-due"}'::jsonb) where public.auction_due_exists()$$);

-- -------------------------------------------------------------
-- Check: four "true"
-- -------------------------------------------------------------
select
  exists (select 1 from information_schema.columns where table_name = 'auction_sales' and column_name = 'decline_count') as charge_guards,
  exists (select 1 from information_schema.columns where table_name = 'auction_settings' and column_name = 'square_application_id') as square_columns,
  exists (select 1 from auction_settings where event_slug = 'ohrr-online-auction') as online_auction_row,
  exists (select 1 from cron.job where jobname = 'ohrr-auction-close') as auto_close_scheduled;
