-- =============================================================
-- OHRR — update 26: social posts need a second person's approval
--
-- OHRR (2026-09-24): "on the social media generation portion. lets set up a
-- user level authority and then also an approval requirement. so i can
-- generate the socials text etc and then i save it for another user to stamp
-- approved."
--
-- Part 1 A new permission, "Approve social posts" (social.approve), granted
--        person by person in Staff → Team.
-- Part 2 A post goes: draft → waiting for approval ('submitted') → approved →
--        posted. Only someone with social.approve who did NOT write it can
--        approve it; they can also send it back with a note. Only an approved
--        post can be marked posted.
-- Part 3 The rules hold whatever screen is used: a status can only change
--        through set_social_post_status(), a new post always starts as a draft
--        or waiting for approval, and changing the words, picture or platforms
--        of an approved post sends it back for approval.
--
-- Safe to run more than once. Paste + Run after update 25.
-- =============================================================

-- Part 1: the permission
insert into permissions(key, area, description) values
 ('social.approve', 'Content', 'Approve social-media posts written by someone else')
on conflict (key) do nothing;
insert into permission_presets(preset, permission_key) values ('Content Approver', 'social.approve')
on conflict do nothing;

-- An approver who doesn't write posts still needs to see them (and may fix a typo).
drop policy if exists social_posts_select on social_posts;
create policy social_posts_select on social_posts for select
  using (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish')
         or has_permission(org_id, 'social.approve'));
drop policy if exists social_posts_update on social_posts;
create policy social_posts_update on social_posts for update
  using (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish')
         or has_permission(org_id, 'social.approve'))
  with check (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish')
              or has_permission(org_id, 'social.approve'));

-- Part 2: waiting for approval, and a note when a post is sent back
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.social_posts'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.social_posts drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.social_posts add constraint social_posts_status_check
  check (status in ('draft', 'submitted', 'approved', 'posted', 'archived'));
alter table public.social_posts add column if not exists submitted_by uuid references auth.users(id) on delete set null;
alter table public.social_posts add column if not exists submitted_at timestamptz;
alter table public.social_posts add column if not exists review_note  text;

create or replace function set_social_post_status(
  p_id uuid, p_status text, p_posted_to text[] default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  r social_posts;
  can_write boolean;
begin
  select * into r from social_posts where id = p_id;
  if not found then raise exception 'No such post'; end if;
  if p_status not in ('draft', 'submitted', 'approved', 'posted', 'archived') then raise exception 'Bad status'; end if;
  can_write := has_permission(r.org_id, 'announcements.post') or has_permission(r.org_id, 'social.publish');

  if p_status = 'approved' then
    if not has_permission(r.org_id, 'social.approve') then
      raise exception 'Approving posts needs the “Approve social posts” permission (Staff → Team).';
    end if;
    -- Not the writer, nor whoever last sent it in (an approver who changed the
    -- words of an approved post is sending in their own words).
    if r.created_by = auth.uid() or r.submitted_by = auth.uid() then
      raise exception 'Someone else needs to approve a post you wrote or changed.';
    end if;
    if r.status not in ('submitted', 'draft') then raise exception 'Only a post waiting for approval can be approved.'; end if;
  elsif p_status = 'posted' then
    if not has_permission(r.org_id, 'social.publish') then
      raise exception 'Only the person with posting rights can mark a post as posted.';
    end if;
    if r.status <> 'approved' then raise exception 'This post hasn’t been approved yet.'; end if;
  elsif p_status = 'draft' and r.status = 'submitted' and nullif(btrim(coalesce(p_note, '')), '') is not null then
    -- Sent back with a note: the reviewer's call.
    if not has_permission(r.org_id, 'social.approve') then raise exception 'Not allowed'; end if;
  else
    if not (can_write or has_permission(r.org_id, 'social.approve')) then raise exception 'Not allowed'; end if;
  end if;

  perform set_config('ohrr.post_status', 'on', true);
  update social_posts set
    status       = p_status,
    submitted_by = case when p_status = 'submitted' then auth.uid() else submitted_by end,
    submitted_at = case when p_status = 'submitted' then now() else submitted_at end,
    approved_by  = case when p_status = 'approved' then auth.uid()
                        when p_status in ('draft', 'submitted') then null else approved_by end,
    approved_at  = case when p_status = 'approved' then now()
                        when p_status in ('draft', 'submitted') then null else approved_at end,
    review_note  = case when p_status = 'draft' then nullif(btrim(coalesce(p_note, '')), '')
                        when p_status in ('submitted', 'approved') then null else review_note end,
    posted_by    = case when p_status = 'posted' then auth.uid() else posted_by end,
    posted_at    = case when p_status = 'posted' then now() else posted_at end,
    posted_to    = case when p_status = 'posted' then coalesce(p_posted_to, platforms) else posted_to end
  where id = p_id;
  perform set_config('ohrr.post_status', 'off', true);

  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'social.' || p_status, 'social_post', p_id::text,
          jsonb_build_object('title', r.title, 'note', nullif(btrim(coalesce(p_note, '')), '')));
end $$;
grant execute on function set_social_post_status(uuid, text, text[], text) to authenticated;
-- The old three-argument version would skip the new rules.
drop function if exists set_social_post_status(uuid, text, text[]);

-- Part 3: the rules hold on every screen
create or replace function social_posts_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then new.status := 'draft'; end if;
    new.approved_by := null;
    new.approved_at := null;
    new.posted_by := null;
    new.posted_at := null;
    if new.status = 'submitted' then
      new.submitted_by := auth.uid();
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if coalesce(current_setting('ohrr.post_status', true), 'off') <> 'on' then
    -- Status and sign-offs change only through set_social_post_status().
    if new.status is distinct from old.status
       or new.approved_by is distinct from old.approved_by
       or new.posted_by is distinct from old.posted_by then
      raise exception 'Use Send for approval / Approve / Mark as posted to change a post’s status.';
    end if;
    -- New words or a new picture on an approved post need a fresh approval.
    if old.status = 'approved'
       and (new.caption, new.title, new.image_url, new.platforms)
           is distinct from (old.caption, old.title, old.image_url, old.platforms) then
      new.status := 'submitted';
      new.approved_by := null;
      new.approved_at := null;
      new.submitted_by := auth.uid();
      new.submitted_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_social_posts_guard on public.social_posts;
create trigger trg_social_posts_guard before insert or update on public.social_posts
  for each row execute function social_posts_guard();

-- Approvers see how many posts are waiting for them (not their own).
create or replace function count_posts_to_approve(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'social.approve')
              then (select count(*)::int from social_posts
                     where org_id = p_org and status = 'submitted'
                       and created_by is distinct from auth.uid()
                       and submitted_by is distinct from auth.uid())
              else 0 end;
$$;
grant execute on function count_posts_to_approve(uuid) to authenticated;
