-- =============================================================
-- Update 30 (2026-09-25): staff tiers, and sharing some tasks but not all.
--
-- OHRR (2026-09-25), on Staff → Team → Invite: "function gen_random_bytes(integer)
-- does not exist" … "audit the process of users and how to create them and how to
-- provide access. also beyond founder there should be admin and a few levels …
-- how we can share some but not all tasks with different trusted staff and
-- volunteers."
--
-- What was wrong:
--   * No invite could be made: the code maker used pgcrypto's gen_random_bytes,
--     which lives in the `extensions` schema, from a function that only looks in
--     `public`. Codes now come from gen_random_uuid() (built in; as random).
--   * Anyone who could invite could put ANY task on an invite — including ones
--     they don't have themselves, like "change app settings". The same was true of
--     switching tasks on for someone below you.
--   * Someone whose access had been switched off could switch it back on by
--     redeeming any invite code.
--   * The one-time owner code left the level behind (an owner still marked Lead).
--
-- The levels, as OHRR set them (2026-09-25: "volunteer 1, 2, 3 and then … lead,
-- admin 1, 2, 3 and then board and founder. founder is all access for all
-- things. the final is developer which is all access as well."), lowest first:
--   volunteer1 · volunteer2 · volunteer3   Volunteer 1–3
--   lead                                   Lead
--   admin1 · admin2 · admin3               Admin 1–3
--   board                                  Board
--   founder                                Founder    — every task
--   developer                              Developer  — every task
-- Founders and developers are owners underneath and hold every task; they can
-- look after anyone, each other included (never themselves), and there is
-- always at least one founder. Everyone else holds exactly the tasks switched
-- on for them and looks after people below their own level.
--
-- The sharing rule: you can only give a level below your own, and only share
-- tasks you have yourself. So a Lead who may bring on helpers can hand a
-- volunteer part of their own job and nothing more. Access can also end on a
-- date ("until the end of BunFest").
--
-- Before this update: Worker becomes Volunteer 1. Board members were admins
-- underneath, holding every task without it being written down; they stay
-- Board and every task is now switched on for them, so nobody loses anything.
-- Safe to run more than once.
-- =============================================================

-- Part 1 — the ten levels
do $$
declare c record;
begin
  for c in select conname, conrelid::regclass as t from pg_constraint
            where conrelid in ('public.memberships'::regclass, 'public.invite_codes'::regclass)
              and contype = 'c' and pg_get_constraintdef(oid) ilike '%level%'
  loop
    execute format('alter table %s drop constraint %I', c.t, c.conname);
  end loop;
end $$;
update public.memberships set level = 'volunteer1' where level = 'worker';
update public.invite_codes set level = 'volunteer1' where level = 'worker';
-- Board members held every task as admins; write them all down, then make them
-- plain members. Board from now on is never role 'admin', so this runs once.
insert into public.membership_permissions(membership_id, permission_key, granted_by)
select m.id, p.key, null from public.memberships m cross join public.permissions p
 where m.level = 'board' and m.role = 'admin'
on conflict do nothing;
update public.memberships set role = 'staff' where level = 'board' and role = 'admin';
update public.invite_codes set role = 'staff', capabilities = array(select key from public.permissions)
 where level = 'board' and role = 'admin';
alter table public.memberships alter column level set default 'volunteer1';
alter table public.memberships add constraint memberships_level_check
  check (level in ('developer', 'founder', 'board', 'admin3', 'admin2', 'admin1', 'lead', 'volunteer3', 'volunteer2', 'volunteer1'));
alter table public.invite_codes add constraint invite_codes_level_check
  check (level is null or level in ('developer', 'founder', 'board', 'admin3', 'admin2', 'admin1', 'lead', 'volunteer3', 'volunteer2', 'volunteer1'));

create or replace function level_rank(p_level text) returns int
language sql immutable as $$
  select case p_level when 'developer' then 10 when 'founder' then 9 when 'board' then 8
                      when 'admin3' then 7 when 'admin2' then 6 when 'admin1' then 5 when 'lead' then 4
                      when 'volunteer3' then 3 when 'volunteer2' then 2 when 'volunteer1' then 1 else 0 end;
$$;
grant execute on function level_rank(text) to authenticated;
-- Founders and developers are owners (every task); everyone else is staff.
create or replace function level_role(p_level text) returns membership_role
language sql immutable as $$
  select (case when p_level in ('founder', 'developer') then 'owner' else 'staff' end)::membership_role;
$$;
create or replace function is_all_access_level(p_level text) returns boolean
language sql immutable as $$
  select coalesce(p_level in ('founder', 'developer'), false);
$$;
create or replace function membership_level_from_role() returns trigger
language plpgsql as $$
begin
  if new.role::text = 'owner' and not is_all_access_level(new.level) then
    new.level := 'founder';
  end if;
  return new;
end $$;

-- Part 2 — access that ends on a date
alter table public.memberships add column if not exists access_until date;
alter table public.invite_codes add column if not exists access_until date;

create or replace function is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
     where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
       and (m.access_until is null or m.access_until >= (now() at time zone 'America/New_York')::date)
  );
$$;
create or replace function has_permission(p_org uuid, p_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships
   where org_id = p_org and user_id = auth.uid() and status = 'active'
     and (access_until is null or access_until >= (now() at time zone 'America/New_York')::date);
  if not found then return false; end if;
  if m.role in ('owner', 'admin') then return true; end if;
  return exists (
    select 1 from membership_permissions mp
     where mp.membership_id = m.id and mp.permission_key = p_key
  );
end $$;
create or replace function my_level(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select level from memberships
   where org_id = p_org and user_id = auth.uid() and status = 'active'
     and (access_until is null or access_until >= (now() at time zone 'America/New_York')::date);
$$;
grant execute on function my_level(uuid) to authenticated;
-- Everyone may always read their own membership row, so a person whose access
-- has ended can be told when it ended (the team list still needs membership).
drop policy if exists mem_select_own on memberships;
create policy mem_select_own on memberships for select using (user_id = auth.uid());

-- Who may change whom: founders and developers anyone (never themselves);
-- everyone else only people below their own level.
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
  return is_all_access_level(mine) or level_rank(mine) > level_rank(t.level);
end $$;
grant execute on function can_manage_member(uuid) to authenticated;
-- Which levels someone may give: founders and developers any; others below their own.
create or replace function can_give_level(p_org uuid, p_level text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(is_all_access_level(my_level(p_org)) or level_rank(my_level(p_org)) > level_rank(p_level), false);
$$;
grant execute on function can_give_level(uuid, text) to authenticated;

-- Part 3 — the tasks, in plain words, and the usual sets
update public.permissions set description = 'Invite people — to levels below yours, sharing only tasks you have'
 where key = 'staff.invite';
update public.permissions set description = 'Change the level, tasks and access of people below you (sharing only tasks you have)'
 where key = 'staff.permissions.manage';
insert into permission_presets(preset, permission_key) values
 ('Board', 'audit.view'),
 ('Board', 'social.approve'),
 ('Board', 'volunteers.certificates'),
 ('Board', 'giving.guardians'),
 ('BunFest & Events', 'events.bunfest.manage'),
 ('BunFest & Events', 'bookings.manage'),
 ('BunFest & Events', 'counter.use'),
 ('Inbox helper', 'inbox.manage'),
 ('Rabbit listings helper', 'adoptions.listings.create'),
 ('Rabbit listings helper', 'adoptions.listings.edit'),
 ('Rabbit listings helper', 'adoptions.status.change'),
 ('Care pages helper', 'content.education.edit')
on conflict do nothing;

-- Part 4 — changing a person: level, tasks, on/off, end date
create or replace function set_member_level(p_membership uuid, p_level text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t memberships;
begin
  select * into t from memberships where id = p_membership;
  if not found then raise exception 'Membership not found'; end if;
  if p_level not in ('developer', 'founder', 'board', 'admin3', 'admin2', 'admin1', 'lead', 'volunteer3', 'volunteer2', 'volunteer1') then raise exception 'Unknown level'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;
  if not can_give_level(t.org_id, p_level) then
    raise exception 'You can only give a level below your own.';
  end if;
  if t.level = 'founder' and p_level <> 'founder'
     and (select count(*) from memberships where org_id = t.org_id and level = 'founder' and status = 'active') <= 1 then
    raise exception 'OHRR needs at least one founder.';
  end if;
  -- Leaving founder or developer means holding only the tasks switched on. Someone
  -- moved to Board with none gets the Board set, so they aren't left with nothing.
  if t.role in ('owner', 'admin') and p_level = 'board'
     and not exists (select 1 from membership_permissions where membership_id = t.id) then
    insert into membership_permissions(membership_id, permission_key, granted_by)
    select t.id, permission_key, auth.uid() from permission_presets where preset = 'Board'
    on conflict do nothing;
  end if;
  update memberships set level = p_level, role = level_role(p_level) where id = t.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'set_member_level', 'membership', t.id::text,
          jsonb_build_object('from', t.level, 'to', p_level));
end $$;
grant execute on function set_member_level(uuid, text) to authenticated;

create or replace function set_membership_permission(p_membership uuid, p_key text, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from memberships where id = p_membership;
  if v_org is null then raise exception 'Membership not found'; end if;
  if not has_permission(v_org, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;
  if not has_permission(v_org, p_key) then raise exception 'You can only share tasks you have yourself.'; end if;
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

create or replace function set_member_access_until(p_membership uuid, p_until date)
returns void language plpgsql security definer set search_path = public as $$
declare t memberships;
begin
  select * into t from memberships where id = p_membership;
  if not found then raise exception 'Membership not found'; end if;
  if not has_permission(t.org_id, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;
  if is_all_access_level(t.level) and p_until is not null then raise exception 'A founder’s or developer’s access doesn’t end.'; end if;
  update memberships set access_until = p_until where id = t.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'set_member_access_until', 'membership', t.id::text,
          jsonb_build_object('until', p_until));
end $$;
grant execute on function set_member_access_until(uuid, date) to authenticated;

-- Part 5 — invites
create or replace function create_staff_invite(
  p_org uuid, p_level text, p_capabilities text[] default '{}', p_preset text default null,
  p_access_until date default null, p_name text default null, p_email text default null,
  p_phone text default null, p_position text default null, p_note text default null,
  p_max_uses int default 1, p_expires_at timestamptz default now() + interval '14 days'
) returns text language plpgsql security definer set search_path = public as $$
declare
  caps     text[];
  k        text;
  new_code text;
begin
  if not has_permission(p_org, 'staff.invite') then
    raise exception 'Inviting people needs the “Invite people” task.';
  end if;
  if p_level not in ('developer', 'founder', 'board', 'admin3', 'admin2', 'admin1', 'lead', 'volunteer3', 'volunteer2', 'volunteer1') then raise exception 'Unknown level'; end if;
  if not can_give_level(p_org, p_level) then
    raise exception 'You can only invite people below your own level.';
  end if;
  if is_all_access_level(p_level) then
    caps := '{}';
  else
    caps := coalesce(p_capabilities, '{}')
         || coalesce(array(select permission_key from permission_presets where preset = p_preset), '{}');
    caps := array(select distinct x from unnest(caps) x where x in (select key from permissions));
    foreach k in array caps loop
      if not has_permission(p_org, k) then
        raise exception 'You can only share tasks you have yourself (%).',
          coalesce((select description from permissions where key = k), k);
      end if;
    end loop;
  end if;
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from invite_codes where code = new_code);
  end loop;
  insert into invite_codes(code, org_id, kind, role, capabilities, preset, max_uses, expires_at, created_by,
                           level, access_until, invitee_name, invitee_email, invitee_phone, position_note, note)
  values (new_code, p_org, 'worker', level_role(p_level), caps,
          case when is_all_access_level(p_level) then null else nullif(btrim(coalesce(p_preset, '')), '') end,
          greatest(1, coalesce(p_max_uses, 1)), p_expires_at, auth.uid(),
          p_level, case when is_all_access_level(p_level) then null else p_access_until end,
          nullif(btrim(coalesce(p_name, '')), ''), lower(nullif(btrim(coalesce(p_email, '')), '')),
          nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_position, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''));
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'create_invite_code', 'invite', new_code,
          jsonb_build_object('level', p_level, 'preset', p_preset, 'capabilities', caps,
                             'access_until', p_access_until, 'invitee', p_name));
  return new_code;
end $$;
grant execute on function create_staff_invite(uuid, text, text[], text, date, text, text, text, text, text, int, timestamptz)
  to authenticated;

-- The older screens (and phone builds already installed) still call this one.
-- It now makes a Volunteer 1 invite with the same checks; they then raise the
-- level with set_invite_level, which checks again.
create or replace function create_invite_code(
  p_org uuid, p_role membership_role, p_capabilities text[], p_preset text,
  p_max_uses int default 1, p_expires_at timestamptz default now() + interval '14 days'
) returns text language plpgsql security definer set search_path = public as $$
begin
  return create_staff_invite(
    p_org,
    case coalesce(p_role, 'staff') when 'owner' then 'founder' else 'volunteer1' end,
    p_capabilities, p_preset, null, null, null, null, null, null, p_max_uses, p_expires_at);
end $$;

create or replace function set_invite_level(p_code text, p_level text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c invite_codes;
  v_level text := case p_level when 'worker' then 'volunteer1' else p_level end;  -- older screens
begin
  select * into c from invite_codes where code = p_code;
  if not found then raise exception 'No such invite'; end if;
  if not has_permission(c.org_id, 'staff.invite') then raise exception 'Not allowed'; end if;
  if v_level is not null and v_level not in ('developer', 'founder', 'board', 'admin3', 'admin2', 'admin1', 'lead', 'volunteer3', 'volunteer2', 'volunteer1') then
    raise exception 'Unknown level';
  end if;
  if v_level is not null and not can_give_level(c.org_id, v_level) then
    raise exception 'You can only invite people below your own level.';
  end if;
  update invite_codes set
    level = v_level,
    role  = case when v_level is null then role else level_role(v_level) end,
    capabilities = case when is_all_access_level(v_level) then '{}' else capabilities end
  where id = c.id;
end $$;
grant execute on function set_invite_level(text, text) to authenticated;

create or replace function redeem_invite_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c       invite_codes;
  m       memberships;
  mid     uuid;
  caps    text[];
  v_level text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into c from invite_codes where code = upper(btrim(p_code)) and kind = 'worker' for update;
  if not found then raise exception 'Invalid code'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Code expired'; end if;
  if c.used_count >= c.max_uses then raise exception 'Code fully used'; end if;
  v_level := coalesce(c.level, case c.role::text when 'owner' then 'founder' when 'admin' then 'board' else 'lead' end);

  select * into m from memberships where org_id = c.org_id and user_id = auth.uid();
  if found then
    -- An invite never switches back on access that someone switched off.
    if m.status <> 'active' then
      raise exception 'Your access was switched off. Ask a founder or admin to switch it back on.';
    end if;
    mid := m.id;
    update memberships set
      level        = case when level_rank(v_level) > level_rank(level) then v_level else level end,
      role         = case when level_rank(v_level) > level_rank(level) then level_role(v_level) else role end,
      access_until = case when access_until is null or c.access_until is null then null
                          else greatest(access_until, c.access_until) end
    where id = m.id;
  else
    insert into memberships(org_id, user_id, role, status, level, access_until, display_name)
    values (c.org_id, auth.uid(), level_role(v_level), 'active', v_level, c.access_until, c.invitee_name)
    returning id into mid;
  end if;

  -- New invites carry their tasks, already checked. Older ones may name only a preset.
  caps := coalesce(c.capabilities, '{}');
  if cardinality(caps) = 0 and c.preset is not null and not is_all_access_level(v_level) then
    caps := array(select permission_key from permission_presets where preset = c.preset);
  end if;
  insert into membership_permissions(membership_id, permission_key, granted_by)
  select mid, k, c.created_by from unnest(caps) as k
   where k in (select key from permissions)
  on conflict do nothing;

  update invite_codes set used_count = used_count + 1 where id = c.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (c.org_id, auth.uid(), 'redeem_invite_code', 'membership', mid::text,
          jsonb_build_object('code', c.code, 'level', v_level, 'access_until', c.access_until));
  return mid;
end $$;

create or replace function redeem_master_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c invite_codes; mid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into c from invite_codes where code = p_code and kind = 'master' for update;
  if not found then raise exception 'Invalid master code'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Code expired'; end if;
  if c.used_count >= c.max_uses then raise exception 'Code already used'; end if;
  insert into memberships(org_id, user_id, role, status, level)
  values (c.org_id, auth.uid(), 'owner', 'active', 'founder')
  on conflict (org_id, user_id) do update set role = 'owner', status = 'active', level = 'founder', access_until = null
  returning id into mid;
  update invite_codes set used_count = used_count + 1 where id = c.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (c.org_id, auth.uid(), 'redeem_master_code', 'membership', mid::text,
          jsonb_build_object('code_id', c.id));
  return mid;
end $$;

create or replace function open_invites(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'staff.invite')
    then coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', i.code, 'role', i.role, 'level', i.level, 'preset', i.preset,
               'capabilities', to_jsonb(i.capabilities), 'access_until', i.access_until,
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

-- Part 6 — the Team list shows when someone's access ends
drop function if exists list_team(uuid);
create function list_team(p_org uuid)
returns table (
  membership_id uuid, user_id uuid, email text, role membership_role, status membership_status,
  level text, display_name text, title text, created_at timestamptz, can_manage boolean, access_until date
) language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, u.email::text, m.role, m.status, m.level, m.display_name, m.title, m.created_at,
         can_manage_member(m.id), m.access_until
    from memberships m
    join auth.users u on u.id = m.user_id
   where m.org_id = p_org and is_org_member(p_org)
   order by level_rank(m.level) desc, m.created_at;
$$;
grant execute on function list_team(uuid) to authenticated;

-- Staff who open "My volunteer hours" for the first time: Volunteer 3 and up
-- are trusted (their logged hours count straight away).
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
            case when m.level in ('volunteer1', 'volunteer2') then 'standard' else 'trusted' end,
            (now() at time zone 'America/New_York')::date, 'OHRR team member', 'approved')
    returning * into v;
  end if;
  return v.access_token;
end $$;
grant execute on function my_staff_volunteer_page(uuid) to authenticated;
