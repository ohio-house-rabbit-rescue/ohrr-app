-- Update 53 — remove someone from the team (Staff → Team → Edit details → Remove from the team).
--
-- Same rules as putting someone on hold (set_membership_status):
--   * you need the "manage permissions" task,
--   * only people below your own level (a founder may also remove a founder),
--   * never yourself, and never the last active founder.
-- Their login stays; only the team membership goes (their tasks go with it).
-- To bring them back, make them a new invite.

create or replace function remove_member(p_membership uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t memberships;
begin
  select * into t from memberships where id = p_membership;
  if not found then raise exception 'Membership not found'; end if;
  if not has_permission(t.org_id, 'staff.permissions.manage') then raise exception 'Not allowed'; end if;
  if not can_manage_member(p_membership) then raise exception 'You can only change people below your own level.'; end if;
  if t.level = 'founder' and t.status = 'active'
     and (select count(*) from memberships where org_id = t.org_id and level = 'founder' and status = 'active') <= 1 then
    raise exception 'OHRR needs at least one founder.';
  end if;
  delete from memberships where id = p_membership;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'remove_member', 'membership', p_membership::text,
          jsonb_build_object('level', t.level, 'role', t.role, 'user_id', t.user_id));
end $$;
grant execute on function remove_member(uuid) to authenticated;
