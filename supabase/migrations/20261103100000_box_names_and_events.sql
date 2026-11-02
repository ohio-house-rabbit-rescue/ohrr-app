-- =============================================================
-- Update 50 (2026-11-03): name a box, describe it, say which event it goes to,
-- and make a set ("Raffle box 1 of 4"). Sponsor: "can I change the name of the
-- box so I can build orders or specific storage items like raffle box 1 and
-- then do a box 1 of 4 ... put a description on the box like green tote ...
-- where does it go is the event list, and we need to create an event."
--
-- item_boxes gets name, description, event_id (an events row), part_no/part_of.
-- Boxes with no name are still "Box 12". Idempotent.
-- =============================================================

alter table item_boxes add column if not exists name        text check (name is null or length(name) <= 60);
alter table item_boxes add column if not exists description text check (description is null or length(description) <= 120);
alter table item_boxes add column if not exists event_id    uuid references events(id) on delete set null;
alter table item_boxes add column if not exists part_no     int  check (part_no is null or part_no > 0);
alter table item_boxes add column if not exists part_of     int  check (part_of is null or part_of > 0);

create or replace function box_json(p_box item_boxes)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p_box.id, 'code', p_box.code, 'box_no', p_box.box_no,
    'location', p_box.location, 'note', p_box.note,
    'name', p_box.name, 'description', p_box.description,
    'event_id', p_box.event_id,
    'event_title', (select e.title from events e where e.id = p_box.event_id),
    'part_no', p_box.part_no, 'part_of', p_box.part_of,
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

-- The box an item sits in (item lookups): its name and place in a set too.
create or replace function item_box_json(p_tag item_tags)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', b.code, 'box_no', b.box_no, 'location', b.location,
                            'name', b.name, 'part_no', b.part_no, 'part_of', b.part_of)
    from item_boxes b
   where b.id = (item_main_tag(p_tag)).box_id;
$$;
revoke all on function item_box_json(item_tags) from public, anon;

-- Make one box, or a set: p_count > 1 makes "name 1 of N" ... "name N of N".
create or replace function make_boxes(
  p_org uuid, p_count int default 1, p_name text default null, p_description text default null,
  p_event_id uuid default null, p_location text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n int;
  b item_boxes;
  i int;
  k int;
  made jsonb := '[]'::jsonb;
  cnt int := greatest(1, least(coalesce(p_count, 1), 50));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if p_event_id is not null and not exists (select 1 from events where id = p_event_id and org_id = p_org) then
    raise exception 'No such event';
  end if;
  for k in 1..cnt loop
    for i in 1..1000 loop
      n := next_code_no(p_org, 'BOX')::int;
      if n > 99999 then raise exception 'Box numbers have run out (99999)'; end if;
      if not exists (select 1 from item_boxes where org_id = p_org and box_no = n) then
        insert into item_boxes (org_id, box_no, code, location, name, description, event_id, part_no, part_of, created_by)
        values (p_org, n, 'BOX-' || code_pad(n, 5), nullif(btrim(p_location), ''), nullif(btrim(p_name), ''),
                nullif(btrim(p_description), ''), p_event_id,
                case when cnt > 1 then k end, case when cnt > 1 then cnt end, auth.uid())
        returning * into b;
        made := made || jsonb_build_array(box_json(b));
        exit;
      end if;
    end loop;
  end loop;
  return made;
end $$;
grant execute on function make_boxes(uuid, int, text, text, uuid, text) to authenticated;

-- Change a box's name, description, event and place in a set. Blank clears.
create or replace function set_box_details(
  p_org uuid, p_code text, p_name text default null, p_description text default null,
  p_event_id uuid default null, p_part_no int default null, p_part_of int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b item_boxes;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not can_manage_item_kind(p_org, 'donation') then raise exception 'Not allowed'; end if;
  if p_event_id is not null and not exists (select 1 from events where id = p_event_id and org_id = p_org) then
    raise exception 'No such event';
  end if;
  if (p_part_no is null) <> (p_part_of is null) then raise exception 'Give both numbers for "1 of 4", or neither'; end if;
  if p_part_no is not null and p_part_no > p_part_of then raise exception 'The box number can''t be more than the total'; end if;
  update item_boxes
     set name = nullif(btrim(p_name), ''), description = nullif(btrim(p_description), ''),
         event_id = p_event_id, part_no = p_part_no, part_of = p_part_of
   where org_id = p_org and code = normalize_item_code(p_code)
   returning * into b;
  if not found then raise exception 'No box with that number'; end if;
  return box_json(b);
end $$;
grant execute on function set_box_details(uuid, text, text, text, uuid, int, int) to authenticated;

revoke execute on function make_boxes(uuid, int, text, text, uuid, text),
  set_box_details(uuid, text, text, text, uuid, int, int) from anon;
