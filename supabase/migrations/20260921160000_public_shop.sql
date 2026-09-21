-- =============================================================
-- OHRR App — the Hop Shop shelf, public
--
-- Staff scan stock into hopshop_products (+ hopshop_inventory counts); until
-- now only signed-in members could read those rows, so the public Hop Shop
-- page could never show what is actually on the shelf. This adds ONE read-only
-- function the public may call: active products with their photo, price and
-- whether any are left. No prices are charged in the app — people buy at the
-- Adoption Center counter (in-app payment attaches later).
--
-- Apply AFTER 20260920100000_item_tags.sql. Paste + Run in the Supabase SQL
-- editor. Idempotent.
-- =============================================================

create or replace function hopshop_public_products()
returns table (
  id uuid, name text, description text, price_cents int, photo_url text, in_stock boolean
) language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.description, p.price_cents, p.photo_url,
         -- no inventory row = never counted = assume it is there
         coalesce(i.quantity, 1) > 0 as in_stock
    from hopshop_products p
    left join hopshop_inventory i on i.product_id = p.id
   where p.is_active
   order by (coalesce(i.quantity, 1) > 0) desc, p.name;
$$;
grant execute on function hopshop_public_products() to anon, authenticated;
