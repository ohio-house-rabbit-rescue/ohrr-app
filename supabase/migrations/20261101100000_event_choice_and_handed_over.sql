-- =============================================================
-- OHRR — update 48: the auction's event is chosen in the app + raffle prizes
-- "handed over"
--
-- 1. The event the Silent Auction and the raffle are for is no longer written
--    into the code. Staff pick it (or type a new one) on Staff → Silent
--    Auction; it is one app_settings row ('auction_event'), which needs no
--    database change. Two database functions still named the 2026 event, so
--    they are made general here:
--      • auction_public_on  — any event except the Online Auction answers to
--                              the Silent Auction switch (not only 'midwest-bunfest…')
--      • auction_move_item  — an item can be moved to any event in the events list
-- 2. Raffle prizes: when a prize has been given to its winner, staff tick
--    "Handed over" on the Raffle desk. It is stored on the winning ticket (when
--    and by whom), shows in the PDF and the spreadsheet, and can be undone.
--
-- Apply AFTER update 47. Safe to run twice. Run it as ONE paste.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Any event, not only a "midwest-bunfest…" one
-- -------------------------------------------------------------
create or replace function auction_public_on(p_org uuid, p_event text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_event = 'ohrr-online-auction'
    then feature_on(p_org, 'online_auction_enabled', false)
    else feature_on(p_org, 'silent_auction_enabled') end;
$$;
grant execute on function auction_public_on(uuid, text) to anon, authenticated;

-- An item can be moved between the two auctions while nobody has bid on it.
create or replace function auction_move_item(p_item_id uuid, p_event text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r raffle_items;
  s auction_settings;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  -- The Online Auction, or the event staff chose (Staff → Silent Auction; any event in the events list).
  if p_event <> 'ohrr-online-auction' and not exists (select 1 from events e where e.slug = p_event) then raise exception 'Unknown auction'; end if;
  select * into r from raffle_items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if not has_permission(r.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if r.event_slug = p_event then
    select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
    return auction_item_json(r, s);
  end if;
  if r.bid_count > 0 or exists (select 1 from auction_bids b where b.item_id = r.id) then
    raise exception 'Someone has bid on this item, so it stays in its auction.';
  end if;
  if exists (select 1 from auction_sales sa where sa.item_id = r.id and sa.payment_status <> 'void') then
    raise exception 'This item has been sold.';
  end if;
  -- The online auction has one closing time; BunFest items keep their session.
  update raffle_items set event_slug = p_event, closes_at_override = null,
                          session = case when p_event = 'ohrr-online-auction' then 'all-day' else session end
   where id = r.id returning * into r;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (r.org_id, auth.uid(), 'auction.item_moved', 'raffle_item', r.id::text, jsonb_build_object('to', p_event, 'title', r.title));
  select * into s from auction_settings where org_id = r.org_id and event_slug = r.event_slug;
  return auction_item_json(r, s);
end $$;
grant execute on function auction_move_item(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- 2. Raffle prizes: handed over
-- -------------------------------------------------------------
alter table raffle_tickets add column if not exists handed_over_at timestamptz;
alter table raffle_tickets add column if not exists handed_over_by uuid references auth.users(id);
comment on column raffle_tickets.handed_over_at is 'When the winning ticket''s prize was handed over (null = not yet).';

-- The winner row the apps read gains when it was handed over and by whom.
create or replace function raffle_winner_json(p_ticket raffle_tickets)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ticket_id', p_ticket.id, 'no', p_ticket.ticket_no, 'drawn_at', p_ticket.drawn_at,
    'order_id', o.id, 'name', o.name, 'phone', o.phone, 'source', o.source,
    'prize_id', p_ticket.prize_id, 'prize', p.title,
    'handed_over_at', p_ticket.handed_over_at,
    'handed_over_by', (select coalesce(nullif(btrim(coalesce(m.display_name, '')), ''), split_part(u.email::text, '@', 1))
                         from memberships m join auth.users u on u.id = m.user_id
                        where m.org_id = p_ticket.org_id and m.user_id = p_ticket.handed_over_by
                        limit 1))
  from raffle_ticket_orders o
  left join raffle_prizes p on p.id = p_ticket.prize_id
  where o.id = p_ticket.order_id;
$$;

-- Tick or untick "Handed over" for a winning ticket.
create or replace function set_raffle_handed_over(p_ticket_id uuid, p_handed boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t raffle_tickets;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into t from raffle_tickets where id = p_ticket_id for update;
  if not found then raise exception 'No such ticket'; end if;
  if not has_permission(t.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if t.drawn_at is null then raise exception 'That ticket has not won a prize'; end if;
  update raffle_tickets
     set handed_over_at = case when p_handed then now() end,
         handed_over_by = case when p_handed then auth.uid() end
   where id = t.id returning * into t;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), case when p_handed then 'raffle.handed_over' else 'raffle.handed_back' end,
          'raffle_ticket', t.id::text, jsonb_build_object('no', t.ticket_no, 'prize_id', t.prize_id));
  return raffle_winner_json(t);
end $$;
grant execute on function set_raffle_handed_over(uuid, boolean) to authenticated;

-- Undoing a draw also clears "handed over".
create or replace function undo_raffle_draw(p_ticket_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t raffle_tickets;
begin
  select * into t from raffle_tickets where id = p_ticket_id;
  if not found then raise exception 'No such ticket'; end if;
  if not has_permission(t.org_id, 'events.bunfest.manage') then raise exception 'Not allowed'; end if;
  if t.prize_id is not null then update raffle_prizes set status = 'available' where id = t.prize_id; end if;
  update raffle_tickets set drawn_at = null, drawn_by = null, prize_id = null, handed_over_at = null, handed_over_by = null where id = p_ticket_id;
  insert into audit_log(org_id, actor_user_id, action, target_type, target_id, detail)
  values (t.org_id, auth.uid(), 'raffle.undraw', 'raffle_ticket', p_ticket_id::text, jsonb_build_object('no', t.ticket_no));
end $$;
grant execute on function undo_raffle_draw(uuid) to authenticated;

-- -------------------------------------------------------------
-- Check (the last result): four "true"
-- -------------------------------------------------------------
select
  exists (select 1 from information_schema.columns where table_name = 'raffle_tickets' and column_name = 'handed_over_at') as handed_over_saved,
  exists (select 1 from pg_proc where proname = 'set_raffle_handed_over') as handed_over_button,
  pg_get_functiondef('auction_public_on(uuid,text)'::regprocedure) !~ 'midwest' as any_event_shows,
  pg_get_functiondef('auction_move_item(uuid,text)'::regprocedure) !~ 'midwest' as items_move_to_any_event;
