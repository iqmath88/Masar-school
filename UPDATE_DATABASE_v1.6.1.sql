-- Masar v1.6.1 — Smart Timetable compatibility hotfix
-- Idempotent: safe to run more than once.
begin;

alter table public.timetable
  add column if not exists is_locked boolean not null default false;

create table if not exists public.teacher_availability (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  period_number smallint not null check (period_number between 1 and 12),
  preference text not null default 'available' check (preference in ('available','preferred','avoid','blocked')),
  primary key (teacher_id, day_of_week, period_number)
);

create table if not exists public.assignment_timetable_rules (
  assignment_id uuid primary key references public.teacher_assignments(id) on delete cascade,
  weekly_periods smallint not null default 1 check (weekly_periods between 1 and 12)
);

create table if not exists public.timetable_day_settings (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  periods_count integer not null default 7 check (periods_count between 0 and 12),
  is_working_day boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, day_of_week)
);

insert into public.timetable_day_settings
  (academic_year_id, day_of_week, periods_count, is_working_day)
select ay.id, d.day_of_week, d.periods_count, d.is_working_day
from public.academic_years ay
cross join (values
  (1,7,true),(2,7,true),(3,6,true),(4,7,true),(5,5,true),(6,0,false),(7,0,false)
) as d(day_of_week,periods_count,is_working_day)
on conflict (academic_year_id,day_of_week) do nothing;

alter table public.teacher_availability enable row level security;
alter table public.assignment_timetable_rules enable row level security;
alter table public.timetable_day_settings enable row level security;

grant select,insert,update,delete on public.teacher_availability to authenticated;
grant select,insert,update,delete on public.assignment_timetable_rules to authenticated;
grant select,insert,update,delete on public.timetable_day_settings to authenticated;
grant select on public.system_meta to authenticated;

drop policy if exists "admin manage teacher availability" on public.teacher_availability;
create policy "admin manage teacher availability" on public.teacher_availability
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin manage timetable rules" on public.assignment_timetable_rules;
create policy "admin manage timetable rules" on public.assignment_timetable_rules
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated read timetable day settings" on public.timetable_day_settings;
create policy "authenticated read timetable day settings" on public.timetable_day_settings
for select to authenticated using (true);

drop policy if exists "admin manage timetable day settings" on public.timetable_day_settings;
create policy "admin manage timetable day settings" on public.timetable_day_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

update public.system_meta
set db_version=6, app_version='1.6.1', updated_at=now()
where id=1;

commit;

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('teacher_availability','assignment_timetable_rules','timetable_day_settings')
order by table_name;
