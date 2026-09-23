-- =============================================================
-- OHRR — email, not the phone
--
-- OHRR is run entirely by volunteers and email is how people reach it; the
-- phone isn't for emergencies (OHRR, 2026-09-23). The app and the website no
-- longer show the number anywhere but the one place OHRR's own site does: the
-- small print at the bottom of each page (the website footer, and the app's
-- About page).
--
-- The one place the number was typed into content is OHRR's own entry in the
-- BunFest rescue-partner list, which the BunFest pages show with contact
-- details. midwestbunfest.org shows no phone for OHRR, so it goes; the email
-- stays. The number itself stays in OHRR details (Staff -> OHRR details).
--
-- Idempotent.
-- =============================================================
update rescue_partners
   set phone = null
 where name ilike 'Ohio House Rabbit Rescue'
   and phone is not null;
