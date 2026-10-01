-- =============================================================
-- Update 39 (2026-10-01): More details on a donation.
--
-- The person cataloging can now note, for each donated item:
--   quantity      how many of it (6 bags of hay = one item, quantity 6)
--   price_cents   a possible price for one, if it may be sold
--   condition     new, like new, good or fair
--   category      what sort of thing it is (food & hay, toys, gift basket …)
--   location      where it is kept (a bin, a shelf, a closet)
-- next to what was already there: who gave it, its value and notes.
--
-- When a donation is sorted, the details go with it:
--   into Hop Shop stock   price, how many, category, and the place it is kept
--                          (the product's "shelf")
--   into the auction or   its value and notes; the condition is added to the
--   the raffle            notes ("Condition: like new.")
--
--   donation_items        + quantity, price_cents, condition, category, location
--   tagged_item_json()    returns them (and category/location for shop stock)
--   save_scanned_item()   saves quantity/price on donations; carries details
--                         across a move (same signature as before)
--   set_item_extras()     condition, category, location for one item
--   catalog_new_item()    takes the new details in the same call
--   catalog_suggestions() recent places and categories, for one-tap chips
--
-- Apply AFTER 20261001120000_feature_switches_and_photo_order.sql. Paste + Run
-- in the Supabase SQL editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. The new details
-- -------------------------------------------------------------
alter table donation_items add column if not exists quantity    int not null default 1 check (quantity between 1 and 9999);
alter table donation_items add column if not exists price_cents int check (price_cents is null or price_cents >= 0);
alter table donation_items add column if not exists condition   text check (condition is null or condition in ('new', 'like_new', 'good', 'fair'));
alter table donation_items add column if not exists category    text;
alter table donation_items add column if not exists location    text;

create or replace function condition_label(p text) returns text
language sql immutable as $$
  select case p when 'new' then 'New' when 'like_new' then 'Like new' when 'good' then 'Good' when 'fair' then 'Fair' end;
$$;

-- -------------------------------------------------------------
-- 2. The item as JSON, now with the details
-- -------------------------------------------------------------
create or replace function tagged_item_json(p_tag item_tags)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
begin
  if p_tag.kind = 'auction' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'photo_urls', to_jsonb(coalesce(r.photo_urls, '{}'::text[])),
      'status', r.status, 'is_published', r.is_published, 'session', r.session,
      'price_cents', null, 'quantity', null)
    into j from raffle_items r where r.id = p_tag.raffle_item_id;
  elsif p_tag.kind = 'raffle' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'photo_urls', to_jsonb(coalesce(r.photo_urls, '{}'::text[])),
      'status', r.status, 'is_published', r.is_published, 'session', null,
      'price_cents', null, 'quantity', null)
    into j from raffle_prizes r where r.id = p_tag.raffle_prize_id;
  elsif p_tag.kind = 'donation' then
    select jsonb_build_object(
      'ref_id', d.id, 'title', d.title, 'description', d.description,
      'donated_by', d.donated_by, 'value_cents', d.value_cents, 'photo_url', d.photo_url,
      'photo_urls', to_jsonb(coalesce(d.photo_urls, '{}'::text[])),
      'status', 'unsorted', 'is_published', false, 'session', null,
      'price_cents', d.price_cents, 'quantity', d.quantity,
      'condition', d.condition, 'category', d.category, 'location', d.location,
      'received_on', d.received_on)
    into j from donation_items d where d.id = p_tag.donation_id;
  else
    select jsonb_build_object(
      'ref_id', p.id, 'title', p.name, 'description', p.description,
      'donated_by', null, 'value_cents', null, 'photo_url', p.photo_url,
      'photo_urls', to_jsonb(coalesce(p.photo_urls, '{}'::text[])),
      'status', case when p.is_active then 'active' else 'inactive' end,
      'is_published', p.is_active, 'session', null,
      'price_cents', p.price_cents, 'quantity', coalesce(i.quantity, 0),
      'category', p.category, 'location', p.shelf)
    into j from hopshop_products p
      left join hopshop_inventory i on i.product_id = p.id
     where p.id = p_tag.product_id;
  end if;
  if j is null then return null; end if;
  return j || jsonb_build_object(
    'tag_id', p_tag.id, 'code', p_tag.code, 'kind', p_tag.kind,
    'label_printed_at', p_tag.label_printed_at,
    'created_at', p_tag.created_at, 'updated_at', p_tag.updated_at);
end $$;

-- -------------------------------------------------------------
-- 3. save_scanned_item(): donations keep quantity and price; a move carries
--    the details (same arguments as before, so every caller keeps working)
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
  v_exists boolean;
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
  -- being sorted hands on its details.
  if v_exists then
    if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
    old_kind := t.kind;
    old_ref  := coalesce(t.raffle_item_id, t.raffle_prize_id, t.product_id, t.donation_id);
    if old_kind = 'auction' then select photo_urls into old_photos from raffle_items where id = old_ref;
    elsif old_kind = 'raffle' then select photo_urls into old_photos from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then
      select * into d from donation_items where id = old_ref;
      old_photos := d.photo_urls;
      v_desc  := coalesce(v_desc, nullif(btrim(coalesce(d.description, '')), ''));
      v_value := coalesce(v_value, d.value_cents);
      v_price := coalesce(v_price, d.price_cents);
      v_qty   := coalesce(v_qty, d.quantity);
      v_cat   := d.category;
      v_place := d.location;
      if p_kind in ('auction', 'raffle') and d.condition is not null
         and position('condition:' in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Condition: ' || lower(condition_label(d.condition)) || '.');
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
    insert into donation_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by,
                                price_cents, quantity)
    values (p_org, v_title, v_desc, p_donated_by, v_value, v_photo, v_photos, auth.uid(),
            v_price, greatest(1, coalesce(v_qty, 1)))
    returning id into new_id;
  else
    if not has_permission(p_org, 'hopshop.products.create') then
      raise exception 'Not allowed to add products';
    end if;
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, photo_urls, created_by, category, shelf)
    values (p_org, v_title, v_desc, coalesce(v_price, 0), v_code, v_photo, v_photos, auth.uid(), v_cat, v_place)
    returning id into new_id;
    insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
    values (new_id, p_org, greatest(0, coalesce(v_qty, 1)), auth.uid());
  end if;

  if v_exists then
    update item_tags set
      kind = p_kind,
      raffle_item_id  = case when p_kind = 'auction'  then new_id end,
      raffle_prize_id = case when p_kind = 'raffle'   then new_id end,
      product_id      = case when p_kind = 'stock'    then new_id end,
      donation_id     = case when p_kind = 'donation' then new_id end
    where id = t.id;
    -- the old row is gone with the tag re-pointed (cascade no longer applies)
    if old_kind = 'auction' then delete from raffle_items  where id = old_ref;
    elsif old_kind = 'raffle' then delete from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then delete from donation_items where id = old_ref;
    else delete from hopshop_products where id = old_ref; end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.moved', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'from', old_kind, 'to', p_kind, 'title', v_title));
  else
    insert into item_tags (org_id, code, kind, raffle_item_id, raffle_prize_id, product_id, donation_id, created_by)
    values (p_org, v_code, p_kind,
            case when p_kind = 'auction'  then new_id end,
            case when p_kind = 'raffle'   then new_id end,
            case when p_kind = 'stock'    then new_id end,
            case when p_kind = 'donation' then new_id end,
            auth.uid())
    returning * into t;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.scanned', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'kind', p_kind, 'title', v_title));
  end if;

  select * into t from item_tags where org_id = p_org and code = v_code;
  return tagged_item_json(t);
end $$;
grant execute on function save_scanned_item(uuid, text, text, text, text, text, int, text, int, int, text) to authenticated;

-- -------------------------------------------------------------
-- 4. Condition, category and place for one item
--    (a donation keeps all three; shop stock keeps category and its shelf)
-- -------------------------------------------------------------
create or replace function set_item_extras(p_org uuid, p_code text, p_condition text default null,
                                           p_category text default null, p_location text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := normalize_item_code(p_code);
  v_cond text := nullif(btrim(coalesce(p_condition, '')), '');
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
      category  = nullif(btrim(coalesce(p_category, '')), ''),
      location  = nullif(btrim(coalesce(p_location, '')), '')
    where id = t.donation_id;
  elsif t.kind = 'stock' then
    update hopshop_products set
      category = nullif(btrim(coalesce(p_category, '')), ''),
      shelf    = nullif(btrim(coalesce(p_location, '')), '')
    where id = t.product_id;
  end if;
  return tagged_item_json(t);
end $$;
grant execute on function set_item_extras(uuid, text, text, text, text) to authenticated;

-- -------------------------------------------------------------
-- 5. catalog_new_item() takes the new details in the same call
-- -------------------------------------------------------------
drop function if exists catalog_new_item(uuid, text, text, text, text, int, text, int, int, text);
create or replace function catalog_new_item(
  p_org uuid, p_title text, p_kind text default 'donation',
  p_description text default null, p_donated_by text default null,
  p_value_cents int default null, p_photo_url text default null,
  p_price_cents int default null, p_quantity int default null,
  p_code text default null,
  p_condition text default null, p_category text default null, p_location text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := nullif(normalize_item_code(p_code), '');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_code is null then v_code := new_item_code(p_org); end if;
  if exists (select 1 from item_tags where org_id = p_org and code = v_code) then
    raise exception 'Code % is already on another item', v_code;
  end if;
  perform save_scanned_item(p_org, v_code, p_kind, p_title, p_description, p_donated_by,
                            p_value_cents, p_photo_url, p_price_cents, p_quantity, null);
  if p_condition is not null or p_category is not null or p_location is not null then
    perform set_item_extras(p_org, v_code, p_condition, p_category, p_location);
  end if;
  return tagged_item_json((select x from item_tags x where x.org_id = p_org and x.code = v_code));
end $$;
grant execute on function catalog_new_item(uuid, text, text, text, text, int, text, int, int, text, text, text, text) to authenticated;

-- -------------------------------------------------------------
-- 6. Places and categories typed lately, for one-tap chips
-- -------------------------------------------------------------
create or replace function catalog_suggestions(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not is_org_member(p_org) then jsonb_build_object('locations', '[]'::jsonb, 'categories', '[]'::jsonb)
  else jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(name order by last_used desc) from (
        select btrim(location) as name, max(created_at) as last_used
          from donation_items where org_id = p_org and nullif(btrim(coalesce(location, '')), '') is not null
         group by btrim(location) order by max(created_at) desc limit 10) l), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(name order by last_used desc) from (
        select name, max(used) as last_used from (
          select btrim(category) as name, created_at as used from donation_items
           where org_id = p_org and nullif(btrim(coalesce(category, '')), '') is not null
          union all
          select btrim(category), updated_at from hopshop_products
           where org_id = p_org and nullif(btrim(coalesce(category, '')), '') is not null) u
         group by name order by max(used) desc limit 12) c), '[]'::jsonb))
  end;
$$;
grant execute on function catalog_suggestions(uuid) to authenticated;
