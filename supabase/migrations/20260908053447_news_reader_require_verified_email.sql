create function public.news_reader_verified() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=(select auth.uid()) and email_confirmed_at is not null and is_anonymous=false);
$$;
revoke all on function public.news_reader_verified() from public,anon;
grant execute on function public.news_reader_verified() to authenticated;
alter policy news_reader_owner on public.news_reader_records
 using ((select auth.uid())=user_id and (select public.news_reader_verified()))
 with check ((select auth.uid())=user_id and (select public.news_reader_verified()));
