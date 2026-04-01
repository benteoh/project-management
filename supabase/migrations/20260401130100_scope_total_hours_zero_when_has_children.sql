-- Scope rows with children funnel hours from the tree; persist total_hours as 0 like task/subtask parents.
UPDATE programme_nodes n
SET total_hours = 0
WHERE n.type = 'scope'
  AND EXISTS (SELECT 1 FROM programme_nodes c WHERE c.parent_id = n.id);
