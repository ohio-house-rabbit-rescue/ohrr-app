-- =============================================================
-- OHRR App — Staff admin extras
--
-- Adds list_org_members(): a SECURITY DEFINER function so the Team screen can show
-- member EMAILS. The Supabase client cannot read auth.users directly (other users'
-- emails are private), so this function — running with definer rights and gated to
-- the caller's own org — is the supported way to surface them in the admin UI.
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent (create or replace).
-- =============================================================

create or replace function list_org_members(p_org uuid)
returns table (
  membership_id uuid,
  user_id       uuid,
  email         text,
  role          membership_role,
  status        membership_status,
  created_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, u.email::text, m.role, m.status, m.created_at
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org
    and is_org_member(p_org)        -- caller must be an active member of this org
  order by m.created_at;
$$;

grant execute on function list_org_members(uuid) to authenticated;
