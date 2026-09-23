-- =============================================================
-- OHRR — the BunFest floor plan, the speakers, and where to get the RHDV2 jab
--
-- Three things the BunFest website needs that the database didn't have yet,
-- each of which improves the app the same day:
--
--   bunfest_floor_rows   the tables in each room, per year, as rows. Tables
--                        are numbered 1, 2, 3 … through the Burgundy Room and
--                        on into the Emerald Room, left to right, row by row.
--   bunfest_tables       who sits at which table that year. One row per
--                        table, so a table can't be given to two people, and
--                        a vendor with tables 7 and 8 side by side shows as
--                        one stand with their name once.
--   bunfest_presenters   the speakers, with credentials and a bio, linked to
--                        their talks (bunfest_sessions.presenter_ids).
--   vets.gives_rhdv2     which practices give the RHDV2 vaccine — the question
--                        BunFest's own rabbit rule sends people off to answer.
--
-- The published 2026 map shows the vendor areas as single blocks with no table
-- numbers, so the layout seeded here is a STARTING POINT sized to this year's
-- roster, not OHRR's real one. Staff change the rows to match the room.
-- No table assignments are seeded: none are published.
--
-- Speaker bios are transcribed from midwestbunfest.org/presenter-bios.html
-- (2026-09-23); the RHDV2 practices from /rhdv2-vaccination-sites-in-central-ohio.
--
-- Paste + Run AFTER 20260922160000_bunfest_2026_content.sql. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. The layout: rows of tables in each room, per year
-- -------------------------------------------------------------
create table if not exists bunfest_floor_rows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  year        int  not null check (year between 2000 and 2100),
  room        text not null check (room in ('burgundy', 'emerald')),
  sort_order  int  not null default 0,
  tables      int  not null check (tables between 1 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_bunfest_floor_rows on bunfest_floor_rows(org_id, year, room, sort_order);
drop trigger if exists trg_bunfest_floor_rows_updated on bunfest_floor_rows;
create trigger trg_bunfest_floor_rows_updated before update on bunfest_floor_rows
  for each row execute function set_updated_at();

alter table bunfest_floor_rows enable row level security;
drop policy if exists bunfest_floor_rows_public_select on bunfest_floor_rows;
create policy bunfest_floor_rows_public_select on bunfest_floor_rows for select using (true);
drop policy if exists bunfest_floor_rows_staff_all on bunfest_floor_rows;
create policy bunfest_floor_rows_staff_all on bunfest_floor_rows for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select on bunfest_floor_rows to anon, authenticated;
grant insert, update, delete on bunfest_floor_rows to authenticated;

-- -------------------------------------------------------------
-- 2. Who sits where, per year
--
-- Exactly one of: a vendor, a rescue partner, or a free label (a sponsor, the
-- OHRR info table). The unique key is what stops a double booking.
-- -------------------------------------------------------------
create table if not exists bunfest_tables (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  year         int  not null check (year between 2000 and 2100),
  table_no     int  not null check (table_no between 1 and 500),
  supplier_id  uuid references suppliers(id) on delete cascade,
  partner_id   uuid references rescue_partners(id) on delete cascade,
  label        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (org_id, year, table_no),
  check (num_nonnulls(supplier_id, partner_id, nullif(btrim(label), '')) = 1)
);
create index if not exists idx_bunfest_tables_supplier on bunfest_tables(supplier_id);
create index if not exists idx_bunfest_tables_partner on bunfest_tables(partner_id);

alter table bunfest_tables enable row level security;
drop policy if exists bunfest_tables_staff_all on bunfest_tables;
create policy bunfest_tables_staff_all on bunfest_tables for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select, insert, update, delete on bunfest_tables to authenticated;

-- The public map: every assigned table with the name to print on it. A
-- vendor or rescue that isn't published yet still holds its table — it shows
-- as reserved rather than as a free table someone might ask for.
create or replace function bunfest_tables_public(p_year int)
returns table (table_no int, kind text, ref_id uuid, name text, category text)
language sql stable security definer set search_path = public as $$
  select t.table_no,
         case when t.supplier_id is not null then 'vendor'
              when t.partner_id  is not null then 'rescue'
              else 'other' end,
         coalesce(t.supplier_id, t.partner_id),
         case when t.supplier_id is not null then
                (case when s.is_vendor and s.vendor_published and s.is_active then s.name end)
              when t.partner_id is not null then
                (case when r.is_published then r.name end)
              else nullif(btrim(t.label), '') end,
         case when s.vendor_published then s.vendor_category end
    from bunfest_tables t
    left join suppliers s       on s.id = t.supplier_id
    left join rescue_partners r on r.id = t.partner_id
   where t.year = p_year
   order by t.table_no;
$$;
grant execute on function bunfest_tables_public(int) to anon, authenticated;

-- Give one vendor, rescue or label its tables for a year, replacing what it
-- had. Refuses — in words a volunteer can act on — a number that isn't on
-- the plan or already belongs to someone else.
create or replace function set_bunfest_tables(
  p_org uuid, p_year int, p_tables int[],
  p_supplier uuid default null, p_partner uuid default null, p_label text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_max   int;
  v_no    int;
  v_who   text;
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if num_nonnulls(p_supplier, p_partner, v_label) <> 1 then
    raise exception 'Choose who the tables are for';
  end if;

  select coalesce(sum(tables), 0) into v_max
    from bunfest_floor_rows where org_id = p_org and year = p_year;

  foreach v_no in array coalesce(p_tables, '{}'::int[]) loop
    if v_no < 1 or v_no > v_max then
      if v_max = 0 then
        raise exception 'There are no tables on the % floor plan yet — add the rows first', p_year;
      end if;
      raise exception 'There is no table % — this year''s tables run 1 to %', v_no, v_max;
    end if;
  end loop;

  select t.table_no, coalesce(s.name, r.name, t.label) into v_no, v_who
    from bunfest_tables t
    left join suppliers s       on s.id = t.supplier_id
    left join rescue_partners r on r.id = t.partner_id
   where t.org_id = p_org and t.year = p_year and t.table_no = any (p_tables)
     and not (   (p_supplier is not null and t.supplier_id = p_supplier)
              or (p_partner  is not null and t.partner_id  = p_partner)
              or (v_label    is not null and lower(btrim(t.label)) = lower(v_label)))
   order by t.table_no
   limit 1;
  if found then
    raise exception 'Table % is already %', v_no, coalesce(v_who, 'taken');
  end if;

  delete from bunfest_tables t
   where t.org_id = p_org and t.year = p_year
     and (   (p_supplier is not null and t.supplier_id = p_supplier)
          or (p_partner  is not null and t.partner_id  = p_partner)
          or (v_label    is not null and lower(btrim(t.label)) = lower(v_label)));

  insert into bunfest_tables (org_id, year, table_no, supplier_id, partner_id, label, created_by)
  select distinct p_org, p_year, n, p_supplier, p_partner, v_label, auth.uid()
    from unnest(coalesce(p_tables, '{}'::int[])) as n;
end $$;
grant execute on function set_bunfest_tables(uuid, int, int[], uuid, uuid, text) to authenticated;

-- Replace a year's layout in one go: the number of tables in each row, top to
-- bottom, per room. All or nothing, and it refuses to shrink the floor out
-- from under a table someone already has.
create or replace function save_bunfest_floor(
  p_org uuid, p_year int, p_burgundy int[], p_emerald int[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_no    int;
  v_who   text;
  n       int;
  i       int;
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;

  foreach n in array coalesce(p_burgundy, '{}'::int[]) || coalesce(p_emerald, '{}'::int[]) loop
    if n < 1 or n > 20 then raise exception 'A row holds between 1 and 20 tables'; end if;
  end loop;

  select coalesce(sum(x), 0) into v_total
    from unnest(coalesce(p_burgundy, '{}'::int[]) || coalesce(p_emerald, '{}'::int[])) as x;

  select t.table_no, coalesce(s.name, r.name, t.label) into v_no, v_who
    from bunfest_tables t
    left join suppliers s       on s.id = t.supplier_id
    left join rescue_partners r on r.id = t.partner_id
   where t.org_id = p_org and t.year = p_year and t.table_no > v_total
   order by t.table_no desc
   limit 1;
  if found then
    raise exception 'Table % belongs to % — that layout only has % tables. Move them first.', v_no, coalesce(v_who, 'someone'), v_total;
  end if;

  delete from bunfest_floor_rows where org_id = p_org and year = p_year;

  i := 0;
  foreach n in array coalesce(p_burgundy, '{}'::int[]) loop
    i := i + 1;
    insert into bunfest_floor_rows (org_id, year, room, sort_order, tables) values (p_org, p_year, 'burgundy', i * 10, n);
  end loop;
  i := 0;
  foreach n in array coalesce(p_emerald, '{}'::int[]) loop
    i := i + 1;
    insert into bunfest_floor_rows (org_id, year, room, sort_order, tables) values (p_org, p_year, 'emerald', i * 10, n);
  end loop;
end $$;
grant execute on function save_bunfest_floor(uuid, int, int[], int[]) to authenticated;

-- -------------------------------------------------------------
-- 3. The speakers
--
-- Kept across years (a vet who speaks every October keeps one record); a
-- session lists who gives it.
-- -------------------------------------------------------------
create table if not exists bunfest_presenters (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  credentials  text,                  -- "DVM, DABVP (Avian)"
  affiliation  text,                  -- "MedVet Hilliard"
  bio          text,
  photo_url    text,
  website      text,
  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, name)
);
drop trigger if exists trg_bunfest_presenters_updated on bunfest_presenters;
create trigger trg_bunfest_presenters_updated before update on bunfest_presenters
  for each row execute function set_updated_at();

alter table bunfest_presenters enable row level security;
drop policy if exists bunfest_presenters_public_select on bunfest_presenters;
create policy bunfest_presenters_public_select on bunfest_presenters for select using (is_published);
drop policy if exists bunfest_presenters_staff_all on bunfest_presenters;
create policy bunfest_presenters_staff_all on bunfest_presenters for all
  using (has_permission(org_id, 'events.bunfest.manage'))
  with check (has_permission(org_id, 'events.bunfest.manage'));
grant select on bunfest_presenters to anon, authenticated;
grant insert, update, delete on bunfest_presenters to authenticated;

alter table bunfest_sessions add column if not exists presenter_ids uuid[] not null default '{}';

-- -------------------------------------------------------------
-- 4. Where to get the RHDV2 vaccine
-- -------------------------------------------------------------
alter table vets add column if not exists gives_rhdv2 boolean not null default false;
alter table vets add column if not exists rhdv2_note  text;   -- "Monthly clinics — see their Facebook page"

-- -------------------------------------------------------------
-- 5. Starting next year copies the floor too
--
-- Same function as before, plus the layout, last year's table plan (vendors
-- often come back to the same spot) and each talk's speakers.
-- -------------------------------------------------------------
create or replace function start_bunfest_year(p_org uuid, p_from int, p_to int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_sessions int := 0;
  n_features int := 0;
  n_pages    int := 0;
  n_vendors  int := 0;
  n_partners int := 0;
  n_rows     int := 0;
  n_tables   int := 0;
begin
  if not has_permission(p_org, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if p_from = p_to then raise exception 'Pick a different year to copy into'; end if;

  insert into bunfest_sessions (org_id, year, start_time, end_time, title, presenter, presenter_ids,
                                description, room, track, kind, is_published, sort_order, created_by)
  select s.org_id, p_to, s.start_time, s.end_time, s.title, s.presenter, s.presenter_ids,
         s.description, s.room, s.track, s.kind, s.is_published, s.sort_order, auth.uid()
    from bunfest_sessions s
   where s.org_id = p_org and s.year = p_from
     and not exists (select 1 from bunfest_sessions t
                      where t.org_id = p_org and t.year = p_to
                        and t.title = s.title and t.start_time = s.start_time);
  get diagnostics n_sessions = row_count;

  insert into event_features (org_id, event_slug, year, title, blurb, icon, link_url,
                              is_published, sort_order, created_by)
  select f.org_id, f.event_slug, p_to, f.title, f.blurb, f.icon, f.link_url,
         f.is_published, f.sort_order, auth.uid()
    from event_features f
   where f.org_id = p_org and f.year = p_from
     and not exists (select 1 from event_features t
                      where t.org_id = p_org and t.year = p_to
                        and t.event_slug = f.event_slug and t.title = f.title);
  get diagnostics n_features = row_count;

  insert into bunfest_pages (org_id, event_slug, year, slug, title, subtitle, icon, sponsor_note,
                             chips, note, sections, feature, reserve, email_signup, contact,
                             related_label, related, is_published, sort_order, created_by)
  select p.org_id, p.event_slug, p_to, p.slug, p.title, p.subtitle, p.icon, p.sponsor_note,
         p.chips, p.note, p.sections, p.feature, p.reserve, p.email_signup, p.contact,
         p.related_label, p.related, p.is_published, p.sort_order, auth.uid()
    from bunfest_pages p
   where p.org_id = p_org and p.year = p_from
  on conflict (org_id, event_slug, year, slug) do nothing;
  get diagnostics n_pages = row_count;

  update suppliers set vendor_years = array_append(vendor_years, p_to)
   where org_id = p_org and is_vendor and p_from = any (vendor_years) and not (p_to = any (vendor_years));
  get diagnostics n_vendors = row_count;

  update rescue_partners set bunfest_years = array_append(bunfest_years, p_to)
   where org_id = p_org and p_from = any (bunfest_years) and not (p_to = any (bunfest_years));
  get diagnostics n_partners = row_count;

  -- The layout, only into a year that has none yet.
  if not exists (select 1 from bunfest_floor_rows where org_id = p_org and year = p_to) then
    insert into bunfest_floor_rows (org_id, year, room, sort_order, tables)
    select org_id, p_to, room, sort_order, tables
      from bunfest_floor_rows where org_id = p_org and year = p_from;
    get diagnostics n_rows = row_count;

    insert into bunfest_tables (org_id, year, table_no, supplier_id, partner_id, label, created_by)
    select org_id, p_to, table_no, supplier_id, partner_id, label, auth.uid()
      from bunfest_tables where org_id = p_org and year = p_from
    on conflict (org_id, year, table_no) do nothing;
    get diagnostics n_tables = row_count;
  end if;

  return jsonb_build_object('sessions', n_sessions, 'features', n_features, 'pages', n_pages,
                            'vendors', n_vendors, 'partners', n_partners,
                            'floor_rows', n_rows, 'tables', n_tables);
end $$;
grant execute on function start_bunfest_year(uuid, int, int) to authenticated;

-- -------------------------------------------------------------
-- 6. Filled in for 2026
-- -------------------------------------------------------------
do $seed$
declare
  v_org uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then
    raise notice 'No OHRR organization row — skipping the seed.';
    return;
  end if;

  -- A starting layout sized to this year's roster (27 vendors, 18 rescues,
  -- some sponsors): Burgundy 4 rows of 6 (tables 1–24), Emerald 5 rows of 7
  -- (25–59). OHRR changes it to match the room.
  if not exists (select 1 from bunfest_floor_rows where org_id = v_org and year = 2026) then
    insert into bunfest_floor_rows (org_id, year, room, sort_order, tables)
    select v_org, 2026, 'burgundy', g * 10, 6 from generate_series(1, 4) as g
    union all
    select v_org, 2026, 'emerald', g * 10, 7 from generate_series(1, 5) as g;
  end if;

  insert into bunfest_presenters (org_id, name, credentials, affiliation, bio, sort_order)
  select v_org, p.name, p.credentials, p.affiliation, p.bio, p.sort
    from (values
      ('Susan Borders', 'DVM', 'Animal Hospital of Pataskala · Borders Veterinary Services', 'Dr. Susan Borders has practiced rabbit medicine and surgery for over 27 years. Currently she is an associate veterinarian at the Animal Hospital of Pataskala. She also operates Borders Veterinary Services, an exotic-only mobile practice serving much of Central Ohio. Dr. Borders has a special interest in exotic companion mammal medicine and surgery and is heavily involved with the local rabbit rescue groups including Columbus Humane.', 10),
      ('Dan Brenner', null, 'Farmer Dave Pet Supply', 'Dan Brenner is a farmer in Western New York State. Dan and his family work together to operate Farmer Dave Pet Supply, growing and producing all natural hay, chews, treats, and toys for small animals. Farming is a life-long apprenticeship, and Dan has been studying how to grow and harvest the highest-quality farm products since his childhood. Dan took a short break from the family farm to pursue a career in education. He has served as a teacher, university instructor, assistant principal, athletic director, and High School principal before returning to help run the farm with his parents David and Theresa, his wife Diane, and his two children - three year old Hailey, and one year old Beau. Dan is an active member of his local farm bureau and strives to promote sustainable farming practice. Dan''s passions are education and agriculture. He is thrilled about the opportunity to educate bunny owners about hay!', 20),
      ('Emily Fagundo', 'DVM', 'MedVet Hilliard', 'Dr. Emily Fagundo is an Emergency Medicine Veterinarian at MedVet Hilliard, where she has been part of the MedVet team since 2001. Dr. Fagundo joined MedVet Columbus as a veterinary technician while earning her Doctor of Veterinary Medicine degree at The Ohio State University College of Veterinary Medicine. Following her graduation from veterinary school, Dr. Fagundo worked as an associate in a busy small animal practice. She also worked as a relief emergency veterinarian before joining the MedVet Hilliard team. She enjoys being able to help treat animals with critical illnesses or injuries at all hours when family veterinarians are closed. In her free time, Dr. Fagundo visits local schools to educate children about becoming a veterinarian and to encourage rescue and adoption. She is also an active advocate and volunteer for the Ohio House Rabbit Rescue.', 30),
      ('Nicholas Jew', 'DVM', 'MedVet Hilliard', 'Dr. Nicholas Jew (pronounced “Joe”) is a 2013 graduate of The Ohio State University College of Veterinary Medicine. He is a veterinarian in the Avian & Exotics service at MedVet in Hilliard. Dr. Jew''s practice focuses on exotic companion mammals, reptiles, amphibians, and fish. He feels strongly that vets need to advocate for exotics to receive the same level of veterinary care that is given to dogs and cats. Dr. Jew is the founder of Exotics Veterinary Consulting, an exotic animal herd health consulting firm working with breeders of exotic mammals and reptiles to promote better husbandry and assist with herd level medical challenges, and he serves on the executive board of the Ohio Wildlife Center. Dr. Jew serves on the Public Relations & Membership committee for the Association of Reptile and Amphibian Veterinarians, and he is an active member of many professional groups (AVMA, AEMV, ARAV, AAV, AAFV). Outside of his animal interests, Dr. Jew is an avid fencer and reader.', 40),
      ('Tess Keener', null, 'Columbus House Rabbit Society · Humane Society of Greater Dayton’s Bunny Brigade', 'Tess Keener has shared her life with rescue rabbits since childhood. She began fostering and volunteering with Columbus House Rabbit Society in 2022, participating in field rescues and caring for more than a dozen foster rabbits at a time. Three of those fosters ultimately became permanent members of her family. Since moving to Dayton in 2025, she continues to volunteer with Columbus House Rabbit Society as she can and with the Humane Society of Greater Dayton''s Bunny Brigade. As a rabbit owner and former foster, Tess enjoys finding simple, affordable ways to enrich rabbits'' lives and help them express their individual personalities and natural behaviors.', 50),
      ('Shanleigh Knittel', null, 'Founder, Operation Obi · House Rabbit Society Educator', 'Shanleigh Knittel is a licensed House Rabbit Society Educator and the Founder of Operation Obi, a 501c3 rabbit rescue located in Pittsburgh, PA. She is passionate about education and tries to make information about proper rabbit care accessible to everyone via her bunnies'' Instagram account, @obibunfuriends. Shanleigh has 6 bunnies and a chinchilla of her own that she cares for in addition to the rabbits under Operation Obi.', 60),
      ('Barbara Oglesbee', 'DVM, DABVP (Avian)', 'MedVet Hilliard · The Ohio State University', 'Dr. Barbara Oglesbee has been an expert in exotic pet medicine for over 25 years. She is currently in private practice at MedVet Hilliard, treating exclusively exotic pets and pet birds. Over 70% of her patients have been pet rabbits. In addition to private practice, she is an Associate Professor of Avian and Exotic Animal Medicine at The Ohio State University College of Veterinary Medicine. At OSU, she served as head of the Companion Avian and Exotic Animal clinical services and has taught courses in avian, rabbit and ferret medicine for the past 29 years. She is board-certified in Avian Medicine and Surgery (Diplomate ABVP- Avian Practice). Dr. Oglesbee wrote the clinical textbook, The 5-Minute Veterinary Consult: Ferret and Rabbit; a reference book used by practicing veterinarians world-wide. She has also authored many book chapters in veterinary textbooks and clinical papers on the diagnosis and treatment of disorders of birds, rabbits, ferrets and other small mammals. She has been an invited lecturer at veterinary conferences locally, nationally, and internationally.', 70),
      ('Danielle Patterson', null, 'Columbus House Rabbit Society · House Rabbit Society Educator', 'Danielle Patterson was fascinated with rabbits at age 7 and pestered her parents into getting her a pet rabbit. She remembers going to a rabbit farm to pick out her first chocolate Dutch rabbit, whom she named Nibbels. Little did she know at that time that her destiny would later be rescuing rabbits and educating people on proper rabbit care. She met Karalee Curry, the founder of Columbus House Rabbit Society, prior to its inception in 2004 and has been helping rabbits ever since.', 80),
      ('Kaylee Vanhorenbeck', 'DVM', 'Animal Hospital of Pataskala', 'Dr. Kaylee Vanhorenbeck is an associate veterinarian at the Animal Hospital of Pataskala. She joined the team in 2026 after graduating from The Ohio State University College of Veterinary Medicine with her doctorate and from Chi University, where she received training in veterinary acupuncture. Originally from the Pittsburgh area, Dr. Vanhorenbeck developed a lifelong passion for animals at a young age, with a particular love for cats and rabbits. Her professional interests include integrative medicine and exotic companion animal medicine, with a focus on providing a holistic, individualized approach to patient care. Outside of veterinary medicine, Dr. Vanhorenbeck enjoys reading and powerlifting.', 90),
      ('Karen Winstead & Ryan Terebesi', null, 'Columbus Humane · Ohio House Rabbit Rescue', 'Karen Winstead is a House Rabbit Society Educator. She and Ryan Terebesi have been volunteering with rabbits for many years at Columbus Humane and have done numerous bondings for the humane society''s “bunny dating service.” They also serve as Ohio House Rabbit Rescue Adoption Coordinators, specializing in bonding. Ryan and Karen have both had pairs and trios; Karen has also had a quartet and a quintet.', 100)
    ) as p(name, credentials, affiliation, bio, sort)
  on conflict (org_id, name) do nothing;

  -- Link each 2026 talk to its speakers, only where nobody has yet.
  update bunfest_sessions s set presenter_ids = x.ids
    from (
      select l.title, array_agg(pr.id order by array_position(l.names, pr.name)) as ids
        from (values
      ('I’m All Ears: Understanding and Treating Rabbit Ear Infections', array['Nicholas Jew']),
      ('Hare-Raising Issues: The Lowdown on Liver Lobe Torsions', array['Nicholas Jew']),
      ('Digestive Issues You Absolutely Should Know About — GI Stasis and Bloat', array['Barbara Oglesbee']),
      ('Fluffy or Fat? Unraveling the Health Hazards of Obesity in Rabbits', array['Barbara Oglesbee']),
      ('Best Friends Forever: Bonding Rabbits', array['Karen Winstead & Ryan Terebesi']),
      ('Administering Meds at Home', array['Emily Fagundo']),
      ('An Integrative Approach to Rabbit Medicine', array['Susan Borders', 'Kaylee Vanhorenbeck']),
      ('What is Hay?', array['Dan Brenner']),
      ('More Than Toys: Creating Meaningful Enrichment for Pet Rabbits', array['Tess Keener']),
      ('Fun Facets of Field Rescue', array['Shanleigh Knittel', 'Danielle Patterson'])
        ) as l(title, names)
        join bunfest_presenters pr on pr.org_id = v_org and pr.name = any (l.names)
       group by l.title
    ) as x
   where s.org_id = v_org and s.year = 2026 and s.title = x.title and s.presenter_ids = '{}';

  -- The two practices OHRR lists for the RHDV2 vaccine.
  update vets set gives_rhdv2 = true,
         rhdv2_note = coalesce(rhdv2_note, 'Monthly vaccine clinics. For dates and locations, see the Borders Veterinary Services Facebook page or email Dr. Susan Borders at slborders1@gmail.com.')
   where org_id = v_org and name ilike 'Borders Veterinary Services%';
  update vets set gives_rhdv2 = true,
         rhdv2_note = coalesce(rhdv2_note, 'Gives the vaccine by appointment — call 614-870-7008.')
   where org_id = v_org and name ilike 'Norton Road Vet%';

  -- "Bringing Your Bunny" sent people to the whole vet list; send them to the
  -- practices that actually give the vaccine. Only the seeded link is changed.
  update bunfest_pages p
     set related = (
       select jsonb_agg(
                case when x.e ->> 'to' = '/vets'
                     then jsonb_build_object('label', 'Where to get the RHDV2 vaccine', 'to', '/vets?rhdv2=1')
                     else x.e end
                order by x.ord)
         from jsonb_array_elements(p.related) with ordinality as x(e, ord))
   where p.org_id = v_org and p.year = 2026 and p.slug = 'bringing-bunny'
     and exists (select 1 from jsonb_array_elements(p.related) as r(e) where r.e ->> 'to' = '/vets');
end $seed$;
