-- Masar v1.2.0 - one-time initialization for update/version tracking
-- Safe foundation: does not store privileged keys in the browser.

begin;

create table if not exists public.system_meta (
  id smallint primary key default 1 check (id = 1),
  db_version integer not null default 1 check (db_version >= 1),
  app_version text,
  updated_at timestamptz not null default now()
);

insert into public.system_meta (id, db_version, app_version)
values (1, 2, '1.2.0')
on conflict (id) do update
set db_version = greatest(public.system_meta.db_version, excluded.db_version),
    app_version = excluded.app_version,
    updated_at = now();

alter table public.system_meta enable row level security;

drop policy if exists "Authenticated users can read system meta" on public.system_meta;
create policy "Authenticated users can read system meta"
on public.system_meta for select
to authenticated
using (true);

-- Only database/service administrators may change version metadata.
-- No browser client write policy is intentionally created.

commit;
