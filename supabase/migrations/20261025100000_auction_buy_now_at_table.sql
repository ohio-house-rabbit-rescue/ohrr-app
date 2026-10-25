-- =============================================================
-- Update 44 (2026-10-25): Silent Auction — "Buy it now, pay at the table".
--
-- No card payments online. The bid sheet's label carries a QR code; a buyer
-- scans it, taps Buy it now, gives a name and phone number, and the item is
-- held for them. The auction helpers' phones get a notification, the buyer
-- goes to the auction table, pays there (Square reader or cash) and a helper
-- taps "Paid and taken".
--
--   auction_settings  + buy_now_at_table   the switch (off until staff turn it on)
--                     + helper_user_ids    who gets the notification (none
--                                          picked = everyone who runs the desk)
--   auction_sales     + claim_token        the buyer's private link to their hold
--                     + pickup_no          a short number to say at the table
--
--   auction_buy_now_claim(item, name, phone)   anyone: hold the item
--   auction_table_claim(token)                  the buyer's screen
--   auction_table_claims(org, event)            staff: the list at the table
--   auction_helper_candidates(org)              staff: who can be a helper
--   auction_set_table_buy_now(org, event, on, helpers)
--   auction_item_label_code(item)               staff: a DON number for an
--                                               auction item made in the
--                                               Silent Auction screen, so its
--                                               label can be printed
-- "Paid and taken" and "Put it back" use auction_update_sale() (update 35).
--
-- Apply AFTER update 43. Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

alter table auction_settings add column if not exists buy_now_at_table boolean not null default false;
alter table auction_settings add column if not exists helper_user_ids uuid[] not null default '{}';
alter table auction_sales add column if not exists claim_token uuid unique;
alter table auction_sales add column if not exists pickup_no int;
create index if not exists idx_auction_sales_table on auction_sales(org_id, event_slug, created_at desc)
  where claim_token is not null;

-- -------------------------------------------------------------
-- 1. What the public and the desk see
-- -------------------------------------------------------------
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
    'shipping_note', p_settings.shipping_note,
    'buy_now_at_table', p_settings.buy_now_at_table
  ) end;
$$;

-- The sale as the desk sees it, now saying when it was a hold at the table.
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
    'at_table', p_sale.claim_token is not null, 'pickup_no', p_sale.pickup_no,
    'buyer', jsonb_build_object(
      'name', coalesce(b.name, p_sale.buyer_name), 'email', coalesce(b.email, p_sale.buyer_email),
      'phone', coalesce(b.phone, p_sale.buyer_phone), 'bidder_no', b.bidder_no,
      'card_brand', b.card_brand, 'card_last4', b.card_last4,
      'stripe_customer_id', b.stripe_customer_id, 'stripe_payment_method_id', b.stripe_payment_method_id),
    'item', case when r.id is null then null else auction_item_json(r, s) end
  );
end $$;

-- -------------------------------------------------------------
-- 2. Helpers: who may run the desk (any member, not just the caller)
-- -------------------------------------------------------------
create or replace function member_has_permission(p_org uuid, p_user uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
     where m.org_id = p_org and m.user_id = p_user and m.status = 'active'
       and (m.access_until is null or m.access_until >= (now() at time zone 'America/New_York')::date)
       and (m.role in ('owner', 'admin')
            or exists (select 1 from membership_permissions mp
                        where mp.membership_id = m.id and mp.permission_key = p_key)));
$$;
revoke all on function member_has_permission(uuid, uuid, text) from public, anon, authenticated;

-- "$35" or "$12.50", for notification text.
create or replace function auction_money_text(p_cents int)
returns text language sql immutable as $$
  select case when p_cents % 100 = 0 then '$' || (p_cents / 100)::text
              else '$' || to_char(p_cents / 100.0, 'FM999999990.00') end;
$$;

-- Who gets told: the picked helpers who can still run the desk, or — when
-- none are picked — everyone who can.
create or replace function auction_table_helpers(p_org uuid, p_event text)
returns uuid[] language plpgsql stable security definer set search_path = public as $$
declare
  v_picked uuid[];
  v_out uuid[];
begin
  select helper_user_ids into v_picked from auction_settings where org_id = p_org and event_slug = p_event;
  if coalesce(cardinality(v_picked), 0) > 0 then
    select coalesce(array_agg(u), '{}') into v_out
      from unnest(v_picked) u where member_has_permission(p_org, u, 'events.bunfest.manage');
    if cardinality(v_out) > 0 then return v_out; end if;
  end if;
  select coalesce(array_agg(distinct m.user_id), '{}') into v_out
    from memberships m
   where m.org_id = p_org and member_has_permission(p_org, m.user_id, 'events.bunfest.manage');
  return v_out;
end $$;
revoke all on function auction_table_helpers(uuid, text) from public, anon, authenticated;

-- -------------------------------------------------------------
-- 3. The buyer: hold the item, pay at the table
-- -------------------------------------------------------------
create or replace function auction_buy_now_claim(p_item_id uuid, p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  s auction_settings;
  sa auction_sales;
  v_name  text := left(btrim(coalesce(p_name, '')), 80);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_close timestamptz;
  v_no    int;
  v_user  uuid;
begin
  if length(v_name) < 2 then raise exception 'Please give your name.'; end if;
  if length(v_phone) = 11 and left(v_phone, 1) = '1' then v_phone := substr(v_phone, 2); end if;
  if length(v_phone) < 7 or length(v_phone) > 15 then raise exception 'Please give a phone number we can reach you on.'; end if;

  select * into r from raffle_items where id = p_item_id for update;
  if not found or not r.is_published then raise exception 'That item is not in the auction.'; end if;
  if not feature_on(r.org_id, 'silent_auction_enabled') and not is_org_member(r.org_id) then
    raise exception 'The silent auction isn’t open right now.';
  end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  if s is null or not s.buy_now_at_table then raise exception 'Buy it now isn’t on right now. Please bid on the sheet.'; end if;
  if r.status <> 'available' then raise exception 'Sorry — someone has just bought this one.'; end if;
  if r.buy_now_cents is null then raise exception 'This item has no Buy it now price. Please bid on the sheet.'; end if;
  if s.bidding_opens_at is not null and now() < s.bidding_opens_at then raise exception 'The auction hasn’t opened yet.'; end if;
  v_close := auction_effective_close(r);
  if v_close is not null and now() >= v_close then raise exception 'Bidding on this item has closed.'; end if;

  -- A few holds at a time per phone, and a ceiling on a rush, so one person
  -- can't hold the whole table.
  if (select count(*) from auction_sales x
       where x.org_id = r.org_id and x.event_slug = r.event_slug and x.claim_token is not null
         and x.buyer_phone = v_phone and x.payment_status = 'pending') >= 3 then
    raise exception 'You have 3 items waiting at the auction table. Please pay for those first.';
  end if;
  if (select count(*) from auction_sales x
       where x.org_id = r.org_id and x.event_slug = r.event_slug and x.claim_token is not null
         and x.created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Lots of people are buying right now. Please go to the auction table.';
  end if;

  perform pg_advisory_xact_lock(hashtext('auction_pickup:' || r.org_id::text || ':' || r.event_slug));
  select coalesce(max(pickup_no), 0) + 1 into v_no
    from auction_sales where org_id = r.org_id and event_slug = r.event_slug;

  insert into auction_sales (org_id, event_slug, item_id, buyer_name, buyer_phone, kind, amount_cents,
                             fulfil, payment_status, claim_token, pickup_no, created_by)
  values (r.org_id, r.event_slug, r.id, v_name, v_phone, 'buy_now', r.buy_now_cents,
          'pickup', 'pending', gen_random_uuid(), v_no, auth.uid())
  returning * into sa;
  -- Sold on the catalog at once, so no one else can take it. Paper bids stay on the sheet.
  update raffle_items set status = 'won', won_kind = 'buy_now', current_bid_cents = r.buy_now_cents where id = r.id;

  foreach v_user in array auction_table_helpers(r.org_id, r.event_slug) loop
    insert into push_messages (org_id, topic, title, body, url, dedupe_key, only_user)
    values (r.org_id, 'auction', left('Buy it now: ' || r.title, 120),
            left(v_name || ' · ' || auction_money_text(r.buy_now_cents) || ' · pickup #' || v_no
                 || '. On the way to the auction table.', 400),
            '/staff/auction-desk', 'tablebuy:' || sa.id || ':' || v_user, v_user)
    on conflict (dedupe_key) do nothing;
  end loop;

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'auction.table_buy_now', 'auction_sale', sa.id::text,
          jsonb_build_object('item', r.title, 'amount_cents', r.buy_now_cents, 'pickup_no', v_no));

  return jsonb_build_object('sale_id', sa.id, 'claim_token', sa.claim_token, 'pickup_no', v_no,
                            'item_id', r.id, 'title', r.title, 'amount_cents', r.buy_now_cents);
end $$;
grant execute on function auction_buy_now_claim(uuid, text, text) to anon, authenticated;

-- The buyer's screen: is it still waiting, paid, or put back?
create or replace function auction_table_claim(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  sa auction_sales;
  r raffle_items;
  s auction_settings;
begin
  if p_token is null then return null; end if;
  select * into sa from auction_sales where claim_token = p_token;
  if not found then return null; end if;
  select * into r from raffle_items where id = sa.item_id;
  select * into s from auction_settings where org_id = sa.org_id and event_slug = sa.event_slug;
  return jsonb_build_object(
    'pickup_no', sa.pickup_no, 'item_id', sa.item_id, 'title', r.title, 'photo_url', r.photo_url,
    'amount_cents', sa.amount_cents, 'buyer_name', sa.buyer_name, 'created_at', sa.created_at,
    'payment_status', sa.payment_status, 'fulfil_status', sa.fulfil_status, 'paid_at', sa.paid_at,
    'state', case when sa.payment_status = 'void' then 'cancelled'
                  when sa.fulfil_status = 'picked_up' then 'done'
                  when sa.payment_status in ('cash', 'paid') then 'paid'
                  else 'waiting' end,
    'pickup_note', s.pickup_note);
end $$;
grant execute on function auction_table_claim(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- 4. Staff: the list at the table, the switch and the helpers
-- -------------------------------------------------------------
create or replace function auction_helper_candidates(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', m.user_id,
             'name', coalesce(nullif(btrim(coalesce(m.display_name, '')), ''), split_part(u.email::text, '@', 1)),
             'email', u.email,
             'has_alerts', exists (select 1 from push_subscriptions p where p.user_id = m.user_id))
           order by lower(coalesce(nullif(btrim(coalesce(m.display_name, '')), ''), u.email::text)))
      from memberships m join auth.users u on u.id = m.user_id
     where m.org_id = p_org and member_has_permission(p_org, m.user_id, 'events.bunfest.manage')), '[]'::jsonb);
end $$;
grant execute on function auction_helper_candidates(uuid) to authenticated;

create or replace function auction_table_claims(p_org uuid, p_event text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  select * into s from auction_settings where org_id = p_org and event_slug = p_event;
  return jsonb_build_object(
    'now', now(),
    'on', coalesce(s.buy_now_at_table, false),
    'helper_user_ids', to_jsonb(coalesce(s.helper_user_ids, '{}'::uuid[])),
    'notifications_on', feature_on(p_org, 'phone_notifications_enabled'),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
               'sale_id', sa.id, 'pickup_no', sa.pickup_no, 'item_id', sa.item_id,
               'title', r.title, 'photo_url', r.photo_url,
               'code', (select t.code from item_tags t where t.raffle_item_id = sa.item_id order by t.created_at limit 1),
               'amount_cents', sa.amount_cents, 'buyer_name', sa.buyer_name, 'buyer_phone', sa.buyer_phone,
               'payment_status', sa.payment_status, 'fulfil_status', sa.fulfil_status,
               'created_at', sa.created_at, 'paid_at', sa.paid_at, 'updated_at', sa.updated_at,
               'handled_by', (select coalesce(nullif(btrim(coalesce(m.display_name, '')), ''), split_part(u.email::text, '@', 1))
                                from memberships m join auth.users u on u.id = m.user_id
                               where m.org_id = sa.org_id and m.user_id = sa.fulfilled_by limit 1))
             order by sa.created_at desc)
        from (select * from auction_sales x
               where x.org_id = p_org and x.event_slug = p_event and x.claim_token is not null
               order by x.created_at desc limit 200) sa
        left join raffle_items r on r.id = sa.item_id), '[]'::jsonb));
end $$;
grant execute on function auction_table_claims(uuid, text) to authenticated;

create or replace function auction_set_table_buy_now(p_org uuid, p_event text, p_on boolean default null,
                                                     p_helpers uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s auction_settings;
  v_helpers uuid[];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  insert into auction_settings (org_id, event_slug) values (p_org, p_event) on conflict (org_id, event_slug) do nothing;
  if p_helpers is not null then
    select coalesce(array_agg(distinct u), '{}') into v_helpers
      from unnest(p_helpers) u where member_has_permission(p_org, u, 'events.bunfest.manage');
  end if;
  update auction_settings set
    buy_now_at_table = coalesce(p_on, buy_now_at_table),
    helper_user_ids = coalesce(v_helpers, helper_user_ids)
  where org_id = p_org and event_slug = p_event returning * into s;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'auction.table_buy_now_settings', 'auction', p_event,
          jsonb_strip_nulls(jsonb_build_object('on', p_on, 'helpers', cardinality(v_helpers))));
  return jsonb_build_object('on', s.buy_now_at_table, 'helper_user_ids', to_jsonb(s.helper_user_ids));
end $$;
grant execute on function auction_set_table_buy_now(uuid, text, boolean, uuid[]) to authenticated;

-- An item made in the Silent Auction screen has no DON number, so no label.
-- This gives it one (or returns the one it has).
create or replace function auction_item_label_code(p_item_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  v_code text;
  v_tag uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into r from raffle_items where id = p_item_id;
  if not found then raise exception 'Item not found'; end if;
  if not has_permission(r.org_id, 'events.bunfest.manage') and not can_manage_item_kind(r.org_id, 'auction') then
    raise exception 'Not allowed';
  end if;
  select code into v_code from item_tags where raffle_item_id = r.id order by created_at limit 1;
  if v_code is not null then return v_code; end if;
  v_code := new_item_code(r.org_id);
  insert into item_tags (org_id, code, kind, raffle_item_id, created_by)
  values (r.org_id, v_code, 'auction', r.id, auth.uid())
  returning id into v_tag;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'item.scanned', 'item_tag', v_tag::text,
          jsonb_build_object('code', v_code, 'kind', 'auction', 'title', r.title));
  return v_code;
end $$;
grant execute on function auction_item_label_code(uuid) to authenticated;

-- Check: three answers, all "true".
select
  exists (select 1 from information_schema.columns where table_name = 'auction_settings' and column_name = 'buy_now_at_table') as table_switch,
  exists (select 1 from information_schema.columns where table_name = 'auction_sales' and column_name = 'claim_token') as claim_column,
  exists (select 1 from pg_proc where proname = 'auction_buy_now_claim') as claim_function;
