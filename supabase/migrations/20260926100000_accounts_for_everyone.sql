-- =============================================================
-- Update 31 (2026-09-26): one account for everyone — supporters and staff.
--
-- OHRR (2026-09-26): "enter your information and save things like favorites,
-- my bunny etc. Also have a be notified for volunteering, emails about events
-- etc." … "have the account use a password option that they can change. Some
-- staff will be users also so the same process and the same application except
-- the invite code is only for staff sign ups. So I am a user and save bunny
-- info etc. Then I decide to volunteer and get an invite code. I accept and
-- then nothing is different on my login except the features I can see."
--
-- So anyone can create an account (email and a password they can change; sign
-- up is already on and needs no confirmation email). What they save lives
-- here, only readable by them. An invite code still only adds a membership —
-- the same login then sees the staff features too.
--
--   user_profiles  their name
--   user_saves     favourites, saved BunFest sessions, My Bunny (no photos),
--                  what they've already seen — one JSON document per kind,
--                  written through save_my_data() so the size is capped
--   mailing_list   who wants OHRR's emails and about what; filled from the
--                  app (signed in or not) and the website's email form; one
--                  unsubscribe link per address; staff with the new
--                  "supporters.view" task can see and download it
--
-- A sign-up email is NOT confirmed (Supabase sends no email here), so nothing
-- is ever looked up by someone's email — no bookings or volunteer records are
-- shown to an account just because the address matches.
-- Safe to run more than once.
-- =============================================================

-- Part 1 — who may see the list (founders and developers already can)
insert into permissions(key, area, description) values
 ('supporters.view', 'Supporters', 'See and download the supporter email list')
on conflict (key) do nothing;

-- Part 2 — a person's name
create table if not exists public.user_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text check (name is null or length(name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated before update on public.user_profiles
  for each row execute function set_updated_at();
alter table public.user_profiles enable row level security;
drop policy if exists user_profiles_own on public.user_profiles;
create policy user_profiles_own on public.user_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_profiles from anon;
grant select, insert, update, delete on public.user_profiles to authenticated;

-- Part 3 — what they've saved
create table if not exists public.user_saves (
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('follows', 'sessions', 'mybunny', 'seen', 'settings')),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.user_saves enable row level security;
drop policy if exists user_saves_own_select on public.user_saves;
create policy user_saves_own_select on public.user_saves for select using (user_id = auth.uid());
drop policy if exists user_saves_own_delete on public.user_saves;
create policy user_saves_own_delete on public.user_saves for delete using (user_id = auth.uid());
revoke all on public.user_saves from anon;
grant select, delete on public.user_saves to authenticated;

create or replace function save_my_data(p_kind text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_kind not in ('follows', 'sessions', 'mybunny', 'seen', 'settings') then raise exception 'Unknown kind'; end if;
  if pg_column_size(coalesce(p_data, '{}'::jsonb)) > 1000000 then
    raise exception 'That is too much to save at once. Photos stay on this phone; use Backup for them.';
  end if;
  insert into user_saves (user_id, kind, data, updated_at)
  values (auth.uid(), p_kind, coalesce(p_data, '{}'::jsonb), v_at)
  on conflict (user_id, kind) do update set data = excluded.data, updated_at = excluded.updated_at;
  return v_at;
end $$;
grant execute on function save_my_data(text, jsonb) to authenticated;

-- Part 4 — the email list
create table if not exists public.mailing_list (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  email             text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name              text,
  interests         text[] not null default '{}',
  source            text,
  user_id           uuid references auth.users(id) on delete set null,
  consent_at        timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, email)
);
create index if not exists idx_mailing_list_user on public.mailing_list(user_id);
drop trigger if exists trg_mailing_list_updated on public.mailing_list;
create trigger trg_mailing_list_updated before update on public.mailing_list
  for each row execute function set_updated_at();
alter table public.mailing_list enable row level security;
drop policy if exists mailing_list_select on public.mailing_list;
create policy mailing_list_select on public.mailing_list for select
  using (user_id = auth.uid() or has_permission(org_id, 'supporters.view'));
revoke all on public.mailing_list from anon;
grant select on public.mailing_list to authenticated;

-- The interests people can pick. Anything else is dropped.
create or replace function clean_interests(p text[]) returns text[]
language sql immutable as $$
  select coalesce(array(
    select distinct x from unnest(coalesce(p, '{}')) x
     where x in ('volunteer', 'events', 'bunfest', 'adoptions', 'hopshop', 'newsletter')
     order by x), '{}');
$$;

-- The website form and the app when not signed in. Adds interests, never
-- removes them (anyone can type any address), and says nothing about whether
-- the address was already on the list.
create or replace function join_mailing_list(
  p_name text, p_email text, p_interests text[], p_source text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_int   text[] := clean_interests(p_interests);
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please check your email address.'; end if;
  if cardinality(v_int) = 0 then v_int := '{newsletter}'; end if;
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if exists (select 1 from mailing_list where org_id = v_org and email = v_email
               and updated_at > now() - interval '1 minute') then
    return;  -- a double tap
  end if;
  insert into mailing_list (org_id, email, name, interests, source)
  values (v_org, v_email, nullif(left(btrim(coalesce(p_name, '')), 120), ''), v_int, left(coalesce(p_source, ''), 20))
  on conflict (org_id, email) do update set
    interests       = clean_interests(mailing_list.interests || excluded.interests),
    name            = coalesce(mailing_list.name, excluded.name),
    unsubscribed_at = null,
    consent_at      = now();
end $$;
grant execute on function join_mailing_list(text, text, text[], text) to anon, authenticated;

-- A signed-in person's own choices (their account's address; replaces them).
create or replace function save_my_email_prefs(p_interests text[], p_subscribed boolean, p_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org   uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'Your account has no email.'; end if;
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if not coalesce(p_subscribed, false) then
    update mailing_list set unsubscribed_at = coalesce(unsubscribed_at, now()), user_id = auth.uid()
     where org_id = v_org and email = v_email;
    return;
  end if;
  insert into mailing_list (org_id, email, name, interests, source, user_id)
  values (v_org, v_email, nullif(left(btrim(coalesce(p_name, '')), 120), ''), clean_interests(p_interests), 'account', auth.uid())
  on conflict (org_id, email) do update set
    interests       = clean_interests(excluded.interests),
    name            = coalesce(excluded.name, mailing_list.name),
    user_id         = auth.uid(),
    unsubscribed_at = null,
    consent_at      = case when mailing_list.unsubscribed_at is null then mailing_list.consent_at else now() end;
end $$;
grant execute on function save_my_email_prefs(text[], boolean, text) to authenticated;

-- The unsubscribe link in every email: /emails/<token>. Shows the address
-- half-hidden, lets them change what they get or leave the list.
create or replace function email_prefs_by_token(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email', left(m.email, 2) || '•••' || substr(m.email, position('@' in m.email)),
    'interests', to_jsonb(m.interests),
    'subscribed', m.unsubscribed_at is null)
    from mailing_list m where m.unsubscribe_token = p_token;
$$;
grant execute on function email_prefs_by_token(uuid) to anon, authenticated;

create or replace function set_email_prefs_by_token(p_token uuid, p_interests text[], p_subscribed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from mailing_list where unsubscribe_token = p_token) then
    raise exception 'That link isn’t valid any more.';
  end if;
  update mailing_list set
    interests       = case when coalesce(p_subscribed, false) then clean_interests(p_interests) else interests end,
    unsubscribed_at = case when coalesce(p_subscribed, false) then null else coalesce(unsubscribed_at, now()) end
  where unsubscribe_token = p_token;
end $$;
grant execute on function set_email_prefs_by_token(uuid, text[], boolean) to anon, authenticated;

-- Everyone who already joined the mailing list through the Inbox form.
insert into public.mailing_list (org_id, email, name, interests, source, consent_at)
select distinct on (r.org_id, lower(btrim(r.email)))
       r.org_id, lower(btrim(r.email)), nullif(btrim(coalesce(r.name, '')), ''), '{newsletter}', 'inbox', r.created_at
  from public.requests r
 where r.kind = 'mailing-list' and r.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
 order by r.org_id, lower(btrim(r.email)), r.created_at
on conflict (org_id, email) do nothing;

-- Part 5 — deleting your account takes you off the list too
create or replace function delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if exists (
    select 1 from memberships m
     where m.user_id = v_uid and m.role = 'owner' and m.status = 'active'
       and not exists (select 1 from memberships o
                        where o.org_id = m.org_id and o.user_id <> v_uid and o.role = 'owner' and o.status = 'active')
  ) then
    raise exception 'You are the only founder or developer — make someone else one first.';
  end if;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  select m.org_id, null, 'account.deleted', 'user', v_uid::text, '{}'::jsonb from memberships m where m.user_id = v_uid;
  delete from mailing_list where user_id = v_uid;
  -- Every public table that points at auth.users: the person's own rows go
  -- (NOT NULL columns such as memberships.user_id), references on shared
  -- content (created_by, updated_by, paid_by, …) are cleared so the content
  -- stays. Then the auth row itself; Supabase cascades sessions/identities.
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as notnull
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.connamespace = 'public'::regnamespace
  loop
    if r.notnull then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_uid;
    else
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v_uid;
    end if;
  end loop;
  delete from auth.users where id = v_uid;
end $$;
grant execute on function delete_own_account() to authenticated;
