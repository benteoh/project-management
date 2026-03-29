-- Programme / WBS tables (engineer pool, flat tree with parent_id, scope allocations).
-- Remote:  npx supabase link   then   npx supabase db push
-- Or: Dashboard → SQL Editor → paste and run.

create extension if not exists pgcrypto;

create table if not exists programme_nodes (
  id                   text primary key,
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

create table if not exists engineer_pool (
  code      text primary key,
  is_active boolean not null default true
);

create table if not exists scope_engineers (
  id             uuid primary key default gen_random_uuid(),
  scope_id       text not null references programme_nodes (id) on delete cascade,
  engineer_code  text not null references engineer_pool (code) on delete cascade,
  is_lead        boolean not null default false,
  planned_hrs    numeric,
  forecast_hrs   numeric,
  position       integer not null default 0,
  unique (scope_id, engineer_code)
);

create index if not exists programme_nodes_parent_id_idx on programme_nodes (parent_id);
create index if not exists scope_engineers_scope_id_idx on scope_engineers (scope_id);

alter table programme_nodes enable row level security;
alter table engineer_pool enable row level security;
alter table scope_engineers enable row level security;

drop policy if exists "programme_nodes_allow_all" on programme_nodes;
create policy "programme_nodes_allow_all" on programme_nodes
  for all using (true) with check (true);

drop policy if exists "engineer_pool_allow_all" on engineer_pool;
create policy "engineer_pool_allow_all" on engineer_pool
  for all using (true) with check (true);

drop policy if exists "scope_engineers_allow_all" on scope_engineers;
create policy "scope_engineers_allow_all" on scope_engineers
  for all using (true) with check (true);

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on programme_nodes to anon, authenticated, service_role;
grant select, insert, update, delete on engineer_pool to anon, authenticated, service_role;
grant select, insert, update, delete on scope_engineers to anon, authenticated, service_role;
