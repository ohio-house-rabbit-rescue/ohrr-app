-- =============================================================
-- OHRR — who signs the volunteer-hours letters, and a speaker's name
--
--   Letter signer   Beverly May, Founding Director and Shelter Manager — named
--                   by OHRR (2026-09-23); the title is as OHRR's own site
--                   gives it (ohiohouserabbitrescue.org/about-us/volunteer-family).
--   EIN             27-0830606, OHRR's IRS number as GuideStar and Charity
--                   Navigator list it; school and military letters print it
--                   beside "a nonprofit organization".
--   Karen Winstead  The 2026 bonding talk had her as "Winsted"; Ohio State,
--                   where she is a professor, spells it Winstead (and so does
--                   her speaker bio).
--
-- Only blanks are filled: anything staff have already typed under Staff ->
-- OHRR details stays as it is. Idempotent.
-- =============================================================
do $$
declare
  v_org uuid;
begin
  select id into v_org from organizations where name = 'Ohio House Rabbit Rescue' limit 1;
  if v_org is null then return; end if;

  update app_settings
     set value = value
       || case when coalesce(value ->> 'letter_signer_name', '') = ''
               then jsonb_build_object('letter_signer_name', 'Beverly May') else '{}'::jsonb end
       || case when coalesce(value ->> 'letter_signer_title', '') = ''
               then jsonb_build_object('letter_signer_title', 'Founding Director and Shelter Manager') else '{}'::jsonb end
       || case when coalesce(value ->> 'ein', '') = ''
               then jsonb_build_object('ein', '27-0830606') else '{}'::jsonb end
   where org_id = v_org and key = 'org_profile';

  update bunfest_sessions
     set presenter = replace(presenter, 'Karen Winsted ', 'Karen Winstead ')
   where org_id = v_org and presenter like '%Karen Winsted %';
end $$;
