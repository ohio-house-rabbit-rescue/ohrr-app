-- =============================================================
-- OHRR App — Care articles (staff-editable education content)
--
-- Staff with `content.education.edit` manage the Rabbit Care guides shown in the
-- Learn section. Visitors (anon) read PUBLISHED articles; the public Learn pages
-- fall back to the built-in guides until articles exist. The staff editor offers a
-- one-click "import the built-in guides" so staff start from today's content and
-- edit from there (no big seed needed in this migration).
--
-- `body` is light markdown: blank-line-separated paragraphs, `## ` headings, and
-- `- ` bullet lines. `slug` is the URL piece (/learn/<slug>).
--
-- Apply once via the Supabase SQL editor (paste + Run) or `supabase db push`.
-- Idempotent.
-- =============================================================

create table if not exists care_articles (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  slug         text not null,
  title        text not null,
  icon         text not null default 'book',
  summary      text not null default '',
  body         text not null default '',
  tip          text,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_care_articles_org on care_articles(org_id, sort_order);

drop trigger if exists trg_care_articles_updated on care_articles;
create trigger trg_care_articles_updated before update on care_articles
  for each row execute function set_updated_at();

alter table care_articles enable row level security;

drop policy if exists care_articles_public_select on care_articles;
create policy care_articles_public_select on care_articles for select
  using (is_published);

drop policy if exists care_articles_staff_select on care_articles;
create policy care_articles_staff_select on care_articles for select
  using (has_permission(org_id, 'content.education.edit'));

drop policy if exists care_articles_insert on care_articles;
create policy care_articles_insert on care_articles for insert
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists care_articles_update on care_articles;
create policy care_articles_update on care_articles for update
  using (has_permission(org_id, 'content.education.edit'))
  with check (has_permission(org_id, 'content.education.edit'));
drop policy if exists care_articles_delete on care_articles;
create policy care_articles_delete on care_articles for delete
  using (has_permission(org_id, 'content.education.edit'));

grant select on care_articles to anon, authenticated;
grant insert, update, delete on care_articles to authenticated;
