-- Artifacts table for unstructured → structured node storage
create table if not exists public.artifacts (
  id text primary key,
  user_id uuid not null,
  rdf_type text not null check (rdf_type in ('Mission', 'Aim', 'Initiative', 'Strength', 'Task', 'Ritual', 'Achievement')),
  raw text not null default '',
  derived jsonb not null default '[]'::jsonb,
  primary_index int,
  -- Triples
  parent text,
  contributes_to text[] default array[]::text[],
  practices text,
  frequency text,
  tags text[] default array[]::text[],
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ensure unique id per user
  constraint artifacts_user_id_uniq unique (user_id, id)
);

-- Index for fast lookups
create index if not exists idx_artifacts_user_id on public.artifacts(user_id);
create index if not exists idx_artifacts_parent on public.artifacts(parent);
create index if not exists idx_artifacts_rdf_type on public.artifacts(rdf_type);

-- RLS policies
alter table public.artifacts enable row level security;

create policy "Enable read for owners"
  on public.artifacts for select
  using (auth.uid() = user_id);

create policy "Enable insert for owners"
  on public.artifacts for insert
  with check (auth.uid() = user_id);

create policy "Enable update for owners"
  on public.artifacts for update
  using (auth.uid() = user_id);

create policy "Enable delete for owners"
  on public.artifacts for delete
  using (auth.uid() = user_id);

-- Update trigger for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_artifacts_updated_at
  before update on public.artifacts
  for each row
  execute function public.update_updated_at_column();