-- =============================================================
-- OHRR App — Adoptable rabbits (staff-managed, with photo uploads)
--
-- Staff manage the adoptable-rabbit listings the public Adopt page shows. Photos
-- are uploaded to a public Storage bucket. Capabilities:
--   adoptions.listings.create  -> add a rabbit
--   adoptions.listings.edit    -> edit / delete a rabbit
--   adoptions.status.change    -> change just the adoption status (set_rabbit_status)
-- Visitors (anon) read PUBLISHED rabbits; members see drafts too.
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists rabbits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  status          text not null default 'Available',  -- Available | Pending | Adopted
  sex             text,                                 -- Male | Female | Unknown
  age             text,                                 -- Baby | Young | Adult | Senior
  breed           text,
  size            text,
  spayed_neutered boolean not null default true,
  house_trained   boolean not null default false,
  bonded          boolean not null default false,
  description     text,
  tags            text[] not null default '{}',
  photos          text[] not null default '{}',        -- public URLs; first = primary
  sort_order      int not null default 0,
  is_published    boolean not null default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_rabbits_org on rabbits(org_id, sort_order, created_at);

drop trigger if exists trg_rabbits_updated on rabbits;
create trigger trg_rabbits_updated before update on rabbits
  for each row execute function set_updated_at();

alter table rabbits enable row level security;

drop policy if exists rabbits_public_select on rabbits;
create policy rabbits_public_select on rabbits for select using (is_published);
drop policy if exists rabbits_staff_select on rabbits;
create policy rabbits_staff_select on rabbits for select using (is_org_member(org_id));

drop policy if exists rabbits_insert on rabbits;
create policy rabbits_insert on rabbits for insert
  with check (has_permission(org_id, 'adoptions.listings.create'));
drop policy if exists rabbits_update on rabbits;
create policy rabbits_update on rabbits for update
  using (has_permission(org_id, 'adoptions.listings.edit'))
  with check (has_permission(org_id, 'adoptions.listings.edit'));
drop policy if exists rabbits_delete on rabbits;
create policy rabbits_delete on rabbits for delete
  using (has_permission(org_id, 'adoptions.listings.edit'));

grant select on rabbits to anon, authenticated;
grant insert, update, delete on rabbits to authenticated;

-- Change ONLY the adoption status (narrower than full edit), so a worker can be
-- granted adoptions.status.change alone (e.g. to mark rabbits Adopted).
create or replace function set_rabbit_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from rabbits where id = p_id;
  if v_org is null then raise exception 'Rabbit not found'; end if;
  if not has_permission(v_org, 'adoptions.status.change') then raise exception 'Not allowed'; end if;
  update rabbits set status = p_status where id = p_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (v_org, auth.uid(), 'set_rabbit_status', 'rabbit', p_id::text,
          jsonb_build_object('status', p_status));
end $$;
grant execute on function set_rabbit_status(uuid, text) to authenticated;

-- =============================================================
-- Storage: a public bucket for rabbit photos. Public read; uploads/edits limited
-- to active org members (any signed-in staff member).
-- =============================================================
insert into storage.buckets (id, name, public)
values ('rabbit-photos', 'rabbit-photos', true)
on conflict (id) do nothing;

drop policy if exists "rabbit photos public read" on storage.objects;
create policy "rabbit photos public read" on storage.objects for select
  using (bucket_id = 'rabbit-photos');

drop policy if exists "rabbit photos member insert" on storage.objects;
create policy "rabbit photos member insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rabbit-photos'
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active')
  );

drop policy if exists "rabbit photos member update" on storage.objects;
create policy "rabbit photos member update" on storage.objects for update to authenticated
  using (
    bucket_id = 'rabbit-photos'
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active')
  );

drop policy if exists "rabbit photos member delete" on storage.objects;
create policy "rabbit photos member delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'rabbit-photos'
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active')
  );
