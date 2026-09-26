-- =============================================================
-- Update 32 (2026-09-26): wish-list items, My Bunny photos on the account,
-- rabbits kept up to date from RescueGroups every morning, and phone
-- notifications (web push).
--
-- OHRR: "build the things you can and then lets also do 2 [push] and 7".
--
--   wish_list_items   items from OHRR's Amazon wish list, each with its own
--                     Amazon link (Amazon won't let a program read the list,
--                     so staff paste them in; the whole-list button stays)
--   my-bunny-photos   a private storage bucket: each person's My Bunny photos,
--                     in a folder only they can reach
--   rabbits           a daily look at OHRR's RescueGroups listing: new rabbits
--                     are added; a rabbit no longer listed is hidden (not
--                     marked adopted — staff decide) until it's listed again
--   push_*            who asked for which notifications on which phone, and the
--                     messages; a new volunteer call, event or rabbit sends one
--                     automatically, and staff can write one
--
-- The sending and the RescueGroups check happen in one Edge Function,
-- "ohrr-jobs" (supabase/functions/ohrr-jobs; deploy it with Verify JWT OFF).
-- The database calls it with pg_net and a shared secret made here; its
-- web-push keys are made by the function itself the first time and kept in
-- push_config, which only the database and the function can read.
-- Safe to run more than once.
-- =============================================================

-- Part 1 — two new tasks (founders and developers already have them)
insert into permissions(key, area, description) values
 ('giving.wishlist', 'Giving', 'Keep the Amazon wish list items'),
 ('notifications.send', 'Supporters', 'Send phone notifications to people who asked for them')
on conflict (key) do nothing;

-- Part 2 — wish-list items
create table if not exists public.wish_list_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 160),
  amazon_url   text not null check (amazon_url ~* '^https://([a-z0-9-]+\.)*(amazon\.com|a\.co|amzn\.to)/'),
  note         text check (note is null or length(note) <= 300),
  most_needed  boolean not null default false,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_wish_list_items on public.wish_list_items(org_id, sort_order);
drop trigger if exists trg_wish_list_items_updated on public.wish_list_items;
create trigger trg_wish_list_items_updated before update on public.wish_list_items
  for each row execute function set_updated_at();
alter table public.wish_list_items enable row level security;
drop policy if exists wish_list_items_select on public.wish_list_items;
create policy wish_list_items_select on public.wish_list_items for select
  using (is_published or has_permission(org_id, 'giving.wishlist'));
drop policy if exists wish_list_items_write on public.wish_list_items;
create policy wish_list_items_write on public.wish_list_items for all
  using (has_permission(org_id, 'giving.wishlist')) with check (has_permission(org_id, 'giving.wishlist'));
grant select on public.wish_list_items to anon, authenticated;
grant insert, update, delete on public.wish_list_items to authenticated;

-- Part 3 — My Bunny photos, one private folder per person (<user id>/<bunny id>.jpg)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('my-bunny-photos', 'my-bunny-photos', false, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "my bunny photos own read" on storage.objects;
create policy "my bunny photos own read" on storage.objects for select to authenticated
  using (bucket_id = 'my-bunny-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "my bunny photos own insert" on storage.objects;
create policy "my bunny photos own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'my-bunny-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "my bunny photos own update" on storage.objects;
create policy "my bunny photos own update" on storage.objects for update to authenticated
  using (bucket_id = 'my-bunny-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "my bunny photos own delete" on storage.objects;
create policy "my bunny photos own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'my-bunny-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Part 4 — rabbits from RescueGroups
alter table public.rabbits add column if not exists source_seen_at       timestamptz;
alter table public.rabbits add column if not exists source_missing_since timestamptz;
alter table public.rabbits add column if not exists auto_hidden          boolean not null default false;

create table if not exists public.job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  ok          boolean not null,
  detail      jsonb not null default '{}'::jsonb
);
create index if not exists idx_job_runs on public.job_runs(job, finished_at desc);
alter table public.job_runs enable row level security;
drop policy if exists job_runs_staff on public.job_runs;
create policy job_runs_staff on public.job_runs for select
  using (exists (select 1 from memberships m where m.user_id = auth.uid() and m.status = 'active'));
revoke all on public.job_runs from anon;
grant select on public.job_runs to authenticated;

create or replace function sync_rescuegroups_rabbits(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid;
  r        jsonb;
  n        int := 0;
  v_max    int;
  v_seen   text[] := '{}';
  v_added  text[] := '{}';
  v_back   text[] := '{}';
  v_hidden text[] := '{}';
  v_was    boolean;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then raise exception 'No OHRR organisation'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rabbits in the listing — nothing changed';
  end if;
  select coalesce(max(sort_order), 0) into v_max from rabbits where org_id = v_org;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    v_seen := v_seen || (r->>'source_id');
    -- An adopted rabbit stays as staff left it, even if it's listed again.
    select auto_hidden and status <> 'Adopted' into v_was from rabbits where org_id = v_org and source_id = r->>'source_id';
    if found then
      -- Staff edits stay; only "is it still listed?" is looked after here.
      update rabbits set
        source_seen_at       = now(),
        source_missing_since = null,
        is_published         = case when auto_hidden and status <> 'Adopted' then true else is_published end,
        auto_hidden          = false
      where org_id = v_org and source_id = r->>'source_id';
      if v_was then v_back := v_back || (r->>'name'); end if;
    else
      insert into rabbits (org_id, source_id, name, status, sex, age, breed, size, spayed_neutered,
                           house_trained, bonded, description, tags, photos, sort_order, is_published, source_seen_at)
      values (v_org, r->>'source_id', r->>'name', coalesce(r->>'status', 'Available'),
              r->>'sex', r->>'age', r->>'breed', r->>'size',
              true,  -- OHRR's adoption policy: every OHRR rabbit is spayed or neutered
              coalesce((r->>'house_trained')::boolean, false), coalesce((r->>'bonded')::boolean, false),
              r->>'description',
              coalesce(array(select jsonb_array_elements_text(coalesce(r->'tags', '[]'::jsonb))), '{}'),
              coalesce(array(select jsonb_array_elements_text(coalesce(r->'photos', '[]'::jsonb))), '{}'),
              v_max + n * 10, coalesce(r->>'status', 'Available') <> 'Adopted', now());
      v_added := v_added || (r->>'name');
    end if;
  end loop;
  -- No longer listed: hidden until staff decide (or it comes back), never marked adopted.
  with h as (
    update rabbits set
      source_missing_since = coalesce(source_missing_since, now()),
      auto_hidden          = true,
      is_published         = false
    where org_id = v_org and source_id like 'rescuegroups:%' and not (source_id = any (v_seen))
      and is_published and status <> 'Adopted'
    returning name
  )
  select coalesce(array_agg(name), '{}') into v_hidden from h;
  if cardinality(v_added) > 0 then
    insert into push_messages (org_id, topic, title, body, url, dedupe_key)
    values (v_org, 'adoptions',
            case when cardinality(v_added) = 1 then 'New rabbit up for adoption' else 'New rabbits up for adoption' end,
            'Meet ' || array_to_string(v_added, ', ') || '.', '/adopt',
            'rabbits:' || (now() at time zone 'America/New_York')::date)
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('listed', n, 'added', to_jsonb(v_added), 'back', to_jsonb(v_back), 'hidden', to_jsonb(v_hidden));
end $$;
revoke execute on function sync_rescuegroups_rabbits(jsonb) from public, anon, authenticated;
grant execute on function sync_rescuegroups_rabbits(jsonb) to service_role;

-- Part 5 — notifications
create extension if not exists pg_net;

create table if not exists public.push_config (
  id             int primary key default 1 check (id = 1),
  public_key     text,
  private_key    text,
  trigger_secret text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  function_url   text not null default 'https://ixxzebtzjgeimoijexwn.supabase.co/functions/v1/ohrr-jobs',
  updated_at     timestamptz not null default now()
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;  -- no policies: the database and the function only
revoke all on public.push_config from anon, authenticated;

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  topics       text[] not null default '{}',
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_sent_at timestamptz,
  fail_count   int not null default 0
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_topics on public.push_subscriptions using gin (topics);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for select using (user_id = auth.uid());
revoke all on public.push_subscriptions from anon;
grant select on public.push_subscriptions to authenticated;

create table if not exists public.push_messages (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organizations(id) on delete cascade,
  topic        text not null,
  title        text not null check (length(title) between 1 and 120),
  body         text check (body is null or length(body) <= 400),
  url          text,
  dedupe_key   text unique,
  only_user    uuid references auth.users(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  sent_count   int,
  failed_count int
);
create index if not exists idx_push_messages on public.push_messages(org_id, created_at desc);
alter table public.push_messages enable row level security;
drop policy if exists push_messages_staff on public.push_messages;
create policy push_messages_staff on public.push_messages for select
  using (org_id is not null and has_permission(org_id, 'notifications.send'));
revoke all on public.push_messages from anon;
grant select on public.push_messages to authenticated;

create or replace function clean_push_topics(p text[]) returns text[]
language sql immutable as $$
  select coalesce(array(
    select distinct x from unnest(coalesce(p, '{}')) x
     where x in ('volunteer', 'events', 'adoptions', 'bunfest', 'news')
     order by x), '{}');
$$;

-- Wake the ohrr-jobs function (pg_net sends it in the background).
create or replace function call_ohrr_jobs(p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c push_config;
begin
  select * into c from push_config where id = 1;
  if not found then return; end if;
  perform net.http_post(
    url := c.function_url,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ohrr-secret', c.trigger_secret),
    timeout_milliseconds := 120000);  -- the RescueGroups check reads ~20 pages
end $$;
revoke execute on function call_ohrr_jobs(jsonb) from public, anon, authenticated;

create or replace function push_messages_send() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform call_ohrr_jobs(jsonb_build_object('action', 'push', 'id', new.id));
  return null;
end $$;
drop trigger if exists trg_push_messages_send on public.push_messages;
create trigger trg_push_messages_send after insert on public.push_messages
  for each row execute function push_messages_send();

-- The phone's side: its web-push key, and what it asked for.
create or replace function push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public_key from push_config where id = 1;
$$;
grant execute on function push_public_key() to anon, authenticated;

create or replace function init_push() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from push_config where id = 1 and public_key is not null) then return true; end if;
  perform call_ohrr_jobs('{"action": "init"}'::jsonb);
  return false;
end $$;
grant execute on function init_push() to anon, authenticated;

create or replace function save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_topics text[], p_user_agent text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- Only the browsers' own push services (Chrome/Android, Apple, Firefox, Edge),
  -- so nobody can point the sending at some other address.
  if p_endpoint is null or length(p_endpoint) > 1000 or p_endpoint !~*
     '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
  then raise exception 'Bad endpoint'; end if;
  if coalesce(length(p_p256dh), 0) not between 20 and 200 or coalesce(length(p_auth), 0) not between 8 and 100 then
    raise exception 'Bad keys';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, topics, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, clean_push_topics(p_topics), left(p_user_agent, 200))
  on conflict (endpoint) do update set
    p256dh     = excluded.p256dh,
    auth       = excluded.auth,
    topics     = excluded.topics,
    user_id    = coalesce(auth.uid(), push_subscriptions.user_id),
    user_agent = excluded.user_agent,
    fail_count = 0,
    updated_at = now();
end $$;
grant execute on function save_push_subscription(text, text, text, text[], text) to anon, authenticated;

create or replace function push_subscription_topics(p_endpoint text) returns text[]
language sql stable security definer set search_path = public as $$
  select topics from push_subscriptions where endpoint = p_endpoint;
$$;
grant execute on function push_subscription_topics(text) to anon, authenticated;

create or replace function remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;
grant execute on function remove_push_subscription(text) to anon, authenticated;

-- "Send me a test": to the signed-in person's own phones only.
create or replace function send_test_notification() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if not exists (select 1 from push_subscriptions where user_id = auth.uid()) then
    raise exception 'Turn on notifications on this phone first.';
  end if;
  if (select count(*) from push_messages where only_user = auth.uid() and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'That’s a few tests already — try again in a few minutes.';
  end if;
  insert into push_messages (topic, title, body, url, only_user)
  values ('test', 'OHRR notifications are on', 'You’ll get notifications like this about what you picked.', '/account', auth.uid());
end $$;
grant execute on function send_test_notification() to authenticated;

-- Staff: write a notification to everyone who picked a topic.
create or replace function send_notification(p_org uuid, p_topic text, p_title text, p_body text, p_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not has_permission(p_org, 'notifications.send') then raise exception 'Sending notifications needs the “Send phone notifications” task.'; end if;
  if cardinality(clean_push_topics(array[p_topic])) = 0 then raise exception 'Pick who it is for.'; end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then raise exception 'Give it a title.'; end if;
  if p_url is not null and p_url !~ '^(/|https://)' then raise exception 'The link should start with / or https://'; end if;
  if (select count(*) from push_messages where org_id = p_org and created_by is not null
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'That’s a lot of notifications in an hour — please wait a little.';
  end if;
  insert into push_messages (org_id, topic, title, body, url, created_by)
  values (p_org, p_topic, left(btrim(p_title), 120), nullif(left(btrim(coalesce(p_body, '')), 400), ''),
          nullif(btrim(coalesce(p_url, '')), ''), auth.uid())
  returning id into v_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (p_org, auth.uid(), 'notification.sent', 'push_message', v_id::text,
          jsonb_build_object('topic', p_topic, 'title', p_title));
  return v_id;
end $$;
grant execute on function send_notification(uuid, text, text, text, text) to authenticated;

create or replace function push_counts(p_org uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'notifications.send') then jsonb_build_object(
    'phones',    (select count(*) from push_subscriptions),
    'volunteer', (select count(*) from push_subscriptions where 'volunteer' = any (topics)),
    'events',    (select count(*) from push_subscriptions where 'events' = any (topics)),
    'adoptions', (select count(*) from push_subscriptions where 'adoptions' = any (topics)),
    'bunfest',   (select count(*) from push_subscriptions where 'bunfest' = any (topics)),
    'news',      (select count(*) from push_subscriptions where 'news' = any (topics)),
    'ready',     (select public_key is not null from push_config where id = 1))
  else null end;
$$;
grant execute on function push_counts(uuid) to authenticated;

-- Automatic: a newly published volunteer call or event.
create or replace function notify_new_call() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) and new.on_date >= (now() at time zone 'America/New_York')::date then
    insert into push_messages (org_id, topic, title, body, url, dedupe_key)
    values (new.org_id, 'volunteer', 'Volunteers needed: ' || left(new.title, 90),
            to_char(new.on_date, 'FMDay, FMMonth FMDD') || coalesce(' · ' || new.location, ''),
            '/volunteer/call/' || new.slug, 'call:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_new_call on public.volunteer_calls;
create trigger trg_notify_new_call after insert or update of is_published on public.volunteer_calls
  for each row execute function notify_new_call();

create or replace function notify_new_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) and new.starts_at > now() then
    insert into push_messages (org_id, topic, title, body, url, dedupe_key)
    values (new.org_id, 'events', left(new.title, 120),
            to_char(new.starts_at at time zone 'America/New_York', 'FMDay, FMMonth FMDD') || coalesce(' · ' || new.venue, ''),
            '/events', 'event:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_new_event on public.events;
create trigger trg_notify_new_event after insert or update of is_published on public.events
  for each row execute function notify_new_event();

-- A rabbit staff add by hand (the RescueGroups check sends its own, one a day).
create or replace function notify_new_rabbit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and new.status = 'Available' and coalesce(new.source_id, '') not like 'rescuegroups:%'
     and (tg_op = 'INSERT' or not old.is_published) then
    insert into push_messages (org_id, topic, title, body, url, dedupe_key)
    values (new.org_id, 'adoptions', 'New rabbit up for adoption', 'Meet ' || new.name || '.', '/adopt',
            'rabbit:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_new_rabbit on public.rabbits;
create trigger trg_notify_new_rabbit after insert or update of is_published on public.rabbits
  for each row execute function notify_new_rabbit();

-- Staff: "Check RescueGroups now".
create or replace function request_rabbit_refresh(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (has_permission(p_org, 'adoptions.listings.edit') or has_permission(p_org, 'adoptions.listings.create')) then
    raise exception 'Not allowed';
  end if;
  if exists (select 1 from job_runs where job = 'rabbits' and finished_at > now() - interval '3 minutes') then
    raise exception 'RescueGroups was checked a moment ago.';
  end if;
  perform call_ohrr_jobs('{"action": "rabbits"}'::jsonb);
end $$;
grant execute on function request_rabbit_refresh(uuid) to authenticated;

-- Part 6 — every morning at 7:15 (Ohio, summer time), and a first hello
create extension if not exists pg_cron;
select cron.schedule('ohrr-rabbits-daily', '15 11 * * *', $$select public.call_ohrr_jobs('{"action": "rabbits"}'::jsonb)$$);
select public.call_ohrr_jobs('{"action": "init"}'::jsonb);
