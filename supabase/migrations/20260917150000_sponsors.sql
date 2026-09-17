-- =============================================================
-- OHRR App — Sponsors (Phase 1): partners, perks & "Presented by" placements
--
-- Staff with `events.bunfest.manage` maintain the sponsor roster that the public
-- "Our Partners" (/partners) and "Partner perks" (/partners/perks) screens show,
-- plus optional per-surface placements that render a small "Presented by" strip
-- on a given screen (home, bunfest, silent-auction, ...). Logos upload to a
-- public Storage bucket. The OHRR website reads the same two tables read-only,
-- so column names here are the contract — keep them exact.
--
-- Visitors (anon) read ACTIVE sponsors whose term hasn't ended and ACTIVE
-- placements inside their date window; staff with the capability see everything.
--
-- Apply AFTER 20260627052536_hopshop_backend.sql (organizations, memberships,
-- set_updated_at, has_permission) and 20260627072524_rabbits.sql (storage
-- policy pattern). Independent of the events / vets / raffle migrations.
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists sponsors (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  tier         text not null default 'community'
                 check (tier in ('presenting', 'program', 'community', 'friend')),
  blurb        text,
  logo_url     text,                 -- public URL in the sponsor-logos bucket (or external)
  website      text,
  perk_title   text,                 -- when set, the sponsor appears on /partners/perks
  perk_detail  text,
  perk_code    text,                 -- revealed with a "Show code" tap
  term_start   date,
  term_end     date,                 -- hidden from the public once this date passes
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists sponsor_placements (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  sponsor_id   uuid not null references sponsors(id) on delete cascade,
  surface      text not null
                 check (surface in ('home', 'bunfest', 'silent-auction', 'events',
                                    'care-library', 'find-a-vet', 'happy-tails',
                                    'volunteer', 'hop-shop', 'my-bunny')),
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_sponsors_org_tier on sponsors(org_id, tier, sort_order);
create index if not exists idx_sponsor_placements_org_surface on sponsor_placements(org_id, surface);
create index if not exists idx_sponsor_placements_sponsor on sponsor_placements(sponsor_id);

drop trigger if exists trg_sponsors_updated on sponsors;
create trigger trg_sponsors_updated before update on sponsors
  for each row execute function set_updated_at();

alter table sponsors enable row level security;
alter table sponsor_placements enable row level security;

-- ---- sponsors ----
-- Public (incl. anonymous visitors): active sponsors whose term hasn't ended.
drop policy if exists sponsors_public_select on sponsors;
create policy sponsors_public_select on sponsors for select
  using (is_active and (term_end is null or term_end >= current_date));

-- Staff with the capability see every row (OR'd with the public policy).
drop policy if exists sponsors_staff_select on sponsors;
create policy sponsors_staff_select on sponsors for select
  using (has_permission(org_id, 'events.bunfest.manage'));

drop policy if exists sponsors_insert on sponsors;
create policy sponsors_insert on sponsors for insert
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists sponsors_update on sponsors;
create policy sponsors_update on sponsors for update
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists sponsors_delete on sponsors;
create policy sponsors_delete on sponsors for delete
  using (has_permission(org_id, 'events.bunfest.manage'));

-- ---- sponsor_placements ----
-- Public: active placements inside their (optional) date window.
drop policy if exists sponsor_placements_public_select on sponsor_placements;
create policy sponsor_placements_public_select on sponsor_placements for select
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists sponsor_placements_staff_select on sponsor_placements;
create policy sponsor_placements_staff_select on sponsor_placements for select
  using (has_permission(org_id, 'events.bunfest.manage'));

drop policy if exists sponsor_placements_insert on sponsor_placements;
create policy sponsor_placements_insert on sponsor_placements for insert
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists sponsor_placements_update on sponsor_placements;
create policy sponsor_placements_update on sponsor_placements for update
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
drop policy if exists sponsor_placements_delete on sponsor_placements;
create policy sponsor_placements_delete on sponsor_placements for delete
  using (has_permission(org_id, 'events.bunfest.manage'));

grant select on sponsors, sponsor_placements to anon, authenticated;
grant insert, update, delete on sponsors, sponsor_placements to authenticated;

-- =============================================================
-- Storage: a public bucket for sponsor logos. Public read; writes limited to
-- staff holding events.bunfest.manage in the org named by the first path
-- segment (objects live at  sponsor-logos/<org_id>/<uuid>.<ext>).
-- =============================================================
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;

drop policy if exists "sponsor logos public read" on storage.objects;
create policy "sponsor logos public read" on storage.objects for select
  using (bucket_id = 'sponsor-logos');

drop policy if exists "sponsor logos staff insert" on storage.objects;
create policy "sponsor logos staff insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sponsor-logos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and m.org_id::text = (storage.foldername(name))[1]
        and public.has_permission(m.org_id, 'events.bunfest.manage')
    )
  );

drop policy if exists "sponsor logos staff update" on storage.objects;
create policy "sponsor logos staff update" on storage.objects for update to authenticated
  using (
    bucket_id = 'sponsor-logos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and m.org_id::text = (storage.foldername(name))[1]
        and public.has_permission(m.org_id, 'events.bunfest.manage')
    )
  );

drop policy if exists "sponsor logos staff delete" on storage.objects;
create policy "sponsor logos staff delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'sponsor-logos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.status = 'active'
        and m.org_id::text = (storage.foldername(name))[1]
        and public.has_permission(m.org_id, 'events.bunfest.manage')
    )
  );
