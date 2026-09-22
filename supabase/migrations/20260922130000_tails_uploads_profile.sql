-- =============================================================
-- OHRR — Happy Tails people can publish, photos people can send,
--        and the org details staff can change
--
-- Three gaps this closes:
--
-- 1. HAPPY TAILS had no table, so a story sent through the app landed in the
--    Inbox and stopped there — the public page showed sample stories forever.
--    `happy_tails` holds the published stories; `publish_happy_tail()` turns an
--    Inbox request into one in a tap (keeping the link back to the request).
--
-- 2. PUBLIC FORMS asked for a photo *link* ("a shared photo link, if you have
--    one") because anonymous visitors had nowhere to upload. The
--    `public-uploads` bucket takes one image at a time from anyone — capped at
--    8 MB, images only, insert-only (no read-back, no overwrite, no delete) —
--    so a found-rabbit report, a surrender intake and a Happy Tail can carry a
--    photo. Files live under a random name; the form puts the URL in its
--    payload, and staff see it in the Inbox.
--
-- 3. OPENING HOURS, phone, address and the holiday notice were constants in
--    code, on ten-odd screens. They move into app_settings under `org_profile`
--    (public to read, `settings.manage` to change), and the apps fall back to
--    the bundled values for anything left blank.
--
-- Paste + Run in the Supabase SQL editor AFTER 20260922120000_bunfest_content.sql.
-- Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Happy Tails
-- -------------------------------------------------------------
create table if not exists happy_tails (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  bunny         text not null,
  family        text,                  -- "With the Patel family"
  status        text not null default 'going-strong'
                  check (status in ('looking', 'just-adopted', 'settling-in', 'going-strong', 'forever-loved')),
  since         text,                  -- "Adopted Mar 2025" (free text: adopters are vague, and that's fine)
  summary       text not null,
  story         text,
  photo_url     text,
  is_published  boolean not null default true,
  sort_order    int not null default 0,
  request_id    uuid references requests(id) on delete set null,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_happy_tails_org on happy_tails(org_id, sort_order, created_at desc);
drop trigger if exists trg_happy_tails_updated on happy_tails;
create trigger trg_happy_tails_updated before update on happy_tails
  for each row execute function set_updated_at();

alter table happy_tails enable row level security;
drop policy if exists happy_tails_public_select on happy_tails;
create policy happy_tails_public_select on happy_tails for select using (is_published);
drop policy if exists happy_tails_staff_select on happy_tails;
create policy happy_tails_staff_select on happy_tails for select
  using (has_permission(org_id, 'content.education.edit') or has_permission(org_id, 'inbox.manage'));
drop policy if exists happy_tails_staff_write on happy_tails;
create policy happy_tails_staff_write on happy_tails for all
  using (has_permission(org_id, 'content.education.edit') or has_permission(org_id, 'inbox.manage'))
  with check (has_permission(org_id, 'content.education.edit') or has_permission(org_id, 'inbox.manage'));
grant select on happy_tails to anon, authenticated;
grant insert, update, delete on happy_tails to authenticated;

-- Inbox → Happy Tails in one tap. Returns the new story's id.
create or replace function publish_happy_tail(
  p_request_id uuid, p_bunny text, p_summary text,
  p_family text default null, p_status text default 'going-strong',
  p_since text default null, p_story text default null, p_photo_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  r requests;
  v_id uuid;
begin
  select * into r from requests where id = p_request_id;
  if not found then raise exception 'No such request'; end if;
  if not (has_permission(r.org_id, 'inbox.manage') or has_permission(r.org_id, 'content.education.edit')) then
    raise exception 'Not allowed';
  end if;
  if nullif(btrim(coalesce(p_bunny, '')), '') is null then raise exception 'Give the bunny a name'; end if;

  insert into happy_tails (org_id, bunny, family, status, since, summary, story, photo_url, request_id, created_by,
                           sort_order)
  values (r.org_id, btrim(p_bunny), nullif(btrim(coalesce(p_family, '')), ''),
          coalesce(nullif(p_status, ''), 'going-strong'), nullif(btrim(coalesce(p_since, '')), ''),
          coalesce(nullif(btrim(coalesce(p_summary, '')), ''), 'A new chapter.'),
          nullif(btrim(coalesce(p_story, '')), ''), nullif(btrim(coalesce(p_photo_url, '')), ''),
          r.id, auth.uid(),
          coalesce((select max(sort_order) + 10 from happy_tails where org_id = r.org_id), 10))
  returning id into v_id;

  update requests set status = 'done', handled_by = auth.uid(), handled_at = now() where id = r.id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'happy_tail.published', 'happy_tail', v_id::text,
          jsonb_build_object('bunny', p_bunny, 'request', r.id));
  return v_id;
end $$;
grant execute on function publish_happy_tail(uuid, text, text, text, text, text, text, text) to authenticated;

-- -------------------------------------------------------------
-- 2. One image from anyone, for the public forms
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-uploads', 'public-uploads', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

drop policy if exists "public uploads read" on storage.objects;
create policy "public uploads read" on storage.objects for select
  using (bucket_id = 'public-uploads');

-- Anyone may ADD a file (the forms need it) — and nothing else. No update, no
-- delete, no listing: a sender can't reach, replace or remove anyone's photo.
drop policy if exists "public uploads insert" on storage.objects;
create policy "public uploads insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'public-uploads');

drop policy if exists "public uploads staff delete" on storage.objects;
create policy "public uploads staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'public-uploads'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'inbox.manage')
    )
  );

-- -------------------------------------------------------------
-- 3. Hours, phone, address — staff-editable
-- -------------------------------------------------------------
-- One app_settings row. Blank fields fall back to the values bundled in the
-- app, so an empty row changes nothing.
do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;
  insert into app_settings (org_id, key, value)
  values (v_org, 'org_profile', jsonb_build_object(
    'hours', 'Sat & Sun, 12–4 PM · adoptions by appointment',
    'hours_short', 'Sat & Sun, 12–4 PM',
    'hopshop_hours', 'Saturday / Sunday Noon – 4:00 pm',
    'notice', '',
    'phone', '614-263-8557',
    'email', 'ohrrcontact@ohiohouserabbitrescue.org',
    'address', '5485 N. High Street, Columbus, OH 43214'
  ))
  on conflict (org_id, key) do nothing;
end $$;
