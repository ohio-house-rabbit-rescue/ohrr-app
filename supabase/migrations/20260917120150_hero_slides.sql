-- =============================================================
-- OHRR App + Website — Hero / featured slides (shared data contract)
--
-- The rotating cards at the top of the website home page and the app's Home
-- screen. `placement` is 'hero' (the big top cards) or 'featured' (the smaller
-- highlight tiles). A slide is live when it is published AND inside its
-- optional starts_at / ends_at window. Staff with `announcements.post` manage
-- them (from the website's staff area); the app reads them and falls back to
-- its bundled seed.
--
-- Also creates the public-read Storage bucket `site-images` for slide images,
-- with writes limited to staff holding the same capability.
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists hero_slides (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  placement    text not null default 'hero' check (placement in ('hero', 'featured')),
  headline     text not null,
  subline      text,
  image_url    text,
  cta_label    text,
  cta_url      text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_hero_slides_org on hero_slides(org_id, placement, sort_order);

drop trigger if exists trg_hero_slides_updated on hero_slides;
create trigger trg_hero_slides_updated before update on hero_slides
  for each row execute function set_updated_at();

alter table hero_slides enable row level security;

-- Public (incl. anonymous visitors) read PUBLISHED slides inside their window.
drop policy if exists hero_slides_public_select on hero_slides;
create policy hero_slides_public_select on hero_slides for select
  using (
    is_published
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- Staff who post announcements see everything (drafts, expired, scheduled).
drop policy if exists hero_slides_staff_select on hero_slides;
create policy hero_slides_staff_select on hero_slides for select
  using (has_permission(org_id, 'announcements.post'));

-- Writes gated on announcements.post.
drop policy if exists hero_slides_insert on hero_slides;
create policy hero_slides_insert on hero_slides for insert
  with check (has_permission(org_id, 'announcements.post'));
drop policy if exists hero_slides_update on hero_slides;
create policy hero_slides_update on hero_slides for update
  using (has_permission(org_id, 'announcements.post'))
  with check (has_permission(org_id, 'announcements.post'));
drop policy if exists hero_slides_delete on hero_slides;
create policy hero_slides_delete on hero_slides for delete
  using (has_permission(org_id, 'announcements.post'));

grant select on hero_slides to anon, authenticated;
grant insert, update, delete on hero_slides to authenticated;

-- -------------------------------------------------------------
-- Storage: a public bucket for site images (hero / featured slide artwork).
-- Public read; uploads/edits limited to staff holding announcements.post.
-- (Same pattern as the rabbit-photos bucket.)
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

drop policy if exists "site images public read" on storage.objects;
create policy "site images public read" on storage.objects for select
  using (bucket_id = 'site-images');

drop policy if exists "site images staff insert" on storage.objects;
create policy "site images staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'announcements.post')
    )
  );

drop policy if exists "site images staff update" on storage.objects;
create policy "site images staff update" on storage.objects for update to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'announcements.post')
    )
  );

drop policy if exists "site images staff delete" on storage.objects;
create policy "site images staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and public.has_permission(m.org_id, 'announcements.post')
    )
  );
