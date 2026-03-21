-- Waitlist table migration
-- Create table for email signups and waitlist management

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  source text default 'web',
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Allow anonymous inserts for signup form
create policy "Allow anonymous inserts"
  on public.waitlist for insert
  to anon
  with check (true);

-- Allow service role to read all
create policy "Allow service role read"
  on public.waitlist for select
  to service_role
  using (true);

create index if not exists waitlist_email_idx on public.waitlist (email);