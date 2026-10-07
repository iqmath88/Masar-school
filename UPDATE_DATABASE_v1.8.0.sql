-- Masar v1.8.0 — Production Stabilization
-- Safe/idempotent migration over v1.7.1
begin;

-- Preserve the teacher's academic/history record when an Auth/profile account is deleted.
alter table public.teachers alter column user_id drop not null;
alter table public.teachers drop constraint if exists teachers_user_id_fkey;
alter table public.teachers
  add constraint teachers_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Keep version metadata readable by signed-in clients.
grant select on table public.system_meta to authenticated;
alter table public.system_meta enable row level security;
drop policy if exists "authenticated read system meta" on public.system_meta;
create policy "authenticated read system meta" on public.system_meta
for select to authenticated using (true);

update public.system_meta
set db_version=8, app_version='1.8.0', updated_at=now()
where id=1;

commit;

select id,db_version,app_version,updated_at from public.system_meta where id=1;
