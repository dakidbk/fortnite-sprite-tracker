create table public.after_hours_players (
  room text not null,
  slot integer not null check (slot between 1 and 4),
  token uuid not null unique,
  x real not null default 0,
  z real not null default 4.55,
  yaw real not null default 0,
  stride real not null default 0,
  seen_at timestamptz not null default now(),
  primary key (room, slot)
);
alter table public.after_hours_players enable row level security;
revoke all on public.after_hours_players from public, anon, authenticated;
grant select, insert, update, delete on public.after_hours_players to service_role;

create function public.after_hours_room(
  op text, code text, session_id uuid,
  px real default 0, pz real default 4.55, angle real default 0, pace real default 0
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  seat integer;
  active_since timestamptz := statement_timestamp() - interval '25 seconds';
  roster jsonb;
begin
  if op in ('create', 'join') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(code, 0));
    delete from public.after_hours_players where room = code and seen_at < active_since;
    if op = 'create' then
      if exists (select 1 from public.after_hours_players where room = code) then
        return '{"error":"Try creating the room again."}';
      end if;
      delete from public.after_hours_players where seen_at < active_since;
    elsif not exists (select 1 from public.after_hours_players where room = code) then
      return '{"error":"Room not found. Ask your friend for a new invite."}';
    end if;
    select s into seat from pg_catalog.generate_series(1, 4) s
      where not exists (select 1 from public.after_hours_players where room = code and slot = s)
      order by s limit 1;
    if seat is null then return '{"error":"This room is full (4/4)."}'; end if;
    insert into public.after_hours_players(room, slot, token, x, z, yaw, stride)
      values (code, seat, session_id, px, pz, angle, pace);
  elsif op = 'leave' then
    delete from public.after_hours_players where room = code and token = session_id;
    return '{}';
  elsif op = 'sync' then
    update public.after_hours_players
      set x = px, z = pz, yaw = angle, stride = pace, seen_at = statement_timestamp()
      where room = code and token = session_id and seen_at >= active_since
      returning slot into seat;
    if seat is null then return '{"expired":true}'; end if;
  else
    return '{"error":"Unknown action."}';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('slot', slot, 'x', x, 'z', z, 'yaw', yaw, 'stride', stride)
      order by slot), '[]'::jsonb)
    into roster from public.after_hours_players where room = code and seen_at >= active_since;
  return jsonb_build_object('room', code, 'slot', seat, 'players', roster);
end;
$$;
revoke all on function public.after_hours_room(text,text,uuid,real,real,real,real) from public, anon, authenticated;
grant execute on function public.after_hours_room(text,text,uuid,real,real,real,real) to service_role;
