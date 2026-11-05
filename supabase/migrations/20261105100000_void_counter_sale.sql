-- =============================================================
-- Update 57: undo a sale at the Sell screen (2026-11-05)
-- Run AFTER update 56. Safe to run twice.
--
-- Until now a sale was recorded the moment "Paid by card" or "Paid cash" was
-- tapped, and nothing could take it back. "Undo this sale" marks the sale as
-- undone (it is kept, not deleted, so the day's record still shows what
-- happened), puts the stock back, and leaves it out of Today's sales.
--
--   * Only the person who rang the sale up, or someone who can see Hop Shop
--     orders, can undo it.
--   * It only changes the record. The app never moves money: the cash goes
--     back to the customer, or the card reader refunds the card, by hand.
--   * Undoing twice does nothing the second time.
-- =============================================================

alter table counter_sales add column if not exists voided_at timestamptz;
alter table counter_sales add column if not exists voided_by uuid references auth.users(id);

create or replace function void_counter_sale(p_org uuid, p_sale uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sale counter_sales%rowtype;
  l      record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not counter_can_sell(p_org) then raise exception 'Not allowed'; end if;

  select * into v_sale from counter_sales where id = p_sale and org_id = p_org for update;
  if not found then
    -- Never reached the database (the phone sends sales first, then undos), so there is nothing to undo.
    return jsonb_build_object('id', p_sale, 'missing', true);
  end if;
  if v_sale.voided_at is not null then
    return jsonb_build_object('id', p_sale, 'already', true);
  end if;
  if v_sale.sold_by is distinct from auth.uid() and not has_permission(p_org, 'hopshop.orders.view') then
    raise exception 'Only the person who rang up the sale can undo it';
  end if;

  update counter_sales set voided_at = now(), voided_by = auth.uid() where id = p_sale;

  -- Stock back on the shelf, per item.
  for l in
    select product_id, sum(qty)::int as qty
      from counter_sale_lines
     where sale_id = p_sale and product_id is not null
     group by product_id
  loop
    update hopshop_inventory set quantity = quantity + l.qty, updated_by = auth.uid()
     where product_id = l.product_id;
  end loop;

  return jsonb_build_object('id', p_sale, 'voided', true, 'total_cents', v_sale.total_cents);
end $$;
grant execute on function void_counter_sale(uuid, uuid) to authenticated;

-- Today's sales leaves undone sales out of every total and says how many were undone.
create or replace function counter_day(p_org uuid, p_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (
    select * from counter_sales
     where org_id = p_org and (sold_at at time zone 'America/New_York')::date = p_day
  ), s as (
    select * from d where voided_at is null
  )
  select jsonb_build_object(
    'sales', (select count(*) from s),
    'voided', (select count(*) from d where voided_at is not null),
    'cash_cents', (select coalesce(sum(total_cents), 0) from s where method = 'cash'),
    'card_cents', (select coalesce(sum(total_cents), 0) from s where method = 'card'),
    'other_cents', (select coalesce(sum(total_cents), 0) from s where method = 'other'),
    'items', coalesce((select jsonb_agg(x order by x.cents desc) from (
                select l.name, sum(l.qty)::int as qty, sum(coalesce(l.line_cents, l.qty * l.price_cents))::int as cents
                  from counter_sale_lines l join s on s.id = l.sale_id
                 group by l.name) x), '[]'::jsonb))
  where counter_can_sell(p_org) or has_permission(p_org, 'hopshop.orders.view');
$$;
grant execute on function counter_day(uuid, date) to authenticated;

-- -------------------------------------------------------------
-- Check (the last result): three "true"
-- -------------------------------------------------------------
select
  exists (select 1 from information_schema.columns where table_name = 'counter_sales' and column_name = 'voided_at') as sales_can_be_undone,
  exists (select 1 from pg_proc where proname = 'void_counter_sale') as undo_made,
  pg_get_functiondef('counter_day(uuid, date)'::regprocedure) like '%voided_at is null%' as todays_totals_skip_undone;
