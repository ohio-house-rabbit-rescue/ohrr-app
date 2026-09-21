-- =============================================================
-- OHRR — Post queue: premade social posts, released by one person
--
-- Anyone with `announcements.post` drafts posts (a Share-kit card or their
-- own photo + caption), picks the platforms and a "post on" date, and marks
-- them approved. The person holding `social.publish` sees what is ready,
-- taps Share (the phone's share sheet → Instagram / Facebook / TikTok, all
-- logged in as OHRR on that phone) and marks the post as posted. No social-
-- media APIs, no scheduler subscription — the queue is the database, the
-- publishing is a tap.
--
-- Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

insert into permissions(key, area, description) values
 ('social.publish', 'Content', 'Release queued social-media posts (the one person who posts as OHRR)')
on conflict (key) do nothing;

create table if not exists social_posts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  title         text not null,                 -- what the queue shows: "Meet Clover", "Easter: 10-year pet"
  caption       text not null default '',
  image_url     text,                          -- public URL in the social-images bucket (or any public image)
  image_alt     text,
  platforms     text[] not null default '{instagram,facebook}',  -- instagram | facebook | tiktok | other
  scheduled_for date,                          -- null = whenever
  status        text not null default 'draft'
                check (status in ('draft', 'approved', 'posted', 'archived')),
  source        text,                          -- 'kit:rabbit:<id>' | 'kit:edu:<id>' | 'upload' | 'website'
  notes         text,                          -- for the poster: "post to Stories too"
  created_by    uuid references auth.users(id),
  approved_by   uuid references auth.users(id),
  approved_at   timestamptz,
  posted_by     uuid references auth.users(id),
  posted_at     timestamptz,
  posted_to     text[],                        -- where it actually went
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_social_posts_org on social_posts(org_id, status, scheduled_for, created_at desc);

drop trigger if exists trg_social_posts_updated on social_posts;
create trigger trg_social_posts_updated before update on social_posts
  for each row execute function set_updated_at();

alter table social_posts enable row level security;

drop policy if exists social_posts_select on social_posts;
create policy social_posts_select on social_posts for select
  using (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish'));
drop policy if exists social_posts_insert on social_posts;
create policy social_posts_insert on social_posts for insert
  with check (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish'));
drop policy if exists social_posts_update on social_posts;
create policy social_posts_update on social_posts for update
  using (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish'))
  with check (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish'));
drop policy if exists social_posts_delete on social_posts;
create policy social_posts_delete on social_posts for delete
  using (has_permission(org_id, 'announcements.post') or has_permission(org_id, 'social.publish'));

grant select, insert, update, delete on social_posts to authenticated;

-- Status changes go through here so "posted" is reserved for social.publish.
create or replace function set_social_post_status(p_id uuid, p_status text, p_posted_to text[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r social_posts;
begin
  select * into r from social_posts where id = p_id;
  if not found then raise exception 'No such post'; end if;
  if p_status not in ('draft', 'approved', 'posted', 'archived') then raise exception 'Bad status'; end if;
  if p_status = 'posted' then
    if not has_permission(r.org_id, 'social.publish') then raise exception 'Only the person with posting rights can mark a post as posted'; end if;
  else
    if not (has_permission(r.org_id, 'announcements.post') or has_permission(r.org_id, 'social.publish')) then raise exception 'Not allowed'; end if;
  end if;
  update social_posts set
    status = p_status,
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    posted_by   = case when p_status = 'posted' then auth.uid() else posted_by end,
    posted_at   = case when p_status = 'posted' then now() else posted_at end,
    posted_to   = case when p_status = 'posted' then coalesce(p_posted_to, platforms) else posted_to end
  where id = p_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'social.' || p_status, 'social_post', p_id::text, jsonb_build_object('title', r.title));
end $$;
grant execute on function set_social_post_status(uuid, text, text[]) to authenticated;

-- Approved posts whose day has come (or that have no day) — the dashboard badge.
create or replace function count_ready_posts(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'announcements.post') or has_permission(p_org, 'social.publish')
              then (select count(*)::int from social_posts
                     where org_id = p_org and status = 'approved'
                       and (scheduled_for is null or scheduled_for <= (now() at time zone 'America/New_York')::date))
              else 0 end;
$$;
grant execute on function count_ready_posts(uuid) to authenticated;

-- Images for queued posts (public bucket; upload needs content rights).
insert into storage.buckets (id, name, public)
values ('social-images', 'social-images', true)
on conflict (id) do nothing;

drop policy if exists "social images public read" on storage.objects;
create policy "social images public read" on storage.objects for select
  using (bucket_id = 'social-images');

drop policy if exists "social images staff insert" on storage.objects;
create policy "social images staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'social-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.has_permission(m.org_id, 'announcements.post') or public.has_permission(m.org_id, 'social.publish'))
    )
  );

drop policy if exists "social images staff delete" on storage.objects;
create policy "social images staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'social-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and (public.has_permission(m.org_id, 'announcements.post') or public.has_permission(m.org_id, 'social.publish'))
    )
  );
