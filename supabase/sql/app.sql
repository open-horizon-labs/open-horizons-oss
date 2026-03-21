-- Daily pages storage (user-scoped, per context + date)
create table if not exists public.daily_pages (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  context_id text not null,
  "date" date not null,
  body text not null default '',
  fm jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint daily_pages_uniq unique (user_id, context_id, "date")
);

alter table public.daily_pages enable row level security;

create policy "Enable read for owners"
  on public.daily_pages for select
  using (auth.uid() = user_id);

create policy "Enable insert for owners"
  on public.daily_pages for insert
  with check (auth.uid() = user_id);

create policy "Enable update for owners"
  on public.daily_pages for update
  using (auth.uid() = user_id);

-- Endeavors: Single canonical node type for graph-based system
create table if not exists public.endeavors (
  id text primary key,
  user_id uuid not null,
  title text,
  description text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.endeavors enable row level security;

create policy "Enable read for owners"
  on public.endeavors for select
  using (auth.uid() = user_id);

create policy "Enable insert for owners"
  on public.endeavors for insert
  with check (auth.uid() = user_id);

create policy "Enable update for owners"
  on public.endeavors for update
  using (auth.uid() = user_id);

create policy "Enable delete for owners"
  on public.endeavors for delete
  using (auth.uid() = user_id);

-- Role assertions: Dynamic role assignments for endeavors
create table if not exists public.role_assertions (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  endeavor_id text not null references public.endeavors(id) on delete cascade,
  role text not null, -- 'mission', 'aim', 'initiative', 'ritual', etc.
  context text, -- Additional context or qualifier for the role
  asserted_at timestamptz not null default now(),
  expires_at timestamptz, -- Optional expiration for temporal roles
  confidence real default 1.0, -- 0.0-1.0 confidence in this role assertion
  source text default 'manual', -- 'manual', 'llm', 'inferred', etc.
  constraint role_assertions_uniq unique (user_id, endeavor_id, role, context)
);

alter table public.role_assertions enable row level security;

create policy "Enable read for owners"
  on public.role_assertions for select
  using (auth.uid() = user_id);

create policy "Enable insert for owners"
  on public.role_assertions for insert
  with check (auth.uid() = user_id);

create policy "Enable update for owners"
  on public.role_assertions for update
  using (auth.uid() = user_id);

create policy "Enable delete for owners"
  on public.role_assertions for delete
  using (auth.uid() = user_id);

-- Edges: Relationships between endeavors
create table if not exists public.edges (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  from_endeavor_id text not null references public.endeavors(id) on delete cascade,
  to_endeavor_id text not null references public.endeavors(id) on delete cascade,
  relationship text not null, -- 'supports', 'refines', 'supersedes', 'blocks', 'enables', etc.
  weight real default 1.0, -- Strength of the relationship
  context text, -- Additional context for the relationship
  created_at timestamptz not null default now(),
  expires_at timestamptz, -- Optional expiration for temporal relationships
  metadata jsonb not null default '{}'::jsonb,
  constraint edges_uniq unique (user_id, from_endeavor_id, to_endeavor_id, relationship, context)
);

alter table public.edges enable row level security;

create policy "Enable read for owners"
  on public.edges for select
  using (auth.uid() = user_id);

create policy "Enable insert for owners"
  on public.edges for insert
  with check (auth.uid() = user_id);

create policy "Enable update for owners"
  on public.edges for update
  using (auth.uid() = user_id);

create policy "Enable delete for owners"
  on public.edges for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists endeavors_user_id_idx on public.endeavors(user_id);
create index if not exists role_assertions_user_endeavor_idx on public.role_assertions(user_id, endeavor_id);
create index if not exists role_assertions_role_idx on public.role_assertions(role);
create index if not exists edges_user_from_idx on public.edges(user_id, from_endeavor_id);
create index if not exists edges_user_to_idx on public.edges(user_id, to_endeavor_id);
create index if not exists edges_relationship_idx on public.edges(relationship);
