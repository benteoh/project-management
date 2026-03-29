-- Programme WBS rows belong to exactly one project.

alter table programme_nodes
  add column if not exists project_id text references projects (id) on delete cascade;

update programme_nodes
set project_id = (select p.id from projects p order by p.id limit 1)
where project_id is null
  and exists (select 1 from projects);

delete from programme_nodes where project_id is null;

alter table programme_nodes alter column project_id set not null;

create index if not exists programme_nodes_project_id_idx on programme_nodes (project_id);
