-- Project header metadata (one row per project; programme data stays in programme_* tables for now).

create table if not exists projects (
  id           text primary key,
  name         text not null,
  client       text not null,
  office       text not null,
  status       text not null check (status in ('active', 'complete', 'bid', 'on_hold')),
  fixed_fee    numeric not null,
  start_date   text not null,
  end_date     text not null,
  updated_at   timestamptz not null default now()
);

alter table projects enable row level security;

drop policy if exists "projects_allow_all" on projects;
create policy "projects_allow_all" on projects
  for all using (true) with check (true);

grant select, insert, update, delete on projects to anon, authenticated, service_role;
