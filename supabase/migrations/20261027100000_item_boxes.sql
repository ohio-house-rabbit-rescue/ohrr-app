-- =============================================================
-- Update 46 (2026-10-27): boxes — packing scanned items into a box.
--
-- Sponsor: "i want to scan 12 donations. they fit in a box. i want that box
-- to have a itemized list and label … a box number and just the item listed".
--
--   item_boxes         one row per box: BOX-00001 (shown as "Box 1"), where
--                      it's kept, a note, when its label was printed
--   item_tags.box_id   which box an item is in (one box at a time);
--   item_tags.boxed_at when it went in (the list keeps that order)
--
--   new_box()            the next box number
--   box_by_code()        a box and its items (what scanning the box opens)
--   list_boxes()         every box, newest first
--   box_items_set()      put items in a box by their codes (moves them out of
--                        any other box); with no box, takes them out
--   save_box()           where it's kept, and the note
--   delete_box()         the box goes, its items stay (just not in a box)
--   mark_boxes_printed() after the box label prints
--   item_by_code() and list_tagged_items() now say which box an item is in.
--
-- normalize_item_code() learns "box 12" → BOX-00012. Box numbers have 1–5
-- digits, so a Hop Shop SKU of a type called BOX (BOX-101-001) still reads
-- as a SKU.
--
-- Apply AFTER 20261026100000_online_auction_square.sql. Safe to run twice.
-- =============================================================

create table if not exists item_boxes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  box_no            int not null check (box_no > 0),
  code              text not null,
  location          text check (location is null or length(location) <= 120),
  note              text check (note is null or length(note) <= 500),
  label_printed_at  timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, box_no),
  unique (org_id, code)
);
drop trigger if exists trg_item_boxes_updated on item_boxes;
create trigger trg_item_boxes_updated before update on item_boxes
  for each row execute function set_updated_at();
alter table item_boxes enable row level security;
drop policy if exists item_boxes_member_select on item_boxes;
create policy item_boxes_member_select on item_boxes for select using (is_org_member(org_id));
grant select on item_boxes to authenticated;

alter table item_tags add column if not exists box_id uuid references item_boxes(id) on delete set null;
alter table item_tags add column if not exists boxed_at timestamptz;
create index if not exists idx_item_tags_box on item_tags(box_id) where box_id is not null;

-- Any way a code arrives → one spelling. Same as update 41, plus boxes.
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

-- The tag that carries an item's box: a shop item's packet barcode (or the
-- DON number it came in with) points at the product's own SKU tag.
create or replace function item_main_tag(p_tag item_tags)
returns item_tags language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
begin
  if p_tag.is_alias and p_tag.product_id is not null then
    select * into t from item_tags x
     where x.product_id = p_tag.product_id and x.kind = 'stock' and not x.is_alias
     order by x.created_at limit 1;
    if found then return t; end if;
  end if;
  return p_tag;
end $$;
revoke all on function item_main_tag(item_tags) from public, anon;

-- {code, box_no, location} of the box an item is in, or null.
create or replace function item_box_json(p_tag item_tags)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', b.code, 'box_no', b.box_no, 'location', b.location)
    from item_boxes b
   where b.id = (item_main_tag(p_tag)).box_id;
$$;
revoke all on function item_box_json(item_tags) from public, anon;

create or replace function box_json(p_box item_boxes)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p_box.id, 'code', p_box.code, 'box_no', p_box.box_no,
    'location', p_box.location, 'note', p_box.note,
    'label_printed_at', p_box.label_printed_at,
    'created_at', p_box.created_at, 'updated_at', p_box.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', x.j->>'code', 'kind', t.kind, 'title', x.j->>'title',
               'photo_url', x.j->>'photo_url', 'quantity', x.j->'quantity',
               'boxed_at', t.boxed_at)
             order by t.boxed_at, t.code)
        from item_tags t
        cross join lateral (select tagged_item_json(t) as j) x
       where t.box_id = p_box.id and not t.is_alias and x.j is not null), '[]'::jsonb));
$$;
revoke all on function box_json(item_boxes) from public, anon;

create or replace function new_box(p_org uuid, p_location text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n int;
  b item_boxes;
  i int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  for i in 1..1000 loop
    n := next_code_no(p_org, 'BOX')::int;
    if n > 99999 then raise exception 'Box numbers have run out (99999)'; end if;
    if not exists (select 1 from item_boxes where org_id = p_org and box_no = n) then
      insert into item_boxes (org_id, box_no, code, location, note, created_by)
      values (p_org, n, 'BOX-' || code_pad(n, 5), nullif(btrim(p_location), ''), nullif(btrim(p_note), ''), auth.uid())
      returning * into b;
      return box_json(b);
    end if;
  end loop;
  raise exception 'Could not give a box number — try again';
end $$;
grant execute on function new_box(uuid, text, text) to authenticated;

create or replace function box_by_code(p_org uuid, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  b item_boxes;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  select * into b from item_boxes where org_id = p_org and code = normalize_item_code(p_code);
  if not found then return null; end if;
  return box_json(b);
end $$;
grant execute on function box_by_code(uuid, text) to authenticated;

create or replace function list_boxes(p_org uuid)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
declare
  b item_boxes;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  for b in select * from item_boxes where org_id = p_org order by box_no desc loop
    return next box_json(b);
  end loop;
end $$;
grant execute on function list_boxes(uuid) to authenticated;

-- Put items in a box by their codes; with p_box null, take them out of their boxes.
-- Answers {box, added, moved: [{code, title, from}], not_found: [codes]}.
create or replace function box_items_set(p_org uuid, p_box text, p_codes text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b item_boxes;
  t item_tags;
  m item_tags;
  c text;
  v_from text;
  v_added int := 0;
  v_moved jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if p_box is not null then
    select * into b from item_boxes where org_id = p_org and code = normalize_item_code(p_box);
    if not found then raise exception 'No box with that number'; end if;
  end if;
  foreach c in array coalesce(p_codes, '{}'::text[]) loop
    select * into t from item_tags where org_id = p_org and code = normalize_item_code(c);
    if not found then
      v_missing := v_missing || to_jsonb(c);
      continue;
    end if;
    m := item_main_tag(t);
    if m.box_id is not distinct from b.id then continue; end if;   -- already there (or already out)
    if b.id is not null and m.box_id is not null then
      select code into v_from from item_boxes where id = m.box_id;
      v_moved := v_moved || jsonb_build_object('code', m.code, 'title', tagged_item_json(m)->>'title', 'from', v_from);
    end if;
    update item_tags set box_id = b.id, boxed_at = case when b.id is null then null else now() end where id = m.id;
    v_added := v_added + 1;
  end loop;
  if b.id is not null then
    update item_boxes set updated_at = now() where id = b.id returning * into b;
  end if;
  return jsonb_build_object('box', case when b.id is null then null else box_json(b) end,
                            'added', v_added, 'moved', v_moved, 'not_found', v_missing);
end $$;
grant execute on function box_items_set(uuid, text, text[]) to authenticated;

create or replace function save_box(p_org uuid, p_code text, p_location text default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b item_boxes;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  update item_boxes set location = nullif(btrim(p_location), ''), note = nullif(btrim(p_note), '')
   where org_id = p_org and code = normalize_item_code(p_code)
   returning * into b;
  if not found then raise exception 'No box with that number'; end if;
  return box_json(b);
end $$;
grant execute on function save_box(uuid, text, text, text) to authenticated;

create or replace function delete_box(p_org uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  update item_tags set box_id = null, boxed_at = null
   where box_id = (select id from item_boxes where org_id = p_org and code = normalize_item_code(p_code));
  delete from item_boxes where org_id = p_org and code = normalize_item_code(p_code);
end $$;
grant execute on function delete_box(uuid, text) to authenticated;

create or replace function mark_boxes_printed(p_org uuid, p_codes text[], p_printed boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  update item_boxes set label_printed_at = case when p_printed then now() else null end
   where org_id = p_org
     and code = any (select normalize_item_code(c) from unnest(coalesce(p_codes, '{}'::text[])) c);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function mark_boxes_printed(uuid, text[], boolean) to authenticated;

revoke execute on function new_box(uuid, text, text), box_by_code(uuid, text), list_boxes(uuid),
  box_items_set(uuid, text, text[]), save_box(uuid, text, text, text), delete_box(uuid, text),
  mark_boxes_printed(uuid, text[], boolean) from anon;

-- Item lookups say which box the item is in (same as update 41, plus 'box').
create or replace function item_by_code(p_org uuid, p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
  j jsonb;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  select * into t from item_tags where org_id = p_org and code = normalize_item_code(p_code);
  if not found then return null; end if;
  j := tagged_item_json(t);
  if j is null then return null; end if;
  return j || jsonb_build_object('box', item_box_json(t));
end $$;
grant execute on function item_by_code(uuid, text) to authenticated;

create or replace function list_tagged_items(p_org uuid, p_kind text default null, p_unprinted boolean default false)
returns setof jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t item_tags;
  j jsonb;
begin
  if not is_org_member(p_org) then raise exception 'Not allowed'; end if;
  for t in
    select * from item_tags
     where org_id = p_org and (p_kind is null or kind = p_kind) and not is_alias
       and (not p_unprinted or label_printed_at is null)
     order by created_at desc
  loop
    j := tagged_item_json(t);
    if j is not null then
      return next j || jsonb_build_object('box', item_box_json(t));
    end if;
  end loop;
end $$;
grant execute on function list_tagged_items(uuid, text, boolean) to authenticated;
