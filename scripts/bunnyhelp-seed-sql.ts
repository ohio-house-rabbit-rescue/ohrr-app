// Generates supabase/migrations/20260917140000_care_topics.sql from the code
// seed, so the SQL seed and the in-app fallback can never drift.
//
//   node scripts/bunnyhelp-seed-sql.ts > supabase/migrations/20260917140000_care_topics.sql
//
// Idempotent: table/policies use IF NOT EXISTS / DROP-IF-EXISTS, and every seed
// row is `on conflict (org_id, slug) do nothing`.

import { SEED_TOPICS } from '../src/features/bunnyhelp/seedTopics.ts'

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
function qn(s: string | null): string {
  return s === null ? 'null' : q(s)
}
function arr(list: string[]): string {
  return list.length === 0 ? "'{}'::text[]" : `array[${list.map(q).join(', ')}]::text[]`
}

const header = `-- =============================================================
-- OHRR App — Care topics ("Bunny Help": the "My bunny is…" search)
--
-- Staff with \`content.education.edit\` manage short, symptom-shaped topics that
-- route people to OHRR's own care guidance — never a diagnosis. Visitors (anon)
-- read PUBLISHED topics; the app falls back to an identical built-in seed
-- (src/features/bunnyhelp/seedTopics.ts) when this table is missing or empty.
--
-- \`what_to_do\` is light markdown: blank-line-separated paragraphs, \`## \`
-- headings, and \`- \` bullet lines. \`aliases\` are the words people actually
-- type. \`urgency\`: emergency | vet-today | watch | tip. Health-category rows
-- with reviewed_by NULL show "Not yet vet-reviewed" in the app.
--
-- Apply AFTER 20260627065720_care_articles.sql (needs organizations,
-- set_updated_at() and has_permission()). Paste + Run in the Supabase SQL
-- editor, or \`supabase db push\`. Idempotent.
--
-- GENERATED FILE — edit src/features/bunnyhelp/seedTopics.ts and re-run
-- \`node scripts/bunnyhelp-seed-sql.ts > supabase/migrations/20260917140000_care_topics.sql\`.
-- =============================================================

create table if not exists care_topics (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  slug          text not null,
  title         text not null,
  aliases       text[] not null default '{}',
  category      text not null check (category in ('health','behavior','diet','litter','bonding','grooming','housing')),
  urgency       text not null check (urgency in ('emergency','vet-today','watch','tip')),
  summary       text not null default '',
  what_to_do    text not null default '',
  article_slug  text,
  show_vets     boolean not null default false,
  hopshop_note  text,
  reviewed_by   text,
  reviewed_at   date,
  is_published  boolean not null default true,
  sort_order    int not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_care_topics_org on care_topics(org_id, sort_order);

drop trigger if exists trg_care_topics_updated on care_topics;
create trigger trg_care_topics_updated before update on care_topics
  for each row execute function set_updated_at();

alter table care_topics enable row level security;

drop policy if exists care_topics_public_select on care_topics;
create policy care_topics_public_select on care_topics for select
  using (is_published);

drop policy if exists care_topics_staff_select on care_topics;
create policy care_topics_staff_select on care_topics for select
  using (has_permission(org_id, 'content.education.edit'));

drop policy if exists care_topics_insert on care_topics;
create policy care_topics_insert on care_topics for insert
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists care_topics_update on care_topics;
create policy care_topics_update on care_topics for update
  using (has_permission(org_id, 'content.education.edit'))
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists care_topics_delete on care_topics;
create policy care_topics_delete on care_topics for delete
  using (has_permission(org_id, 'content.education.edit'));

grant select on care_topics to anon, authenticated;
grant insert, update, delete on care_topics to authenticated;

-- -------------------------------------------------------------
-- Seed: the built-in topics, drawn only from OHRR's live-site care guides
-- (https://ohiohouserabbitrescue.org/rabbit-care/resources/ and the articles it
-- links) plus the emergency warning signs in the app's emergency card.
-- reviewed_by / reviewed_at are NULL on purpose. Org looked up by name.
-- -------------------------------------------------------------
`

const rows = SEED_TOPICS.map(
  (t, i) => `-- ${t.slug}: ${t.title}
--   source: ${t.source}
insert into care_topics (org_id, slug, title, aliases, category, urgency, summary, what_to_do, article_slug, show_vets, hopshop_note, sort_order)
select o.id, ${q(t.slug)}, ${q(t.title)}, ${arr(t.aliases)}, ${q(t.category)}, ${q(t.urgency)},
  ${q(t.summary)},
  ${q(t.what_to_do)},
  ${qn(t.article_slug)}, ${t.show_vets ? 'true' : 'false'}, ${qn(t.hopshop_note)}, ${i}
from organizations o
where o.name = 'Ohio House Rabbit Rescue'
on conflict (org_id, slug) do nothing;
`,
)

process.stdout.write(header + '\n' + rows.join('\n'))
