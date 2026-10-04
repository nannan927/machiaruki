begin;
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
