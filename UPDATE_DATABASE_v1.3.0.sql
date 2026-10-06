-- Masar v1.3.0 Smart Timetable
begin;
alter table public.timetable add column if not exists is_locked boolean not null default false;

create table if not exists public.teacher_availability (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_number smallint not null check (period_number between 1 and 12),
  preference text not null default 'available' check (preference in ('available','preferred','avoid','blocked')),
  primary key (teacher_id,day_of_week,period_number)
);
create table if not exists public.assignment_timetable_rules (
  assignment_id uuid primary key references public.teacher_assignments(id) on delete cascade,
  weekly_periods smallint not null default 1 check (weekly_periods between 1 and 12)
);
alter table public.teacher_availability enable row level security;
alter table public.assignment_timetable_rules enable row level security;
drop policy if exists "admin manage teacher availability" on public.teacher_availability;
create policy "admin manage teacher availability" on public.teacher_availability for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin manage timetable rules" on public.assignment_timetable_rules;
create policy "admin manage timetable rules" on public.assignment_timetable_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
update public.system_meta set db_version=3,app_version='1.3.0',updated_at=now() where id=1;
commit;
