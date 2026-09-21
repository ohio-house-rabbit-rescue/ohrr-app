-- =============================================================
-- OHRR — the Inbox: every form on the app and the website lands here
--
-- Appointment requests, bonding/clinic sign-ups, surrender intakes, volunteer
-- sign-ups, Happy Tail stories, mailing-list joins, contact messages, the
-- raffle-ticket test forms … all used to POST to Netlify Forms, which doesn't
-- exist on Cloudflare Pages. Now they call submit_request() (open to anyone,
-- no sign-in) and staff who hold `inbox.manage` read and handle them in the
-- staff Inbox on a phone or on the website.
--
-- Paste + Run in the Supabase SQL editor. Idempotent.
-- =============================================================

insert into permissions(key, area, description) values
 ('inbox.manage', 'Inbox', 'Read and handle requests sent from the app and website')
on conflict (key) do nothing;

-- Volunteer leads and content editors usually field these; owners/admins
-- hold everything anyway.
insert into permission_presets(preset, permission_key) values
 ('Volunteer Lead', 'inbox.manage'),
 ('Adoptions Coordinator', 'inbox.manage')
on conflict do nothing;

create table if not exists requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  kind         text not null,            -- 'appointment-request', 'volunteer-signup', …
  name         text,
  email        text,
  phone        text,
  subject      text,                     -- one line for the list: "Adoption visit · Sat Oct 3"
  payload      jsonb not null default '{}'::jsonb,   -- every field, as submitted
  status       text not null default 'new'
               check (status in ('new', 'in_progress', 'done', 'archived')),
  staff_notes  text,
  source       text,                     -- 'app' | 'website'
  handled_by   uuid references auth.users(id),
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_requests_org on requests(org_id, status, created_at desc);
create index if not exists idx_requests_email on requests(org_id, email, created_at desc);

drop trigger if exists trg_requests_updated on requests;
create trigger trg_requests_updated before update on requests
  for each row execute function set_updated_at();

alter table requests enable row level security;

drop policy if exists requests_staff_select on requests;
create policy requests_staff_select on requests for select
  using (has_permission(org_id, 'inbox.manage'));
drop policy if exists requests_staff_update on requests;
create policy requests_staff_update on requests for update
  using (has_permission(org_id, 'inbox.manage'))
  with check (has_permission(org_id, 'inbox.manage'));
drop policy if exists requests_staff_delete on requests;
create policy requests_staff_delete on requests for delete
  using (has_permission(org_id, 'inbox.manage'));
-- No insert policy: the public writes only through submit_request() below.

grant select, update, delete on requests to authenticated;

-- -------------------------------------------------------------
-- Public entry point. Anyone may call it; it only ever INSERTS, caps the
-- size, and refuses more than 12 submissions from one email address per
-- hour (a stuck form, not a real person).
-- -------------------------------------------------------------
create or replace function submit_request(
  p_kind text, p_name text, p_email text, p_phone text,
  p_subject text, p_payload jsonb, p_source text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id  uuid;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if p_kind is null or length(p_kind) > 60 or p_kind !~ '^[a-z][a-z0-9-]*$' then
    raise exception 'Bad request kind';
  end if;
  if pg_column_size(p_payload) > 40000 then raise exception 'That’s too much text for one request.'; end if;
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then select id into v_org from organizations order by created_at limit 1; end if;
  if v_org is null then raise exception 'No organization to deliver to'; end if;
  if v_email is not null and (
       select count(*) from requests
        where org_id = v_org and email = v_email and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'Too many requests from this address — please try again later.';
  end if;

  insert into requests (org_id, kind, name, email, phone, subject, payload, source)
  values (v_org, p_kind, nullif(btrim(coalesce(p_name, '')), ''), v_email,
          nullif(btrim(coalesce(p_phone, '')), ''), left(coalesce(p_subject, ''), 200),
          coalesce(p_payload, '{}'::jsonb), left(coalesce(p_source, ''), 20))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function submit_request(text, text, text, text, text, jsonb, text) to anon, authenticated;

-- Staff: change status (and stamp who/when).
create or replace function set_request_status(p_id uuid, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r requests;
begin
  select * into r from requests where id = p_id;
  if not found then raise exception 'No such request'; end if;
  if not has_permission(r.org_id, 'inbox.manage') then raise exception 'Not allowed'; end if;
  if p_status not in ('new', 'in_progress', 'done', 'archived') then raise exception 'Bad status'; end if;
  update requests set
    status = p_status,
    staff_notes = coalesce(p_notes, staff_notes),
    handled_by = case when p_status in ('done', 'archived') then auth.uid() else handled_by end,
    handled_at = case when p_status in ('done', 'archived') then now() else handled_at end
  where id = p_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'request.' || p_status, 'request', p_id::text,
          jsonb_build_object('kind', r.kind, 'subject', r.subject));
end $$;
grant execute on function set_request_status(uuid, text, text) to authenticated;

-- How many are waiting (the dashboard badge).
create or replace function count_new_requests(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when has_permission(p_org, 'inbox.manage')
              then (select count(*)::int from requests where org_id = p_org and status = 'new')
              else 0 end;
$$;
grant execute on function count_new_requests(uuid) to authenticated;
