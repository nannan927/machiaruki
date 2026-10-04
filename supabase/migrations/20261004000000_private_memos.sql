begin;
-- Legacy anonymous rows remain intact and unassigned; they are not exposed to users.
alter table public.memos add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.memos alter column user_id set default auth.uid();
create index if not exists memos_user_created_idx on public.memos(user_id, created_at desc);
drop policy if exists "Allow public memo reads" on public.memos;
drop policy if exists "Allow public memo inserts" on public.memos;
create policy "Read own memos" on public.memos for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own memos" on public.memos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own memos" on public.memos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own memos" on public.memos for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.memos from anon;
grant select, insert, update, delete on public.memos to authenticated;
commit;
