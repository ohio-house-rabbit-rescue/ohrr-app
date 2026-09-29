-- =============================================================
-- Update 36 (2026-09-30): Catalog donations fast, and print labels.
--
-- Staff photograph a donated item, say its name, tap Next — and the app
-- gives it an OHRR code by itself. The item is saved as a DONATION ("sort
-- later") and moved into the Silent Auction, the raffle or Hop Shop stock
-- afterwards, from the items list, with the same code. Labels (QR + barcode +
-- code + name + donor) print later, in one go, on any label printer.
--
--   donation_items          the "not sorted yet" items (same shape as the others)
--   item_tags.kind          gains 'donation' (+ donation_id)
--   item_tags.label_printed_at   which labels have been printed
--   catalog_new_item()      make the code, save the item, return it (one call)
--   mark_labels_printed()   after printing
--   recent_donors()         the names typed lately, for one-tap chips
--
-- save_scanned_item() and friends learn the new kind, so scanning a donation's
-- tag and choosing "Silent Auction" moves it exactly as before.
--
-- Apply AFTER 20260920100000_item_tags.sql. Paste + Run in the Supabase SQL
-- editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Donations: cataloged, not yet sorted
-- -------------------------------------------------------------
create table if not exists donation_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  title         text not null,
  description   text,
  donated_by    text,
  value_cents   int check (value_cents is null or value_cents >= 0),
  photo_url     text,
  received_on   date not null default ((now() at time zone 'America/New_York')::date),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_donation_items_org on donation_items(org_id, created_at desc);

drop trigger if exists trg_donation_items_updated on donation_items;
create trigger trg_donation_items_updated before update on donation_items
  for each row execute function set_updated_at();

alter table donation_items enable row level security;
drop policy if exists donation_items_member_select on donation_items;
create policy donation_items_member_select on donation_items for select
  using (is_org_member(org_id));
grant select on donation_items to authenticated;

-- -------------------------------------------------------------
-- 2. The tag registry: a fourth kind, and "label printed"
-- -------------------------------------------------------------
alter table item_tags add column if not exists donation_id uuid references donation_items(id) on delete cascade;
alter table item_tags add column if not exists label_printed_at timestamptz;

-- Replace the two kind checks (their auto-generated names vary).
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'item_tags'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table item_tags drop constraint %I', r.conname);
  end loop;
end $$;
alter table item_tags add constraint item_tags_kind_check
  check (kind in ('auction', 'raffle', 'stock', 'donation'));
alter table item_tags add constraint item_tags_one_link_check check (
  (kind = 'auction'  and raffle_item_id is not null and raffle_prize_id is null and product_id is null and donation_id is null) or
  (kind = 'raffle'   and raffle_prize_id is not null and raffle_item_id is null and product_id is null and donation_id is null) or
  (kind = 'stock'    and product_id is not null and raffle_item_id is null and raffle_prize_id is null and donation_id is null) or
  (kind = 'donation' and donation_id is not null and raffle_item_id is null and raffle_prize_id is null and product_id is null)
);

-- Anyone who may add auction items or stock may catalog a donation.
create or replace function can_manage_item_kind(p_org uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'auction'  then has_permission(p_org, 'events.bunfest.manage')
    when 'raffle'   then has_permission(p_org, 'events.bunfest.manage')
    when 'stock'    then has_permission(p_org, 'hopshop.products.create')
                      or has_permission(p_org, 'hopshop.products.edit')
                      or has_permission(p_org, 'hopshop.inventory.update')
    when 'donation' then has_permission(p_org, 'events.bunfest.manage')
                      or has_permission(p_org, 'hopshop.products.create')
                      or has_permission(p_org, 'hopshop.products.edit')
                      or has_permission(p_org, 'hopshop.inventory.update')
    else false end;
$$;

-- One uniform JSON shape for every kind (what the scan screens render).
create or replace function tagged_item_json(p_tag item_tags)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
begin
  if p_tag.kind = 'auction' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'status', r.status, 'is_published', r.is_published, 'session', r.session,
      'price_cents', null, 'quantity', null)
    into j from raffle_items r where r.id = p_tag.raffle_item_id;
  elsif p_tag.kind = 'raffle' then
    select jsonb_build_object(
      'ref_id', r.id, 'title', r.title, 'description', r.description,
      'donated_by', r.donated_by, 'value_cents', r.value_cents, 'photo_url', r.photo_url,
      'status', r.status, 'is_published', r.is_published, 'session', null,
      'price_cents', null, 'quantity', null)
    into j from raffle_prizes r where r.id = p_tag.raffle_prize_id;
  elsif p_tag.kind = 'donation' then
    select jsonb_build_object(
      'ref_id', d.id, 'title', d.title, 'description', d.description,
      'donated_by', d.donated_by, 'value_cents', d.value_cents, 'photo_url', d.photo_url,
      'status', 'unsorted', 'is_published', false, 'session', null,
      'price_cents', null, 'quantity', null, 'received_on', d.received_on)
    into j from donation_items d where d.id = p_tag.donation_id;
  else
    select jsonb_build_object(
      'ref_id', p.id, 'title', p.name, 'description', p.description,
      'donated_by', null, 'value_cents', null, 'photo_url', p.photo_url,
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

-- Everything with a tag, newest first; optionally one kind, or only the ones
-- whose label hasn't been printed. (Re-created with the extra argument.)
drop function if exists list_tagged_items(uuid, text);
create or replace function list_tagged_items(p_org uuid, p_kind text default null, p_unprinted boolean default false)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  for t in
    select * from item_tags
     where org_id = p_org and (p_kind is null or kind = p_kind)
       and (not p_unprinted or label_printed_at is null)
     order by created_at desc
  loop
    return next tagged_item_json(t);
  end loop;
end $$;
grant execute on function list_tagged_items(uuid, text, boolean) to authenticated;

-- Create or update the item behind a code. Changing the kind moves the item:
-- the new row is created first, the tag re-pointed, then the old row removed.
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
  v_exists boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_code is null then raise exception 'That code is empty'; end if;
  if p_kind not in ('auction', 'raffle', 'stock', 'donation') then raise exception 'Unknown item type'; end if;
  if not can_manage_item_kind(p_org, p_kind) then raise exception 'Not allowed'; end if;
  if v_title is null then raise exception 'Give the item a name'; end if;

  select * into t from item_tags where org_id = p_org and code = v_code for update;
  v_exists := found;

  -- Same kind: update in place.
  if v_exists and t.kind = p_kind then
    if p_kind = 'auction' then
      update raffle_items set
        title = v_title, description = p_description, donated_by = p_donated_by,
        value_cents = p_value_cents, photo_url = coalesce(p_photo_url, photo_url),
        session = coalesce(p_session, session)
      where id = t.raffle_item_id;
    elsif p_kind = 'raffle' then
      update raffle_prizes set
        title = v_title, description = p_description, donated_by = p_donated_by,
        value_cents = p_value_cents, photo_url = coalesce(p_photo_url, photo_url)
      where id = t.raffle_prize_id;
    elsif p_kind = 'donation' then
      update donation_items set
        title = v_title, description = p_description, donated_by = p_donated_by,
        value_cents = p_value_cents, photo_url = coalesce(p_photo_url, photo_url)
      where id = t.donation_id;
    else
      if p_price_cents is not null and not (has_permission(p_org, 'hopshop.products.edit') or has_permission(p_org, 'hopshop.products.create')) then
        raise exception 'Not allowed to change product details';
      end if;
      update hopshop_products set
        name = v_title, description = p_description,
        price_cents = coalesce(p_price_cents, price_cents),
        photo_url = coalesce(p_photo_url, photo_url)
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

  -- New item (or a kind change): create the linked row first.
  if v_exists then
    if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
    old_kind := t.kind;
    old_ref  := coalesce(t.raffle_item_id, t.raffle_prize_id, t.product_id, t.donation_id);
  end if;

  if p_kind = 'auction' then
    insert into raffle_items (org_id, title, description, donated_by, value_cents, photo_url, session, created_by,
                              sort_order)
    values (p_org, v_title, p_description, p_donated_by, p_value_cents, p_photo_url,
            coalesce(p_session, 'all-day'), auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_items where org_id = p_org), 10))
    returning id into new_id;
  elsif p_kind = 'raffle' then
    insert into raffle_prizes (org_id, title, description, donated_by, value_cents, photo_url, created_by, sort_order)
    values (p_org, v_title, p_description, p_donated_by, p_value_cents, p_photo_url, auth.uid(),
            coalesce((select max(sort_order) + 10 from raffle_prizes where org_id = p_org), 10))
    returning id into new_id;
  elsif p_kind = 'donation' then
    insert into donation_items (org_id, title, description, donated_by, value_cents, photo_url, created_by)
    values (p_org, v_title, p_description, p_donated_by, p_value_cents, p_photo_url, auth.uid())
    returning id into new_id;
  else
    if not has_permission(p_org, 'hopshop.products.create') then
      raise exception 'Not allowed to add products';
    end if;
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, created_by)
    values (p_org, v_title, p_description, coalesce(p_price_cents, 0), v_code, p_photo_url, auth.uid())
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

-- Status: auction available|won · raffle available|drawn · stock active|inactive.
create or replace function set_item_status_by_code(p_org uuid, p_code text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code);
  if not found then raise exception 'Nothing has that code'; end if;
  if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
  if t.kind = 'auction' then
    if p_status not in ('available', 'won') then raise exception 'Bad status'; end if;
    update raffle_items set status = p_status where id = t.raffle_item_id;
  elsif t.kind = 'raffle' then
    if p_status not in ('available', 'drawn') then raise exception 'Bad status'; end if;
    update raffle_prizes set status = p_status where id = t.raffle_prize_id;
  elsif t.kind = 'donation' then
    raise exception 'Put this donation in the auction, the raffle or the shop first.';
  else
    if p_status not in ('active', 'inactive') then raise exception 'Bad status'; end if;
    update hopshop_products set is_active = (p_status = 'active') where id = t.product_id;
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item.status', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'kind', t.kind, 'status', p_status));
  return tagged_item_json(t);
end $$;
grant execute on function set_item_status_by_code(uuid, text, text) to authenticated;

-- Show / hide from the public lists (auction + raffle); stock uses status.
create or replace function set_item_published_by_code(p_org uuid, p_code text, p_published boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code);
  if not found then raise exception 'Nothing has that code'; end if;
  if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
  if t.kind = 'auction' then
    update raffle_items set is_published = p_published where id = t.raffle_item_id;
  elsif t.kind = 'raffle' then
    update raffle_prizes set is_published = p_published where id = t.raffle_prize_id;
  elsif t.kind = 'donation' then
    raise exception 'Put this donation in the auction, the raffle or the shop first.';
  else
    update hopshop_products set is_active = p_published where id = t.product_id;
  end if;
  return tagged_item_json(t);
end $$;
grant execute on function set_item_published_by_code(uuid, text, boolean) to authenticated;

-- Remove the tag AND the item behind it (the physical thing is gone / was a mistake).
create or replace function delete_item_by_code(p_org uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code);
  if not found then return; end if;
  if not can_manage_item_kind(p_org, t.kind) then raise exception 'Not allowed'; end if;
  if t.kind = 'auction' then delete from raffle_items where id = t.raffle_item_id;
  elsif t.kind = 'raffle' then delete from raffle_prizes where id = t.raffle_prize_id;
  elsif t.kind = 'donation' then delete from donation_items where id = t.donation_id;
  else delete from hopshop_products where id = t.product_id; end if;
  delete from item_tags where id = t.id;  -- cascade normally did this already
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item.deleted', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'kind', t.kind));
end $$;
grant execute on function delete_item_by_code(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 3. Catalog mode: one call makes the code and saves the item
-- -------------------------------------------------------------

-- A fresh OHRR code nobody in this org has: five characters from an alphabet
-- with no 0/O or 1/I (the same one the app's printed tags use).
create or replace function new_item_code(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  body text;
  i int;
begin
  for i in 1..50 loop
    body := '';
    for i in 1..5 loop
      body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if body !~ '[A-Z]' then continue; end if;
    if not exists (select 1 from item_tags where org_id = p_org and code = 'OHRR-' || body) then
      return 'OHRR-' || body;
    end if;
  end loop;
  raise exception 'Could not make a new code — try again';
end $$;
revoke all on function new_item_code(uuid) from public, anon;

-- Photo, name, donor, Next: saves the item under a new code (or a tag code the
-- person scanned) and returns it, code included. Kind defaults to 'donation'.
create or replace function catalog_new_item(
  p_org uuid, p_title text, p_kind text default 'donation',
  p_description text default null, p_donated_by text default null,
  p_value_cents int default null, p_photo_url text default null,
  p_price_cents int default null, p_quantity int default null,
  p_code text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := nullif(normalize_item_code(p_code), '');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_code is null then v_code := new_item_code(p_org); end if;
  if exists (select 1 from item_tags where org_id = p_org and code = v_code) then
    raise exception 'Code % is already on another item', v_code;
  end if;
  return save_scanned_item(p_org, v_code, p_kind, p_title, p_description, p_donated_by,
                           p_value_cents, p_photo_url, p_price_cents, p_quantity, null);
end $$;
grant execute on function catalog_new_item(uuid, text, text, text, text, int, text, int, int, text) to authenticated;

-- After printing: remember which labels are done. Returns how many were marked.
create or replace function mark_labels_printed(p_org uuid, p_codes text[], p_printed boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (can_manage_item_kind(p_org, 'donation')) then raise exception 'Not allowed'; end if;
  update item_tags set label_printed_at = case when p_printed then now() else null end
   where org_id = p_org
     and code = any (select normalize_item_code(c) from unnest(coalesce(p_codes, '{}'::text[])) c);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function mark_labels_printed(uuid, text[], boolean) to authenticated;

-- The donor names typed lately (any kind), newest first — for one-tap chips.
create or replace function recent_donors(p_org uuid, p_limit int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(name order by last_used desc), '[]'::jsonb)
    from (
      select name, max(used) as last_used
        from (
          select btrim(donated_by) as name, created_at as used from donation_items where org_id = p_org and nullif(btrim(coalesce(donated_by, '')), '') is not null
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
