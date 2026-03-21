-- Add node_type column migration
-- Add node_type column to endeavors table to store the inherent type
-- This eliminates the need to derive rdfType from role assertions

alter table public.endeavors
add column if not exists node_type text;

-- Update existing endeavors to have node_type based on their current primary role
-- This is a one-time migration to populate the new column
with primary_roles as (
  select
    e.id,
    e.user_id,
    -- Get the highest confidence, most recent role for each endeavor
    (
      select ra.role
      from role_assertions ra
      where ra.endeavor_id = e.id
        and ra.user_id = e.user_id
        and (ra.expires_at is null or ra.expires_at > now())
      order by ra.confidence desc, ra.asserted_at desc
      limit 1
    ) as primary_role
  from endeavors e
)
update endeavors
set node_type = case primary_roles.primary_role
  when 'mission' then 'Mission'
  when 'aim' then 'Aim'
  when 'initiative' then 'Initiative'
  when 'task' then 'Task'
  when 'ritual' then 'Ritual'
  when 'strength' then 'Strength'
  when 'achievement' then 'Achievement'
  when 'goal' then 'Achievement'
  else 'Task'
end
from primary_roles
where endeavors.id = primary_roles.id
  and endeavors.node_type is null;

-- Set default for new rows
alter table public.endeavors
alter column node_type set default 'Task';

-- Add constraint to ensure valid node types
alter table public.endeavors
add constraint endeavors_node_type_check
check (node_type in ('Mission', 'Aim', 'Initiative', 'Task', 'Ritual', 'Strength', 'Achievement', 'DailyPage'));