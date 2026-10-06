begin;
update public.system_meta set app_version='1.7.1', updated_at=now() where id=1;
commit;
