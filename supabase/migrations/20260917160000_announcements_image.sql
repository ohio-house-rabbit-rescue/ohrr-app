-- =============================================================
-- OHRR App — Announcements: optional image
--
-- Staff can attach a photo to an announcement (fundraiser artwork, event
-- flyer, license plate…) so the website home/news and the app cards show an
-- image. Uploads go to the public `site-images` bucket (created by the
-- hero_slides migration). Idempotent.
-- =============================================================
alter table announcements add column if not exists image_url text;
