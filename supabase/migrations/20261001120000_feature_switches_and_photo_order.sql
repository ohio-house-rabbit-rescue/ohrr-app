-- =============================================================
-- Update 38 (2026-10-01): Feature switches for Founders and Developers, and
-- every photo of an item on the public pages, in the order staff set.
--
-- FEATURE SWITCHES. Staff → Features already holds on/off switches in
-- app_settings (keys ending "_enabled"). From now on only a Founder or a
-- Developer may flip one; other settings (OHRR details, the door) keep their
-- "Change app settings" task. Each change is written to the audit log.
-- Three new switches arrive with the app: Silent Auction, Hop Shop items
-- online and Phone notifications. A missing row counts as ON, so nothing
-- changes until a switch is flipped. Switched OFF:
--   Silent Auction        the public catalog and an item's tag page show no
--                         items (signed-in staff still see them), online
--                         bidding is closed and can't be reopened until the
--                         switch is back on
--   Hop Shop items online the public shelf lists nothing (staff still see it)
--   Phone notifications   nothing new is sent (messages wait, unsent)
--
-- PHOTOS. Update 37 gave items up to four photos (photo_urls, cover first).
-- The public auction catalog, an item's tag page and the Hop Shop shelf now
-- return photo_urls too, so an item opens on all its photos in order.
--
-- Apply AFTER 20261001100000_item_photos.sql. Paste + Run in the Supabase SQL
-- editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Is a switch on? (a missing row = on)
-- -------------------------------------------------------------
create or replace function feature_on(p_org uuid, p_key text, p_default boolean default true)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when jsonb_typeof(value -> 'enabled') = 'boolean' then (value ->> 'enabled')::boolean end
       from app_settings where org_id = p_org and key = p_key),
    p_default);
$$;
grant execute on function feature_on(uuid, text, boolean) to anon, authenticated;

-- -------------------------------------------------------------
-- 2. Who may change a setting: switches = Founders and Developers only
-- -------------------------------------------------------------
create or replace function can_set_app_setting(p_org uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_key like '%\_enabled' escape '\' then coalesce(is_all_access_level(my_level(p_org)), false)
    else has_permission(p_org, 'settings.manage')
  end;
$$;
grant execute on function can_set_app_setting(uuid, text) to authenticated;

drop policy if exists app_settings_insert on app_settings;
create policy app_settings_insert on app_settings for insert
  with check (can_set_app_setting(org_id, key));
drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings for update
  using (can_set_app_setting(org_id, key))
  with check (can_set_app_setting(org_id, key));
drop policy if exists app_settings_delete on app_settings;
create policy app_settings_delete on app_settings for delete
  using (can_set_app_setting(org_id, key));

-- -------------------------------------------------------------
-- 3. After a switch changes: audit it; the auction switch closes bidding
-- -------------------------------------------------------------
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
    update auction_settings set bidding_enabled = false where org_id = new.org_id and bidding_enabled;
  end if;
  return null;
end $$;
drop trigger if exists trg_app_settings_switch on app_settings;
create trigger trg_app_settings_switch after insert or update on app_settings
  for each row execute function app_settings_switch_changed();

-- Online bidding can't be switched on while the Silent Auction is off.
create or replace function auction_settings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.bidding_enabled, false) then return new; end if;
  if tg_op = 'UPDATE' then
    if coalesce(old.bidding_enabled, false) then return new; end if;  -- already on: other edits pass
  end if;
  if not feature_on(new.org_id, 'silent_auction_enabled') then
    raise exception 'The Silent Auction is switched off. A Founder or Developer can switch it on in Staff → Features first.';
  end if;
  return new;
end $$;
drop trigger if exists trg_auction_settings_guard on auction_settings;
create trigger trg_auction_settings_guard before insert or update on auction_settings
  for each row execute function auction_settings_guard();

-- -------------------------------------------------------------
-- 4. The public auction: every photo, and hidden while switched off
-- -------------------------------------------------------------
create or replace function auction_item_json(p_item raffle_items, p_settings auction_settings)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', p_item.id,
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

create or replace function auction_catalog(p_event text default 'midwest-bunfest-2026')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid;
  v_on  boolean;
  s auction_settings;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  v_on := feature_on(v_org, 'silent_auction_enabled');
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
  if not feature_on(r.org_id, 'silent_auction_enabled') and not is_org_member(r.org_id) then return null; end if;
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  return auction_item_json(r, s);
end $$;
grant execute on function auction_item_by_code(text) to anon, authenticated;

-- -------------------------------------------------------------
-- 5. The Hop Shop shelf: every photo, and hidden while switched off
-- -------------------------------------------------------------
drop function if exists hopshop_public_products();
create or replace function hopshop_public_products()
returns table (
  id uuid, name text, description text, price_cents int, photo_url text, photo_urls text[], in_stock boolean
) language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.description, p.price_cents, p.photo_url,
         coalesce(p.photo_urls, '{}'::text[]),
         -- no inventory row = never counted = assume it is there
         coalesce(i.quantity, 1) > 0 as in_stock
    from hopshop_products p
    left join hopshop_inventory i on i.product_id = p.id
   where p.is_active
     and (feature_on(p.org_id, 'hop_shop_items_enabled') or is_org_member(p.org_id))
   order by (coalesce(i.quantity, 1) > 0) desc, p.name;
$$;
grant execute on function hopshop_public_products() to anon, authenticated;

-- -------------------------------------------------------------
-- 6. Phone notifications: nothing is sent while switched off
-- -------------------------------------------------------------
create or replace function push_messages_send() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is not null and not feature_on(new.org_id, 'phone_notifications_enabled') then
    return null;  -- kept, unsent
  end if;
  perform call_ohrr_jobs(jsonb_build_object('action', 'push', 'id', new.id));
  return null;
end $$;
