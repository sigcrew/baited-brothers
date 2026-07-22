create table public.favorite_fishing_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  latitude numeric(10, 7) not null check (latitude between 32.5 and 39.0),
  longitude numeric(10, 7) not null check (longitude between 124.0 and 132.5),
  created_at timestamptz not null default now(),
  unique (user_id, latitude, longitude)
);

comment on table public.favorite_fishing_spots is
  'Private coastal places saved by each user from the fishing map.';

create index favorite_fishing_spots_user_created_idx
  on public.favorite_fishing_spots (user_id, created_at desc);

alter table public.favorite_fishing_spots enable row level security;

revoke all on table public.favorite_fishing_spots from anon;
grant select, insert, update, delete on table public.favorite_fishing_spots to authenticated;

create policy "favorite_fishing_spots_select_own"
  on public.favorite_fishing_spots for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "favorite_fishing_spots_insert_own"
  on public.favorite_fishing_spots for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "favorite_fishing_spots_update_own"
  on public.favorite_fishing_spots for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "favorite_fishing_spots_delete_own"
  on public.favorite_fishing_spots for delete
  to authenticated
  using ((select auth.uid()) = user_id);
