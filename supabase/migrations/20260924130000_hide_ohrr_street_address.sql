-- =============================================================
-- OHRR — update 22: OHRR's street address off the "Rescues near you" list
--
-- OHRR (2026-09-24): keep the Adoption Center's street address off public
-- pages — people leave rabbits at the door, and OHRR then has to take them.
-- OHRR's own row in rescue_partners carried the street address, and the
-- website, the app and the BunFest site all show that list publicly. City and
-- state stay ("Columbus, OH").
--
-- The address stays where it is needed and not public: the booking types
-- (shown only after someone books), and the org profile (staff letters).
-- Only OHRR's own row, and only while it still holds the street. Idempotent.
-- =============================================================
update rescue_partners
   set address = null
 where is_host = true
   and address like '5485 N. High%';
