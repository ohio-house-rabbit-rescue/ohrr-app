-- =============================================================
-- Update 52 — BunFest bunny registration.
--
-- Owners register the rabbits they are bringing: owner name, email and phone;
-- per bunny the name, age, sex, breed or color, RHDV2 vaccine date and a photo
-- of the proof; the attendance agreement (with the date and time it was
-- agreed); and which activities they want (Spa, Glamour Shots, Lounge, other).
-- Each registration is tied to that year's BunFest event, so 2027 starts clean.
--
-- Public: register_bunfest() — open to anyone, only ever inserts, rate limited.
-- Staff (events.bunfest.manage): list, check the proof at the door, delete.
-- The tables have no policies at all: everything goes through the functions.
--
-- Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

create table if not exists bunfest_registrations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  event_id    uuid references events(id) on delete set null,
  owner_name  text not null,
  email       text not null,
  phone       text,
  activities  text[] not null default '{}',
  note        text,
  agreed_at   timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bunfest_reg_event on bunfest_registrations(org_id, event_id, created_at desc);
create index if not exists idx_bunfest_reg_email on bunfest_registrations(org_id, email, created_at desc);

create table if not exists bunfest_bunnies (
  id                 uuid primary key default gen_random_uuid(),
  registration_id    uuid not null references bunfest_registrations(id) on delete cascade,
  org_id             uuid not null references organizations(id) on delete cascade,
  name               text not null,
  age                text,
  sex                text not null default 'unknown' check (sex in ('female', 'male', 'unknown')),
  breed_color        text,
  rhdv2_date         date,
  proof_url          text,
  proof_checked_at   timestamptz,
  proof_checked_by   uuid references auth.users(id),
  created_at         timestamptz not null default now()
);
create index if not exists idx_bunfest_bunnies_reg on bunfest_bunnies(registration_id);

alter table bunfest_registrations enable row level security;
alter table bunfest_bunnies enable row level security;

-- -------------------------------------------------------------
-- Public entry point.
-- -------------------------------------------------------------
create or replace function register_bunfest(
  p_name text, p_email text, p_phone text,
  p_activities text[], p_bunnies jsonb, p_note text, p_agreed boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org     uuid;
  v_event   uuid;
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_name    text := btrim(coalesce(p_name, ''));
  v_acts    text[] := '{}';
  v_act     text;
  v_reg     uuid;
  v_b       jsonb;
  v_n       int := 0;
  v_bname   text;
  v_sex     text;
  v_date    date;
  v_proof   text;
begin
  if v_name = '' or length(v_name) > 120 then raise exception 'Please enter your name.'; end if;
  if position('@' in v_email) < 2 or length(v_email) > 200 then raise exception 'Please enter an email address we can reach you at.'; end if;
  if coalesce(p_agreed, false) is not true then raise exception 'Please agree to the Rabbit Attendance Agreement.'; end if;
  if p_bunnies is null or jsonb_typeof(p_bunnies) <> 'array' or jsonb_array_length(p_bunnies) < 1 then
    raise exception 'Add at least one bunny.';
  end if;
  if jsonb_array_length(p_bunnies) > 10 then raise exception 'That is more than 10 bunnies — please email us instead.'; end if;
  if pg_column_size(p_bunnies) > 20000 then raise exception 'That is too much text for one registration.'; end if;

  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if v_org is null then raise exception 'No organization to deliver to'; end if;

  if (select count(*) from bunfest_registrations
       where org_id = v_org and email = v_email and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Too many registrations from this address — please try again later.';
  end if;

  -- Only the activities the form offers, once each.
  foreach v_act in array coalesce(p_activities, '{}') loop
    if v_act in ('spa', 'glamour', 'lounge', 'other') and not (v_act = any (v_acts)) then
      v_acts := array_append(v_acts, v_act);
    end if;
  end loop;

  -- The year's BunFest: the next one that has not ended, else the latest.
  select id into v_event from events
   where org_id = v_org and is_published and slug like 'midwest-bunfest-%'
     and coalesce(ends_at, starts_at) >= now()
   order by starts_at limit 1;
  if v_event is null then
    select id into v_event from events
     where org_id = v_org and is_published and slug like 'midwest-bunfest-%'
     order by starts_at desc limit 1;
  end if;

  insert into bunfest_registrations (org_id, event_id, owner_name, email, phone, activities, note, agreed_at)
  values (v_org, v_event, left(v_name, 120), v_email, left(nullif(btrim(coalesce(p_phone, '')), ''), 40),
          v_acts, left(nullif(btrim(coalesce(p_note, '')), ''), 1000), now())
  returning id into v_reg;

  for v_b in select * from jsonb_array_elements(p_bunnies) loop
    v_bname := btrim(coalesce(v_b ->> 'name', ''));
    if v_bname = '' then raise exception 'Every bunny needs a name.'; end if;
    v_sex := lower(btrim(coalesce(v_b ->> 'sex', '')));
    if v_sex not in ('female', 'male') then v_sex := 'unknown'; end if;
    begin
      v_date := nullif(btrim(coalesce(v_b ->> 'rhdv2_date', '')), '')::date;
    exception when others then
      raise exception 'The vaccine date for % was not a date.', v_bname;
    end;
    if v_date is null then raise exception 'Enter the RHDV2 vaccine date for %.', v_bname; end if;
    v_proof := nullif(btrim(coalesce(v_b ->> 'proof_url', '')), '');
    if v_proof is not null and (length(v_proof) > 600 or v_proof !~ '^https://') then v_proof := null; end if;

    insert into bunfest_bunnies (registration_id, org_id, name, age, sex, breed_color, rhdv2_date, proof_url)
    values (v_reg, v_org, left(v_bname, 80), left(nullif(btrim(coalesce(v_b ->> 'age', '')), ''), 40), v_sex,
            left(nullif(btrim(coalesce(v_b ->> 'breed_color', '')), ''), 120), v_date, v_proof);
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('id', v_reg, 'bunnies', v_n, 'event_id', v_event);
end $$;
grant execute on function register_bunfest(text, text, text, text[], jsonb, text, boolean) to anon, authenticated;

-- -------------------------------------------------------------
-- Staff: the list (every registration, newest first, bunnies inside).
-- -------------------------------------------------------------
create or replace function list_bunfest_registrations(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'event_id', r.event_id, 'event_title', e.title, 'event_starts_at', e.starts_at,
      'owner_name', r.owner_name, 'email', r.email, 'phone', r.phone,
      'activities', to_jsonb(r.activities), 'note', r.note, 'agreed_at', r.agreed_at, 'created_at', r.created_at,
      'bunnies', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', b.id, 'name', b.name, 'age', b.age, 'sex', b.sex, 'breed_color', b.breed_color,
          'rhdv2_date', b.rhdv2_date, 'proof_url', b.proof_url, 'proof_checked_at', b.proof_checked_at
        ) order by b.created_at, b.name)
        from bunfest_bunnies b where b.registration_id = r.id), '[]'::jsonb)
    ) order by r.created_at desc)
    from bunfest_registrations r
    left join events e on e.id = r.event_id
    where r.org_id = p_org
  ), '[]'::jsonb);
end $$;
grant execute on function list_bunfest_registrations(uuid) to authenticated;

-- Staff: "proof checked at the door" on or off for one bunny.
create or replace function set_bunny_proof_checked(p_id uuid, p_checked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from bunfest_bunnies where id = p_id;
  if v_org is null then raise exception 'That bunny is not registered.'; end if;
  if not has_permission(v_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  update bunfest_bunnies
     set proof_checked_at = case when p_checked then now() else null end,
         proof_checked_by = case when p_checked then auth.uid() else null end
   where id = p_id;
end $$;
grant execute on function set_bunny_proof_checked(uuid, boolean) to authenticated;

-- Staff: remove a whole registration (and its bunnies).
create or replace function delete_bunfest_registration(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from bunfest_registrations where id = p_id;
  if v_org is null then return; end if;
  if not has_permission(v_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  delete from bunfest_registrations where id = p_id;
end $$;
grant execute on function delete_bunfest_registration(uuid) to authenticated;
