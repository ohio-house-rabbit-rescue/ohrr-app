-- =============================================================
-- Update 40 (2026-10-01): Donation intake — drop-offs, where it's headed,
-- value each or for all, split a lot, baskets, and the monthly report.
--
-- OHRR: "we get a donation and then you ask where it goes. we need to add
-- things and tell it a donation, then we sort it out later or a hop shop …
-- the donation should have also a value input … we need an each, or box
-- version for the value … a simple check the box for a donation that we know
-- goes to a raffle or a silent auction."
--
--   donation_dropoffs      one drop-off: who gave it, when, their email (for
--                          the thank-you), whether they've been thanked
--   donation_items         + dropoff_id, headed_for (raffle / auction / shop /
--                          rabbits), value_basis (each / all), size, use_by,
--                          outcome (sorted / basket / rabbits / passed_on),
--                          sorted_kind, sorted_tag_id, split_from
--
-- A donation now STAYS a donation record after it is sorted (outcome
-- 'sorted', pointing at the item it became), so drop-off letters and the
-- monthly report still see it. Its label code moves with the item, as before.
--
--   start_dropoff() update_dropoff() set_dropoff_thanked() list_dropoffs()
--   dropoff_detail()       drop-offs and the thank-you letter
--   set_donation_plan()    headed for, value each/all, size, use-by, drop-off
--   set_donation_outcome() used for the rabbits / passed on / undo
--   split_donation()       take some of a lot off as its own item
--   make_basket()          several donations → one raffle prize or auction lot
--   sort_headed_donations() move every donation headed for X in one go
--   donations_received()   every donation in a date range, for the report
--   catalog_new_item()     + p_plan (the above, in the same call)
--   save_scanned_item()    keeps the donation record; carries size, use-by and
--                          the value for the whole lot; a donation moved into
--                          the shop without a price stays hidden until priced
--   tagged_item_json()     the new fields; a basket lists what's in it
--   delete_item_by_code()  deleting a basket frees what was in it
--   recent_donors()        drop-off names too
--
-- Apply AFTER 20261001140000_donation_details.sql. Paste + Run in the
-- Supabase SQL editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Drop-offs and the new donation fields
-- -------------------------------------------------------------
create table if not exists donation_dropoffs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  donor_name   text,
  donor_email  text,
  received_on  date not null default ((now() at time zone 'America/New_York')::date),
  note         text,
  thanked_at   timestamptz,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_donation_dropoffs_org on donation_dropoffs(org_id, received_on desc, created_at desc);

drop trigger if exists trg_donation_dropoffs_updated on donation_dropoffs;
create trigger trg_donation_dropoffs_updated before update on donation_dropoffs
  for each row execute function set_updated_at();

alter table donation_dropoffs enable row level security;
drop policy if exists donation_dropoffs_select on donation_dropoffs;
create policy donation_dropoffs_select on donation_dropoffs for select
  using (can_manage_item_kind(org_id, 'donation'));
grant select on donation_dropoffs to authenticated;

alter table donation_items add column if not exists dropoff_id    uuid references donation_dropoffs(id) on delete set null;
alter table donation_items add column if not exists headed_for    text check (headed_for is null or headed_for in ('raffle', 'auction', 'shop', 'rabbits'));
alter table donation_items add column if not exists value_basis   text not null default 'each' check (value_basis in ('each', 'all'));
alter table donation_items add column if not exists size          text;
alter table donation_items add column if not exists use_by        date;
alter table donation_items add column if not exists outcome       text check (outcome is null or outcome in ('sorted', 'basket', 'rabbits', 'passed_on'));
alter table donation_items add column if not exists outcome_at    timestamptz;
alter table donation_items add column if not exists outcome_note  text;
alter table donation_items add column if not exists sorted_kind   text check (sorted_kind is null or sorted_kind in ('auction', 'raffle', 'stock'));
alter table donation_items add column if not exists sorted_tag_id uuid references item_tags(id) on delete set null;
alter table donation_items add column if not exists split_from    uuid references donation_items(id) on delete set null;
create index if not exists idx_donation_items_dropoff on donation_items(dropoff_id);
create index if not exists idx_donation_items_sorted_tag on donation_items(sorted_tag_id);
create index if not exists idx_donation_items_received on donation_items(org_id, received_on);

-- What one is worth, and the whole lot, whichever way it was typed.
create or replace function donation_value_total(p_value int, p_basis text, p_qty int) returns int
language sql immutable as $$
  select case when p_value is null then null
              when p_basis = 'all' then p_value
              else p_value * greatest(1, coalesce(p_qty, 1)) end;
$$;
create or replace function donation_value_each(p_value int, p_basis text, p_qty int) returns int
language sql immutable as $$
  select case when p_value is null then null
              when p_basis = 'all' then round(p_value::numeric / greatest(1, coalesce(p_qty, 1)))::int
              else p_value end;
$$;

-- -------------------------------------------------------------
-- 2. The item as JSON: donations carry the new fields; a basket lists
--    what's in it
-- -------------------------------------------------------------
create or replace function tagged_item_json(p_tag item_tags)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
  v_contents jsonb;
begin
  if p_tag.kind in ('auction', 'raffle') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'code', dt.code, 'title', d.title, 'quantity', d.quantity, 'size', d.size,
             'donated_by', d.donated_by,
             'value_total_cents', donation_value_total(d.value_cents, d.value_basis, d.quantity))
             order by d.created_at), '[]'::jsonb)
      into v_contents
      from donation_items d
      left join item_tags dt on dt.donation_id = d.id
     where d.sorted_tag_id = p_tag.id and d.outcome = 'basket';
  end if;

  if p_tag.kind = 'auction' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'photo_urls', to_jsonb(coalesce(r.photo_urls, '{}'::text[])),
      'status', r.status, 'is_published', r.is_published, 'session', r.session,
      'price_cents', null, 'quantity', null, 'contents', v_contents)
    into j from raffle_items r where r.id = p_tag.raffle_item_id;
  elsif p_tag.kind = 'raffle' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'photo_urls', to_jsonb(coalesce(r.photo_urls, '{}'::text[])),
      'status', r.status, 'is_published', r.is_published, 'session', null,
      'price_cents', null, 'quantity', null, 'contents', v_contents)
    into j from raffle_prizes r where r.id = p_tag.raffle_prize_id;
  elsif p_tag.kind = 'donation' then
    select jsonb_build_object(
      'ref_id', d.id, 'title', d.title, 'description', d.description,
      'donated_by', d.donated_by, 'value_cents', d.value_cents, 'photo_url', d.photo_url,
      'photo_urls', to_jsonb(coalesce(d.photo_urls, '{}'::text[])),
      'status', coalesce(d.outcome, 'unsorted'), 'is_published', false, 'session', null,
      'price_cents', d.price_cents, 'quantity', d.quantity,
      'condition', d.condition, 'category', d.category, 'location', d.location,
      'received_on', d.received_on,
      'headed_for', d.headed_for, 'value_basis', d.value_basis,
      'value_each_cents', donation_value_each(d.value_cents, d.value_basis, d.quantity),
      'value_total_cents', donation_value_total(d.value_cents, d.value_basis, d.quantity),
      'size', d.size, 'use_by', d.use_by,
      'outcome', d.outcome, 'outcome_at', d.outcome_at, 'outcome_note', d.outcome_note,
      'dropoff_id', d.dropoff_id, 'split_from', d.split_from,
      'in_basket', case when d.outcome = 'basket' and bt.id is not null then jsonb_build_object(
                     'code', bt.code, 'kind', bt.kind,
                     'title', coalesce((select r.title from raffle_items r where r.id = bt.raffle_item_id),
                                       (select r.title from raffle_prizes r where r.id = bt.raffle_prize_id))) end)
    into j from donation_items d
      left join item_tags bt on bt.id = d.sorted_tag_id
     where d.id = p_tag.donation_id;
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
-- 3. save_scanned_item(): a sorted donation stays on record; the move
--    carries size, use-by and the whole lot's value (same arguments)
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
  prior   donation_items;
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
  v_from_donation boolean := false;
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
  -- being sorted hands on its details and stays on record.
  if v_exists then
    if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
    old_kind := t.kind;
    old_ref  := coalesce(t.raffle_item_id, t.raffle_prize_id, t.product_id, t.donation_id);
    if old_kind = 'auction' then select photo_urls into old_photos from raffle_items where id = old_ref;
    elsif old_kind = 'raffle' then select photo_urls into old_photos from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then
      select * into d from donation_items where id = old_ref;
      if d.outcome = 'basket' then
        raise exception 'This is in a basket. Take it out of the basket first.';
      end if;
      v_from_donation := true;
      old_photos := d.photo_urls;
      v_desc  := coalesce(v_desc, nullif(btrim(coalesce(d.description, '')), ''));
      v_value := coalesce(v_value, donation_value_total(d.value_cents, d.value_basis, d.quantity));
      v_price := coalesce(v_price, d.price_cents);
      v_qty   := coalesce(v_qty, d.quantity);
      v_cat   := d.category;
      v_place := d.location;
      if p_kind in ('auction', 'raffle') and d.condition is not null
         and position('condition:' in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Condition: ' || lower(condition_label(d.condition)) || '.');
      end if;
      if nullif(btrim(coalesce(d.size, '')), '') is not null
         and position(lower(btrim(d.size)) in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Size: ' || btrim(d.size) || '.');
      end if;
      if d.use_by is not null and position('use by' in lower(coalesce(v_desc, ''))) = 0 then
        v_desc := btrim(coalesce(v_desc || ' ', '') || 'Use by ' || to_char(d.use_by, 'MM/DD/YYYY') || '.');
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
    -- Back to a donation: re-open the record it came from, if there is one.
    if v_exists then
      select * into prior from donation_items
       where sorted_tag_id = t.id and outcome = 'sorted'
       order by outcome_at desc nulls last limit 1;
    end if;
    if prior.id is not null then
      update donation_items set
        title = v_title, description = v_desc, donated_by = p_donated_by,
        photo_url = v_photo, photo_urls = v_photos,
        value_cents = coalesce(p_value_cents, value_cents),
        value_basis = case when p_value_cents is not null then 'all' else value_basis end,
        price_cents = coalesce(v_price, price_cents),
        quantity = greatest(1, coalesce(v_qty, quantity)),
        outcome = null, outcome_at = null, outcome_note = null, sorted_kind = null, sorted_tag_id = null
      where id = prior.id;
      new_id := prior.id;
    else
      insert into donation_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by,
                                  price_cents, quantity)
      values (p_org, v_title, v_desc, p_donated_by, v_value, v_photo, v_photos, auth.uid(),
              v_price, greatest(1, coalesce(v_qty, 1)))
      returning id into new_id;
    end if;
  else
    if not has_permission(p_org, 'hopshop.products.create') then
      raise exception 'Not allowed to add products';
    end if;
    -- A donation moved into the shop without a price stays hidden until priced.
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, photo_urls, created_by, category, shelf,
                                  is_active)
    values (p_org, v_title, v_desc, coalesce(v_price, 0), v_code, v_photo, v_photos, auth.uid(), v_cat, v_place,
            not (v_from_donation and coalesce(v_price, 0) = 0))
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
    -- The old row goes; a donation stays on record as sorted into the new item.
    if old_kind = 'auction' then delete from raffle_items  where id = old_ref;
    elsif old_kind = 'raffle' then delete from raffle_prizes where id = old_ref;
    elsif old_kind = 'donation' then
      update donation_items set outcome = 'sorted', outcome_at = now(), sorted_kind = p_kind, sorted_tag_id = t.id
       where id = old_ref;
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

-- Deleting a basket frees what was in it (they go back to waiting).
create or replace function delete_item_by_code(p_org uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code);
  if not found then return; end if;
  if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
  update donation_items set outcome = null, outcome_at = null, sorted_kind = null, sorted_tag_id = null
   where sorted_tag_id = t.id and outcome = 'basket';
  if t.kind = 'auction' then delete from raffle_items where id = t.raffle_item_id;
  elsif t.kind = 'raffle' then delete from raffle_prizes where id = t.raffle_prize_id;
  elsif t.kind = 'donation' then delete from donation_items where id = t.donation_id;
  else delete from hopshop_products where id = t.product_id; end if;
  delete from item_tags where id = t.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item.deleted', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'kind', t.kind));
end $$;
grant execute on function delete_item_by_code(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 4. Drop-offs
-- -------------------------------------------------------------
-- One drop-off as JSON, with its totals (pieces and value include split-off parts).
create or replace function dropoff_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'donor_name', o.donor_name, 'donor_email', o.donor_email,
    'received_on', o.received_on, 'note', o.note, 'thanked_at', o.thanked_at,
    'created_at', o.created_at,
    'items', (select count(*) from donation_items d where d.dropoff_id = o.id and d.split_from is null),
    'pieces', (select coalesce(sum(d.quantity), 0) from donation_items d where d.dropoff_id = o.id),
    'value_total_cents', (select sum(donation_value_total(d.value_cents, d.value_basis, d.quantity))
                            from donation_items d where d.dropoff_id = o.id))
  from donation_dropoffs o where o.id = p_id;
$$;
revoke all on function dropoff_json(uuid) from public, anon;

-- One donation line (for a drop-off and the report): where it is now.
create or replace function donation_line_json(d donation_items)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', d.id, 'title', d.title, 'size', d.size, 'quantity', d.quantity,
    'value_cents', d.value_cents, 'value_basis', d.value_basis,
    'value_each_cents', donation_value_each(d.value_cents, d.value_basis, d.quantity),
    'value_total_cents', donation_value_total(d.value_cents, d.value_basis, d.quantity),
    'donated_by', d.donated_by, 'received_on', d.received_on, 'dropoff_id', d.dropoff_id,
    'headed_for', d.headed_for, 'outcome', d.outcome, 'outcome_at', d.outcome_at,
    'sorted_kind', d.sorted_kind, 'split_from', d.split_from, 'photo_url', d.photo_url,
    'use_by', d.use_by, 'created_at', d.created_at,
    'code', (select t.code from item_tags t where t.donation_id = d.id limit 1),
    'went_to', (select jsonb_build_object('code', st.code, 'kind', st.kind, 'title', tagged_item_json(st)->>'title')
                  from item_tags st where st.id = d.sorted_tag_id));
$$;
revoke all on function donation_line_json(donation_items) from public, anon;

create or replace function start_dropoff(p_org uuid, p_donor_name text default null, p_donor_email text default null,
                                         p_received_on date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_donor_email, ''))), '');
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email doesn''t look right';
  end if;
  insert into donation_dropoffs (org_id, donor_name, donor_email, received_on, note, created_by)
  values (p_org, nullif(btrim(coalesce(p_donor_name, '')), ''), v_email,
          coalesce(p_received_on, (now() at time zone 'America/New_York')::date),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'dropoff.started', 'donation_dropoff', v_id::text,
          jsonb_build_object('donor', nullif(btrim(coalesce(p_donor_name, '')), '')));
  return dropoff_json(v_id);
end $$;
grant execute on function start_dropoff(uuid, text, text, date, text) to authenticated;

-- Change who / when / the note; the items that carried the old name follow.
create or replace function update_dropoff(p_org uuid, p_id uuid, p_donor_name text default null, p_donor_email text default null,
                                          p_received_on date default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o donation_dropoffs;
  v_name  text := nullif(btrim(coalesce(p_donor_name, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_donor_email, ''))), '');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  select * into o from donation_dropoffs where id = p_id and org_id = p_org for update;
  if not found then raise exception 'That drop-off isn''t here'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email doesn''t look right';
  end if;
  update donation_dropoffs set
    donor_name = v_name, donor_email = v_email,
    received_on = coalesce(p_received_on, received_on),
    note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id;
  update donation_items set donated_by = v_name
   where dropoff_id = p_id and outcome is distinct from 'sorted'
     and coalesce(donated_by, '') = coalesce(o.donor_name, '');
  if p_received_on is not null then
    update donation_items set received_on = p_received_on where dropoff_id = p_id;
  end if;
  return dropoff_json(p_id);
end $$;
grant execute on function update_dropoff(uuid, uuid, text, text, date, text) to authenticated;

create or replace function set_dropoff_thanked(p_org uuid, p_id uuid, p_thanked boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  update donation_dropoffs set thanked_at = case when p_thanked then now() end
   where id = p_id and org_id = p_org;
  if not found then raise exception 'That drop-off isn''t here'; end if;
  return dropoff_json(p_id);
end $$;
grant execute on function set_dropoff_thanked(uuid, uuid, boolean) to authenticated;

create or replace function list_dropoffs(p_org uuid, p_limit int default 40)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not can_manage_item_kind(p_org, 'donation') then '[]'::jsonb else
    coalesce((select jsonb_agg(dropoff_json(o.id) order by o.received_on desc, o.created_at desc)
                from (select id, received_on, created_at from donation_dropoffs
                       where org_id = p_org
                       order by received_on desc, created_at desc
                       limit greatest(1, least(coalesce(p_limit, 40), 200))) o), '[]'::jsonb) end;
$$;
grant execute on function list_dropoffs(uuid, int) to authenticated;

create or replace function dropoff_detail(p_org uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
begin
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if not exists (select 1 from donation_dropoffs where id = p_id and org_id = p_org) then return null; end if;
  select dropoff_json(p_id) || jsonb_build_object('lines', coalesce(jsonb_agg(donation_line_json(d) order by d.created_at), '[]'::jsonb))
    into j
    from donation_items d where d.dropoff_id = p_id;
  return j;
end $$;
grant execute on function dropoff_detail(uuid, uuid) to authenticated;

-- -------------------------------------------------------------
-- 5. One donation: where it's headed, value each/all, size, use-by, drop-off;
--    and its outcome (used for the rabbits, passed on, or undo)
-- -------------------------------------------------------------
create or replace function set_donation_plan(p_org uuid, p_code text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
  v_head  text;
  v_basis text;
  v_drop  uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code) for update;
  if not found then raise exception 'Nothing has that code'; end if;
  if t.kind <> 'donation' then raise exception 'That is not a donation'; end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then return tagged_item_json(t); end if;
  if p_plan ? 'headed_for' then
    v_head := nullif(btrim(coalesce(p_plan->>'headed_for', '')), '');
    if v_head is not null and v_head not in ('raffle', 'auction', 'shop', 'rabbits') then raise exception 'Unknown place'; end if;
    update donation_items set headed_for = v_head where id = t.donation_id;
  end if;
  if p_plan ? 'value_basis' then
    v_basis := coalesce(nullif(p_plan->>'value_basis', ''), 'each');
    if v_basis not in ('each', 'all') then raise exception 'Value is for each or for all'; end if;
    update donation_items set value_basis = v_basis where id = t.donation_id;
  end if;
  if p_plan ? 'size' then
    update donation_items set size = nullif(btrim(coalesce(p_plan->>'size', '')), '') where id = t.donation_id;
  end if;
  if p_plan ? 'use_by' then
    update donation_items set use_by = nullif(btrim(coalesce(p_plan->>'use_by', '')), '')::date where id = t.donation_id;
  end if;
  if p_plan ? 'dropoff_id' then
    v_drop := nullif(btrim(coalesce(p_plan->>'dropoff_id', '')), '')::uuid;
    if v_drop is not null and not exists (select 1 from donation_dropoffs where id = v_drop and org_id = p_org) then
      raise exception 'That drop-off isn''t here';
    end if;
    update donation_items set dropoff_id = v_drop,
      received_on = coalesce((select o.received_on from donation_dropoffs o where o.id = v_drop), received_on)
     where id = t.donation_id;
  end if;
  return tagged_item_json(t);
end $$;
grant execute on function set_donation_plan(uuid, text, jsonb) to authenticated;

create or replace function set_donation_outcome(p_org uuid, p_code text, p_outcome text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
  d donation_items;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code) for update;
  if not found then raise exception 'Nothing has that code'; end if;
  if t.kind <> 'donation' then raise exception 'That is not a donation'; end if;
  select * into d from donation_items where id = t.donation_id for update;
  if p_outcome is null then
    update donation_items set outcome = null, outcome_at = null, outcome_note = null, sorted_kind = null, sorted_tag_id = null
     where id = d.id;
  else
    if p_outcome not in ('rabbits', 'passed_on') then raise exception 'Unknown outcome'; end if;
    if d.outcome = 'basket' then raise exception 'This is in a basket. Take it out of the basket first.'; end if;
    update donation_items set outcome = p_outcome, outcome_at = now(),
      outcome_note = nullif(btrim(coalesce(p_note, '')), ''), sorted_kind = null, sorted_tag_id = null
     where id = d.id;
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'donation.outcome', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'outcome', p_outcome, 'was', d.outcome));
  return tagged_item_json(t);
end $$;
grant execute on function set_donation_outcome(uuid, text, text, text) to authenticated;

-- -------------------------------------------------------------
-- 6. Split a lot: take some off as their own donation (new code)
-- -------------------------------------------------------------
create or replace function split_donation(p_org uuid, p_code text, p_quantity int, p_headed_for text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t  item_tags;
  d  donation_items;
  nt item_tags;
  v_head text := nullif(btrim(coalesce(p_headed_for, '')), '');
  v_part_value int;
  v_new uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code) for update;
  if not found then raise exception 'Nothing has that code'; end if;
  if t.kind <> 'donation' then raise exception 'Only a donation can be split'; end if;
  select * into d from donation_items where id = t.donation_id for update;
  if d.outcome is not null then raise exception 'Only a donation still waiting to be sorted can be split'; end if;
  if d.quantity < 2 then raise exception 'There is only one of these'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity >= d.quantity then
    raise exception 'Take off between 1 and % of them', d.quantity - 1;
  end if;
  if v_head is not null and v_head not in ('raffle', 'auction', 'shop', 'rabbits') then raise exception 'Unknown place'; end if;
  -- A value for the whole lot is shared out by how many go with each part.
  v_part_value := case when d.value_basis = 'all' and d.value_cents is not null
                       then round(d.value_cents::numeric * p_quantity / d.quantity)::int
                       else d.value_cents end;
  insert into donation_items (org_id, title, description, donated_by, value_cents, value_basis, photo_url, photo_urls,
                              received_on, created_by, price_cents, quantity, condition, category, location,
                              dropoff_id, headed_for, size, use_by, split_from)
  values (d.org_id, d.title, d.description, d.donated_by, v_part_value, d.value_basis, d.photo_url, d.photo_urls,
          d.received_on, auth.uid(), d.price_cents, p_quantity, d.condition, d.category, d.location,
          d.dropoff_id, coalesce(v_head, d.headed_for), d.size, d.use_by, d.id)
  returning id into v_new;
  update donation_items set
    quantity = quantity - p_quantity,
    value_cents = case when value_basis = 'all' and value_cents is not null then value_cents - v_part_value else value_cents end
   where id = d.id;
  insert into item_tags (org_id, code, kind, donation_id, created_by)
  values (p_org, new_item_code(p_org), 'donation', v_new, auth.uid())
  returning * into nt;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'donation.split', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'new_code', nt.code, 'quantity', p_quantity));
  return tagged_item_json(nt);
end $$;
grant execute on function split_donation(uuid, text, int, text) to authenticated;

-- -------------------------------------------------------------
-- 7. Baskets: several donations become one raffle prize or auction lot
-- -------------------------------------------------------------
create or replace function make_basket(p_org uuid, p_codes text[], p_kind text, p_title text, p_description text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_title  text := nullif(btrim(coalesce(p_title, '')), '');
  v_codes  text[];
  v_n      int;
  v_found  int;
  v_value  int;
  v_donors text;
  v_list   text;
  v_photos text[];
  v_desc   text;
  v_new    uuid;
  nt       item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('raffle', 'auction') then raise exception 'A basket goes in the raffle or the Silent Auction'; end if;
  if not can_manage_item_kind(p_org, p_kind) or not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if v_title is null then raise exception 'Give the basket a name'; end if;
  select array_agg(distinct normalize_item_code(c)) into v_codes
    from unnest(coalesce(p_codes, '{}'::text[])) c where nullif(btrim(c), '') is not null;
  v_n := coalesce(array_length(v_codes, 1), 0);
  if v_n = 0 then raise exception 'Pick what goes in the basket'; end if;
  select count(*) into v_found
    from item_tags t join donation_items d on d.id = t.donation_id
   where t.org_id = p_org and t.kind = 'donation' and t.code = any (v_codes) and d.outcome is null;
  if v_found <> v_n then raise exception 'Only donations still waiting to be sorted can go in a basket'; end if;

  select sum(donation_value_total(d.value_cents, d.value_basis, d.quantity)),
         string_agg(distinct nullif(btrim(coalesce(d.donated_by, '')), ''), ', '),
         string_agg(d.quantity::text || ' × ' || d.title
                    || coalesce(' (' || nullif(btrim(coalesce(d.size, '')), '') || ')', ''), '; ' order by d.created_at),
         clean_photo_urls(array_agg(d.photo_url order by d.created_at) filter (where d.photo_url is not null))
    into v_value, v_donors, v_list, v_photos
    from item_tags t join donation_items d on d.id = t.donation_id
   where t.org_id = p_org and t.code = any (v_codes);
  v_desc := btrim(coalesce(nullif(btrim(coalesce(p_description, '')), '') || ' ', '') || 'Contains: ' || v_list || '.');

  if p_kind = 'auction' then
    insert into raffle_items (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, session, created_by, sort_order)
    values (p_org, v_title, v_desc, v_donors, v_value, v_photos[1], v_photos, 'all-day', auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_items where org_id = p_org), 10))
    returning id into v_new;
  else
    insert into raffle_prizes (org_id, title, description, donated_by, value_cents, photo_url, photo_urls, created_by, sort_order)
    values (p_org, v_title, v_desc, v_donors, v_value, v_photos[1], v_photos, auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_prizes where org_id = p_org), 10))
    returning id into v_new;
  end if;
  insert into item_tags (org_id, code, kind, raffle_item_id, raffle_prize_id, created_by)
  values (p_org, new_item_code(p_org), p_kind,
          case when p_kind = 'auction' then v_new end,
          case when p_kind = 'raffle' then v_new end,
          auth.uid())
  returning * into nt;
  update donation_items d set outcome = 'basket', outcome_at = now(), sorted_kind = p_kind, sorted_tag_id = nt.id
    from item_tags t
   where t.donation_id = d.id and t.org_id = p_org and t.code = any (v_codes);
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'basket.made', 'item_tag', nt.id::text,
          jsonb_build_object('code', nt.code, 'kind', p_kind, 'title', v_title, 'contents', to_jsonb(v_codes)));
  return tagged_item_json(nt);
end $$;
grant execute on function make_basket(uuid, text[], text, text, text) to authenticated;

-- -------------------------------------------------------------
-- 8. Move every donation headed for one place, in one go
-- -------------------------------------------------------------
create or replace function sort_headed_donations(p_org uuid, p_headed_for text)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  v_kind text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if p_headed_for = 'rabbits' then
    update donation_items d set outcome = 'rabbits', outcome_at = now()
     where d.org_id = p_org and d.headed_for = 'rabbits' and d.outcome is null
       and exists (select 1 from item_tags t where t.donation_id = d.id);
    get diagnostics n = row_count;
  else
    v_kind := case p_headed_for when 'raffle' then 'raffle' when 'auction' then 'auction' when 'shop' then 'stock' end;
    if v_kind is null then raise exception 'Unknown place'; end if;
    if not can_manage_item_kind(p_org, v_kind) then raise exception 'Not allowed'; end if;
    for r in
      select t.code, d.title, d.donated_by
        from item_tags t join donation_items d on d.id = t.donation_id
       where t.org_id = p_org and d.headed_for = p_headed_for and d.outcome is null
       order by d.created_at
    loop
      perform save_scanned_item(p_org, r.code, v_kind, r.title, null, r.donated_by, null, null, null, null, null);
      n := n + 1;
    end loop;
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'donation.sorted_all', 'organization', p_org::text,
          jsonb_build_object('headed_for', p_headed_for, 'count', n));
  return n;
end $$;
grant execute on function sort_headed_donations(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 9. Everything received in a date range (the monthly report)
-- -------------------------------------------------------------
create or replace function donations_received(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
begin
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Pick the dates'; end if;
  if p_to - p_from > 400 then raise exception 'Pick a shorter time (up to about a year)'; end if;
  select coalesce(jsonb_agg(donation_line_json(d) || jsonb_build_object('dropoff_donor', o.donor_name)
                            order by d.received_on, d.created_at), '[]'::jsonb)
    into j
    from donation_items d
    left join donation_dropoffs o on o.id = d.dropoff_id
   where d.org_id = p_org and d.received_on between p_from and p_to;
  return j;
end $$;
grant execute on function donations_received(uuid, date, date) to authenticated;

-- -------------------------------------------------------------
-- 10. catalog_new_item() takes the plan in the same call; donor chips
--     include drop-off names
-- -------------------------------------------------------------
drop function if exists catalog_new_item(uuid, text, text, text, text, int, text, int, int, text, text, text, text);
create or replace function catalog_new_item(
  p_org uuid, p_title text, p_kind text default 'donation',
  p_description text default null, p_donated_by text default null,
  p_value_cents int default null, p_photo_url text default null,
  p_price_cents int default null, p_quantity int default null,
  p_code text default null,
  p_condition text default null, p_category text default null, p_location text default null,
  p_plan jsonb default null
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
  if p_kind = 'donation' and p_plan is not null and jsonb_typeof(p_plan) = 'object' then
    perform set_donation_plan(p_org, v_code, p_plan);
  end if;
  return tagged_item_json((select x from item_tags x where x.org_id = p_org and x.code = v_code));
end $$;
grant execute on function catalog_new_item(uuid, text, text, text, text, int, text, int, int, text, text, text, text, jsonb) to authenticated;

create or replace function recent_donors(p_org uuid, p_limit int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(name order by last_used desc), '[]'::jsonb)
    from (
      select name, max(used) as last_used
        from (
          select btrim(donated_by) as name, created_at as used from donation_items where org_id = p_org and nullif(btrim(coalesce(donated_by, '')), '') is not null
          union all
          select btrim(donor_name), created_at from donation_dropoffs where org_id = p_org and nullif(btrim(coalesce(donor_name, '')), '') is not null
          union all
          select btrim(donated_by), created_at from raffle_items where org_id = p_org and nullif(btrim(coalesce(donated_by, '')), '') is not null
          union all
          select btrim(donated_by), created_at from raffle_prizes where org_id = p_org and nullif(btrim(coalesce(donated_by, '')), '') is not null
        ) u
       where is_org_member(p_org)
       group by name
       order by last_used desc
       limit greatest(1, least(coalesce(p_limit, 12), 50))
    ) d;
$$;
grant execute on function recent_donors(uuid, int) to authenticated;
