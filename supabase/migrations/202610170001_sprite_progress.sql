-- Sprite Tracker: private collection storage for Supabase Auth.
-- Apply in the project's SQL editor after creating the project.
-- Application access uses the public publishable key, never a service-role key.
begin;

create table public.sprite_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  sprite_id text not null check (
    length(sprite_id) between 1 and 200
    and sprite_id not in ('__proto__', 'constructor', 'prototype')
    and sprite_id !~ '[[:cntrl:]]'
  ),
  level smallint not null check (level between 1 and 5),
  mastered boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, sprite_id)
);

create function public.stamp_sprite_progress()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    new.revision := old.revision + 1;
  else
    new.revision := 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger stamp_sprite_progress
before insert or update on public.sprite_progress
for each row execute function public.stamp_sprite_progress();

alter table public.sprite_progress enable row level security;
alter table public.sprite_progress force row level security;
revoke all on public.sprite_progress from public, anon, authenticated;
grant select, insert, update, delete on public.sprite_progress to authenticated;

create policy "Read own collection" on public.sprite_progress
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own Sprites" on public.sprite_progress
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own Sprites" on public.sprite_progress
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Remove own Sprites" on public.sprite_progress
for delete to authenticated using ((select auth.uid()) = user_id);

commit;

