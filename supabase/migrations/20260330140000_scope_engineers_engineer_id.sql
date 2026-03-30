-- scope_engineers: reference engineers by id (engineer_pool.id) instead of code.

alter table if exists scope_engineers
  add column if not exists engineer_id uuid;

update scope_engineers se
set engineer_id = ep.id
from engineer_pool ep
where se.engineer_code = ep.code;

delete from scope_engineers where engineer_id is null;

alter table scope_engineers alter column engineer_id set not null;

alter table scope_engineers drop constraint if exists scope_engineers_engineer_code_fkey;
alter table scope_engineers drop constraint if exists scope_engineers_scope_id_engineer_code_key;

alter table scope_engineers drop column if exists engineer_code;

alter table scope_engineers
  add constraint scope_engineers_engineer_id_fkey
  foreign key (engineer_id) references engineer_pool (id) on delete cascade;

create unique index if not exists scope_engineers_scope_id_engineer_id_key
  on scope_engineers (scope_id, engineer_id);
