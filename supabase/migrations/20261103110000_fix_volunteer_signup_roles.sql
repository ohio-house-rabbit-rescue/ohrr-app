-- =============================================================
-- Update 51 (2026-11-03): fix "malformed array literal: "events"" when someone
-- who is ALREADY on the volunteer roster signs up for a volunteer call.
--
-- Cause: `roles || 'events'` — with a text[] on the left, Postgres reads the bare
-- 'events' as an array literal and fails. A first-time sign-up never reached that
-- line (it inserts array['events']), so only returning volunteers were blocked.
-- Fix: array_append(roles, 'events'). Nothing else in the function changes.
-- Idempotent (create or replace).
-- =============================================================

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
      roles          = case when 'events' = any (roles) then roles else array_append(roles, 'events') end,
      status         = case when status in ('prospect', 'former') then 'active' else status end,
      hours_for      = coalesce(v_for, hours_for),
      letter_details = letter_details || coalesce(p_details, '{}'::jsonb)
    where id = v_vol.id;
  end if;
  if v_new then v_token := v_vol.access_token; end if;

  return jsonb_build_object('shifts', v_out, 'new_volunteer', v_new, 'hours_token', v_token);
end $$;
