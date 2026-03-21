-- Add archiving support to endeavors table
-- This allows marking endeavors as archived while preserving them in the RDF graph

-- Add archiving fields
alter table public.endeavors 
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

-- Add index for performance when filtering out archived endeavors
create index if not exists endeavors_archived_at_idx on public.endeavors(archived_at) 
  where archived_at is not null;

-- Add index for active endeavors (most common query pattern)
create index if not exists endeavors_active_idx on public.endeavors(user_id) 
  where archived_at is null;

-- Update the existing created_at to be more explicit (birth timestamp)
comment on column public.endeavors.created_at is 'Birth timestamp - when the endeavor was first created';
comment on column public.endeavors.archived_at is 'Archive timestamp - when the endeavor was archived (null = active)';
comment on column public.endeavors.archived_reason is 'Optional reason for archiving (e.g., "completed", "cancelled", "superseded")';