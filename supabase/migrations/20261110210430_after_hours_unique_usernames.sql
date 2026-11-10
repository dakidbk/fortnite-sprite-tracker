create table public.after_hours_usernames (
  profile_id uuid primary key,
  username text not null check (
    username ~ '^[A-Za-z][A-Za-z0-9_]{2,15}$'
    and lower(username) not in ('admin','administrator','moderator','owner','creator','system','support')
    and lower(username) !~ '^player[0-9]+$'
  )
);
create unique index after_hours_usernames_unique on public.after_hours_usernames (lower(username));
alter table public.after_hours_usernames enable row level security;
revoke all on public.after_hours_usernames from public, anon, authenticated;
grant select, insert, update on public.after_hours_usernames to service_role;

alter table public.after_hours_players add column profile_id uuid references public.after_hours_usernames(profile_id);
create unique index after_hours_players_room_profile on public.after_hours_players(room,profile_id) where profile_id is not null;
create index after_hours_players_profile_id on public.after_hours_players(profile_id) where profile_id is not null;

create function public.after_hours_reserve_name(profile_token uuid, requested text)
returns jsonb language plpgsql set search_path = '' as $$
begin
  insert into public.after_hours_usernames(profile_id,username) values(profile_token,requested)
  on conflict (profile_id) do update set username=excluded.username;
  return jsonb_build_object('username',requested);
exception
  when unique_violation then return '{"error":"That username is already taken."}'::jsonb;
  when check_violation then return '{"error":"That username is reserved or invalid."}'::jsonb;
end;
$$;

create function public.after_hours_room_named(
  op text, code text, session_id uuid, px real, pz real, angle real, pace real, profile_token uuid
) returns jsonb language plpgsql set search_path = '' as $$
declare
  state jsonb;
  roster jsonb;
begin
  state := public.after_hours_room(op,code,session_id,px,pz,angle,pace);
  if not state ? 'players' then return state; end if;

  if op in ('create','join') and profile_token is not null then
    update public.after_hours_players
      set profile_id = (select profile_id from public.after_hours_usernames where profile_id = profile_token)
      where room = code and token = session_id;
  end if;

  select coalesce(jsonb_agg(player.value || jsonb_build_object('username', profile.username)
      order by player.position),'[]'::jsonb)
    into roster
    from jsonb_array_elements(state->'players') with ordinality as player(value,position)
    left join public.after_hours_players member on member.room = code and member.slot = (player.value->>'slot')::int
    left join public.after_hours_usernames profile on profile.profile_id = member.profile_id;
  return jsonb_set(state,'{players}',roster);
exception when unique_violation then
  return '{"error":"This username is already in this room."}'::jsonb;
end;
$$;

revoke all on function public.after_hours_reserve_name(uuid,text) from public, anon, authenticated;
revoke all on function public.after_hours_room_named(text,text,uuid,real,real,real,real,uuid) from public, anon, authenticated;
grant execute on function public.after_hours_reserve_name(uuid,text) to service_role;
grant execute on function public.after_hours_room_named(text,text,uuid,real,real,real,real,uuid) to service_role;
