-- Masar v1.8.1 — Bulk Teaching Staff Import
begin;
alter table public.teachers add column if not exists full_name text;
update public.teachers t set full_name=p.full_name from public.profiles p where t.user_id=p.id and (t.full_name is null or btrim(t.full_name)='');
update public.system_meta set db_version=9, app_version='1.8.1', updated_at=now() where id=1;
commit;
select id,db_version,app_version,updated_at from public.system_meta where id=1;
