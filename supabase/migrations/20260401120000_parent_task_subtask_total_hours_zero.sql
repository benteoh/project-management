-- Parent task/subtask rows do not store their own total; app derives from children. Persist as 0.
UPDATE programme_nodes n
SET total_hours = 0
WHERE n.type IN ('task', 'subtask')
  AND EXISTS (SELECT 1 FROM programme_nodes c WHERE c.parent_id = n.id);
