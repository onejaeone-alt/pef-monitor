alter table public.news_reader_records add column version bigint not null default 1;
create function public.news_reader_patch(p_changes jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c jsonb; k text; h text; v jsonb; ver bigint; expected bigint; results jsonb := '[]'::jsonb; who uuid := auth.uid();
begin
 if who is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'login_required' using errcode='42501'; end if;
 if jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)<1 or jsonb_array_length(p_changes)>100 or octet_length(p_changes::text)>180000 then raise exception 'invalid_changes' using errcode='22023'; end if;
 for c in select value from jsonb_array_elements(p_changes) order by value->>'kind',value->>'record_key' loop
  k:=c->>'kind'; h:=c->>'record_key'; v:=nullif(c->'value','null'::jsonb); expected:=(c->>'expected_version')::bigint;
  if k not in ('read','opened','bookmark','hidden','override','watch') or h !~ '^[a-f0-9]{64}$' or expected is null or expected<0 then raise exception 'invalid_change' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(who::text||k||h,0));
  ver:=null;
  select version into ver from public.news_reader_records where user_id=who and kind=k and record_key=h for update;
  if coalesce(ver,0)<>expected then raise exception 'reader_version_conflict' using errcode='40001'; end if;
  insert into public.news_reader_records(user_id,kind,record_key,value,version,updated_at) values(who,k,h,v,coalesce(ver,0)+1,clock_timestamp())
  on conflict(user_id,kind,record_key) do update set value=excluded.value,version=excluded.version,updated_at=excluded.updated_at;
  results:=results||jsonb_build_array(jsonb_build_object('kind',k,'record_key',h,'version',coalesce(ver,0)+1));
 end loop;
 return results;
end; $$;
revoke all on function public.news_reader_patch(jsonb) from public,anon;
grant execute on function public.news_reader_patch(jsonb) to authenticated;
comment on function public.news_reader_patch(jsonb) is 'Owner-bound atomic patch with optimistic versions; never accepts a client-supplied owner ID.';
