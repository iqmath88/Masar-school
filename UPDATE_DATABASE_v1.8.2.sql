-- Masar v1.8.2 — Timetable Visual Identity & Complete Staff Account Register
begin;
alter table public.teachers add column if not exists notes text;
update public.system_meta set db_version=10, app_version='1.8.2', updated_at=now() where id=1;
commit;
select id,db_version,app_version,updated_at from public.system_meta where id=1;
