-- =============================================================
-- OHRR — update 21: the Bunny Socialization health note
--
-- The shift's requirements said "Because of COVID, we must account for all
-- people in the building." OHRR (2026-09-24): drop the COVID framing, but keep
-- the care it stood for, since COVID is still around. The rule stays (a
-- parent signs up for their own slot, so OHRR knows who is in the building)
-- and a plain health note replaces the COVID reason.
--
-- Staff can change the wording any time: Staff -> Volunteer opportunities.
-- Only the exact old sentence is replaced, so a later edit is never undone.
-- Idempotent.
-- =============================================================
update volunteer_opportunities
   set detail = replace(
         detail,
         'If you are a parent accompanying a child, you must sign up for a volunteer slot also. Because of COVID, we must account for all people in the building.',
         'If you are a parent accompanying a child, you must sign up for a volunteer slot also, so we know everyone who is in the building. COVID and other illnesses are still around: if you are feeling unwell, please reschedule your shift.'
       )
 where detail like '%Because of COVID, we must account for all people in the building.%';
