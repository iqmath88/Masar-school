-- Masar v1.4.0 — Teacher Workload & Smart Scheduling
begin;
grant select on table public.system_meta to authenticated;
grant select, insert, update, delete on table public.teacher_availability to authenticated;
grant select, insert, update, delete on table public.assignment_timetable_rules to authenticated;
grant select, insert, update, delete on table public.timetable to authenticated;
update public.system_meta set db_version=greatest(db_version,4),app_version='1.4.0',updated_at=now() where id=1;
commit;
