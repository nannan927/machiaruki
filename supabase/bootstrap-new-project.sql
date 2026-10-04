-- Initial production setup for an EMPTY project only.
-- Generated from supabase/migrations; all changes commit atomically.
-- Do not execute this against an existing memos table.
begin;
do $$ begin
  if to_regclass('public.memos') is not null then
    raise exception 'memos already exists; apply only pending migrations instead';
  end if;
end $$;
-- 20260510000000_create_memos.sql
create extension if not exists pgcrypto;

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  title text check (title is null or char_length(title) <= 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  tags text[] not null default '{}'::text[] check (coalesce(array_length(tags, 1), 0) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memos_created_at_idx on public.memos (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_memos_updated_at on public.memos;
create trigger set_memos_updated_at
before update on public.memos
for each row
execute function public.set_updated_at();

alter table public.memos enable row level security;

drop policy if exists "Allow public memo reads" on public.memos;
create policy "Allow public memo reads"
on public.memos
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public memo inserts" on public.memos;
create policy "Allow public memo inserts"
on public.memos
for insert
to anon, authenticated
with check (
  char_length(btrim(body)) between 1 and 2000
  and lat between -90 and 90
  and lng between -180 and 180
  and coalesce(array_length(tags, 1), 0) <= 10
  and (title is null or char_length(title) <= 120)
);

-- 20261004000000_private_memos.sql

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

-- 20261004010000_production_integrity.sql

alter table public.memos add column version integer not null default 1;
create or replace function public.memo_search_text(title text, body text, tags text[])
returns text language sql immutable set search_path = pg_catalog as $$
  select lower(normalize(coalesce(title, '') || ' ' || body || ' ' || array_to_string(tags, ' '), NFKC));
$$;
alter table public.memos add column search_text text generated always as (public.memo_search_text(title, body, tags)) stored;
create index memos_user_cursor_idx on public.memos(user_id, created_at desc, id desc);
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at then
    raise exception 'Memo identity cannot be changed' using errcode = '23514';
  end if;
  new.updated_at = clock_timestamp();
  new.version = old.version + 1;
  return new;
end;
$$;
-- Check only new/modified rows; keep historical data intact for operator review.
create function public.valid_memo_tags(tags text[]) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select cardinality(tags) <= 10 and coalesce(array_ndims(tags), 1) = 1
    and not exists (select 1 from unnest(tags) as tag where tag is null or char_length(btrim(tag)) not between 1 and 40);
$$;
alter table public.memos add constraint memos_tags_valid check (public.valid_memo_tags(tags)) not valid;
-- Direct Data API clients may set only the approved fields.
revoke insert, update on public.memos from authenticated;
grant insert (id, user_id, title, body, lat, lng, tags) on public.memos to authenticated;
grant update (title, body, lat, lng, tags) on public.memos to authenticated;

commit;
