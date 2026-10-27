-- =============================================================
-- Update 47 (2026-10-28): receiving, then its use. Donation or purchase,
-- where it's kept, and what it's for, from OHRR's own list of uses; Hop Shop
-- numbers count each vendor's items; a new price at the counter.
--
-- Sponsor (2026-10-27): "items come in as a donation or a purchase so when
-- we receive it we need to account for that process. then identify where it
-- goes. we need to label it and then put the location … when we build a box
-- we need to say the location of the box"; "locations we need to add as we
-- go and have a drop down list as i type a new one"; "the where is it headed
-- is … more of a purpose of the item"; "the used for items we know of now is
-- MidWest BunFest, Guardians Event, Special Event, HOP Shop, Bunny Care …
-- they should be a drop down but have a add to from authorized levels of
-- user"; "the care items can be administrative. we need to know what they
-- are, location etc."; "in using the HOP shop items lets tie the first set
-- of numbers to the vendor, the last is in order of items and the TRT works
-- for a category".
--
--   item_purposes                OHRR's list of uses: Midwest BunFest,
--                                Guardians Event, Special Event (events),
--                                Hop Shop (sold), Bunny Care (kept for the
--                                rescue's own use). Admin 1 and up add to it.
--   donation_items.purpose       the use it was given ("Guardians Event")
--   donation_items.source        'donation' (default) or 'purchase'
--   donation_items.cost_cents    a purchase: what OHRR paid for the lot
--   donation_items.bought_from   a purchase: the store or supplier
--   headed_for gains 'event': used at an event, not as a raffle prize or
--   auction lot. 'rabbits' now means kept for the rescue's own use.
--
--   A purchase gets its own number, PUR-00001 (donations keep DON-00001);
--   normalize_item_code() reads "pur 5" as PUR-00005.
--   catalog_new_item() and set_donation_plan() take source, cost_cents,
--   bought_from and purpose in the plan; save_scanned_item() keeps a PUR
--   number. split_donation() keeps them on both parts (a purchase's new part
--   gets a PUR number; the cost is shared out by how many go with each part).
--   tagged_item_json() answers with them.
--   catalog_suggestions() adds the boxes' places to the places list (30, for
--   the drop-down) and lists stores (typed before, or Hop Shop suppliers).
--   An item put in a box takes the box's place, and changing a box's place
--   changes its items' place too.
--   donations_received() (the donations report) leaves purchases out.
--
--   Hop Shop numbers: CATEGORY-VENDOR-ITEM, and the item number now counts
--   that vendor's items in order, whatever the category (TRT-101-001,
--   HAY-101-002 …). Numbers already made stay as they are; the count for
--   each vendor carries on after the highest one in use.
--
--   Vendors: a purchase whose store is on the vendor list is linked to it
--   (donation_items.bought_from_id); supplier_purchase_totals() gives each
--   vendor's count and cost for the Vendors list. The stores drop-down lists
--   every active vendor, whether we buy from them, they sell at our events,
--   or both.
--
--   The counter: a line can be sold at one price for all of it ("3 for
--   $30"): counter_sale_lines.line_cents; record_counter_sale() and
--   counter_day() count it.
--
-- Apply AFTER 20261027100000_item_boxes.sql. Safe to run twice.
-- =============================================================

alter table donation_items add column if not exists source text not null default 'donation';
alter table donation_items add column if not exists cost_cents int;
alter table donation_items add column if not exists bought_from text;
alter table donation_items add column if not exists purpose text;

-- headed_for's check (unnamed in update 40) is replaced by a named one.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'donation_items'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%headed_for%'
  loop
    execute format('alter table donation_items drop constraint %I', c.conname);
  end loop;
end $$;
alter table donation_items add constraint donation_items_headed_for_check
  check (headed_for is null or headed_for in ('raffle', 'auction', 'shop', 'rabbits', 'event'));
alter table donation_items drop constraint if exists donation_items_source_check;
alter table donation_items add constraint donation_items_source_check check (source in ('donation', 'purchase'));
alter table donation_items drop constraint if exists donation_items_cost_check;
alter table donation_items add constraint donation_items_cost_check check (cost_cents is null or cost_cents >= 0);
alter table donation_items drop constraint if exists donation_items_bought_from_check;
alter table donation_items add constraint donation_items_bought_from_check check (bought_from is null or length(bought_from) <= 120);
alter table donation_items drop constraint if exists donation_items_purpose_check;
alter table donation_items add constraint donation_items_purpose_check check (purpose is null or length(purpose) <= 60);

-- -------------------------------------------------------------
-- OHRR's list of uses (the "What is it for?" drop-down)
--   use: 'event' (raffle, auction or used there), 'shop' (sold in the Hop
--   Shop), 'keep' (kept for the rescue's own use: care, office)
-- -------------------------------------------------------------
create table if not exists item_purposes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null check (btrim(name) <> '' and length(name) <= 60),
  use         text not null default 'event' check (use in ('event', 'shop', 'keep')),
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists idx_item_purposes_name on item_purposes(org_id, lower(name));
drop trigger if exists trg_item_purposes_updated on item_purposes;
create trigger trg_item_purposes_updated before update on item_purposes
  for each row execute function set_updated_at();
alter table item_purposes enable row level security;
drop policy if exists item_purposes_member_select on item_purposes;
create policy item_purposes_member_select on item_purposes for select using (is_org_member(org_id));
grant select on item_purposes to authenticated;

-- The five OHRR uses now (2026-10-27), for a rescue that has none yet.
create or replace function ensure_item_purposes(p_org uuid) returns void
language sql security definer set search_path = public as $$
  insert into item_purposes (org_id, name, use, sort_order)
  select p_org, v.name, v.use, v.sort_order
    from (values ('Midwest BunFest', 'event', 10), ('Guardians Event', 'event', 20), ('Special Event', 'event', 30),
                 ('Hop Shop', 'shop', 40), ('Bunny Care', 'keep', 50)) v(name, use, sort_order)
   where not exists (select 1 from item_purposes x where x.org_id = p_org);
$$;
revoke all on function ensure_item_purposes(uuid) from public, anon, authenticated;
select ensure_item_purposes(id) from organizations;

-- Admin 1 and up (founders and developers too) add to the list.
create or replace function can_edit_item_purposes(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(level_rank(my_level(p_org)) >= level_rank('admin1'), false);
$$;
grant execute on function can_edit_item_purposes(uuid) to authenticated;

create or replace function item_purpose_json(p item_purposes) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'use', p.use, 'sort_order', p.sort_order, 'is_active', p.is_active);
$$;

create or replace function list_item_purposes(p_org uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  perform ensure_item_purposes(p_org);
  return coalesce((select jsonb_agg(item_purpose_json(p) order by p.sort_order, lower(p.name))
                     from item_purposes p where p.org_id = p_org), '[]'::jsonb);
end $$;
grant execute on function list_item_purposes(uuid) to authenticated;

-- p_id null adds one (at the end of the list); otherwise renames, changes its
-- use, or hides it (p_is_active false). Items keep the name they were given.
create or replace function save_item_purpose(p_org uuid, p_id uuid, p_name text, p_use text,
                                             p_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  p item_purposes;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_edit_item_purposes(p_org) then raise exception 'Only Admin 1 and up can change the list of uses'; end if;
  if v_name is null then raise exception 'Give the use a name'; end if;
  if length(v_name) > 60 then raise exception 'Keep the name short (60 letters)'; end if;
  if coalesce(p_use, '') not in ('event', 'shop', 'keep') then raise exception 'Unknown kind of use'; end if;
  if exists (select 1 from item_purposes where org_id = p_org and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception '"%" is on the list already', v_name;
  end if;
  if p_id is null then
    insert into item_purposes (org_id, name, use, sort_order)
    values (p_org, v_name, p_use, coalesce((select max(sort_order) from item_purposes where org_id = p_org), 0) + 10)
    returning * into p;
  else
    update item_purposes set name = v_name, use = p_use, is_active = coalesce(p_is_active, true)
     where id = p_id and org_id = p_org
    returning * into p;
    if not found then raise exception 'That use isn''t on the list'; end if;
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'item_purpose.save', 'item_purpose', p.id::text,
          jsonb_build_object('name', p.name, 'use', p.use, 'is_active', p.is_active));
  return item_purpose_json(p);
end $$;
grant execute on function save_item_purpose(uuid, uuid, text, text, boolean) to authenticated;

-- Items sorted before this update get the use their place meant (BunFest was
-- the only event with a raffle and an auction).
update donation_items set purpose = case headed_for
    when 'shop' then 'Hop Shop' when 'rabbits' then 'Bunny Care'
    when 'raffle' then 'Midwest BunFest' when 'auction' then 'Midwest BunFest' end
 where purpose is null and headed_for in ('shop', 'rabbits', 'raffle', 'auction');

alter table donation_items add column if not exists bought_from_id uuid references suppliers(id) on delete set null;

-- Any way a code arrives -> one spelling. Same as update 46, plus purchases.
create or replace function normalize_item_code(p_raw text)
returns text language plpgsql immutable as $$
declare
  s text := coalesce(p_raw, '');
  m text[];
begin
  -- a label's QR link: keep whatever follows the last "/t/"
  if position('/t/' in s) > 0 then
    s := coalesce(substring(s from '/t/([^/?#]+)'), '');
  end if;
  m := regexp_match(s, '^\s*[Dd][Oo][Nn][\s_-]*([0-9]{1,9})\s*$');
  if m is not null then return 'DON-' || code_pad(m[1]::bigint, 5); end if;
  m := regexp_match(s, '^\s*[Pp][Uu][Rr][\s_-]*([0-9]{1,9})\s*$');
  if m is not null then return 'PUR-' || code_pad(m[1]::bigint, 5); end if;
  m := regexp_match(s, '^\s*[Bb][Oo][Xx][\s_-]*([0-9]{1,5})\s*$');
  if m is not null then return 'BOX-' || code_pad(m[1]::bigint, 5); end if;
  m := regexp_match(s, '^\s*([A-Za-z]{3})[\s_-]+([0-9]{1,3})[\s_-]+([0-9]{1,6})\s*$');
  if m is not null then
    return upper(m[1]) || '-' || code_pad(m[2]::bigint, 3) || '-' || code_pad(m[3]::bigint, 3);
  end if;
  s := upper(regexp_replace(s, '[^A-Za-z0-9]', '', 'g'));
  if s = '' then return null; end if;
  if s ~ '^[A-Z]{3}[0-9]{6,9}$' then
    return substring(s from 1 for 3) || '-' || substring(s from 4 for 3) || '-' || substring(s from 7);
  end if;
  return s;   -- a maker's barcode (digits), or anything else as typed
end $$;

-- The next purchase number: PUR-00001, PUR-00002 …
create or replace function new_purchase_code(p_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text;
  i int;
begin
  for i in 1..1000 loop
    v := 'PUR-' || code_pad(next_code_no(p_org, 'PUR'), 5);
    if not exists (select 1 from item_tags where org_id = p_org and code = v) then return v; end if;
  end loop;
  raise exception 'Could not make a new number. Try again.';
end $$;
revoke all on function new_purchase_code(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------
-- Hop Shop numbers: the item number counts each vendor's items in order
-- (TRT-101-001, HAY-101-002 …). Each vendor's count starts after the highest
-- number already in use, so no number is made twice.
-- -------------------------------------------------------------
insert into code_counters (org_id, scope, last_no)
select t.org_id, 'SKU:' || split_part(t.code, '-', 2), max(split_part(t.code, '-', 3)::bigint)
  from item_tags t
 where t.code ~ '^[A-Z]{3}-[0-9]{3}-[0-9]{3,}$'
 group by t.org_id, split_part(t.code, '-', 2)
on conflict (org_id, scope) do update set last_no = greatest(code_counters.last_no, excluded.last_no);

-- Same as update 41; the count is the vendor's, not the category's.
create or replace function make_product_sku(p_org uuid, p_type_id uuid, p_supplier_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_type   text;
  v_vendor text;
  v        text;
  i        int;
begin
  select code into v_type from product_types where id = p_type_id and org_id = p_org;
  v_type := coalesce(v_type, 'OTH');
  select code_pad(vendor_no, 3) into v_vendor from suppliers where id = p_supplier_id and org_id = p_org;
  v_vendor := coalesce(v_vendor, '000');
  for i in 1..1000 loop
    v := v_type || '-' || v_vendor || '-' || code_pad(next_code_no(p_org, 'SKU:' || v_vendor), 3);
    if not exists (select 1 from item_tags where org_id = p_org and code = v) then return v; end if;
  end loop;
  raise exception 'Could not make a new SKU — try again';
end $$;
revoke all on function make_product_sku(uuid, uuid, uuid) from public, anon, authenticated;

-- Same as update 41, plus donation or purchase, its cost and store, and its use.
create or replace function tagged_item_json(p_tag item_tags)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j jsonb;
  v_contents jsonb;
  v_main item_tags;
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
      'source', d.source, 'cost_cents', d.cost_cents, 'bought_from', d.bought_from,
      'purpose', d.purpose,
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
      'category', p.category, 'location', p.shelf,
      'type_id', p.type_id, 'type_code', (select pt.code from product_types pt where pt.id = p.type_id),
      'barcode', p.barcode)
    into j from hopshop_products p
      left join hopshop_inventory i on i.product_id = p.id
     where p.id = p_tag.product_id;
  end if;
  if j is null then return null; end if;
  -- A shop item answers with its SKU, whichever of its codes was scanned.
  if p_tag.kind = 'stock' then
    select * into v_main from item_tags x
     where x.product_id = p_tag.product_id and x.kind = 'stock' and not x.is_alias
     order by x.created_at limit 1;
  end if;
  return j || jsonb_build_object(
    'tag_id', p_tag.id, 'code', coalesce(v_main.code, p_tag.code), 'kind', p_tag.kind,
    'scanned_code', p_tag.code,
    'label_printed_at', case when v_main.id is not null then v_main.label_printed_at else p_tag.label_printed_at end,
    'created_at', p_tag.created_at, 'updated_at', p_tag.updated_at);
end $$;

-- Same as update 40, plus its use, donation or purchase, cost and store.
create or replace function set_donation_plan(p_org uuid, p_code text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t item_tags;
  v_head  text;
  v_basis text;
  v_drop  uuid;
  v_src   text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code) for update;
  if not found then raise exception 'Nothing has that code'; end if;
  if t.kind <> 'donation' then raise exception 'That is not a donation'; end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then return tagged_item_json(t); end if;
  if p_plan ? 'headed_for' then
    v_head := nullif(btrim(coalesce(p_plan->>'headed_for', '')), '');
    if v_head is not null and v_head not in ('raffle', 'auction', 'shop', 'rabbits', 'event') then raise exception 'Unknown use'; end if;
    update donation_items set headed_for = v_head where id = t.donation_id;
  end if;
  if p_plan ? 'purpose' then
    update donation_items set purpose = left(nullif(btrim(coalesce(p_plan->>'purpose', '')), ''), 60) where id = t.donation_id;
  end if;
  if p_plan ? 'source' then
    v_src := coalesce(nullif(p_plan->>'source', ''), 'donation');
    if v_src not in ('donation', 'purchase') then raise exception 'It came in as a donation or a purchase'; end if;
    update donation_items set source = v_src where id = t.donation_id;
  end if;
  if p_plan ? 'cost_cents' then
    if (nullif(p_plan->>'cost_cents', '')::int) < 0 then raise exception 'What we paid can''t be below zero'; end if;
    update donation_items set cost_cents = nullif(p_plan->>'cost_cents', '')::int where id = t.donation_id;
  end if;
  if p_plan ? 'bought_from' then
    -- A store on the vendor list is linked to it, so the vendor's card shows what we bought.
    update donation_items set
      bought_from = left(nullif(btrim(coalesce(p_plan->>'bought_from', '')), ''), 120),
      bought_from_id = (select s.id from suppliers s
                         where s.org_id = p_org and lower(btrim(s.name)) = lower(btrim(coalesce(p_plan->>'bought_from', '')))
                         order by s.is_active desc, s.created_at limit 1)
     where id = t.donation_id;
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

-- Same as update 41; a new PUR number is kept like a DON number.
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
  v_type   uuid;
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

  -- A shop item leaving the shop moves on the DON number it came in with.
  if v_exists and t.kind = 'stock' and p_kind <> 'stock' then
    select * into t from item_tags x
     where x.org_id = p_org and x.product_id = t.product_id and x.kind = 'stock' and x.code like 'DON-%'
     order by x.created_at limit 1 for update;
    if not found then
      raise exception 'Shop items stay in Hop Shop inventory. To make one a prize, add it as a donation.';
    end if;
    v_code := t.code;
  end if;
  -- Anything new that isn't for the shop gets the next DON number (a packet
  -- barcode can't tell one donated bag from the next).
  if not v_exists and p_kind <> 'stock' and v_code !~ '^(DON|PUR)-[0-9]+$' then
    v_code := new_item_code(p_org);
  end if;

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
    -- Its type comes from the donation's sort of thing, when that names a type.
    select x.id into v_type from product_types x
     where x.org_id = p_org and lower(x.name) = lower(btrim(coalesce(v_cat, '')));
    insert into hopshop_products (org_id, name, description, price_cents, sku, photo_url, photo_urls, created_by, category, shelf,
                                  is_active, type_id)
    values (p_org, v_title, v_desc, coalesce(v_price, 0), null, v_photo, v_photos, auth.uid(),
            coalesce((select x.name from product_types x where x.id = v_type), v_cat), v_place,
            not (v_from_donation and coalesce(v_price, 0) = 0), v_type)
    returning id into new_id;
    insert into hopshop_inventory (product_id, org_id, quantity, updated_by)
    values (new_id, p_org, greatest(0, coalesce(v_qty, 1)), auth.uid());
  end if;

  if v_exists then
    update item_tags set
      kind = p_kind,
      is_alias = (p_kind = 'stock'),
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
    -- Into the shop: a SKU of its own; the DON number keeps working too.
    if p_kind = 'stock' then perform refresh_product_sku(new_id); end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.moved', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'from', old_kind, 'to', p_kind, 'title', v_title));
  else
    if p_kind = 'stock' then
      -- A new shop item: a SKU; a packet barcode becomes its second code.
      if v_code ~ '^[0-9]{8,14}$' then
        insert into item_tags (org_id, code, kind, product_id, created_by, is_alias)
        values (p_org, v_code, 'stock', new_id, auth.uid(), true);
        update hopshop_products set barcode = v_code where id = new_id;
      end if;
      v_code := refresh_product_sku(new_id);
      select * into t from item_tags where org_id = p_org and code = v_code;
    else
      insert into item_tags (org_id, code, kind, raffle_item_id, raffle_prize_id, product_id, donation_id, created_by)
      values (p_org, v_code, p_kind,
              case when p_kind = 'auction'  then new_id end,
              case when p_kind = 'raffle'   then new_id end,
              null,
              case when p_kind = 'donation' then new_id end,
              auth.uid())
      returning * into t;
    end if;
    insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
    values (p_org, auth.uid(), 'item.scanned', 'item_tag', t.id::text,
            jsonb_build_object('code', v_code, 'kind', p_kind, 'title', v_title));
  end if;

  select * into t from item_tags where org_id = p_org and code = v_code;
  return tagged_item_json(t);
end $$;
grant execute on function save_scanned_item(uuid, text, text, text, text, text, int, text, int, int, text) to authenticated;

-- Same as update 41; a purchase gets a PUR number.
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
  v_item jsonb;
  v_buy  boolean := coalesce(p_kind, 'donation') = 'donation' and jsonb_typeof(p_plan) = 'object' and p_plan->>'source' = 'purchase';
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- A donation gets the next DON number, a purchase the next PUR number (a
  -- scanned packet barcode isn't kept).
  if v_code is null
     or (coalesce(p_kind, 'donation') <> 'stock'
         and v_code !~ case when v_buy then '^PUR-[0-9]+$' else '^DON-[0-9]+$' end) then
    v_code := case when v_buy then new_purchase_code(p_org) else new_item_code(p_org) end;
  end if;
  if exists (select 1 from item_tags where org_id = p_org and code = v_code) then
    raise exception 'Code % is already on another item', v_code;
  end if;
  v_item := save_scanned_item(p_org, v_code, p_kind, p_title, p_description, p_donated_by,
                              p_value_cents, p_photo_url, p_price_cents, p_quantity, null);
  v_code := coalesce(v_item->>'code', v_code);
  if p_condition is not null or p_category is not null or p_location is not null then
    perform set_item_extras(p_org, v_code, p_condition, p_category, p_location);
  end if;
  if p_kind = 'donation' and p_plan is not null and jsonb_typeof(p_plan) = 'object' then
    perform set_donation_plan(p_org, v_code, p_plan);
  end if;
  return tagged_item_json((select x from item_tags x where x.org_id = p_org and x.code = v_code));
end $$;
grant execute on function catalog_new_item(uuid, text, text, text, text, int, text, int, int, text, text, text, text, jsonb) to authenticated;

-- Same as update 40; both parts keep how it came in, its cost (shared out) and use.
create or replace function split_donation(p_org uuid, p_code text, p_quantity int, p_headed_for text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t  item_tags;
  d  donation_items;
  nt item_tags;
  v_head text := nullif(btrim(coalesce(p_headed_for, '')), '');
  v_part_value int;
  v_part_cost int;
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
  if v_head is not null and v_head not in ('raffle', 'auction', 'shop', 'rabbits', 'event') then raise exception 'Unknown use'; end if;
  -- A value for the whole lot is shared out by how many go with each part.
  v_part_value := case when d.value_basis = 'all' and d.value_cents is not null
                       then round(d.value_cents::numeric * p_quantity / d.quantity)::int
                       else d.value_cents end;
  v_part_cost := case when d.cost_cents is not null then round(d.cost_cents::numeric * p_quantity / d.quantity)::int end;
  insert into donation_items (org_id, title, description, donated_by, value_cents, value_basis, photo_url, photo_urls,
                              received_on, created_by, price_cents, quantity, condition, category, location,
                              dropoff_id, headed_for, size, use_by, split_from,
                              source, cost_cents, bought_from, purpose)
  values (d.org_id, d.title, d.description, d.donated_by, v_part_value, d.value_basis, d.photo_url, d.photo_urls,
          d.received_on, auth.uid(), d.price_cents, p_quantity, d.condition, d.category, d.location,
          d.dropoff_id, coalesce(v_head, d.headed_for), d.size, d.use_by, d.id,
          d.source, v_part_cost, d.bought_from, case when v_head is null or v_head = d.headed_for then d.purpose end)
  returning id into v_new;
  update donation_items set
    quantity = quantity - p_quantity,
    value_cents = case when value_basis = 'all' and value_cents is not null then value_cents - v_part_value else value_cents end,
    cost_cents = case when cost_cents is not null then cost_cents - v_part_cost end
   where id = d.id;
  insert into item_tags (org_id, code, kind, donation_id, created_by)
  values (p_org, case when d.source = 'purchase' then new_purchase_code(p_org) else new_item_code(p_org) end, 'donation', v_new, auth.uid())
  returning * into nt;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'donation.split', 'item_tag', t.id::text,
          jsonb_build_object('code', t.code, 'new_code', nt.code, 'quantity', p_quantity));
  return tagged_item_json(nt);
end $$;
grant execute on function split_donation(uuid, text, int, text) to authenticated;

-- Same as update 40; purchases are not donations received.
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
   where d.org_id = p_org and d.received_on between p_from and p_to
     and coalesce(d.source, 'donation') = 'donation';
  return j;
end $$;
grant execute on function donations_received(uuid, date, date) to authenticated;

-- -------------------------------------------------------------
-- The counter: a new price for a line ("3 towels for $30")
-- Sponsor (2026-10-27): "on items that we sell that are not a vendor item we
-- need to be able to adjust the price. an example of two towels that are
-- priced 15.oo each and then they buy 3 we want to adjust the price to 30
-- for all 3".
-- counter_sale_lines.line_cents is what was charged for the whole line when
-- the price was changed; price_cents stays the label price each. Empty means
-- the label price times how many.
-- -------------------------------------------------------------
alter table counter_sale_lines add column if not exists line_cents int;
alter table counter_sale_lines drop constraint if exists counter_sale_lines_line_cents_check;
alter table counter_sale_lines add constraint counter_sale_lines_line_cents_check check (line_cents is null or line_cents >= 0);

-- Same as the Counter (2026-09-23); a line can carry one price for all of it.
create or replace function record_counter_sale(p_org uuid, p_sale jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := (p_sale ->> 'id')::uuid;
  v_method text := coalesce(p_sale ->> 'method', 'cash');
  v_total  int := 0;
  l        jsonb;
  v_pid    uuid;
  v_qty    int;
  v_short  jsonb := '[]'::jsonb;
  v_left   int;
  v_line   int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not counter_can_sell(p_org) then raise exception 'Not allowed'; end if;
  if v_id is null then raise exception 'The sale has no id'; end if;
  if exists (select 1 from counter_sales where id = v_id) then
    return jsonb_build_object('id', v_id, 'already', true);
  end if;
  if v_method not in ('cash', 'card', 'other') then raise exception 'Unknown payment method'; end if;
  if jsonb_array_length(coalesce(p_sale -> 'lines', '[]'::jsonb)) = 0 then raise exception 'The sale is empty'; end if;

  for l in select * from jsonb_array_elements(p_sale -> 'lines') loop
    v_qty := greatest(1, coalesce((l ->> 'qty')::int, 1));
    v_line := case when nullif(l ->> 'line_cents', '') is not null then greatest(0, (l ->> 'line_cents')::int) end;
    v_total := v_total + coalesce(v_line, greatest(0, coalesce((l ->> 'price_cents')::int, 0)) * v_qty);
  end loop;

  insert into counter_sales (id, org_id, sold_at, method, total_cents, device, note, sold_by)
  values (v_id, p_org, coalesce((p_sale ->> 'sold_at')::timestamptz, now()), v_method, v_total,
          left(p_sale ->> 'device', 40), left(nullif(btrim(coalesce(p_sale ->> 'note', '')), ''), 200), auth.uid());

  for l in select * from jsonb_array_elements(p_sale -> 'lines') loop
    v_pid := nullif(l ->> 'product_id', '')::uuid;
    if v_pid is not null and not exists (select 1 from hopshop_products where id = v_pid and org_id = p_org) then
      v_pid := null;
    end if;
    v_qty := greatest(1, coalesce((l ->> 'qty')::int, 1));
    v_line := case when nullif(l ->> 'line_cents', '') is not null then greatest(0, (l ->> 'line_cents')::int) end;
    insert into counter_sale_lines (sale_id, org_id, product_id, name, price_cents, qty, line_cents)
    values (v_id, p_org, v_pid, left(coalesce(nullif(btrim(l ->> 'name'), ''), 'Item'), 120),
            greatest(0, coalesce((l ->> 'price_cents')::int, 0)), v_qty, v_line);
    if v_pid is not null then
      update hopshop_inventory set quantity = greatest(0, quantity - v_qty), updated_by = auth.uid()
       where product_id = v_pid
       returning quantity into v_left;
      if found and v_left = 0 then
        v_short := v_short || jsonb_build_array(l ->> 'name');
      end if;
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'total_cents', v_total, 'now_out', v_short);
end $$;
grant execute on function record_counter_sale(uuid, jsonb) to authenticated;

-- Same as the Counter; a changed price counts as what was charged.
create or replace function counter_day(p_org uuid, p_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select * from counter_sales
     where org_id = p_org and (sold_at at time zone 'America/New_York')::date = p_day
  )
  select jsonb_build_object(
    'sales', (select count(*) from s),
    'cash_cents', (select coalesce(sum(total_cents), 0) from s where method = 'cash'),
    'card_cents', (select coalesce(sum(total_cents), 0) from s where method = 'card'),
    'other_cents', (select coalesce(sum(total_cents), 0) from s where method = 'other'),
    'items', coalesce((select jsonb_agg(x order by x.cents desc) from (
                select l.name, sum(l.qty)::int as qty, sum(coalesce(l.line_cents, l.qty * l.price_cents))::int as cents
                  from counter_sale_lines l join s on s.id = l.sale_id
                 group by l.name) x), '[]'::jsonb))
  where counter_can_sell(p_org) or has_permission(p_org, 'hopshop.orders.view');
$$;
grant execute on function counter_day(uuid, date) to authenticated;

-- -------------------------------------------------------------
-- Vendors: what we bought from each one
-- Sponsor (2026-10-27): "knowing that there is a vendor that is at the events
-- and sometimes we also purchase from them. we need to understand both".
-- A purchase whose store is on the vendor list (suppliers: is_supplier = we
-- buy from them, is_vendor = sells at our events) is linked to it.
-- -------------------------------------------------------------
alter table donation_items add column if not exists bought_from_id uuid references suppliers(id) on delete set null;
create index if not exists idx_donation_items_bought_from on donation_items(bought_from_id) where bought_from_id is not null;
-- Purchases typed before a vendor was added (or before this update) find it.
update donation_items d set bought_from_id = s.id
  from suppliers s
 where d.bought_from_id is null and d.bought_from is not null
   and s.org_id = d.org_id and lower(btrim(s.name)) = lower(btrim(d.bought_from));

-- [{supplier_id, items, cost_cents, last_on}] for the Vendors list.
create or replace function supplier_purchase_totals(p_org uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not (can_manage_item_kind(p_org, 'donation') or has_permission(p_org, 'hopshop.orders.view'))
  then '[]'::jsonb
  else coalesce((
    select jsonb_agg(jsonb_build_object('supplier_id', bought_from_id, 'items', n, 'cost_cents', cost, 'last_on', last_on))
      from (select bought_from_id, sum(quantity)::int as n, sum(cost_cents)::int as cost, max(received_on) as last_on
              from donation_items
             where org_id = p_org and source = 'purchase' and bought_from_id is not null
             group by bought_from_id) x), '[]'::jsonb)
  end;
$$;
grant execute on function supplier_purchase_totals(uuid) to authenticated;

-- Places (the boxes' too) and stores (every vendor, at events or not) for the drop-down lists.
create or replace function catalog_suggestions(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not is_org_member(p_org)
  then jsonb_build_object('locations', '[]'::jsonb, 'categories', '[]'::jsonb, 'stores', '[]'::jsonb)
  else jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(name order by last_used desc) from (
        select min(name) as name, max(used) as last_used from (
          select btrim(location) as name, created_at as used from donation_items
           where org_id = p_org and nullif(btrim(coalesce(location, '')), '') is not null
          union all
          select btrim(location), updated_at from item_boxes
           where org_id = p_org and nullif(btrim(coalesce(location, '')), '') is not null) u
         group by lower(name) order by max(used) desc limit 30) l), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(name order by last_used desc) from (
        select name, max(used) as last_used from (
          select btrim(category) as name, created_at as used from donation_items
           where org_id = p_org and nullif(btrim(coalesce(category, '')), '') is not null
          union all
          select btrim(category), updated_at from hopshop_products
           where org_id = p_org and nullif(btrim(coalesce(category, '')), '') is not null) u
         group by name order by max(used) desc limit 12) c), '[]'::jsonb),
    'stores', coalesce((
      select jsonb_agg(name order by last_used desc) from (
        select min(name) as name, max(used) as last_used from (
          select btrim(bought_from) as name, created_at as used from donation_items
           where org_id = p_org and nullif(btrim(coalesce(bought_from, '')), '') is not null
          union all
          select btrim(name), updated_at from suppliers
           where org_id = p_org and is_active and nullif(btrim(coalesce(name, '')), '') is not null) u
         group by lower(name) order by max(used) desc limit 30) s), '[]'::jsonb))
  end;
$$;
grant execute on function catalog_suggestions(uuid) to authenticated;

-- An item put in a box is kept where the box is.
create or replace function item_takes_box_place() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.box_id is not null and new.donation_id is not null then
    update donation_items d set location = b.location
      from item_boxes b
     where b.id = new.box_id and d.id = new.donation_id
       and nullif(btrim(coalesce(b.location, '')), '') is not null
       and d.location is distinct from b.location;
  end if;
  return null;
end $$;
drop trigger if exists trg_item_tags_box_place on item_tags;
create trigger trg_item_tags_box_place after insert or update of box_id on item_tags
  for each row execute function item_takes_box_place();

-- A box moved to another place takes its items with it.
create or replace function box_moves_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if nullif(btrim(coalesce(new.location, '')), '') is not null and new.location is distinct from old.location then
    update donation_items d set location = new.location
      from item_tags t
     where t.box_id = new.id and d.id = t.donation_id and d.location is distinct from new.location;
  end if;
  return null;
end $$;
drop trigger if exists trg_item_boxes_move_items on item_boxes;
create trigger trg_item_boxes_move_items after update of location on item_boxes
  for each row execute function box_moves_items();

-- -------------------------------------------------------------
-- Check (the last result): seven "true"
-- -------------------------------------------------------------
select
  exists (select 1 from information_schema.columns where table_name = 'donation_items' and column_name = 'source') as donation_or_purchase,
  exists (select 1 from information_schema.columns where table_name = 'donation_items' and column_name = 'purpose') as uses_column,
  (select count(*) from item_purposes) >= 5 as uses_list,
  normalize_item_code('pur 5') = 'PUR-00005' as purchase_numbers_read,
  exists (select 1 from pg_proc where proname = 'new_purchase_code') as purchase_numbers_made,
  exists (select 1 from pg_trigger where tgname = 'trg_item_boxes_move_items') as boxes_carry_their_place,
  exists (select 1 from information_schema.columns where table_name = 'counter_sale_lines' and column_name = 'line_cents') as counter_price_changes;
