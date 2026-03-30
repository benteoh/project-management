-- DSP project intelligence: full initial schema (single migration for greenfield DBs).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table projects (
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

-- ---------------------------------------------------------------------------
-- Programme / WBS
-- ---------------------------------------------------------------------------

create table programme_nodes (
  id                   text primary key,
  project_id           text not null references projects (id) on delete cascade,
  activity_id          text,
  name                 text not null,
  type                 text not null check (type in ('scope', 'task', 'subtask', 'activity')),
  total_hours          numeric,
  start_date           text,
  finish_date          text,
  forecast_total_hours numeric,
  status               text not null default '' check (status in ('Not Started', 'In Progress', 'Completed', '')),
  parent_id            text references programme_nodes (id) on delete cascade,
  position             integer not null default 0,
  updated_at           timestamptz not null default now()
);

create index programme_nodes_parent_id_idx on programme_nodes (parent_id);
create index programme_nodes_project_id_idx on programme_nodes (project_id);

-- ---------------------------------------------------------------------------
-- Engineer pool (UUID identity + capacity; `code` remains primary key for stable labels)
-- ---------------------------------------------------------------------------

create table engineer_pool (
  code               text primary key,
  id                 uuid not null default gen_random_uuid (),
  is_active          boolean not null default true,
  first_name         text not null default '',
  last_name          text not null default '',
  capacity_per_week  numeric,
  capacity_days      numeric[]
);

create unique index engineer_pool_id_key on engineer_pool (id);

-- ---------------------------------------------------------------------------
-- Scope ↔ engineer allocations (by engineer id)
-- ---------------------------------------------------------------------------

create table scope_engineers (
  id           uuid primary key default gen_random_uuid (),
  scope_id     text not null references programme_nodes (id) on delete cascade,
  engineer_id  uuid not null references engineer_pool (id) on delete cascade,
  is_lead      boolean not null default false,
  planned_hrs  numeric,
  forecast_hrs numeric,
  position     integer not null default 0,
  unique (scope_id, engineer_id)
);

create index scope_engineers_scope_id_idx on scope_engineers (scope_id);

-- ---------------------------------------------------------------------------
-- Engineers assigned to a project with up to five rate slots (A–E)
-- ---------------------------------------------------------------------------

create table project_engineers (
  id           uuid primary key default gen_random_uuid (),
  project_id   text not null references projects (id) on delete cascade,
  engineer_id  uuid not null references engineer_pool (id) on delete cascade,
  rate_a       numeric,
  rate_b       numeric,
  rate_c       numeric,
  rate_d       numeric,
  rate_e       numeric,
  unique (project_id, engineer_id)
);

create index project_engineers_project_id_idx on project_engineers (project_id);

-- ---------------------------------------------------------------------------
-- Row level security (dev-friendly open policies)
-- ---------------------------------------------------------------------------

alter table projects enable row level security;
alter table programme_nodes enable row level security;
alter table engineer_pool enable row level security;
alter table scope_engineers enable row level security;
alter table project_engineers enable row level security;

drop policy if exists "projects_allow_all" on projects;
create policy "projects_allow_all" on projects
  for all using (true) with check (true);

drop policy if exists "programme_nodes_allow_all" on programme_nodes;
create policy "programme_nodes_allow_all" on programme_nodes
  for all using (true) with check (true);

drop policy if exists "engineer_pool_allow_all" on engineer_pool;
create policy "engineer_pool_allow_all" on engineer_pool
  for all using (true) with check (true);

drop policy if exists "scope_engineers_allow_all" on scope_engineers;
create policy "scope_engineers_allow_all" on scope_engineers
  for all using (true) with check (true);

drop policy if exists "project_engineers_allow_all" on project_engineers;
create policy "project_engineers_allow_all" on project_engineers
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on projects to anon, authenticated, service_role;
grant select, insert, update, delete on programme_nodes to anon, authenticated, service_role;
grant select, insert, update, delete on engineer_pool to anon, authenticated, service_role;
grant select, insert, update, delete on scope_engineers to anon, authenticated, service_role;
grant select, insert, update, delete on project_engineers to anon, authenticated, service_role;
