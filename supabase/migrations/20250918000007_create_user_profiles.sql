-- User profiles migration
-- Create table for storing user context and LLM personalization preferences

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  about_me text,
  llm_personalization text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Enable read for owners"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Enable insert for owners"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Enable update for owners"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at on user_profiles
create trigger handle_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.handle_updated_at();