-- =============================================================
-- OHRR — update 28: levels for staff, certifications, and trusted volunteers
--
-- OHRR (2026-09-24): "we also need a multiple levels of users and admins. so
-- top admin the founders, then the board level or something etc. then a user
-- that only can work the hop shop and is certified … volunteers will have
-- levels of trust as well but hours can be validated by the admins." And:
-- "a person that is a volunteer but not covering a shift of some type can
-- still log in hours … a trusted supporter and worker log their hours just to
-- track how much they volunteer."
--
-- Part 1 Staff levels, highest first:
--          founder  the founders — everything, including who is on the board
--          board    board members — everything, and look after leads and workers
--          lead     coordinators (volunteers, adoptions, Hop Shop, BunFest …)
--                   with the permissions their job needs
--          worker   people who do one job, e.g. work the Hop Shop counter
--        A level decides who may change whom: nobody can change the level,
--        permissions or access of someone at their own level or above
--        (founders can manage founders, but the last one can't be removed).
--        Founders are owners and board members are admins, as before, so
--        every existing screen keeps working; everyone already here keeps
--        what they have (owner → founder, admin → board, staff → lead).
-- Part 2 Certifications: what someone has been trained and signed off for
--        ("Hop Shop counter", "Buncare orientation" …), by whom and when,
--        with an optional expiry — and a "Hop Shop Worker" access preset.
-- Part 3 Trusted volunteers: hours a trusted volunteer logs count straight
--        away (still marked self-reported, and staff can un-confirm them);
--        everyone else's wait for staff to confirm, as now. Any volunteer can
--        log hours for work that isn't a shift (vet runs, fostering, events …).
-- Part 4 Staff who volunteer: "My volunteer hours" opens their own volunteer
--        page (made for them the first time), so they can log hours too.
--
-- Safe to run more than once. Paste + Run after update 27.
-- =============================================================

-- -------------------------------------------------------------
-- Part 1: staff levels
-- -------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'memberships' and column_name = 'level') then
    alter table public.memberships add column level text not null default 'lead'
      check (level in ('founder', 'board', 'lead', 'worker'));
    update public.memberships set level = case role::text when 'owner' then 'founder'
                                                          when 'admin' then 'board'
                                                          else 'lead' end;
  end if;
end $$;

-- Anyone who joins as an owner (the master code) is a founder; as an admin, board.
create or replace function membership_level_from_role() returns trigger
language plpgsql as $$
begin
  if new.level = 'lead' and new.role::text in ('owner', 'admin') then
    new.level := case new.role::text when 'owner' then 'founder' else 'board' end;
  end if;
  return new;
end $$;
drop trigger if exists trg_membership_level on public.memberships;
create trigger trg_membership_level before insert on public.memberships
  for each row execute function membership_level_from_role();

create or replace function level_rank(p_level text) returns int
language sql immutable as $$
  select case p_level when 'founder' then 4 when 'board' then 3 when 'lead' then 2 when 'worker' then 1 else 0 end;
$$;

-- The signed-in person's level in an org (null if not an active member).
create or replace function my_level(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select level from memberships where org_id = p_org and user_id = auth.uid() and status = 'active';
$$;
grant execute on function my_level(uuid) to authenticated;

-- May the signed-in person manage this membership? Only people below them
-- (founders may manage founders), and never themselves.
create or replace function can_manage_member(p_membership uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  t memberships;
  mine text;
begin
  select * into t from memberships where id = p_membership;
  if not found or t.user_id = auth.uid() then return false; end if;
  mine := my_level(t.org_id);
  if mine is null or not has_permission(t.org_id, 'staff.permissions.manage') then return false; end if;
  return level_rank(mine) > level_rank(t.level) or (mine = 'founder' and t.level = 'founder');
end $$;
grant execute on function can_manage_member(uuid) to authenticated;

-- Set someone's level. You can give any level below your own (founders can make founders).
create or replace function set_member_level(p_membership uuid, p_level text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t memberships;
  mine text;
begin
  select * into t from memberships where id = p_membership;
  if not found then raise exception 'Membership not found'; end if;
  if p_level not in ('founder', 'board', 'lead', 'worker') then raise exception 'Unknown level'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;
  mine := my_level(t.org_id);
  if not (level_rank(mine) > level_rank(p_level) or mine = 'founder') then
    raise exception 'You can only give a level below your own.';
  end if;
  if t.level = 'founder' and p_level <> 'founder'
     and (select count(*) from memberships where org_id = t.org_id and level = 'founder' and status = 'active') <= 1 then
    raise exception 'OHRR needs at least one founder.';
  end if;
  update memberships set
    level = p_level,
    role  = (case p_level when 'founder' then 'owner' when 'board' then 'admin' else 'staff' end)::membership_role
  where id = t.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'set_member_level', 'membership', t.id::text,
          jsonb_build_object('from', t.level, 'to', p_level));
end $$;
grant execute on function set_member_level(uuid, text) to authenticated;

-- The existing permission and access switches now respect levels too.
create or replace function set_membership_permission(p_membership uuid, p_key text, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from memberships where id = p_membership;
  if v_org is null then raise exception 'Membership not found'; end if;
  if not has_permission(v_org, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;

  if p_grant then
    insert into membership_permissions(membership_id, permission_key, granted_by)
    values (p_membership, p_key, auth.uid()) on conflict do nothing;
  else
    delete from membership_permissions where membership_id = p_membership and permission_key = p_key;
  end if;

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (v_org, auth.uid(), case when p_grant then 'grant_permission' else 'revoke_permission' end,
          'membership', p_membership::text, jsonb_build_object('key', p_key));
end $$;

create or replace function set_membership_status(p_membership uuid, p_status membership_status)
returns void language plpgsql security definer set search_path = public as $$
declare t memberships;
begin
  select * into t from memberships where id = p_membership;
  if not found then raise exception 'Membership not found'; end if;
  if not has_permission(t.org_id, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;
  if t.level = 'founder' and p_status <> 'active'
     and (select count(*) from memberships where org_id = t.org_id and level = 'founder' and status = 'active') <= 1 then
    raise exception 'OHRR needs at least one founder.';
  end if;
  update memberships set status = p_status where id = p_membership;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'set_membership_status', 'membership', p_membership::text,
          jsonb_build_object('status', p_status));
end $$;

-- Invites can't be used to jump levels: only a founder can invite an owner or admin
-- (a founder or board member), whatever screen or call is used.
create or replace function create_invite_code(
  p_org uuid, p_role membership_role, p_capabilities text[], p_preset text,
  p_max_uses int default 1, p_expires_at timestamptz default now() + interval '14 days'
) returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if not has_permission(p_org, 'staff.invite') then raise exception 'Not allowed'; end if;
  if coalesce(p_role, 'staff') in ('owner', 'admin') and coalesce(my_level(p_org), '') <> 'founder' then
    raise exception 'Only a founder can invite a founder or a board member.';
  end if;
  new_code := upper(encode(gen_random_bytes(5), 'hex'));      -- 10-char code
  insert into invite_codes(code, org_id, kind, role, capabilities, preset, max_uses, expires_at, created_by)
  values (new_code, p_org, 'worker', coalesce(p_role,'staff'),
          coalesce(p_capabilities,'{}'), p_preset, coalesce(p_max_uses,1), p_expires_at, auth.uid());
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'create_invite_code', 'invite', new_code,
          jsonb_build_object('role',p_role,'preset',p_preset,'capabilities',p_capabilities));
  return new_code;
end $$;

-- An invite can say what level the new person joins at (never above the inviter's).
alter table public.invite_codes add column if not exists level text
  check (level is null or level in ('founder', 'board', 'lead', 'worker'));

create or replace function set_invite_level(p_code text, p_level text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c invite_codes;
  mine text;
begin
  select * into c from invite_codes where code = p_code;
  if not found then raise exception 'No such invite'; end if;
  if not has_permission(c.org_id, 'staff.invite') then raise exception 'Not allowed'; end if;
  mine := my_level(c.org_id);
  if p_level is not null and not (level_rank(mine) > level_rank(p_level) or mine = 'founder') then
    raise exception 'You can only invite people below your own level.';
  end if;
  update invite_codes set level = p_level where id = c.id;
end $$;
grant execute on function set_invite_level(text, text) to authenticated;

-- A redeemed invite with a level puts the new member at that level.
create or replace function redeem_invite_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c invite_codes; mid uuid; caps text[]; v_level text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into c from invite_codes where code = p_code and kind = 'worker' for update;
  if not found then raise exception 'Invalid code'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Code expired'; end if;
  if c.used_count >= c.max_uses then raise exception 'Code fully used'; end if;

  v_level := coalesce(c.level, case c.role::text when 'owner' then 'founder' when 'admin' then 'board' else 'lead' end);
  insert into memberships(org_id, user_id, role, status, level)
  values (c.org_id, auth.uid(),
          (case v_level when 'founder' then 'owner' when 'board' then 'admin' else 'staff' end)::membership_role,
          'active', v_level)
  on conflict (org_id, user_id) do update set status = 'active'
  returning id into mid;

  caps := coalesce(c.capabilities, '{}');
  if c.preset is not null then
    caps := caps || array(select permission_key from permission_presets where preset = c.preset);
  end if;

  insert into membership_permissions(membership_id, permission_key, granted_by)
  select mid, k, c.created_by from unnest(caps) as k
  where k in (select key from permissions)
  on conflict do nothing;

  update invite_codes set used_count = used_count + 1 where id = c.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (c.org_id, auth.uid(), 'redeem_invite_code', 'membership', mid::text,
          jsonb_build_object('code', p_code, 'level', v_level));
  return mid;
end $$;

-- The Team screen: everyone with their level, and whether the signed-in person may manage them.
create or replace function list_team(p_org uuid)
returns table (
  membership_id uuid, user_id uuid, email text, role membership_role, status membership_status,
  level text, display_name text, title text, created_at timestamptz, can_manage boolean
) language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, u.email::text, m.role, m.status, m.level, m.display_name, m.title, m.created_at,
         can_manage_member(m.id)
    from memberships m
    join auth.users u on u.id = m.user_id
   where m.org_id = p_org and is_org_member(p_org)
   order by level_rank(m.level) desc, m.created_at;
$$;
grant execute on function list_team(uuid) to authenticated;

-- -------------------------------------------------------------
-- Part 2: certifications
-- -------------------------------------------------------------
create table if not exists public.member_certifications (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  kind          text not null,        -- 'hop-shop', 'counter', 'buncare', 'animal-handling' … or free text
  certified_on  date not null default ((now() at time zone 'America/New_York')::date),
  expires_on    date,
  certified_by  uuid references auth.users(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (membership_id, kind)
);
alter table public.member_certifications enable row level security;
drop policy if exists member_certifications_select on public.member_certifications;
create policy member_certifications_select on public.member_certifications for select
  using (is_org_member(org_id));
drop policy if exists member_certifications_write on public.member_certifications;
create policy member_certifications_write on public.member_certifications for all
  using (can_manage_member(membership_id)) with check (can_manage_member(membership_id));
revoke all on public.member_certifications from anon;
grant select, insert, update, delete on public.member_certifications to authenticated;

insert into permission_presets(preset, permission_key) values
 ('Hop Shop Worker', 'counter.use'),
 ('Hop Shop Worker', 'hopshop.inventory.update'),
 ('Hop Shop Worker', 'hopshop.orders.view')
on conflict do nothing;

-- -------------------------------------------------------------
-- Part 3: trusted volunteers
-- -------------------------------------------------------------
alter table public.volunteers add column if not exists trust_level text not null default 'standard'
  check (trust_level in ('standard', 'trusted'));

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
  if coalesce((select sum(hours) from volunteer_hours_entries
                where volunteer_id = v.id and on_date = p_on_date), 0) + p_hours > 24 then
    raise exception 'That would be more than 24 hours on one day.';
  end if;

  -- A trusted volunteer's hours count straight away; staff can still un-confirm them.
  insert into volunteer_hours_entries (org_id, email, name, on_date, hours, activity, volunteer_id, status, source, note)
  values (v.org_id, coalesce(v.email, ''), v.name, p_on_date, round(p_hours, 2), btrim(p_activity),
          v.id, case when v.trust_level = 'trusted' then 'confirmed' else 'logged' end, 'self',
          nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function log_my_hours(uuid, date, numeric, text, text) to anon, authenticated;

-- -------------------------------------------------------------
-- Part 4: staff who volunteer
-- -------------------------------------------------------------
-- The signed-in staff member's own volunteer page: found by their email, or
-- made for them (approved for everything; founders, board and leads trusted).
create or replace function my_staff_volunteer_page(p_org uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m memberships;
  v_email text;
  v volunteers;
  v_name text;
begin
  select * into m from memberships where org_id = p_org and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'Not allowed'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'Your account has no email.'; end if;
  select * into v from volunteers where org_id = p_org and lower(email) = v_email;
  if not found then
    v_name := coalesce(nullif(btrim(coalesce(m.display_name, '')), ''), split_part(v_email, '@', 1));
    insert into volunteers (org_id, name, email, status, approved_for, trust_level, started_on, notes, review_status)
    values (p_org, v_name, v_email, 'active', '{*}',
            case when m.level in ('founder', 'board', 'lead') then 'trusted' else 'standard' end,
            (now() at time zone 'America/New_York')::date, 'OHRR team member', 'approved')
    returning * into v;
  end if;
  return v.access_token;
end $$;
grant execute on function my_staff_volunteer_page(uuid) to authenticated;
