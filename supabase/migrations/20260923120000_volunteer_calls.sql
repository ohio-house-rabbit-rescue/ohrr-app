-- =============================================================
-- OHRR — Volunteer calls: from "we need people" to "thank you, here are
-- your hours"
--
-- The pieces existed — bookable shifts, a roster with check-in, hours totals,
-- a service letter — but nothing tied a specific need to them. A volunteer
-- call is that need, entered once:
--
--   "Midwest BunFest, Sun 25 Oct, 10 AM – 4 PM, 2-hour shifts, 5 people each"
--
-- Saving it makes the shifts (10–12, 12–2, 2–4, five places each) as an
-- ordinary bookable shift type, so everything already built for shifts works:
-- the roster, check-in, no-shows, and hours counted from shifts people were
-- checked in to. On top of that:
--
--   volunteer_calls         the need: what, when, how long, how many, the
--                           areas people can pick, who can help, the perks
--   sign_up_for_call()      one form, one or more shifts; the person lands in
--                           the volunteer roster (by email) and the medium they
--                           came from is kept — which post or letter worked
--   add_walk_in()           someone turns up without signing up: add them and
--                           mark them present in one go
--   call_roster()           the day's list, shift by shift
--   call_thanks()           afterwards: everyone who came, their hours at this
--                           event, this year and in all — for the thank-you
--   mark_thanked()          so nobody is thanked twice or missed
--   call_sources()          sign-ups by where they came from
--   volunteers.hours_for / letter_details
--                           what the hours are for (school credit, a military
--                           service award, a workplace programme) and the
--                           details the letter needs — asked once, at sign-up
--
-- Hours are still "you came for this block and helped", not a time clock: a
-- shift someone is checked in to counts its full length.
--
-- Paste + Run AFTER 20260923100000_bunfest_floor_speakers_rhdv2.sql.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. The need
-- -------------------------------------------------------------
create table if not exists volunteer_calls (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  slug              text not null,
  title             text not null,                     -- "Midwest BunFest volunteers"
  summary           text,                              -- one line, for posts and texts
  details           text,                              -- what you'll do
  location          text,
  on_date           date not null,
  starts_at         time not null,                     -- the window, local time
  ends_at           time not null,
  shift_minutes     int  not null default 120 check (shift_minutes between 30 and 720),
  people_per_shift  int  not null default 1 check (people_per_shift between 1 and 200),
  areas             text[] not null default '{}',      -- people pick one: "Hop Shop", "Registration"
  who               text,                              -- "Anyone 16 or older — no experience needed"
  perks             text[] not null default '{}',      -- "Free admission", "A BunFest lanyard"
  requirements      text,                              -- one per line
  closes_on         date,                              -- sign-ups close after this day
  type_id           uuid references booking_types(id) on delete set null,
  is_published      boolean not null default true,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, slug),
  check (ends_at > starts_at)
);
create index if not exists idx_volunteer_calls_date on volunteer_calls(org_id, on_date);
drop trigger if exists trg_volunteer_calls_updated on volunteer_calls;
create trigger trg_volunteer_calls_updated before update on volunteer_calls
  for each row execute function set_updated_at();

alter table volunteer_calls enable row level security;
drop policy if exists volunteer_calls_public_select on volunteer_calls;
create policy volunteer_calls_public_select on volunteer_calls for select using (is_published);
drop policy if exists volunteer_calls_staff_all on volunteer_calls;
create policy volunteer_calls_staff_all on volunteer_calls for all
  using (has_permission(org_id, 'bookings.manage') or has_permission(org_id, 'volunteers.shifts.manage'))
  with check (has_permission(org_id, 'bookings.manage') or has_permission(org_id, 'volunteers.shifts.manage'));
grant select on volunteer_calls to anon, authenticated;
grant insert, update, delete on volunteer_calls to authenticated;

-- What the hours are for, and the details a letter needs.
alter table volunteers add column if not exists hours_for text
  check (hours_for is null or hours_for in ('school', 'military', 'workplace', 'community', 'other'));
alter table volunteers add column if not exists letter_details jsonb not null default '{}'::jsonb;

-- So nobody is thanked twice, or missed.
alter table bookings add column if not exists thanked_at timestamptz;

create or replace function vc_can(p_org uuid) returns boolean
language sql stable as $$
  select has_permission(p_org, 'bookings.manage') or has_permission(p_org, 'volunteers.shifts.manage');
$$;

-- -------------------------------------------------------------
-- 2. Saving a call makes its shifts
-- -------------------------------------------------------------
create or replace function save_volunteer_call(p_org uuid, p_call jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid := nullif(p_call ->> 'id', '')::uuid;
  v_slug    text := lower(regexp_replace(btrim(coalesce(nullif(p_call ->> 'slug', ''), p_call ->> 'title', '')), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base    text;
  v_n       int := 1;
  v_title   text := btrim(coalesce(p_call ->> 'title', ''));
  v_date    date := (p_call ->> 'on_date')::date;
  v_start   time := (p_call ->> 'starts_at')::time;
  v_end     time := (p_call ->> 'ends_at')::time;
  v_shift   int  := coalesce((p_call ->> 'shift_minutes')::int, 120);
  v_people  int  := coalesce((p_call ->> 'people_per_shift')::int, 1);
  v_pub     boolean := coalesce((p_call ->> 'is_published')::boolean, true);
  v_type    uuid;
  c         volunteer_calls;
  v_at      timestamptz;
  v_until   timestamptz;
  v_kept    timestamptz[] := '{}';
  v_made    int := 0;
  v_stuck   int := 0;
begin
  if not vc_can(p_org) then raise exception 'Not allowed'; end if;
  v_slug := btrim(v_slug, '-');
  if v_title = '' then raise exception 'Give the call a name'; end if;
  if v_slug = '' then raise exception 'Give the call a name with some letters in it'; end if;
  if v_date is null or v_start is null or v_end is null then raise exception 'Set the day and the hours'; end if;
  if v_end <= v_start then raise exception 'The finish time has to be after the start'; end if;
  if v_shift < 30 then raise exception 'A shift is at least 30 minutes'; end if;
  if extract(epoch from (v_end - v_start)) / 60 < v_shift then
    raise exception 'The shift is longer than the whole window — shorten it, or widen the hours';
  end if;

  -- A call keeps the address it was first shared under, even if renamed —
  -- posts, letters and flyers already point at it.
  if v_id is not null then
    select slug into v_slug from volunteer_calls where id = v_id and org_id = p_org;
    if not found then raise exception 'No such call'; end if;
  else
    v_base := v_slug;
    while exists (select 1 from volunteer_calls where org_id = p_org and slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
  end if;

  if v_id is null then
    insert into volunteer_calls (org_id, slug, title, on_date, starts_at, ends_at, created_by)
    values (p_org, v_slug, v_title, v_date, v_start, v_end, auth.uid())
    returning id into v_id;
  end if;

  update volunteer_calls set
    slug             = v_slug,
    title            = v_title,
    summary          = nullif(btrim(coalesce(p_call ->> 'summary', '')), ''),
    details          = nullif(btrim(coalesce(p_call ->> 'details', '')), ''),
    location         = nullif(btrim(coalesce(p_call ->> 'location', '')), ''),
    on_date          = v_date,
    starts_at        = v_start,
    ends_at          = v_end,
    shift_minutes    = v_shift,
    people_per_shift = greatest(1, v_people),
    areas            = coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p_call -> 'areas', '[]'::jsonb)) as x where btrim(x) <> ''), '{}'),
    who              = nullif(btrim(coalesce(p_call ->> 'who', '')), ''),
    perks            = coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p_call -> 'perks', '[]'::jsonb)) as x where btrim(x) <> ''), '{}'),
    requirements     = nullif(btrim(coalesce(p_call ->> 'requirements', '')), ''),
    closes_on        = nullif(p_call ->> 'closes_on', '')::date,
    is_published     = v_pub
  where id = v_id and org_id = p_org
  returning * into c;
  if not found then raise exception 'No such call'; end if;

  -- Its shifts are an ordinary bookable shift type.
  if c.type_id is null then
    insert into booking_types (org_id, slug, name, kind, description, requirements, location,
                               duration_min, capacity, max_party, confirm_mode, is_published, sort_order)
    values (p_org, 'call-' || c.slug, c.title || ' (volunteer call)', 'shift', c.summary, c.requirements,
            c.location, c.shift_minutes, c.people_per_shift, 1, 'auto', c.is_published, 900)
    on conflict (org_id, slug) do update set name = excluded.name
    returning id into v_type;
    update volunteer_calls set type_id = v_type where id = c.id;
  else
    v_type := c.type_id;
    update booking_types set
      name = c.title || ' (volunteer call)', description = c.summary, requirements = c.requirements,
      location = c.location, duration_min = c.shift_minutes, capacity = c.people_per_shift,
      is_published = c.is_published
    where id = v_type;
  end if;

  -- One slot per shift across the window, in Ohio time.
  v_at := (c.on_date + c.starts_at) at time zone 'America/New_York';
  v_until := (c.on_date + c.ends_at) at time zone 'America/New_York';
  while v_at + make_interval(mins => c.shift_minutes) <= v_until loop
    insert into booking_slots (org_id, type_id, starts_at, ends_at, capacity, is_open, created_by)
    values (p_org, v_type, v_at, v_at + make_interval(mins => c.shift_minutes), c.people_per_shift, true, auth.uid())
    on conflict (type_id, starts_at) do update
      set ends_at = excluded.ends_at, capacity = excluded.capacity, is_open = true;
    v_kept := v_kept || v_at;
    v_made := v_made + 1;
    v_at := v_at + make_interval(mins => c.shift_minutes);
  end loop;

  -- Shifts that no longer fit: gone if nobody is on them, closed if someone is.
  delete from booking_slots s
   where s.type_id = v_type and not (s.starts_at = any (v_kept))
     and not exists (select 1 from bookings b where b.slot_id = s.id and b.status <> 'cancelled');
  update booking_slots s set is_open = false
   where s.type_id = v_type and not (s.starts_at = any (v_kept));
  get diagnostics v_stuck = row_count;

  return jsonb_build_object('id', c.id, 'slug', c.slug, 'shifts', v_made, 'orphaned', v_stuck);
end $$;
grant execute on function save_volunteer_call(uuid, jsonb) to authenticated;

-- -------------------------------------------------------------
-- 3. What the public sees
-- -------------------------------------------------------------
create or replace function vc_shifts(p_type uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
           'capacity', s.capacity,
           'taken', (select coalesce(sum(b.party_size), 0) from bookings b
                      where b.slot_id = s.id and b.status in ('requested', 'confirmed', 'checked_in')),
           'open', s.is_open and s.starts_at > now())
         order by s.starts_at), '[]'::jsonb)
    from booking_slots s
   where s.type_id = p_type;
$$;

-- One call and its shifts with the places left.
create or replace function volunteer_call_public(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'id', c.id, 'slug', c.slug, 'title', c.title, 'summary', c.summary, 'details', c.details,
           'location', c.location, 'on_date', c.on_date, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
           'shift_minutes', c.shift_minutes, 'people_per_shift', c.people_per_shift, 'areas', c.areas,
           'who', c.who, 'perks', c.perks, 'requirements', c.requirements, 'closes_on', c.closes_on,
           'is_open', (c.closes_on is null or c.closes_on >= (now() at time zone 'America/New_York')::date)
                      and c.on_date >= (now() at time zone 'America/New_York')::date,
           'shifts', vc_shifts(c.type_id))
    from volunteer_calls c
   where c.slug = lower(p_slug) and c.is_published
   limit 1;
$$;
grant execute on function volunteer_call_public(text) to anon, authenticated;

-- The calls still taking people, soonest first, with how full they are.
create or replace function volunteer_calls_open()
returns table (slug text, title text, summary text, on_date date, starts_at time, ends_at time,
               location text, places int, taken int)
language sql stable security definer set search_path = public as $$
  select c.slug, c.title, c.summary, c.on_date, c.starts_at, c.ends_at, c.location,
         coalesce((select sum(s.capacity) from booking_slots s where s.type_id = c.type_id and s.is_open), 0)::int,
         coalesce((select sum(b.party_size) from bookings b join booking_slots s on s.id = b.slot_id
                    where s.type_id = c.type_id and s.is_open
                      and b.status in ('requested', 'confirmed', 'checked_in')), 0)::int
    from volunteer_calls c
   where c.is_published
     and c.on_date >= (now() at time zone 'America/New_York')::date
     and (c.closes_on is null or c.closes_on >= (now() at time zone 'America/New_York')::date)
   order by c.on_date, c.starts_at;
$$;
grant execute on function volunteer_calls_open() to anon, authenticated;

-- -------------------------------------------------------------
-- 4. Signing up
--
-- One or more shifts in one go. The person is added to (or matched in) the
-- volunteer roster by email. Their private hours link is only handed back
-- when this sign-up created their record — typing someone else's email must
-- never reveal that person's hours.
-- -------------------------------------------------------------
create or replace function sign_up_for_call(
  p_slug text, p_slot_ids uuid[], p_name text, p_email text, p_phone text default null,
  p_area text default null, p_hours_for text default null, p_details jsonb default '{}'::jsonb,
  p_source text default null, p_attested boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c        volunteer_calls;
  s        booking_slots;
  v_slot   uuid;
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := nullif(btrim(coalesce(p_phone, '')), '');
  v_area   text := nullif(btrim(coalesce(p_area, '')), '');
  v_for    text := nullif(btrim(coalesce(p_hours_for, '')), '');
  v_taken  int;
  v_out    jsonb := '[]'::jsonb;
  v_token  uuid;
  v_new    boolean := false;
  v_vol    volunteers;
  b        bookings;
begin
  select * into c from volunteer_calls where slug = lower(p_slug) and is_published;
  if not found then raise exception 'That call isn’t taking sign-ups'; end if;
  if c.on_date < (now() at time zone 'America/New_York')::date
     or (c.closes_on is not null and c.closes_on < (now() at time zone 'America/New_York')::date) then
    raise exception 'Sign-ups for this have closed — thank you for offering';
  end if;
  if v_name = '' then raise exception 'Please add your name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please check your email address'; end if;
  if coalesce(array_length(p_slot_ids, 1), 0) = 0 then raise exception 'Pick at least one shift'; end if;
  if array_length(c.areas, 1) > 0 and v_area is not null and not (v_area = any (c.areas)) then
    raise exception 'Please pick one of the listed areas';
  end if;
  if v_for is not null and v_for not in ('school', 'military', 'workplace', 'community', 'other') then
    v_for := 'other';
  end if;

  foreach v_slot in array p_slot_ids loop
    select * into s from booking_slots where id = v_slot and type_id = c.type_id for update;
    if not found then raise exception 'One of those shifts isn’t part of this call'; end if;
    if not s.is_open or s.starts_at <= now() then raise exception 'One of those shifts is no longer open'; end if;
    if exists (select 1 from bookings x where x.slot_id = s.id and lower(x.email) = v_email
                and x.status in ('requested', 'confirmed', 'checked_in')) then
      raise exception 'You’re already down for one of those shifts';
    end if;
    select coalesce(sum(party_size), 0) into v_taken from bookings
     where slot_id = s.id and status in ('requested', 'confirmed', 'checked_in');
    if v_taken >= s.capacity then
      raise exception 'One of those shifts has just filled up — please pick another';
    end if;
    insert into bookings (org_id, slot_id, type_id, name, email, phone, party_size, answer, attested, status, source)
    values (c.org_id, s.id, c.type_id, v_name, v_email, v_phone, 1, v_area, coalesce(p_attested, false), 'confirmed',
            left(nullif(btrim(coalesce(p_source, '')), ''), 40))
    returning * into b;
    v_out := v_out || jsonb_build_object('booking_id', b.id, 'slot_id', s.id, 'starts_at', s.starts_at,
                                         'ends_at', s.ends_at, 'cancel_token', b.cancel_token);
  end loop;

  -- Into the roster.
  select * into v_vol from volunteers where org_id = c.org_id and lower(email) = v_email;
  if not found then
    insert into volunteers (org_id, name, email, phone, status, roles, started_on, hours_for, letter_details, notes)
    values (c.org_id, v_name, v_email, v_phone, 'active', array['events'],
            (now() at time zone 'America/New_York')::date, v_for, coalesce(p_details, '{}'::jsonb),
            'Signed up for ' || c.title)
    returning * into v_vol;
    v_new := true;
  else
    update volunteers set
      phone          = coalesce(phone, v_phone),
      roles          = case when 'events' = any (roles) then roles else roles || 'events' end,
      status         = case when status in ('prospect', 'former') then 'active' else status end,
      hours_for      = coalesce(v_for, hours_for),
      letter_details = letter_details || coalesce(p_details, '{}'::jsonb)
    where id = v_vol.id;
  end if;
  if v_new then v_token := v_vol.access_token; end if;

  return jsonb_build_object('shifts', v_out, 'new_volunteer', v_new, 'hours_token', v_token);
end $$;
grant execute on function sign_up_for_call(text, uuid[], text, text, text, text, text, jsonb, text, boolean) to anon, authenticated;

-- -------------------------------------------------------------
-- 5. On the day, and afterwards
-- -------------------------------------------------------------
-- Someone came without signing up: add them to the shift and mark them present.
create or replace function add_walk_in(p_slot_id uuid, p_name text, p_email text, p_phone text default null, p_area text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s booking_slots;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  select * into s from booking_slots where id = p_slot_id;
  if not found then raise exception 'No such shift'; end if;
  if not vc_can(s.org_id) then raise exception 'Not allowed'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Add their name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add their email — it’s how their hours are counted and how they’re thanked';
  end if;
  insert into bookings (org_id, slot_id, type_id, name, email, phone, party_size, answer, status, source, checked_in_at, confirmed_by)
  values (s.org_id, s.id, s.type_id, btrim(p_name), v_email, nullif(btrim(coalesce(p_phone, '')), ''), 1,
          nullif(btrim(coalesce(p_area, '')), ''), 'checked_in', 'walk-in', now(), auth.uid())
  returning id into v_id;
  insert into volunteers (org_id, name, email, phone, status, roles, started_on, notes)
  values (s.org_id, btrim(p_name), v_email, nullif(btrim(coalesce(p_phone, '')), ''), 'active', array['events'],
          (now() at time zone 'America/New_York')::date, 'Walked in to help')
  on conflict (org_id, lower(email)) where email is not null do nothing;
  return v_id;
end $$;
grant execute on function add_walk_in(uuid, text, text, text, text) to authenticated;

-- Present, didn't come, or back to "signed up" — the same statuses the shift
-- roster uses, allowed to whoever runs the call on the day.
create or replace function mark_call_attendance(p_booking uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking;
  if not found then raise exception 'No such sign-up'; end if;
  if not vc_can(b.org_id) then raise exception 'Not allowed'; end if;
  if p_status not in ('confirmed', 'checked_in', 'no_show') then raise exception 'Bad status'; end if;
  update bookings set
    status = p_status,
    checked_in_at = case when p_status = 'checked_in' then now() else null end
  where id = p_booking;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (b.org_id, auth.uid(), 'booking.' || p_status, 'booking', p_booking::text, jsonb_build_object('name', b.name));
end $$;
grant execute on function mark_call_attendance(uuid, text) to authenticated;

-- The day's list, shift by shift.
create or replace function call_roster(p_call uuid)
returns table (slot_id uuid, starts_at timestamptz, ends_at timestamptz, capacity int,
               booking_id uuid, name text, email text, phone text, area text, status text,
               source text, thanked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.starts_at, s.ends_at, s.capacity,
         b.id, b.name, b.email, b.phone, b.answer, b.status, b.source, b.thanked_at
    from volunteer_calls c
    join booking_slots s on s.type_id = c.type_id
    left join bookings b on b.slot_id = s.id and b.status <> 'cancelled'
   where c.id = p_call and vc_can(c.org_id)
   order by s.starts_at, b.created_at;
$$;
grant execute on function call_roster(uuid) to authenticated;

-- Everyone who came: their hours here, this year and in all, for the
-- thank-you. Their private hours link goes to them, never to anyone else.
create or replace function call_thanks(p_call uuid)
returns table (email text, name text, phone text, shifts int, hours_here numeric,
               hours_year numeric, hours_all numeric, hours_token uuid, thanked_at timestamptz)
language sql stable security definer set search_path = public as $$
  with c as (select * from volunteer_calls where id = p_call),
  came as (
    select lower(b.email) as email, max(b.name) as name, max(b.phone) as phone, count(*)::int as shifts,
           sum(round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 2) * b.party_size) as hours,
           max(b.thanked_at) as thanked_at
      from c
      join booking_slots s on s.type_id = c.type_id
      join bookings b on b.slot_id = s.id and b.status = 'checked_in'
     group by lower(b.email)
  )
  select came.email, came.name, came.phone, came.shifts, came.hours,
         coalesce((select sum(h.hours) from c, volunteer_history(c.org_id, came.email,
                     make_date(extract(year from c.on_date)::int, 1, 1),
                     make_date(extract(year from c.on_date)::int, 12, 31)) h), came.hours),
         coalesce((select sum(h.hours) from c, volunteer_history(c.org_id, came.email, date '2000-01-01', date '2100-12-31') h), came.hours),
         (select v.access_token from c, volunteers v where v.org_id = c.org_id and lower(v.email) = came.email),
         came.thanked_at
    from came, c
   where vc_can(c.org_id)
   order by came.name;
$$;
grant execute on function call_thanks(uuid) to authenticated;

create or replace function mark_thanked(p_call uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c volunteer_calls;
begin
  select * into c from volunteer_calls where id = p_call;
  if not found or not vc_can(c.org_id) then raise exception 'Not allowed'; end if;
  update bookings b set thanked_at = now()
    from booking_slots s
   where b.slot_id = s.id and s.type_id = c.type_id and lower(b.email) = lower(p_email) and b.status = 'checked_in';
end $$;
grant execute on function mark_thanked(uuid, text) to authenticated;

-- Which post, letter or flyer brought people in.
create or replace function call_sources(p_call uuid)
returns table (source text, people int)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(b.source, ''), 'direct'), count(distinct lower(b.email))::int
    from volunteer_calls c
    join bookings b on b.type_id = c.type_id and b.status <> 'cancelled'
   where c.id = p_call and vc_can(c.org_id)
   group by 1
   order by 2 desc;
$$;
grant execute on function call_sources(uuid) to authenticated;
