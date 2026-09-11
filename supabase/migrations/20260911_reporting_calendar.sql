create table if not exists public.reporting_calendar_cache (
  cache_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.reporting_calendar_cache enable row level security;
revoke all on public.reporting_calendar_cache from public, anon, authenticated;
grant select, insert, update, delete on public.reporting_calendar_cache to service_role;
