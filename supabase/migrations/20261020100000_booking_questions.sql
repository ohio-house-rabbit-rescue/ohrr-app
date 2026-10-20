-- =============================================================
-- Update 43 (2026-10-20): questions on a booking form, and the
-- bunny bonding (bunny date) form filled in.
--
--   booking_types.questions   one question per line, kept by staff in
--                             Staff → Bookings → Set up. Choices follow a
--                             "|"; a "*" at the end of the question means it
--                             must be answered. The answers are saved in the
--                             booking's existing `answer`, one line each, so
--                             book_slot and the roster are unchanged.
--
-- The bonding session gets OHRR's own wording: the questions staff need to
-- plan a bunny date, and what to know before coming, from OHRR's "Bunny
-- Dates at OHRR" post and its bonding tips (Amy Shears). Only blanks are
-- filled, so anything staff have already typed stays. Safe to run twice.
-- =============================================================

alter table booking_types add column if not exists questions text;
alter table booking_types drop constraint if exists booking_types_questions_len;
alter table booking_types add constraint booking_types_questions_len
  check (questions is null or length(questions) <= 2000);

update booking_types
   set questions = E'Your bunny’s name *\nBoy or girl? | Boy | Girl | Not sure\nSpayed or neutered? * | Yes | No | Booked in\nAbout how old?'
 where slug = 'bonding-session' and questions is null;

update booking_types
   set requirements = E'Your bunny should be spayed or neutered, and a few weeks past the surgery, before bonding starts.\nPlan on being at the Adoption Center for about 1–2 hours.\nLook at the adoptable rabbits first: you’ll pick three for your bunny to meet. If one is in a foster home, tell us ahead of time so we can bring them to the Center.\nBring your bunny with you.'
 where slug = 'bonding-session' and requirements is null;

update booking_types
   set ask_reason = 'Which adoptable rabbits would you like your bunny to meet? (up to three)'
 where slug = 'bonding-session' and ask_reason like 'Tell us about your rabbit and what you%re looking for';

-- Check: two answers, both "true".
select
  exists (select 1 from information_schema.columns where table_name = 'booking_types' and column_name = 'questions') as questions_column,
  exists (select 1 from booking_types where slug = 'bonding-session' and questions is not null) as bonding_questions;
