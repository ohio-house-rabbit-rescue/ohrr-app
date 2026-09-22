-- =============================================================
-- OHRR — Bookings: a standing weekly schedule per bookable thing
--
-- Before this, every time had to be made by hand in Staff → Bookings → Make
-- times, so "Find a time" showed nothing until someone remembered. Now each
-- booking type carries its WEEKLY schedule — "Saturdays 1:30–2:30 and
-- 2:30–3:30, 4 people; Sundays 1:30–2:30" — and the database keeps the next
-- `auto_weeks` weeks of times filled in by itself:
--
--   booking_types.weekly     jsonb array of rules
--                            [{"days":[6],"start":"13:30","end":"14:30",
--                              "capacity":4,"label":"..."}]   (0 = Sunday)
--   booking_types.auto_weeks how many weeks ahead to keep filled (default 8)
--   booking_slots.auto       true for times made from the schedule
--
--   fill_booking_slots(type, force)  makes the missing times. It runs at most
--                            once a day per type from booking_slots_open (the
--                            public "Find a time" read), and immediately when
--                            staff save the schedule (force = true), which also
--                            removes future auto-made times that no longer
--                            match a rule and have nobody booked on them.
--
-- Seeds OHRR's real schedules, copied from the SignUp.com sheets the live
-- site links to (read 2026-09-22): Bunny Socialization Sat 1:30–2:30 and
-- 2:30–3:30, Sun 1:30–2:30, 4 people each; Buncare Mon–Fri 9–10 breakfast
-- (2 people), Mon–Thu 4–6 pm, Tue–Thu 5:30–7:30 pm, Fri 11–1 and 2–4, Sat/Sun
-- 10–12 and 3–5. The evening/weekend Buncare shifts have no cap on SignUp.com;
-- here they get 6 (change it in Staff → Bookings → Set up). Adoption visits
-- and bonding sessions use the published Sat/Sun noon–4 hours.
--
-- Paste + Run in the Supabase SQL editor AFTER 20260921110000_bookings.sql.
-- Idempotent; never overwrites a schedule staff have already set.
-- =============================================================

alter table booking_types add column if not exists weekly jsonb not null default '[]'::jsonb;
alter table booking_types add column if not exists auto_weeks int not null default 8;
alter table booking_types drop constraint if exists booking_types_auto_weeks_check;
alter table booking_types add constraint booking_types_auto_weeks_check check (auto_weeks between 1 and 26);
alter table booking_types add column if not exists slots_filled_on date;
alter table booking_slots add column if not exists auto boolean not null default false;

-- -------------------------------------------------------------
-- Make the next auto_weeks weeks of times from the weekly rules.
-- -------------------------------------------------------------
create or replace function fill_booking_slots(p_type_id uuid, p_force boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare
  t       booking_types;
  r       jsonb;
  d       date;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_to    date;
  v_days  int[];
  v_cap   int;
  v_start timestamptz;
  v_end   timestamptz;
  v_keep  timestamptz[] := '{}';
  n       int := 0;
begin
  select * into t from booking_types where id = p_type_id;
  if not found then return 0; end if;
  if p_force and not has_permission(t.org_id, 'bookings.manage') then raise exception 'Not allowed'; end if;
  if not p_force and t.slots_filled_on is not distinct from v_today then return 0; end if;

  v_to := v_today + t.auto_weeks * 7;
  if jsonb_typeof(t.weekly) = 'array' then
    for r in select * from jsonb_array_elements(t.weekly) loop
      begin
        select array_agg(e.value::int) into v_days from jsonb_array_elements_text(r->'days') as e(value);
        if v_days is null or nullif(r->>'start', '') is null or nullif(r->>'end', '') is null then continue; end if;
        v_cap := greatest(0, least(200, coalesce(nullif(r->>'capacity', '')::int, t.capacity)));
        d := v_today;
        while d <= v_to loop
          if extract(dow from d)::int = any (v_days) then
            v_start := (d + (r->>'start')::time) at time zone 'America/New_York';
            v_end   := (d + (r->>'end')::time)   at time zone 'America/New_York';
            if v_end > v_start then
              v_keep := v_keep || v_start;
              if v_start > now() then
                insert into booking_slots (org_id, type_id, starts_at, ends_at, capacity, note, auto)
                values (t.org_id, t.id, v_start, v_end, v_cap, nullif(r->>'label', ''), true)
                on conflict (type_id, starts_at) do nothing;
                if found then n := n + 1; end if;
              end if;
            end if;
          end if;
          d := d + 1;
        end loop;
      exception when others then
        null; -- one malformed rule never blocks the others
      end;
    end loop;
  end if;

  -- Staff changed the schedule: drop future auto-made times that no rule makes
  -- any more, unless someone is booked on them.
  if p_force then
    delete from booking_slots s
     where s.type_id = t.id and s.auto and s.starts_at > now()
       and not (s.starts_at = any (v_keep))
       and not exists (select 1 from bookings b where b.slot_id = s.id and b.status in ('requested', 'confirmed', 'checked_in'));
  end if;

  update booking_types set slots_filled_on = v_today where id = t.id;
  return n;
end $$;
grant execute on function fill_booking_slots(uuid, boolean) to authenticated;

-- The public read now tops the schedule up first (once a day per type).
create or replace function booking_slots_open(p_slug text, p_from timestamptz default now(), p_to timestamptz default now() + interval '60 days')
returns table (
  slot_id uuid, starts_at timestamptz, ends_at timestamptz, capacity int, taken int, note text
) language plpgsql security definer set search_path = public as $$
declare
  v_type booking_types;
begin
  select * into v_type from booking_types t where t.slug = p_slug and t.is_published limit 1;
  if not found then return; end if;
  perform fill_booking_slots(v_type.id, false);
  return query
  select s.id, s.starts_at, s.ends_at, s.capacity,
         coalesce((select sum(b.party_size)::int from bookings b
                    where b.slot_id = s.id and b.status in ('requested', 'confirmed', 'checked_in')), 0) as taken,
         s.note
    from booking_slots s
   where s.type_id = v_type.id and s.is_open
     and s.starts_at >= greatest(p_from, now() + make_interval(hours => v_type.min_lead_hours))
     and s.starts_at <= p_to
   order by s.starts_at;
end $$;
grant execute on function booking_slots_open(text, timestamptz, timestamptz) to anon, authenticated;

-- -------------------------------------------------------------
-- Seed OHRR's real weekly schedules (only where none is set yet)
-- -------------------------------------------------------------
do $$
declare
  v_org uuid;
  t record;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;

  update booking_types set weekly = '[
    {"days":[6],"start":"13:30","end":"14:30","capacity":4},
    {"days":[6],"start":"14:30","end":"15:30","capacity":4},
    {"days":[0],"start":"13:30","end":"14:30","capacity":4}
  ]'::jsonb
   where org_id = v_org and slug = 'bunny-socialization' and weekly = '[]'::jsonb;

  update booking_types set weekly = '[
    {"days":[1,2,3,4,5],"start":"09:00","end":"10:00","capacity":2,"label":"Breakfast shift — pellets and fresh water"},
    {"days":[1,2,3,4],"start":"16:00","end":"18:00","capacity":6,"label":"Center help — dinner, pens and litter boxes"},
    {"days":[2,3,4],"start":"17:30","end":"19:30","capacity":6,"label":"Center help — dinner, pens and litter boxes"},
    {"days":[5],"start":"11:00","end":"13:00","capacity":6,"label":"Buncare"},
    {"days":[5],"start":"14:00","end":"16:00","capacity":6,"label":"Buncare"},
    {"days":[0,6],"start":"10:00","end":"12:00","capacity":6,"label":"Center help — morning"},
    {"days":[0,6],"start":"15:00","end":"17:00","capacity":6,"label":"Buncare"}
  ]'::jsonb
   where org_id = v_org and slug = 'buncare-shift' and weekly = '[]'::jsonb;

  update booking_types set weekly = '[
    {"days":[0,6],"start":"12:00","end":"14:00","capacity":1},
    {"days":[0,6],"start":"14:00","end":"16:00","capacity":1}
  ]'::jsonb
   where org_id = v_org and slug = 'adoption-visit' and weekly = '[]'::jsonb;

  update booking_types set weekly = '[
    {"days":[0,6],"start":"12:00","end":"13:00","capacity":1},
    {"days":[0,6],"start":"13:00","end":"14:00","capacity":1},
    {"days":[0,6],"start":"14:00","end":"15:00","capacity":1},
    {"days":[0,6],"start":"15:00","end":"16:00","capacity":1}
  ]'::jsonb
   where org_id = v_org and slug = 'bonding-session' and weekly = '[]'::jsonb;

  -- Fill the next weeks right now so "Find a time" has times the moment this runs.
  for t in select id from booking_types where org_id = v_org and is_published loop
    update booking_types set slots_filled_on = null where id = t.id;
    perform fill_booking_slots(t.id, false);
  end loop;
end $$;
