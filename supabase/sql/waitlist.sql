create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  source text default 'web',
  created_at timestamptz not null default now()
);

create index if not exists waitlist_email_idx on public.waitlist (email);

