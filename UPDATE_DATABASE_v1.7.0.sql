-- Masar v1.7.0 — Teacher/Admin management foundation
-- Safe/idempotent migration over v1.6.1
begin;

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;

-- Administrators can maintain profiles, while users retain self-read access.
drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin insert profiles" on public.profiles;
create policy "admin insert profiles" on public.profiles for insert to authenticated
with check (public.is_admin());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.teachers to authenticated;
grant select, insert, update, delete on public.teacher_assignments to authenticated;

-- Explicit admin management policies for teacher records and assignments.
alter table public.teachers enable row level security;
drop policy if exists "admin manage teachers" on public.teachers;
create policy "admin manage teachers" on public.teachers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage assignments" on public.teacher_assignments;
create policy "admin manage assignments" on public.teacher_assignments for all to authenticated
using (public.is_admin()) with check (public.is_admin());

update public.system_meta
set app_version='1.7.0', updated_at=now()
where id=1;

commit;
