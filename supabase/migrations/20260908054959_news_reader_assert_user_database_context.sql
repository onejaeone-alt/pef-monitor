create function public.news_reader_context() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',auth.uid(),'role',current_user);
$$;
revoke all on function public.news_reader_context() from public,anon;
grant execute on function public.news_reader_context() to authenticated;
comment on function public.news_reader_context() is 'Checks the actual user-scoped API role before the server reads or writes personal news records.';
