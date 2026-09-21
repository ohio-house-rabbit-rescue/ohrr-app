-- =============================================================
-- OHRR App — "Scan an item": one tag code per physical thing
--
-- Staff stick an OHRR QR tag on a donated item (or scan the retail barcode on
-- stock), the app asks WHAT it is — Silent Auction / Raffle / Hop Shop stock —
-- and the details are saved to the table that already runs that feature:
--
--   auction  → raffle_items      (the Silent Auction catalog; app + website)
--   raffle   → raffle_prizes     (NEW — ticket-raffle prizes, same shape)
--   stock    → hopshop_products + hopshop_inventory (the Hop Shop manager)
--
-- item_tags is the registry that maps a code to exactly one of those rows, so
-- scanning the same tag later opens the same item (mark won / drawn, count
-- stock up or down, fix a detail). Codes are "OHRR-XXXXX" for printed tags and
-- plain digits for retail barcodes; normalize_item_code() makes the two spell-
-- ings people type ("ohrr 7k3px", a full tag URL, ...) land on the same row.
--
-- All writes go through SECURITY DEFINER functions gated on the capability the
-- underlying feature already uses (events.bunfest.manage for auction/raffle,
-- the hopshop.* keys for stock). Photos from the scan flow go to the public
-- `item-photos` bucket (any of those capabilities may upload).
--
-- Apply AFTER 20260917130000_raffle_items.sql. Paste + Run in the Supabase SQL
-- editor. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- Raffle prizes (ticket raffle) — mirrors raffle_items without the session
-- -------------------------------------------------------------
create table if not exists raffle_prizes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  event_slug    text not null default 'midwest-bunfest-2026',
  title         text not null,
  description   text,
  donated_by    text,
  value_cents   int check (value_cents is null or value_cents >= 0),
  photo_url     text,
  status        text not null default 'available'
                check (status in ('available', 'drawn')),
  is_published  boolean not null default true,
  sort_order    int not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_raffle_prizes_org on raffle_prizes(org_id, event_slug, sort_order);

drop trigger if exists trg_raffle_prizes_updated on raffle_prizes;
create trigger trg_raffle_prizes_updated before update on raffle_prizes
  for each row execute function set_updated_at();

alter table raffle_prizes enable row level security;

drop policy if exists raffle_prizes_public_select on raffle_prizes;
create policy raffle_prizes_public_select on raffle_prizes for select
  using (is_published);
drop policy if exists raffle_prizes_staff_select on raffle_prizes;
create policy raffle_prizes_staff_select on raffle_prizes for select
  using (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists raffle_prizes_insert on raffle_prizes;
create policy raffle_prizes_insert on raffle_prizes for insert
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists raffle_prizes_update on raffle_prizes;
create policy raffle_prizes_update on raffle_prizes for update
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists raffle_prizes_delete on raffle_prizes;
create policy raffle_prizes_delete on raffle_prizes for delete
  using (has_permission(org_id, 'events.bunfest.manage'));

grant select on raffle_prizes to anon, authenticated;
grant insert, update, delete on raffle_prizes to authenticated;

-- Hop Shop products get a photo (the scan flow always offers one).
alter table hopshop_products add column if not exists photo_url text;

-- -------------------------------------------------------------
-- The tag registry
-- -------------------------------------------------------------
create table if not exists item_tags (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  code            text not null,
  kind            text not null check (kind in ('auction', 'raffle', 'stock')),
  raffle_item_id  uuid references raffle_items(id) on delete cascade,
  raffle_prize_id uuid references raffle_prizes(id) on delete cascade,
  product_id      uuid references hopshop_products(id) on delete cascade,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, code),
  -- exactly one linked row, and it matches the kind
  check (
    (kind = 'auction' and raffle_item_id is not null and raffle_prize_id is null and product_id is null) or
    (kind = 'raffle'  and raffle_prize_id is not null and raffle_item_id is null and product_id is null) or
    (kind = 'stock'   and product_id is not null and raffle_item_id is null and raffle_prize_id is null)
  )
);
create index if not exists idx_item_tags_org on item_tags(org_id, kind, created_at desc);

drop trigger if exists trg_item_tags_updated on item_tags;
create trigger trg_item_tags_updated before update on item_tags
  for each row execute function set_updated_at();

alter table item_tags enable row level security;

-- Any active member can read the registry (the list screen); writes only via
-- the functions below.
drop policy if exists item_tags_member_select on item_tags;
create policy item_tags_member_select on item_tags for select
  using (is_org_member(org_id));

grant select on item_tags to authenticated;

-- -------------------------------------------------------------
-- Helpers
-- -------------------------------------------------------------

-- "ohrr 7k3px", "OHRR-7K3PX", "https://ohrr-app.pages.dev/t/7K3PX", "7k3px"
-- → "OHRR-7K3PX";  " 0 12345 67890 5 " → "012345678905".
create or replace function normalize_item_code(p_raw text)
returns text language plpgsql immutable as $$
declare
  s text := coalesce(p_raw, '');
begin
  -- a scanned tag URL: keep whatever follows the last "/t/"
  if position('/t/' in s) > 0 then
    s := substring(s from '/t/([^/?#]+)');
  end if;
  s := upper(regexp_replace(s, '[^A-Za-z0-9]', '', 'g'));
  if s = '' then return null; end if;
  if s ~ '^OHRR[A-Z0-9]{5}$' then
    return 'OHRR-' || substring(s from 5);
  end if;
  if s ~ '^[A-Z0-9]{5}$' and s !~ '^[0-9]+$' then
    return 'OHRR-' || s;
  end if;
  return s;   -- retail barcode digits (or anything else, verbatim)
end $$;

-- Can this person manage items of this kind?
create or replace function can_manage_item_kind(p_org uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'auction' then has_permission(p_org, 'events.bunfest.manage')
    when 'raffle'  then has_permission(p_org, 'events.bunfest.manage')
    when 'stock'   then has_permission(p_org, 'hopshop.products.create')
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
    'created_at', p_tag.created_at, 'updated_at', p_tag.updated_at);
end $$;

-- -------------------------------------------------------------
-- RPCs
-- -------------------------------------------------------------

-- Look a code up. NULL when nothing has that code yet (→ the "What is it?" step).
create or replace function item_by_code(p_org uuid, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code);
  if not found then return null; end if;
  return tagged_item_json(t);
end $$;
grant execute on function item_by_code(uuid, text) to authenticated;

-- Everything with a tag, newest first (optionally one kind). For the list screens.
create or replace function list_tagged_items(p_org uuid, p_kind text default null)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  for t in
    select * from item_tags
     where org_id = p_org and (p_kind is null or kind = p_kind)
     order by created_at desc
  loop
    return next tagged_item_json(t);
  end loop;
end $$;
grant execute on function list_tagged_items(uuid, text) to authenticated;

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
  if p_kind not in ('auction', 'raffle', 'stock') then raise exception 'Unknown item type'; end if;
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
    old_ref  := coalesce(t.raffle_item_id, t.raffle_prize_id, t.product_id);
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
      raffle_item_id  = case when p_kind = 'auction' then new_id end,
      raffle_prize_id = case when p_kind = 'raffle'  then new_id end,
      product_id      = case when p_kind = 'stock'   then new_id end
    where id = t.id;
    -- the old row is gone with the tag re-pointed (cascade no longer applies)
    if old_kind = 'auction' then delete from raffle_items  where id = old_ref;
    elsif old_kind = 'raffle' then delete from raffle_prizes where id = old_ref;
    else delete from hopshop_products where id = old_ref; end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.moved', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'from', old_kind, 'to', p_kind, 'title', v_title));
  else
    insert into item_tags (org_id, code, kind, raffle_item_id, raffle_prize_id, product_id, created_by)
    values (p_org, v_code, p_kind,
            case when p_kind = 'auction' then new_id end,
            case when p_kind = 'raffle'  then new_id end,
            case when p_kind = 'stock'   then new_id end,
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

-- Stock: +1 / −1 (never below zero).
create or replace function adjust_stock_by_code(p_org uuid, p_code text, p_delta int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (has_permission(p_org, 'hopshop.inventory.update') or has_permission(p_org, 'hopshop.products.create')) then
    raise exception 'Not allowed';
  end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code) and kind = 'stock';
  if not found then raise exception 'No stock item has that code'; end if;
  insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
  values (t.product_id, p_org, greatest(0, p_delta), auth.uid())
  on conflict (product_id) do update
    set quantity = greatest(0, hopshop_inventory.quantity + p_delta), updated_by = auth.uid();
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item.stock_adjusted', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'delta', p_delta));
  return tagged_item_json(t);
end $$;
grant execute on function adjust_stock_by_code(uuid, text, int) to authenticated;

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
  else delete from hopshop_products where id = t.product_id; end if;
  delete from item_tags where id = t.id;  -- cascade normally did this already
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item.deleted', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'kind', t.kind));
end $$;
grant execute on function delete_item_by_code(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- Storage: photos taken in the scan flow (public read, staff upload)
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

drop policy if exists "item photos public read" on storage.objects;
create policy "item photos public read" on storage.objects for select
  using (bucket_id = 'item-photos');

drop policy if exists "item photos staff insert" on storage.objects;
create policy "item photos staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.can_manage_item_kind(m.org_id, 'auction') or public.can_manage_item_kind(m.org_id, 'stock'))
    )
  );

drop policy if exists "item photos staff update" on storage.objects;
create policy "item photos staff update" on storage.objects for update to authenticated
  using (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.can_manage_item_kind(m.org_id, 'auction') or public.can_manage_item_kind(m.org_id, 'stock'))
    )
  );

drop policy if exists "item photos staff delete" on storage.objects;
create policy "item photos staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.can_manage_item_kind(m.org_id, 'auction') or public.can_manage_item_kind(m.org_id, 'stock'))
    )
  );
