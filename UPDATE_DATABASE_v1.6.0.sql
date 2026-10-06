-- Masar v1.6.0 Hotfix — database compatibility + flexible timetable
begin;

-- 1) Locking support required by v1.6.0
alter table public.timetable
  add column if not exists is_locked boolean not null default false;

create index if not exists idx_timetable_is_locked
  on public.timetable(is_locked);

-- 2) Flexible periods per weekday (this is the table used by the application)
create table if not exists public.school_timetable_settings (
  day_of_week smallint primary key check (day_of_week between 1 and 7),
  periods_count smallint not null default 7 check (periods_count between 0 and 12),
  updated_at timestamptz not null default now()
);

-- Default school week. Existing values are never overwritten.
insert into public.school_timetable_settings(day_of_week, periods_count)
values
  (1,7), -- الأحد
  (2,7), -- الاثنين
  (3,6), -- الثلاثاء
  (4,7), -- الأربعاء
  (5,5), -- الخميس
  (6,0), -- الجمعة
  (7,0)  -- السبت
on conflict (day_of_week) do nothing;

-- If the earlier timetable_day_settings table was created, copy the active year's
-- values into the table actually used by v1.6.0.
do $$
begin
  if to_regclass('public.timetable_day_settings') is not null then
    execute $q$
      insert into public.school_timetable_settings(day_of_week, periods_count, updated_at)
      select t.day_of_week::smallint, t.periods_count::smallint, now()
      from public.timetable_day_settings t
      join public.academic_years ay on ay.id = t.academic_year_id
      where ay.is_active = true
      on conflict (day_of_week) do update
      set periods_count = excluded.periods_count,
          updated_at = now()
    $q$;
  end if;
end $$;

-- 3) Permissions / RLS
alter table public.school_timetable_settings enable row level security;
grant select, insert, update, delete on public.school_timetable_settings to authenticated;

drop policy if exists "authenticated read timetable settings" on public.school_timetable_settings;
create policy "authenticated read timetable settings"
on public.school_timetable_settings
for select to authenticated
using (true);

drop policy if exists "admin manage timetable settings" on public.school_timetable_settings;
create policy "admin manage timetable settings"
on public.school_timetable_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 4) system_meta must be readable by the signed-in client
alter table public.system_meta enable row level security;
grant select on public.system_meta to authenticated;
drop policy if exists "authenticated read system meta" on public.system_meta;
create policy "authenticated read system meta"
on public.system_meta
for select to authenticated
using (true);

-- 5) Mark database as compatible with v1.6.0
update public.system_meta
set db_version = 6,
    app_version = '1.6.0',
    updated_at = now()
where id = 1;

commit;

-- Verification
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='timetable' and column_name='is_locked';

select day_of_week, periods_count
from public.school_timetable_settings
order by day_of_week;

select id, db_version, app_version
from public.system_meta
where id=1;
