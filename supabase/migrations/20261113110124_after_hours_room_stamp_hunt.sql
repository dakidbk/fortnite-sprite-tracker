create table public.after_hours_hunts (
  room text primary key,
  day date not null,
  mask integer not null check (mask between 0 and 63)
);
create index after_hours_hunts_day_idx on public.after_hours_hunts (day);

alter table public.after_hours_hunts enable row level security;
revoke all on public.after_hours_hunts from public, anon, authenticated;
grant select, insert, update, delete on public.after_hours_hunts to service_role;

create function public.after_hours_room_with_hunt(
  op text, code text, session_id uuid, px real, pz real, angle real, pace real,
  profile_token uuid, with_chat boolean, stamp_id integer default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  today date := (statement_timestamp() at time zone 'UTC')::date;
  state jsonb := '{}'::jsonb;
  found_mask integer;
  stamp_x real;
  stamp_z real;
  member_x real;
  member_z real;
begin
  if op = 'stamp' then
    select x, z into member_x, member_z from public.after_hours_players
      where room = code and token = session_id and seen_at >= statement_timestamp() - interval '25 seconds'
      for update;
    if not found then return '{"expired":true}'::jsonb; end if;

    -- These coordinates match the six stamps placed in hunt.js.
    select x, z into stamp_x, stamp_z from (
      values (0,-5.42,6.82), (1,2.63,-2.38), (2,-5.54,-8.22),
             (3,6.58,-9.44), (4,7.48,-13.92), (5,-.98,-16.39)
    ) as location(id,x,z) where location.id = stamp_id;
    if not found then return '{"error":"Invalid stamp."}'::jsonb; end if;
    if px is null or pz is null or (px-stamp_x)^2+(pz-stamp_z)^2 > 1.20^2
        or (member_x-px)^2+(member_z-pz)^2 > 7^2 then
      return '{"error":"Step closer to pick up the stamp."}'::jsonb;
    end if;
    insert into public.after_hours_hunts as previous (room,day,mask)
      values (code,today,1 << stamp_id)
      on conflict (room) do update set
        day = greatest(previous.day,excluded.day),
        mask = case when previous.day = excluded.day then previous.mask | excluded.mask
          when previous.day < excluded.day then excluded.mask else previous.mask end
      returning mask into found_mask;
  else
    if with_chat then
      state := public.after_hours_room_with_chat(op,code,session_id,px,pz,angle,pace,profile_token);
    else
      state := public.after_hours_room_named(op,code,session_id,px,pz,angle,pace,profile_token);
    end if;
    if not state ? 'players' then return state; end if;
    if op = 'create' then
      delete from public.after_hours_hunts where room = code;
      delete from public.after_hours_hunts where day < today - 1;
    else
      select mask into found_mask from public.after_hours_hunts where room = code and day = today;
    end if;
  end if;
  return state || jsonb_build_object('hunt',coalesce(found_mask,0),'hunt_day',today);
end;
$$;

revoke all on function public.after_hours_room_with_hunt(text,text,uuid,real,real,real,real,uuid,boolean,integer)
  from public, anon, authenticated;
grant execute on function public.after_hours_room_with_hunt(text,text,uuid,real,real,real,real,uuid,boolean,integer)
  to service_role;
