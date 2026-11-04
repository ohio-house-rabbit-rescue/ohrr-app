-- =============================================================
-- Update 56 (2026-11-04): the guided start ("Hop Into the App") remembers each person's ticks.
--
-- One row per step a person ticked off, kept on their own account so the guide picks up where they left
-- off on any phone or computer. Each person can read, add and remove ONLY their own rows; nobody else
-- (not even an admin, from inside the app) can see them. Until this is run, the guide still works and
-- keeps the ticks on the device instead.
--
-- Run AFTER update 55. Safe to run twice.
-- =============================================================

create table if not exists staff_walkthrough (
  user_id  uuid not null references auth.users(id) on delete cascade,
  step_key text not null check (char_length(step_key) between 1 and 80),
  done_at  timestamptz not null default now(),
  primary key (user_id, step_key)
);

alter table staff_walkthrough enable row level security;

drop policy if exists "own walkthrough: read" on staff_walkthrough;
create policy "own walkthrough: read" on staff_walkthrough
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own walkthrough: add" on staff_walkthrough;
create policy "own walkthrough: add" on staff_walkthrough
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own walkthrough: remove" on staff_walkthrough;
create policy "own walkthrough: remove" on staff_walkthrough
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on staff_walkthrough to authenticated;

-- Check (should show 1, 3, true):
select (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'staff_walkthrough') as table_made,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'staff_walkthrough') as rules,
       (select relrowsecurity from pg_class where oid = 'public.staff_walkthrough'::regclass) as private_to_each_person;
