-- Update 34 (2026-09-29): the mobile vet clinic, bookable on Saturdays.
-- Update 33 tried to add the `vet-clinic` booking type, but a hidden one already
-- existed from the bookings seed (2026-09-21), so its insert was skipped and no
-- times were made. This sets that existing type to OHRR's Saturday clinic:
-- noon–4 PM at the Adoption Center, one rabbit per 15-minute time, confirmed by
-- staff, and shows it to the public. Staff can change any of it in
-- Staff → Bookings → Set up. Safe to run more than once.

update booking_types
   set name = 'Mobile vet clinic',
       description = 'A rabbit-savvy vet at the OHRR Adoption Center on Saturdays for nail trims, wellness checks and microchipping. One rabbit per 15-minute time.',
       location = 'OHRR Adoption Center',
       duration_min = 15, capacity = 1, max_party = 1, min_lead_hours = 12,
       confirm_mode = 'staff',
       ask_reason = 'What does your rabbit need? (nail trim, wellness check, microchip)',
       weekly = '[{"days":[6],"start":"12:00","end":"12:15","capacity":1},{"days":[6],"start":"12:15","end":"12:30","capacity":1},{"days":[6],"start":"12:30","end":"12:45","capacity":1},{"days":[6],"start":"12:45","end":"13:00","capacity":1},{"days":[6],"start":"13:00","end":"13:15","capacity":1},{"days":[6],"start":"13:15","end":"13:30","capacity":1},{"days":[6],"start":"13:30","end":"13:45","capacity":1},{"days":[6],"start":"13:45","end":"14:00","capacity":1},{"days":[6],"start":"14:00","end":"14:15","capacity":1},{"days":[6],"start":"14:15","end":"14:30","capacity":1},{"days":[6],"start":"14:30","end":"14:45","capacity":1},{"days":[6],"start":"14:45","end":"15:00","capacity":1},{"days":[6],"start":"15:00","end":"15:15","capacity":1},{"days":[6],"start":"15:15","end":"15:30","capacity":1},{"days":[6],"start":"15:30","end":"15:45","capacity":1},{"days":[6],"start":"15:45","end":"16:00","capacity":1}]'::jsonb,
       sort_order = 40,
       is_published = true,
       slots_filled_on = null
 where slug = 'vet-clinic'
   and org_id = (select id from organizations where name = 'Ohio House Rabbit Rescue' limit 1);

-- Clear any older, unbooked future times, then make the Saturday times.
delete from booking_slots s
 using booking_types t
 where s.type_id = t.id and t.slug = 'vet-clinic' and s.starts_at > now()
   and not exists (select 1 from bookings b where b.slot_id = s.id);

select fill_booking_slots(id, false) as times_made from booking_types where slug = 'vet-clinic';
