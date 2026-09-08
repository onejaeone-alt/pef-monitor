-- Applied with Supabase migration news_reader_private_accounts_v1. No existing reporting tables changed.
create table public.news_reader_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('read','opened','bookmark','hidden','override','watch')),
 record_key text not null check (record_key ~ '^[a-f0-9]{64}$'),
 value jsonb check (value is null or (jsonb_typeof(value)='object' and value ? 'key' and value ? 'data' and octet_length(value::text)<=24000)),
 updated_at timestamptz not null default now(),
 primary key (user_id,kind,record_key)
);
alter table public.news_reader_records enable row level security;
alter table public.news_reader_records force row level security;
revoke all on public.news_reader_records from public, anon;
grant select,insert,update on public.news_reader_records to authenticated;
grant all on public.news_reader_records to service_role;
create policy news_reader_owner on public.news_reader_records for all to authenticated
 using ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false')
 with check ((select auth.uid())=user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false');
create table public.news_reader_rate_limits (
 bucket text primary key check (bucket ~ '^[a-f0-9]{64}$'),
 uses integer not null,
 expires_at timestamptz not null
);
create index news_reader_rate_expires on public.news_reader_rate_limits(expires_at);
alter table public.news_reader_rate_limits enable row level security;
revoke all on public.news_reader_rate_limits from public,anon,authenticated;
grant all on public.news_reader_rate_limits to service_role;
create function public.news_reader_allow(p_bucket text,p_max integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_bucket !~ '^[a-f0-9]{64}$' or p_max<1 or p_max>100 or p_seconds<1 or p_seconds>86400 then raise exception 'Invalid limit'; end if;
 delete from public.news_reader_rate_limits where expires_at<now()-interval '1 day';
 insert into public.news_reader_rate_limits(bucket,uses,expires_at) values(p_bucket,1,now()+make_interval(secs=>p_seconds))
 on conflict(bucket) do update set uses=case when news_reader_rate_limits.expires_at<=now() then 1 else news_reader_rate_limits.uses+1 end,
 expires_at=case when news_reader_rate_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else news_reader_rate_limits.expires_at end
 returning uses into n;
 return n<=p_max;
end; $$;
revoke all on function public.news_reader_allow(text,integer,integer) from public,anon,authenticated;
grant execute on function public.news_reader_allow(text,integer,integer) to service_role;
create function public.news_reader_ready() returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='news_reader_records' and c.relrowsecurity and c.relforcerowsecurity)
 and exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='news_reader_records' and policyname='news_reader_owner');
$$;
revoke all on function public.news_reader_ready() from public;
grant execute on function public.news_reader_ready() to anon,authenticated,service_role;
comment on table public.news_reader_records is 'Personal news references only. No automatic import of guest records or private reporting notes.';
