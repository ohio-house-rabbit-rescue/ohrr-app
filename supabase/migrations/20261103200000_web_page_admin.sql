-- =============================================================
-- Update 54 (2026-11-03): the "Web page admin" task.
--
-- Staff → Web page design changes how the app AND the website look (colors,
-- background pictures, the home page sections). It is saved in app_settings under
-- keys that start with "design_" (design_site, design_history).
--
-- WHO MAY: Founders and Developers, and any staff member given the new task
-- "Web page admin" (site.design). Board and the other admin roles hold every
-- other task automatically, but NOT this one: it has to be given on purpose.
-- Giving it follows the usual rule (you can only share tasks you hold; a Founder
-- or Developer can share it with anyone below).
--
-- The task also lets that person upload pictures to the site-images bucket (the
-- design's background pictures live there), as "Post announcements" already does.
--
-- Apply AFTER update 53 (remove_member). Paste + Run in the Supabase SQL editor.
-- Idempotent.
-- =============================================================

-- 1. The task, and a ready-made bundle for the invite screen
insert into permissions(key, area, description) values
 ('site.design', 'Web page admin', 'Change how the app and website look: colors, background pictures, and the home page sections')
on conflict (key) do nothing;

insert into permission_presets(preset, permission_key) values
 ('Web Page Admin', 'site.design')
on conflict do nothing;

-- 2. Who may edit the design (never through the "owner and admin hold everything" shortcut)
create or replace function can_edit_design(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(is_all_access_level(my_level(p_org)), false)
      or exists (
        select 1
          from memberships m
          join membership_permissions mp on mp.membership_id = m.id
         where m.org_id = p_org
           and m.user_id = auth.uid()
           and m.status = 'active'
           and m.role = 'staff'
           and mp.permission_key = 'site.design'
           and (m.access_until is null or m.access_until >= (now() at time zone 'America/New_York')::date)
      );
$$;
grant execute on function can_edit_design(uuid) to authenticated;

-- 3. app_settings: keys starting "design_" need the design task; the rest is as before
create or replace function can_set_app_setting(p_org uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_key like '%\_enabled' escape '\' then coalesce(is_all_access_level(my_level(p_org)), false)
    when p_key like 'design\_%' escape '\' then can_edit_design(p_org)
    else has_permission(p_org, 'settings.manage')
  end;
$$;
grant execute on function can_set_app_setting(uuid, text) to authenticated;

-- 4. Pictures: whoever posts announcements, or edits the design, may add to site-images
drop policy if exists "site images staff insert" on storage.objects;
create policy "site images staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.has_permission(m.org_id, 'announcements.post') or public.can_edit_design(m.org_id))
    )
  );

drop policy if exists "site images staff update" on storage.objects;
create policy "site images staff update" on storage.objects for update to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.has_permission(m.org_id, 'announcements.post') or public.can_edit_design(m.org_id))
    )
  );

drop policy if exists "site images staff delete" on storage.objects;
create policy "site images staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.has_permission(m.org_id, 'announcements.post') or public.can_edit_design(m.org_id))
    )
  );
