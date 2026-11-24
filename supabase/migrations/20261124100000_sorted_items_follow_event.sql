-- =============================================================
-- OHRR — update 59: sorted donations go to the event you chose
--
-- When a donation is sorted into the Silent Auction or the raffle, the new
-- auction lot or raffle prize did not say which event it was for, so the
-- database filled in the old built-in one: Midwest BunFest 2026. That is still
-- right today, because no other event has been chosen. But the day someone
-- picks the 2027 event on Staff → Silent Auction, every donation sorted after
-- that would have landed on the 2026 event and never shown on the 2027 lists.
--
-- After this update: a new lot or prize that names no event gets the event
-- chosen on Staff → Silent Auction (the 'auction_event' setting). If none has
-- been chosen it is Midwest BunFest 2026, as before. A lot or prize that DOES
-- name its event (added by hand on the auction page, or moved to the Online
-- Auction) is left exactly as it was given.
--
-- Nothing already saved is changed. Apply AFTER update 58.
-- Safe to run twice. Run it as ONE paste.
-- =============================================================

-- The event chosen for this organization, or the 2026 BunFest when none is.
create or replace function chosen_event_slug(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.value->>'slug' from app_settings s
      where s.org_id = p_org and s.key = 'auction_event'
        and jsonb_typeof(s.value) = 'object'
        and (s.value->>'slug') ~ '^[a-z0-9][a-z0-9-]{1,58}$'),
    'midwest-bunfest-2026');
$$;
grant execute on function chosen_event_slug(uuid) to anon, authenticated;

-- No event given → the chosen event. An event that was given is never touched.
create or replace function fill_chosen_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event_slug is null or btrim(new.event_slug) = '' then
    new.event_slug := chosen_event_slug(new.org_id);
  end if;
  return new;
end $$;

-- The built-in "2026" is no longer filled in by the table itself: the trigger does it,
-- so it can look up the chosen event first. (The column still may not be empty.)
alter table raffle_items  alter column event_slug drop default;
alter table raffle_prizes alter column event_slug drop default;

drop trigger if exists trg_raffle_items_event on raffle_items;
create trigger trg_raffle_items_event before insert on raffle_items
  for each row execute function fill_chosen_event();

drop trigger if exists trg_raffle_prizes_event on raffle_prizes;
create trigger trg_raffle_prizes_event before insert on raffle_prizes
  for each row execute function fill_chosen_event();

-- Check: should say true.
select (select count(*) from pg_trigger where tgname in ('trg_raffle_items_event', 'trg_raffle_prizes_event') and not tgisinternal) = 2
   and exists (select 1 from pg_proc where proname = 'chosen_event_slug') as sorted_items_follow_the_event;
