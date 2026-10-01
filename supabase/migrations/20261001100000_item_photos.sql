-- =============================================================
-- Update 37 (2026-10-01): Up to four photos per item.
--
-- Every item (a donation still to sort, an auction lot, a raffle prize, shop
-- stock) keeps a list of photos, photo_urls, with the first one as its main
-- photo. The old photo_url column stays and always equals the first photo,
-- so labels, lists and the public pages keep working unchanged.
--
--   photo_urls text[]       on donation_items, raffle_items, raffle_prizes and
--                           hopshop_products (filled from photo_url)
--   clean_photo_urls()      blanks and repeats out, at most four
--   set_item_photos()       replace an item's photo list; the first becomes
--                           its main photo (staff; same rights as editing it)
--   tagged_item_json()      now returns photo_urls
--   save_scanned_item()     a new main photo replaces the first of the list;
--                           moving an item between kinds carries the list
--
-- Apply AFTER 20260930120000_donations_catalog.sql. Paste + Run in the
-- Supabase SQL editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. The column, on all four item tables, filled from photo_url
-- -------------------------------------------------------------
alter table raffle_items     add column if not exists photo_urls text[] not null default '{}';
alter table raffle_prizes    add column if not exists photo_urls text[] not null default '{}';
alter table donation_items   add column if not exists photo_urls text[] not null default '{}';
alter table hopshop_products add column if not exists photo_urls text[] not null default '{}';

update raffle_items     set photo_urls = array[photo_url] where photo_url is not null and cardinality(photo_urls) = 0;
update raffle_prizes    set photo_urls = array[photo_url] where photo_url is not null and cardinality(photo_urls) = 0;
update donation_items   set photo_urls = array[photo_url] where photo_url is not null and cardinality(photo_urls) = 0;
update hopshop_products set photo_urls = array[photo_url] where photo_url is not null and cardinality(photo_urls) = 0;

-- Blanks and repeats out, order kept, at most four.
create or replace function clean_photo_urls(p text[]) returns text[]
language sql immutable as $$
  select coalesce(
    (select array_agg(u order by ord)
       from (select u, min(ord) as ord
               from unnest(coalesce(p, '{}'::text[])) with ordinality as x(u, ord)
              where nullif(btrim(u), '') is not null
              group by u
              order by min(ord)
              limit 4) d),
    '{}'::text[]);
$$;

-- -------------------------------------------------------------
-- 2. The item as JSON, now with photo_urls
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
      'price_cents', null, 'quantity', null, 'received_on', d.received_on)
    into j from donation_items d where d.id = p_tag.donation_id;
  else
    select jsonb_build_object(
      'ref_id', p.id, 'title', p.name, 'description', p.description,
      'donated_by', null, 'value_cents', null, 'photo_url', p.photo_url,
      'photo_urls', to_jsonb(coalesce(p.photo_urls, '{}'::text[])),
      'status', case when p.is_active then 'active' else 'inactive' end,
      'is_published', p.is_active, 'session', null,
      'price_cents', p.price_cents, 'quantity', coalesce(i.quantity, 0))
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
-- 3. Replace an item's photo list (the first becomes the main photo)
-- -------------------------------------------------------------
create or replace function set_item_photos(p_org uuid, p_code text, p_photo_urls text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := normalize_item_code(p_code);
  v      text[] := clean_photo_urls(p_photo_urls);
  t      item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from item_tags where org_id = p_org and code = v_code for update;
  if not found then raise exception 'No item has the code %', v_code; end if;
  if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
  if t.kind = 'auction' then
    update raffle_items set photo_urls = v, photo_url = v[1] where id = t.raffle_item_id;
  elsif t.kind = 'raffle' then
    update raffle_prizes set photo_urls = v, photo_url = v[1] where id = t.raffle_prize_id;
  elsif t.kind = 'donation' then
    update donation_items set photo_urls = v, photo_url = v[1] where id = t.donation_id;
  else
    update hopshop_products set photo_urls = v, photo_url = v[1] where id = t.product_id;
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item.photos', 'item_tag', t.id::text,
          jsonb_build_object('code', v_code, 'count', cardinality(v)));
  select * into t from item_tags where id = t.id;
  return tagged_item_json(t);
end $$;
grant execute on function set_item_photos(uuid, text, text[]) to authenticated;

-- -------------------------------------------------------------
-- 4. save_scanned_item(): the list follows the main photo and survives a move
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
  new_id  uuid;
  old_kind text;
  old_ref  uuid;
  old_photos text[] := '{}';
  v_photos text[];
  v_photo  text;
  v_exists boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_code is null then raise exception 'That code is empty'; end if;
  if p_kind not in ('auction', 'raffle', 'stock', 'donation') then raise exception 'Unknown item type'; end if;
  if not can_manage_item_kind(p_org, p_kind) then raise exception 'Not allowed'; end if;
  if v_title is null then raise exception 'Give the item a name'; end if;

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
        photo_urls = case when p_photo_url is null then photo_urls else clean_photo_urls(array[p_photo_url] || photo_urls[2:]) end
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
  -- the photo list; a main photo given with the move leads it.
  if v_exists then
    if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
    old_kind := t.kind;
    old_ref  := coalesce(t.raffle_item_id, t.raffle_prize_id, t.product_id, t.donation_id);
    if old_kind = 'auction' then select photo_urls into old_photos from raffle_items where id = old_ref;
    elsif old_kind = 'raffle' then select photo_urls into old_photos from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then select photo_urls into old_photos from donation_items where id = old_ref;
    else select photo_urls into old_photos from hopshop_products where id = old_ref; end if;
    old_photos := coalesce(old_photos, '{}');
  end if;
  v_photos := case when p_photo_url is null then clean_photo_urls(old_photos)
                   else clean_photo_urls(array[p_photo_url] || old_photos[2:]) end;
  v_photo  := v_photos[1];

  if p_kind = 'auction' then
    insert into raffle_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, session, created_by,
                              sort_order)
    values (p_org, v_title, p_description, p_donated_by, p_value_cents, v_photo, v_photos,
            coalesce(p_session, 'all-day'), auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_items where org_id = p_org), 10))
    returning id into new_id;
  elsif p_kind = 'raffle' then
    insert into raffle_prizes (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by, sort_order)
    values (p_org, v_title, p_description, p_donated_by, p_value_cents, v_photo, v_photos, auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_prizes where org_id = p_org), 10))
    returning id into new_id;
  elsif p_kind = 'donation' then
    insert into donation_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by)
    values (p_org, v_title, p_description, p_donated_by, p_value_cents, v_photo, v_photos, auth.uid())
    returning id into new_id;
  else
    if not has_permission(p_org, 'hopshop.products.create') then
      raise exception 'Not allowed to add products';
    end if;
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, photo_urls, created_by)
    values (p_org, v_title, p_description, coalesce(p_price_cents, 0), v_code, v_photo, v_photos, auth.uid())
    returning id into new_id;
    insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
    values (new_id, p_org, greatest(0, coalesce(p_quantity, 1)), auth.uid());
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
