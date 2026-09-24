-- =============================================================
-- OHRR — update 25: volunteers apply and are approved; their own page
-- shows what they're signed up for and hands them a signed hours letter
--
-- OHRR (2026-09-24): "we want to vet the new people that volunteer. so we need
-- a signup and approval process and then the volunteer can put in their email
-- address and that is validated as approved which allows them to sign up for a
-- time slot on the opportunities … staff can approve for all or just certain
-- types." And: "on the private link as a volunteer i need also the ability to
-- see what i am scheduled for along with the hours and … a generated PDF with
-- Bev's name signed on it … so the rescue does not have to perform this task."
--
-- Part 1  Applications and approvals on the volunteer roster:
--           approved_for  what a volunteer may sign up for — kinds such as
--                         'socialization', 'buncare', 'events' — or '*' for
--                         everything
--           review_status pending / approved / declined, with the answers
--                         they gave and who reviewed them
--         Everyone already on the roster as active stays able to sign up
--         (approved for everything) — only NEW people are vetted.
-- Part 2  Which sign-ups need approval: a shift type or a volunteer call
--         names the kind of volunteer it is for (approval_role); empty means
--         anyone. Bunny Socialization and Buncare shifts and volunteer calls
--         start as approved-only; appointments stay open to anyone.
-- Part 3  The database refuses a sign-up for an approved-only shift from an
--         email that isn't approved for it (staff adding someone are exempt).
-- Part 4  apply_to_volunteer(): the application form. It lands on the roster
--         as "waiting for approval" and in the staff Inbox.
-- Part 5  volunteer_check(): the sign-up page asks "is this email approved for
--         this?" and gets only yes / waiting / not yet — never anyone's details.
-- Part 6  my_volunteer_record(): the private page now also lists what they're
--         signed up for, counts shifts they were checked in to, and says what
--         they're approved for.
-- Part 7  Self-serve letters: issue_my_letter() works out the CONFIRMED hours
--         in the database (never what a phone sends), records the letter under
--         a code, and verify_volunteer_letter() lets a school or employer check
--         that code on the website.
-- Part 8  Certificates are OHRR's to give (OHRR: "the certificate of
--         appreciation should not be available to the user but to the admins").
--         OHRR's top tier (owners and admins, or anyone given "Make volunteer
--         certificates") is told when a certificate may be due: when a
--         volunteer makes a letter, and when their confirmed hours pass a mark
--         the top tier sets ("when they achieve so many hours which the top
--         will designate"). Part 8 comes before Part 7, which uses it.
--
-- Safe to run more than once. Paste + Run after update 24.
-- =============================================================

-- -------------------------------------------------------------
-- Part 1: applications and approvals
-- -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'volunteers' and column_name = 'approved_for') then
    alter table public.volunteers add column approved_for text[] not null default '{}';
    -- Only new people are vetted: everyone already active may keep signing up.
    update public.volunteers set approved_for = '{*}' where status = 'active';
  end if;
end $$;

alter table public.volunteers add column if not exists review_status text
  check (review_status is null or review_status in ('pending', 'approved', 'declined'));
alter table public.volunteers add column if not exists applied_at  timestamptz;
alter table public.volunteers add column if not exists application jsonb not null default '{}'::jsonb;
alter table public.volunteers add column if not exists reviewed_at timestamptz;
alter table public.volunteers add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
create index if not exists idx_volunteers_review on public.volunteers(org_id, review_status, applied_at);

-- -------------------------------------------------------------
-- Part 2: which sign-ups need approval
-- -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'booking_types' and column_name = 'approval_role') then
    alter table public.booking_types add column approval_role text;
    update public.booking_types set approval_role = 'socialization' where slug = 'bunny-socialization';
    update public.booking_types set approval_role = 'buncare' where slug = 'buncare-shift';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'volunteer_calls' and column_name = 'approval_role') then
    alter table public.volunteer_calls add column approval_role text default 'events';
  end if;
end $$;

-- A call's shifts are an ordinary shift type; keep that type's rule the same as the call's.
create or replace function sync_call_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type_id is not null then
    update booking_types set approval_role = new.approval_role where id = new.type_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_call_approval on public.volunteer_calls;
create trigger trg_call_approval after insert or update of approval_role, type_id on public.volunteer_calls
  for each row execute function sync_call_approval();
update public.booking_types t set approval_role = c.approval_role
  from public.volunteer_calls c where c.type_id = t.id and t.approval_role is distinct from c.approval_role;

-- -------------------------------------------------------------
-- Part 3: the database refuses an unapproved sign-up
-- -------------------------------------------------------------
create or replace function volunteer_approved(p_org uuid, p_email text, p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_role is null or exists (
    select 1 from volunteers v
     where v.org_id = p_org and lower(v.email) = lower(btrim(coalesce(p_email, '')))
       and v.status = 'active'
       and ('*' = any (v.approved_for) or p_role = any (v.approved_for)));
$$;
revoke execute on function volunteer_approved(uuid, text, text) from public, anon;

create or replace function bookings_require_approval() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  select approval_role into v_role from booking_types where id = new.type_id;
  if v_role is not null
     and not volunteer_approved(new.org_id, new.email, v_role)
     and not has_permission(new.org_id, 'bookings.manage') then
    raise exception 'This is for approved volunteers. Please use the email you applied with, or apply to volunteer first.';
  end if;
  return new;
end $$;
drop trigger if exists trg_bookings_require_approval on public.bookings;
create trigger trg_bookings_require_approval before insert on public.bookings
  for each row execute function bookings_require_approval();

-- -------------------------------------------------------------
-- Part 4: the application form
-- -------------------------------------------------------------
create or replace function apply_to_volunteer(
  p_name text, p_email text, p_phone text, p_kinds text[], p_answers jsonb,
  p_hours_for text default null, p_source text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid;
  v       volunteers;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_kinds text[] := coalesce(p_kinds, '{}');
  v_for   text := nullif(btrim(coalesce(p_hours_for, '')), '');
  v_app   jsonb;
begin
  if v_name = '' then raise exception 'Please add your name.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please check your email address.'; end if;
  if pg_column_size(coalesce(p_answers, '{}'::jsonb)) > 20000 then raise exception 'That is too much text for one application.'; end if;
  if v_for is not null and v_for not in ('school', 'military', 'workplace', 'community', 'other') then v_for := 'other'; end if;
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if (select count(*) from requests where org_id = v_org and email = v_email
        and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Too many requests from this address — please try again later.';
  end if;

  v_app := coalesce(p_answers, '{}'::jsonb) || jsonb_build_object('kinds', to_jsonb(v_kinds));
  select * into v from volunteers where org_id = v_org and lower(email) = v_email;
  if not found then
    insert into volunteers (org_id, name, email, phone, status, hours_for, notes,
                            review_status, applied_at, application)
    values (v_org, v_name, v_email, v_phone, 'prospect', v_for, 'Applied to volunteer',
            'pending', now(), v_app);
  else
    -- Someone already on the roster asking for more (or again): staff take another look.
    update volunteers set
      phone         = coalesce(v_phone, phone),
      hours_for     = coalesce(v_for, hours_for),
      review_status = 'pending',
      applied_at    = now(),
      application   = v_app,
      status        = case when status = 'former' then 'prospect' else status end
    where id = v.id;
  end if;

  insert into requests (org_id, kind, name, email, phone, subject, payload, source)
  values (v_org, 'volunteer-application', v_name, v_email, v_phone, 'Volunteer application', v_app,
          left(coalesce(p_source, ''), 20));
  return jsonb_build_object('state', 'received');
end $$;
grant execute on function apply_to_volunteer(text, text, text, text[], jsonb, text, text) to anon, authenticated;

-- -------------------------------------------------------------
-- Part 5: "is this email approved for this?"
-- -------------------------------------------------------------
create or replace function volunteer_check(p_email text, p_type_slug text default null, p_call_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_org   uuid;
  v_role  text;
  v       volunteers;
begin
  if p_call_slug is not null then
    select org_id, approval_role into v_org, v_role from volunteer_calls
     where slug = lower(p_call_slug) and is_published;
  else
    select org_id, approval_role into v_org, v_role from booking_types
     where slug = p_type_slug and is_published;
  end if;
  if v_org is null then return jsonb_build_object('state', 'closed'); end if;
  if v_role is null then return jsonb_build_object('state', 'open'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('state', 'invalid', 'role', v_role); end if;

  select * into v from volunteers where org_id = v_org and lower(email) = v_email;
  if not found then return jsonb_build_object('state', 'unknown', 'role', v_role); end if;
  if v.status = 'active' and ('*' = any (v.approved_for) or v_role = any (v.approved_for)) then
    return jsonb_build_object('state', 'approved', 'role', v_role, 'first_name', split_part(btrim(v.name), ' ', 1));
  end if;
  if v.review_status = 'pending' then return jsonb_build_object('state', 'pending', 'role', v_role); end if;
  if v.status = 'active' and coalesce(array_length(v.approved_for, 1), 0) > 0 then
    return jsonb_build_object('state', 'other', 'role', v_role, 'first_name', split_part(btrim(v.name), ' ', 1));
  end if;
  return jsonb_build_object('state', 'not_yet', 'role', v_role);
end $$;
grant execute on function volunteer_check(text, text, text) to anon, authenticated;

-- -------------------------------------------------------------
-- Part 6: the volunteer's own page
-- -------------------------------------------------------------
create or replace function my_volunteer_record(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (
    select * from volunteers where access_token = p_token
  ),
  -- Hours: what was logged or entered, and every shift they were checked in to.
  l as (
    select e.id, e.on_date, e.hours, e.activity, e.status, e.source, e.note
      from volunteer_hours_entries e, v where e.volunteer_id = v.id
    union all
    select b.id, (s.starts_at at time zone 'America/New_York')::date,
           round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 2) * b.party_size,
           t.name, 'confirmed', 'shift', null
      from bookings b
      join booking_slots s on s.id = b.slot_id
      join booking_types t on t.id = b.type_id, v
     where b.org_id = v.org_id and v.email is not null and lower(b.email) = lower(v.email)
       and b.status = 'checked_in' and t.kind = 'shift'
  ),
  today as (select (now() at time zone 'America/New_York')::date as d)
  select jsonb_build_object(
    'id', v.id,
    'name', v.name,
    'email', v.email,
    'status', v.status,
    'roles', to_jsonb(v.roles),
    'started_on', v.started_on,
    'orientation_on', v.orientation_on,
    'approved_for', to_jsonb(v.approved_for),
    'review_status', v.review_status,
    'hours_for', v.hours_for,
    'letter_details', v.letter_details,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'on_date', l.on_date, 'hours', l.hours, 'activity', l.activity,
               'status', l.status, 'source', l.source, 'note', l.note)
             order by l.on_date desc) from l), '[]'::jsonb),
    'totals', jsonb_build_object(
      'all',        coalesce((select sum(hours) from l), 0),
      'confirmed',  coalesce((select sum(hours) from l where status = 'confirmed'), 0),
      'this_year',  coalesce((select sum(hours) from l, today
                               where date_part('year', l.on_date) = date_part('year', today.d)), 0),
      'this_month', coalesce((select sum(hours) from l, today
                               where date_trunc('month', l.on_date) = date_trunc('month', today.d)), 0),
      'this_week',  coalesce((select sum(hours) from l, today
                               where date_trunc('week', l.on_date) = date_trunc('week', today.d)), 0),
      'today',      coalesce((select sum(hours) from l, today where l.on_date = today.d), 0)
    ),
    'by_year', coalesce((
      select jsonb_agg(jsonb_build_object('year', y.year, 'hours', y.hours) order by y.year desc)
        from (select date_part('year', on_date)::int as year, sum(hours) as hours from l group by 1) y), '[]'::jsonb),
    -- What they're signed up for, soonest first (their cancel links are theirs to use).
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'what', t.name, 'kind', t.kind, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
               'status', b.status, 'location', t.location, 'area', b.answer, 'cancel_token', b.cancel_token)
             order by s.starts_at)
        from bookings b
        join booking_slots s on s.id = b.slot_id
        join booking_types t on t.id = b.type_id
       where b.org_id = v.org_id and v.email is not null and lower(b.email) = lower(v.email)
         and b.status in ('requested', 'confirmed') and s.ends_at > now()), '[]'::jsonb)
  )
  from v;
$$;
grant execute on function my_volunteer_record(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- Part 8: certificates to consider (it comes before Part 7, which uses it)
-- -------------------------------------------------------------
insert into permissions(key, area, description) values
 ('volunteers.certificates', 'Volunteers', 'Make volunteer certificates and set the hours that earn one')
on conflict (key) do nothing;

-- The hours marks the top tier sets, e.g. {25,50,100,250}.
create table if not exists public.volunteer_settings (
  org_id            uuid primary key references public.organizations(id) on delete cascade,
  certificate_hours int[] not null default '{}',
  updated_by        uuid references auth.users(id) on delete set null,
  updated_at        timestamptz not null default now()
);
alter table public.volunteer_settings enable row level security;
drop policy if exists volunteer_settings_select on public.volunteer_settings;
create policy volunteer_settings_select on public.volunteer_settings for select
  using (vc_can(org_id) or has_permission(org_id, 'volunteers.certificates'));
drop policy if exists volunteer_settings_write on public.volunteer_settings;
create policy volunteer_settings_write on public.volunteer_settings for all
  using (has_permission(org_id, 'volunteers.certificates'))
  with check (has_permission(org_id, 'volunteers.certificates'));
revoke all on public.volunteer_settings from anon;
grant select, insert, update on public.volunteer_settings to authenticated;

create table if not exists public.certificate_suggestions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  reason       text not null check (reason in ('letter', 'hours')),
  hours        numeric(8, 2),       -- their confirmed hours when it was suggested
  milestone    int,                 -- the mark they passed (reason 'hours')
  letter_code  text,                -- the letter they made (reason 'letter')
  letter_kind  text,
  status       text not null default 'open' check (status in ('open', 'made', 'dismissed')),
  handled_by   uuid references auth.users(id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists idx_cert_suggestions_mark
  on public.certificate_suggestions(volunteer_id, milestone) where reason = 'hours';
create index if not exists idx_cert_suggestions_open
  on public.certificate_suggestions(org_id, status, created_at desc);
alter table public.certificate_suggestions enable row level security;
drop policy if exists certificate_suggestions_staff on public.certificate_suggestions;
create policy certificate_suggestions_staff on public.certificate_suggestions for all
  using (has_permission(org_id, 'volunteers.certificates'))
  with check (has_permission(org_id, 'volunteers.certificates'));
revoke all on public.certificate_suggestions from anon;
grant select, update on public.certificate_suggestions to authenticated;

-- A volunteer's confirmed hours, all time: entries staff confirmed and shifts they were checked in to.
create or replace function volunteer_confirmed_hours(p_volunteer uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(e.hours) from volunteer_hours_entries e
                    where e.volunteer_id = v.id and e.status = 'confirmed'), 0)
       + coalesce((select sum(round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 2) * b.party_size)
                     from bookings b
                     join booking_slots s on s.id = b.slot_id
                     join booking_types t on t.id = b.type_id
                    where b.org_id = v.org_id and v.email is not null and lower(b.email) = lower(v.email)
                      and b.status = 'checked_in' and t.kind = 'shift'), 0)
    from volunteers v where v.id = p_volunteer;
$$;
revoke execute on function volunteer_confirmed_hours(uuid) from public, anon;

-- Suggest a certificate for every mark a volunteer has passed and not been suggested for.
create or replace function check_certificate_marks(p_volunteer uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v      volunteers;
  marks  int[];
  total  numeric;
  m      int;
  n      int := 0;
begin
  select * into v from volunteers where id = p_volunteer;
  if not found then return 0; end if;
  select certificate_hours into marks from volunteer_settings where org_id = v.org_id;
  if marks is null or cardinality(marks) = 0 then return 0; end if;
  total := volunteer_confirmed_hours(v.id);
  foreach m in array marks loop
    if m > 0 and total >= m then
      insert into certificate_suggestions (org_id, volunteer_id, reason, hours, milestone)
      values (v.org_id, v.id, 'hours', total, m)
      on conflict (volunteer_id, milestone) where reason = 'hours' do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function check_certificate_marks(uuid) from public, anon;

-- Hours change when staff confirm or add them, and when someone is checked in to a shift.
create or replace function certificate_marks_on_entry() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.volunteer_id is not null and new.status = 'confirmed' then
    perform check_certificate_marks(new.volunteer_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_certificate_marks_entry on public.volunteer_hours_entries;
create trigger trg_certificate_marks_entry after insert or update of status, hours on public.volunteer_hours_entries
  for each row execute function certificate_marks_on_entry();

create or replace function certificate_marks_on_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if new.status <> 'checked_in' then return null; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'checked_in' then return null; end if;
  end if;
  select id into v_id from volunteers where org_id = new.org_id and lower(email) = lower(new.email);
  if v_id is not null then perform check_certificate_marks(v_id); end if;
  return null;
end $$;
drop trigger if exists trg_certificate_marks_checkin on public.bookings;
create trigger trg_certificate_marks_checkin after insert or update of status on public.bookings
  for each row execute function certificate_marks_on_checkin();

-- The top tier sets the marks; everyone already past one is suggested straight away.
create or replace function set_certificate_hours(p_org uuid, p_hours int[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_marks int[];
  r record;
  n int := 0;
begin
  if not has_permission(p_org, 'volunteers.certificates') then raise exception 'Not allowed'; end if;
  select coalesce(array_agg(distinct h order by h), '{}') into v_marks
    from unnest(coalesce(p_hours, '{}')) h where h between 1 and 100000;
  insert into volunteer_settings (org_id, certificate_hours, updated_by, updated_at)
  values (p_org, v_marks, auth.uid(), now())
  on conflict (org_id) do update set certificate_hours = excluded.certificate_hours,
                                     updated_by = excluded.updated_by, updated_at = now();
  for r in select id from volunteers where org_id = p_org and status in ('active', 'paused') loop
    n := n + check_certificate_marks(r.id);
  end loop;
  return n;
end $$;
grant execute on function set_certificate_hours(uuid, int[]) to authenticated;

-- -------------------------------------------------------------
-- Part 7: self-serve letters, each with a code anyone can check
-- -------------------------------------------------------------
create table if not exists public.volunteer_letters (
  code         text primary key,                  -- "K7Q2-M9XP"
  org_id       uuid not null references public.organizations(id) on delete cascade,
  volunteer_id uuid references public.volunteers(id) on delete set null,
  name         text not null,
  kind         text not null,
  period_from  date not null,
  period_to    date not null,
  total_hours  numeric(8, 2) not null,
  details      jsonb not null default '{}'::jsonb,
  issued_by    text not null default 'self' check (issued_by in ('self', 'staff')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_volunteer_letters_volunteer on public.volunteer_letters(volunteer_id, created_at desc);
alter table public.volunteer_letters enable row level security;
drop policy if exists volunteer_letters_staff_select on public.volunteer_letters;
create policy volunteer_letters_staff_select on public.volunteer_letters for select using (vc_can(org_id));
revoke all on public.volunteer_letters from anon;
grant select on public.volunteer_letters to authenticated;

create or replace function issue_my_letter(
  p_token uuid, p_kind text, p_from date, p_to date, p_details jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v         volunteers;
  v_today   date := (now() at time zone 'America/New_York')::date;
  v_to      date := least(p_to, (now() at time zone 'America/New_York')::date);
  v_lines   jsonb;
  v_total   numeric;
  v_pending numeric;
  v_code    text;
  v_bytes   bytea;
  i         int;
  alphabet  text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  select * into v from volunteers where access_token = p_token;
  if not found then raise exception 'That link isn’t valid any more — ask OHRR for a new one.'; end if;
  -- A certificate of appreciation is OHRR's to give (Part 8), not self-serve.
  if p_kind not in ('school', 'military', 'workplace', 'general') then
    raise exception 'Pick a kind of letter.';
  end if;
  if p_from is null or p_to is null or v_to < p_from then raise exception 'Pick the dates the letter covers.'; end if;
  if pg_column_size(coalesce(p_details, '{}'::jsonb)) > 4000 then raise exception 'Those details are too long.'; end if;
  if (select count(*) from volunteer_letters where volunteer_id = v.id
        and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That’s a lot of letters for one day — please try again tomorrow.';
  end if;

  -- Only hours OHRR has confirmed: shifts they were checked in to, and entries staff confirmed.
  with l as (
    select e.on_date, e.hours, e.activity
      from volunteer_hours_entries e
     where e.volunteer_id = v.id and e.status = 'confirmed' and e.on_date between p_from and v_to
    union all
    select (s.starts_at at time zone 'America/New_York')::date,
           round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 2) * b.party_size, t.name
      from bookings b
      join booking_slots s on s.id = b.slot_id
      join booking_types t on t.id = b.type_id
     where b.org_id = v.org_id and v.email is not null and lower(b.email) = lower(v.email)
       and b.status = 'checked_in' and t.kind = 'shift'
       and (s.starts_at at time zone 'America/New_York')::date between p_from and v_to
  )
  select coalesce(jsonb_agg(jsonb_build_object('on_date', on_date, 'activity', activity, 'hours', hours)
                            order by on_date), '[]'::jsonb),
         coalesce(sum(hours), 0)
    into v_lines, v_total
    from l;
  if v_total <= 0 then
    raise exception 'There are no confirmed hours in those dates yet.';
  end if;
  select coalesce(sum(hours), 0) into v_pending from volunteer_hours_entries
   where volunteer_id = v.id and status = 'logged' and on_date between p_from and v_to;

  -- A code nobody can guess, e.g. K7Q2-M9XP.
  loop
    v_bytes := decode(md5(gen_random_uuid()::text || clock_timestamp()::text), 'hex');
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
    exit when not exists (select 1 from volunteer_letters where code = v_code);
  end loop;

  insert into volunteer_letters (code, org_id, volunteer_id, name, kind, period_from, period_to, total_hours, details, issued_by)
  values (v_code, v.org_id, v.id, v.name, p_kind, p_from, v_to, v_total, coalesce(p_details, '{}'::jsonb), 'self');
  -- Remember their school / branch / employer for next time.
  update volunteers set letter_details = letter_details || coalesce(p_details, '{}'::jsonb) where id = v.id;
  -- Tell OHRR: someone who needed a letter may deserve a certificate (once a month at most).
  if not exists (select 1 from certificate_suggestions
                  where volunteer_id = v.id and reason = 'letter' and created_at > now() - interval '30 days') then
    insert into certificate_suggestions (org_id, volunteer_id, reason, hours, letter_code, letter_kind)
    values (v.org_id, v.id, 'letter', volunteer_confirmed_hours(v.id), v_code, p_kind);
  end if;

  return jsonb_build_object('code', v_code, 'name', v.name, 'from', p_from, 'to', v_to,
                            'lines', v_lines, 'total', v_total, 'pending', v_pending, 'issued_on', v_today);
end $$;
grant execute on function issue_my_letter(uuid, text, date, date, jsonb) to anon, authenticated;

create or replace function verify_volunteer_letter(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g') as k)
  select jsonb_build_object('code', l.code, 'name', l.name, 'kind', l.kind,
                            'from', l.period_from, 'to', l.period_to, 'total_hours', l.total_hours,
                            'issued_on', (l.created_at at time zone 'America/New_York')::date)
    from volunteer_letters l, c
   where l.code = substr(c.k, 1, 4) || '-' || substr(c.k, 5, 4);
$$;
grant execute on function verify_volunteer_letter(text) to anon, authenticated;
