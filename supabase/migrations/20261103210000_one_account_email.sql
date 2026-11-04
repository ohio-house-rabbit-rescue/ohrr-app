-- =============================================================
-- Update 55 (2026-11-03): one person, one account — customer and staff.
--
-- A customer who becomes staff keeps the SAME login and email (an invitation only adds
-- staff features to it). Two small closings of that:
--
--  1. The Team list now also carries the name the person gave as a customer
--     (account_name), so a merged person shows by name, not only by email, even when
--     the invitation had no name. Only people who are on the team are listed; other
--     customers are never shown.
--  2. An invitation that was made for an email address can only be used by the account
--     with that email. (Invitations made without an email work as before.) If the
--     address was typed wrong, fix it on Team -> the waiting invitation, or make a new one.
--
-- Run AFTER update 54. Safe to run twice.
-- =============================================================

-- 1. Team list (adds account_name at the end)
drop function if exists list_team(uuid);
create function list_team(p_org uuid)
returns table (
  membership_id uuid, user_id uuid, email text, role membership_role, status membership_status,
  level text, display_name text, title text, created_at timestamptz, can_manage boolean, access_until date,
  account_name text
) language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, u.email::text, m.role, m.status, m.level, m.display_name, m.title, m.created_at,
         can_manage_member(m.id), m.access_until,
         p.name
    from memberships m
    join auth.users u on u.id = m.user_id
    left join user_profiles p on p.user_id = m.user_id
   where m.org_id = p_org and is_org_member(p_org)
   order by level_rank(m.level) desc, m.created_at;
$$;
grant execute on function list_team(uuid) to authenticated;

-- 2. Redeeming an invitation (as before, plus the email check)
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

  -- One person, one email: an invitation made for an email address is for the account that
  -- uses that address (the one they may already have as a customer). It never says which one.
  if c.invitee_email is not null
     and c.invitee_email <> coalesce((select lower(u.email) from auth.users u where u.id = auth.uid()), '') then
    raise exception 'This invitation was made for a different email address. Sign in with the email it was sent to, or ask for a new invitation.';
  end if;

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
grant execute on function redeem_invite_code(text) to authenticated;
