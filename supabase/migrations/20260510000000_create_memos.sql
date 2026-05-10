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
