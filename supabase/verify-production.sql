-- Run as the SQL Editor's postgres role. All synthetic rows are rolled back.
begin;
set local statement_timeout = '15s';
select set_config('machiaruki.test_a', gen_random_uuid()::text, true);
select set_config('machiaruki.test_b', gen_random_uuid()::text, true);
select set_config('machiaruki.test_memo', gen_random_uuid()::text, true);
insert into auth.users(id, aud, role, email)
values (current_setting('machiaruki.test_a')::uuid, 'authenticated', 'authenticated', current_setting('machiaruki.test_a') || '@example.invalid'),
       (current_setting('machiaruki.test_b')::uuid, 'authenticated', 'authenticated', current_setting('machiaruki.test_b') || '@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('machiaruki.test_a'), true);
insert into public.memos(id, body, title, lat, lng, tags)
values (current_setting('machiaruki.test_memo')::uuid, '本番接続確認・ロールバック予定', 'ＣＡＦＥ', 35, 139, array['検証']);
do $$ begin
  if (select count(*) from public.memos where id = current_setting('machiaruki.test_memo')::uuid and version = 1 and search_text like '%cafe%') <> 1 then
    raise exception 'Owner read, version or search check failed';
  end if;
end $$;
update public.memos set body = 'updated' where id = current_setting('machiaruki.test_memo')::uuid and version = 1;
do $$ begin
  if (select version from public.memos where id = current_setting('machiaruki.test_memo')::uuid) <> 2 then
    raise exception 'Version trigger failed';
  end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('machiaruki.test_b'), true);
do $$ declare affected integer; begin
  if exists(select 1 from public.memos where id = current_setting('machiaruki.test_memo')::uuid) then
    raise exception 'Cross-user read was allowed';
  end if;
  update public.memos set body = 'must not change' where id = current_setting('machiaruki.test_memo')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user update was allowed'; end if;
  delete from public.memos where id = current_setting('machiaruki.test_memo')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user delete was allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('machiaruki.test_a'), true);
do $$ declare affected integer; begin
  delete from public.memos where id = current_setting('machiaruki.test_memo')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner delete failed'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform id from public.memos;
    raise exception 'Anonymous read was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS: owner CRUD, search, version, cross-user isolation, anonymous denial; synthetic rows rolled back' as verification;
