-- Masar v1.6.0 — flexible timetable settings
begin;
create table if not exists public.school_timetable_settings (
  day_of_week smallint primary key check (day_of_week between 1 and 7),
  periods_count smallint not null default 7 check (periods_count between 0 and 12),
  updated_at timestamptz not null default now()
);
insert into public.school_timetable_settings(day_of_week,periods_count) values (1,7),(2,7),(3,7),(4,7),(5,7) on conflict(day_of_week) do nothing;
alter table public.school_timetable_settings enable row level security;
grant select,insert,update,delete on table public.school_timetable_settings to authenticated;
drop policy if exists "admin manage timetable settings" on public.school_timetable_settings;
create policy "admin manage timetable settings" on public.school_timetable_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
update public.system_meta set db_version=6,app_version='1.6.0',updated_at=now() where id=1;
commit;
