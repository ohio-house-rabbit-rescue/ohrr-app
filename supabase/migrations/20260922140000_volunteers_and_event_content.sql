-- =============================================================
-- OHRR — Volunteers, and event content that isn't written in code
--
-- 1. VOLUNTEERS. Until now a volunteer was just an email address typed into a
--    booking, and hours were a staff-only list keyed to that address. Now:
--      volunteers              one row per person — contact, status, what
--                              they're cleared for, orientation done, notes.
--      volunteers.access_token the private link (and QR) that lets that person
--                              see and log their own hours in the app without
--                              an account. Staff hand it over; the phone keeps it.
--      volunteer_hours_entries + volunteer_id, status (logged|confirmed),
--                              source (self|staff|checkin), note. A volunteer
--                              logs their own; staff confirm or correct; a
--                              service letter counts the confirmed ones.
--      my_volunteer_summary()  totals by day / week / month / year for that
--                              person's own record.
--
-- 2. VOLUNTEER OPPORTUNITIES can be limited by PEOPLE or by HOURS (or not at
--    all), so "we need 6 people" and "we need 30 hours covered" are both
--    sayable, and the public page shows what is left.
--
-- 3. EVENTS take a picture and an end date: once it has passed, the event moves
--    itself to "Past events" — nobody has to remember.
--
-- 4. SPONSORS already end on term_end; they gain `remind_days` so staff are
--    warned before a sponsorship lapses instead of discovering it later.
--
-- 5. TEAM PHOTOS: memberships.photo_url (optional — the app draws a bunny
--    instead) and a display name/title for the team list.
--
-- 6. INVITES carry who they were meant for (email / phone / the position asked
--    for) so an invite can be re-sent, and so a QR code can be handed over in
--    person.
--
-- 7. EVENT CONTENT OUT OF CODE: `event_features` (the "at the festival" cards)
--    and `events.info` (admission, parking, links, hotel, extra notes) per
--    event and year, so next year is typed in, not coded.
--
-- Paste + Run in the Supabase SQL editor AFTER 20260922130000_tails_uploads_profile.sql.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. The volunteer roster
-- -------------------------------------------------------------
create table if not exists volunteers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  status        text not null default 'active'
                  check (status in ('prospect', 'active', 'paused', 'former')),
  roles         text[] not null default '{}',     -- 'socialization', 'buncare', 'vet-transport', 'events', …
  started_on    date,
  orientation_on date,                            -- Buncare orientation, when done
  notes         text,
  photo_url     text,
  /** The private link (and QR) that lets this person see and log their own hours. */
  access_token  uuid not null default gen_random_uuid(),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists idx_volunteers_token on volunteers(access_token);
create unique index if not exists idx_volunteers_email on volunteers(org_id, lower(email)) where email is not null;
create index if not exists idx_volunteers_org on volunteers(org_id, status, name);
drop trigger if exists trg_volunteers_updated on volunteers;
create trigger trg_volunteers_updated before update on volunteers
  for each row execute function set_updated_at();

alter table volunteers enable row level security;
drop policy if exists volunteers_staff_all on volunteers;
create policy volunteers_staff_all on volunteers for all
  using (has_permission(org_id, 'bookings.manage') or has_permission(org_id, 'volunteers.shifts.manage'))
  with check (has_permission(org_id, 'bookings.manage') or has_permission(org_id, 'volunteers.shifts.manage'));
grant select, insert, update, delete on volunteers to authenticated;

-- Hours: whose they are, who said so, and whether staff have confirmed them.
alter table volunteer_hours_entries add column if not exists volunteer_id uuid references volunteers(id) on delete set null;
alter table volunteer_hours_entries add column if not exists status text not null default 'confirmed'
  check (status in ('logged', 'confirmed'));
alter table volunteer_hours_entries add column if not exists source text not null default 'staff'
  check (source in ('self', 'staff', 'checkin'));
alter table volunteer_hours_entries add column if not exists note text;
create index if not exists idx_vh_volunteer on volunteer_hours_entries(volunteer_id, on_date desc);

-- Match existing hours rows to the roster by email as volunteers are added.
create or replace function link_volunteer_hours(p_volunteer uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v volunteers;
  n int;
begin
  select * into v from volunteers where id = p_volunteer;
  if not found then return 0; end if;
  if not (has_permission(v.org_id, 'bookings.manage') or has_permission(v.org_id, 'volunteers.shifts.manage')) then
    raise exception 'Not allowed';
  end if;
  if v.email is null then return 0; end if;
  update volunteer_hours_entries
     set volunteer_id = v.id
   where org_id = v.org_id and volunteer_id is null and lower(email) = lower(v.email);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function link_volunteer_hours(uuid) to authenticated;

-- -------------------------------------------------------------
-- A volunteer's own record, by their private token. No account needed:
-- knowing the token is the permission, the same way a booking's cancel link
-- works. Never exposes anyone else's rows.
-- -------------------------------------------------------------
create or replace function my_volunteer_record(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v volunteers;
begin
  select * into v from volunteers where access_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'email', v.email,
    'status', v.status,
    'roles', to_jsonb(v.roles),
    'started_on', v.started_on,
    'orientation_on', v.orientation_on,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'on_date', e.on_date, 'hours', e.hours,
               'activity', e.activity, 'status', e.status, 'source', e.source, 'note', e.note)
             order by e.on_date desc)
        from volunteer_hours_entries e where e.volunteer_id = v.id), '[]'::jsonb),
    'totals', jsonb_build_object(
      'all',        coalesce((select sum(hours) from volunteer_hours_entries e where e.volunteer_id = v.id), 0),
      'confirmed',  coalesce((select sum(hours) from volunteer_hours_entries e where e.volunteer_id = v.id and e.status = 'confirmed'), 0),
      'this_year',  coalesce((select sum(hours) from volunteer_hours_entries e where e.volunteer_id = v.id
                               and date_part('year', e.on_date) = date_part('year', current_date)), 0),
      'this_month', coalesce((select sum(hours) from volunteer_hours_entries e where e.volunteer_id = v.id
                               and date_trunc('month', e.on_date) = date_trunc('month', current_date)), 0),
      'this_week',  coalesce((select sum(hours) from volunteer_hours_entries e where e.volunteer_id = v.id
                               and date_trunc('week', e.on_date) = date_trunc('week', current_date)), 0),
      'today',      coalesce((select sum(hours) from volunteer_hours_entries e where e.volunteer_id = v.id
                               and e.on_date = current_date), 0)
    ),
    'by_year', coalesce((
      select jsonb_agg(jsonb_build_object('year', y.year, 'hours', y.hours) order by y.year desc)
        from (select date_part('year', e.on_date)::int as year, sum(e.hours) as hours
                from volunteer_hours_entries e where e.volunteer_id = v.id
               group by 1) y), '[]'::jsonb)
  );
end $$;
grant execute on function my_volunteer_record(uuid) to anon, authenticated;

-- A volunteer logs their own hours. Sane limits, and it lands as 'logged' so
-- staff can confirm or correct it (a service letter counts confirmed hours).
create or replace function log_my_hours(
  p_token uuid, p_on_date date, p_hours numeric, p_activity text, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v volunteers;
  v_id uuid;
begin
  select * into v from volunteers where access_token = p_token;
  if not found then raise exception 'That link isn’t valid any more — ask OHRR for a new one.'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 24 then raise exception 'Hours must be between 0 and 24.'; end if;
  if p_on_date is null or p_on_date > current_date then raise exception 'Pick a day that has happened.'; end if;
  if p_on_date < current_date - 400 then raise exception 'That’s more than a year ago — ask OHRR to add it.'; end if;
  if nullif(btrim(coalesce(p_activity, '')), '') is null then raise exception 'Say what you did.'; end if;
  -- One person can't log more than 24 hours on a day, however many entries.
  if coalesce((select sum(hours) from volunteer_hours_entries
                where volunteer_id = v.id and on_date = p_on_date), 0) + p_hours > 24 then
    raise exception 'That would be more than 24 hours on one day.';
  end if;

  insert into volunteer_hours_entries (org_id, email, name, on_date, hours, activity, volunteer_id, status, source, note)
  values (v.org_id, coalesce(v.email, ''), v.name, p_on_date, round(p_hours, 2), btrim(p_activity),
          v.id, 'logged', 'self', nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function log_my_hours(uuid, date, numeric, text, text) to anon, authenticated;

-- A volunteer can take back something they logged themselves, while it is still
-- unconfirmed. Staff-entered and confirmed hours are not theirs to remove.
create or replace function delete_my_hours(p_token uuid, p_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v volunteers;
begin
  select * into v from volunteers where access_token = p_token;
  if not found then raise exception 'That link isn’t valid any more.'; end if;
  delete from volunteer_hours_entries
   where id = p_entry and volunteer_id = v.id and source = 'self' and status = 'logged';
  if not found then raise exception 'That entry can’t be removed — ask OHRR.'; end if;
end $$;
grant execute on function delete_my_hours(uuid, uuid) to anon, authenticated;

-- Staff: confirm (or un-confirm) what a volunteer logged.
create or replace function set_hours_status(p_entry uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  e volunteer_hours_entries;
begin
  select * into e from volunteer_hours_entries where id = p_entry;
  if not found then raise exception 'No such entry'; end if;
  if not has_permission(e.org_id, 'bookings.manage') then raise exception 'Not allowed'; end if;
  if p_status not in ('logged', 'confirmed') then raise exception 'Unknown status'; end if;
  update volunteer_hours_entries set status = p_status where id = e.id;
end $$;
grant execute on function set_hours_status(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 2. Opportunities limited by people or by hours
-- -------------------------------------------------------------
alter table volunteer_opportunities add column if not exists limit_kind text not null default 'none'
  check (limit_kind in ('none', 'people', 'hours'));
alter table volunteer_opportunities add column if not exists limit_people int
  check (limit_people is null or limit_people between 1 and 500);
alter table volunteer_opportunities add column if not exists limit_hours numeric(6,2)
  check (limit_hours is null or (limit_hours > 0 and limit_hours <= 5000));
alter table volunteer_opportunities add column if not exists filled_people int not null default 0
  check (filled_people >= 0);
alter table volunteer_opportunities add column if not exists filled_hours numeric(6,2) not null default 0
  check (filled_hours >= 0);
alter table volunteer_opportunities add column if not exists contact_email text;

-- -------------------------------------------------------------
-- 3. Events: a picture, and an end that moves them to "past"
-- -------------------------------------------------------------
alter table events add column if not exists image_url text;
-- `ends_at` already exists; anything with no end is treated as ending the day
-- it starts. This view is what the public "upcoming / past" split reads.
create or replace function event_is_past(p_starts timestamptz, p_ends timestamptz)
returns boolean language sql immutable as $$
  select coalesce(p_ends, p_starts + interval '1 day') < now();
$$;

-- -------------------------------------------------------------
-- 4. Sponsors: warn before a term ends
-- -------------------------------------------------------------
alter table sponsors add column if not exists remind_days int not null default 21
  check (remind_days between 0 and 180);

-- Staff: sponsorships ending within their reminder window (or already ended).
create or replace function sponsors_expiring(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'events.bunfest.manage')
    then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'tier', s.tier, 'term_end', s.term_end,
               'days_left', (s.term_end - current_date), 'is_active', s.is_active)
             order by s.term_end)
        from sponsors s
       where s.org_id = p_org and s.term_end is not null
         and s.term_end <= current_date + s.remind_days), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
grant execute on function sponsors_expiring(uuid) to authenticated;

-- -------------------------------------------------------------
-- 5. Team photos and titles
-- -------------------------------------------------------------
alter table memberships add column if not exists photo_url text;
alter table memberships add column if not exists display_name text;
alter table memberships add column if not exists title text;          -- "Adoption Coordinator"
alter table memberships add column if not exists show_on_about boolean not null default false;

-- A member may always set their own photo/name/title; staff.permissions.manage
-- may set anyone's.
create or replace function save_member_profile(
  p_membership uuid, p_display_name text default null, p_title text default null,
  p_photo_url text default null, p_show_on_about boolean default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  m memberships;
begin
  select * into m from memberships where id = p_membership;
  if not found then raise exception 'No such member'; end if;
  if m.user_id <> auth.uid() and not has_permission(m.org_id, 'staff.permissions.manage') then
    raise exception 'Not allowed';
  end if;
  update memberships set
    display_name  = coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), display_name),
    title         = case when p_title is null then title else nullif(btrim(p_title), '') end,
    photo_url     = case when p_photo_url is null then photo_url else nullif(btrim(p_photo_url), '') end,
    show_on_about = coalesce(p_show_on_about, show_on_about)
  where id = m.id;
end $$;
grant execute on function save_member_profile(uuid, text, text, text, boolean) to authenticated;

-- -------------------------------------------------------------
-- 6. Invites remember who they were for
-- -------------------------------------------------------------
alter table invite_codes add column if not exists invitee_name  text;
alter table invite_codes add column if not exists invitee_email text;
alter table invite_codes add column if not exists invitee_phone text;
alter table invite_codes add column if not exists position_note text;   -- "Hop Shop Saturday"
alter table invite_codes add column if not exists note text;

-- -------------------------------------------------------------
-- 7. Event content, per year, out of the code
-- -------------------------------------------------------------
-- The "at the festival" cards on the BunFest home screen.
create table if not exists event_features (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  event_slug   text not null default 'midwest-bunfest',
  year         int  not null default extract(year from now())::int,
  title        text not null,
  blurb        text,
  icon         text,                     -- an icon name from the app's set
  link_url     text,                     -- in-app path or external link
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_event_features on event_features(org_id, event_slug, year, sort_order);
drop trigger if exists trg_event_features_updated on event_features;
create trigger trg_event_features_updated before update on event_features
  for each row execute function set_updated_at();

alter table event_features enable row level security;
drop policy if exists event_features_public_select on event_features;
create policy event_features_public_select on event_features for select using (is_published);
drop policy if exists event_features_staff_all on event_features;
create policy event_features_staff_all on event_features for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select on event_features to anon, authenticated;
grant insert, update, delete on event_features to authenticated;

-- Admission, parking, links, hotel, the theme's story — the facts that change
-- every year and used to live in the app's code.
alter table events add column if not exists info jsonb not null default '{}'::jsonb;

-- Seed this year's from the published Midwest BunFest 2026 site, so the first
-- staff edit is a change rather than a blank form.
do $$
declare
  v_org uuid;
  v_event uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;
  select id into v_event from events where org_id = v_org and slug like '%bunfest%' order by starts_at desc limit 1;

  if v_event is not null then
    update events set info = jsonb_build_object(
      'admission', jsonb_build_array(
        jsonb_build_object('who', 'Adults', 'price', '$10.00'),
        jsonb_build_object('who', 'Ages 5–12', 'price', '$5.00'),
        jsonb_build_object('who', 'Under 5', 'price', 'Free')),
      'admission_note', 'Cash or card. Buy at the door or in advance.',
      'parking', 'Ample free parking in The Makoy lot.',
      'rabbit_rule', 'Any rabbit attending must be vaccinated against RHDV2, with proof of vaccination or an annual booster from an authorized vet.',
      'tickets_url', 'https://www.midwestbunfest.org/purchase-tickets.html',
      'hotel_url', 'https://www.midwestbunfest.org/hotel-information.html',
      'volunteer_url', 'https://www.midwestbunfest.org/volunteer.html',
      'merch_url', 'https://www.bonfire.com/store/midwest-bunfest/',
      'logo_credit', 'Logo design by Jillian Lisska'
    ) where id = v_event and info = '{}'::jsonb;
  end if;

  insert into event_features (org_id, event_slug, year, title, blurb, icon, sort_order)
  select v_org, 'midwest-bunfest', 2026, f.title, f.blurb, f.icon, f.sort
    from (values
      ('Education sessions', 'Talks from vets and rabbit experts all day.', 'book', 10),
      ('Bunny Spa', 'Nail trims and grooming for your rabbit.', 'sparkles', 20),
      ('Glamour Shots', 'Professional photos of your bun.', 'camera', 30),
      ('Raffle & Silent Auction', 'Bid and win — proceeds help rabbits.', 'ticket', 40),
      ('Toymaking workshop', 'Make an enrichment toy to take home.', 'gift', 50),
      ('Chillaxabun Lounge', 'A quiet room with hay, water and a hidey house where your bunny can relax.', 'heart', 60),
      ('OHRR Hop Shop', 'Food, supplies and toys — the shop comes to BunFest.', 'bag', 70),
      ('Rescue Partners & Vendors', 'Rabbit rescues and specialty shopping from across the region.', 'users', 80)
    ) as f(title, blurb, icon, sort)
   where not exists (select 1 from event_features where org_id = v_org and year = 2026);
end $$;

-- -------------------------------------------------------------
-- An invite that remembers who it was for
--
-- The invite panel generated a bare code and forgot it instantly, so nobody
-- could tell who a pending invite belonged to or re-send it. Staff now record
-- the person's name and how to reach them, and the QR code on screen carries
-- the code straight into the join screen.
-- -------------------------------------------------------------
create or replace function set_invite_details(
  p_code text, p_name text default null, p_email text default null,
  p_phone text default null, p_position text default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  c invite_codes;
begin
  select * into c from invite_codes where code = p_code;
  if not found then raise exception 'No such invite'; end if;
  if not has_permission(c.org_id, 'staff.invite') then raise exception 'Not allowed'; end if;
  update invite_codes set
    invitee_name  = nullif(btrim(coalesce(p_name, '')), ''),
    invitee_email = lower(nullif(btrim(coalesce(p_email, '')), '')),
    invitee_phone = nullif(btrim(coalesce(p_phone, '')), ''),
    position_note = nullif(btrim(coalesce(p_position, '')), ''),
    note          = nullif(btrim(coalesce(p_note, '')), '')
  where code = p_code;
end $$;
grant execute on function set_invite_details(text, text, text, text, text, text) to authenticated;

-- Staff: invites that haven't been used yet, so one can be re-sent or revoked.
create or replace function open_invites(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'staff.invite')
    then coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', i.code, 'role', i.role, 'preset', i.preset,
               'invitee_name', i.invitee_name, 'invitee_email', i.invitee_email,
               'invitee_phone', i.invitee_phone, 'position_note', i.position_note,
               'expires_at', i.expires_at, 'created_at', i.created_at)
             order by i.created_at desc)
        from invite_codes i
       where i.org_id = p_org and i.kind = 'worker'
         and i.used_count < i.max_uses
         and (i.expires_at is null or i.expires_at > now())), '[]'::jsonb)
    else '[]'::jsonb end;
$$;
grant execute on function open_invites(uuid) to authenticated;

create or replace function revoke_invite(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c invite_codes;
begin
  select * into c from invite_codes where code = p_code;
  if not found then return; end if;
  if not has_permission(c.org_id, 'staff.invite') then raise exception 'Not allowed'; end if;
  delete from invite_codes where code = p_code;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (c.org_id, auth.uid(), 'invite.revoked', 'invite', p_code,
          jsonb_build_object('invitee', c.invitee_name));
end $$;
grant execute on function revoke_invite(text) to authenticated;
