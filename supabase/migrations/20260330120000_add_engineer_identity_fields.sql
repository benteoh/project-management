-- Add first-class engineer identity fields for settings CRUD.
-- Keeps `code` as PK for current scope allocations, adds UUID identity.

create extension if not exists pgcrypto;

alter table if exists engineer_pool
  add column if not exists id uuid;

update engineer_pool
set id = gen_random_uuid()
where id is null;

alter table if exists engineer_pool
  alter column id set default gen_random_uuid(),
  alter column id set not null;

create unique index if not exists engineer_pool_id_key on engineer_pool (id);

alter table if exists engineer_pool
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';
