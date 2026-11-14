alter table public.after_hours_players add column sitting boolean not null default false;

create table public.after_hours_tables (
  room text not null,
  board integer not null check (board in (0,1)),
  kind text not null check (kind in ('four','three','reversi','dots')),
  host uuid not null references public.after_hours_players(token) on delete cascade,
  guest uuid references public.after_hours_players(token) on delete cascade,
  version bigint generated always as identity,
  moves smallint[] not null default '{}' check (cardinality(moves) <= 42),
  primary key (room,board),
  check (guest is null or host <> guest)
);
create index after_hours_tables_host on public.after_hours_tables(host);
create index after_hours_tables_guest on public.after_hours_tables(guest) where guest is not null;
alter table public.after_hours_tables enable row level security;
revoke all on public.after_hours_tables from public, anon, authenticated;
grant select,insert,update,delete on public.after_hours_tables to service_role;
revoke all on sequence public.after_hours_tables_version_seq from public, anon, authenticated;
grant usage on sequence public.after_hours_tables_version_seq to service_role;

create function public.after_hours_table_states(code text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'board',t.board,'kind',t.kind,'host',a.slot,'guest',b.slot,'version',t.version,'moves',t.moves
  ) order by t.board),'[]'::jsonb)
  from public.after_hours_tables t
  join public.after_hours_players a on a.token=t.host and a.room=t.room
  left join public.after_hours_players b on b.token=t.guest and b.room=t.room
  where t.room=code and a.seen_at >= statement_timestamp()-interval '25 seconds'
    and (t.guest is null or b.seen_at >= statement_timestamp()-interval '25 seconds');
$$;

create function public.after_hours_room_with_lounge(
  op text, code text, session_id uuid, px real, pz real, angle real, pace real,
  profile_token uuid, with_chat boolean, with_hunt boolean, is_sitting boolean
) returns jsonb language plpgsql set search_path = '' as $$
declare
  state jsonb;
  poses jsonb;
begin
  if op='sync' then
    update public.after_hours_players set sitting=is_sitting and pz < -20
      where room=code and token=session_id and seen_at >= statement_timestamp()-interval '25 seconds'
        and sitting is distinct from (is_sitting and pz < -20);
  end if;
  if with_hunt then
    state := public.after_hours_room_with_hunt(op,code,session_id,px,pz,angle,pace,profile_token,with_chat);
  elsif with_chat then
    state := public.after_hours_room_with_chat(op,code,session_id,px,pz,angle,pace,profile_token);
  else
    state := public.after_hours_room_named(op,code,session_id,px,pz,angle,pace,profile_token);
  end if;
  if not state ? 'players' then return state; end if;
  select coalesce(jsonb_agg(p.value || jsonb_build_object('sitting',member.sitting) order by p.position),'[]'::jsonb)
    into poses
    from jsonb_array_elements(state->'players') with ordinality as p(value,position)
    join public.after_hours_players member on member.room=code and member.slot=(p.value->>'slot')::int;
  return state || jsonb_build_object('players',poses,'tables',public.after_hours_table_states(code));
end;
$$;

create function public.after_hours_table_action(
  code text, session_id uuid, table_id integer, verb text, px real, pz real,
  game_kind text default null, round_id bigint default null, move_index integer default null,
  move_value integer default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  active_since timestamptz := statement_timestamp()-interval '25 seconds';
  member_x real;
  member_z real;
  table_x real;
  table_z real;
  member_slot integer;
  current_table public.after_hours_tables%rowtype;
begin
  if table_id is null or table_id not in (0,1) then return '{"error":"Unknown table."}'::jsonb; end if;
  if verb is null or verb not in ('view','host','join','move','reset','leave') then return '{"error":"Unknown table action."}'::jsonb; end if;
  select x,z,slot into member_x,member_z,member_slot from public.after_hours_players
    where room=code and token=session_id and seen_at>=active_since for key share;
  if not found then return '{"expired":true}'::jsonb; end if;
  if verb='view' then
    return jsonb_build_object('slot',member_slot,'tables',public.after_hours_table_states(code));
  end if;
  table_x := case table_id when 0 then 2.05 else 6.48 end;
  table_z := case table_id when 0 then -23.55 else -25.85 end;
  if verb in ('host','join') and (px is null or pz is null or
      (px-table_x)^2+(pz-table_z)^2 > 2.65^2 or (member_x-px)^2+(member_z-pz)^2 > 7^2) then
    return '{"error":"Walk up to this table first."}'::jsonb;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lounge:'||code,0));
  delete from public.after_hours_tables t where t.room=code and (
    not exists(select 1 from public.after_hours_players p where p.token=t.host and p.seen_at>=active_since)
    or (t.guest is not null and not exists(select 1 from public.after_hours_players p where p.token=t.guest and p.seen_at>=active_since))
  );
  select * into current_table from public.after_hours_tables t where t.room=code and t.board=table_id for update;
  if verb='leave' then
    delete from public.after_hours_tables t where t.room=code and t.board=table_id and session_id in (t.host,t.guest);
  elsif verb='host' then
    if game_kind is null or game_kind not in ('four','three','reversi','dots') then return '{"error":"Choose a table game."}'::jsonb; end if;
    if current_table.host=session_id and current_table.kind=game_kind then
      return jsonb_build_object('tables',public.after_hours_table_states(code));
    end if;
    if current_table.host is not null then return '{"error":"This table is already in use."}'::jsonb; end if;
    if exists(select 1 from public.after_hours_tables t where t.room=code and session_id in (t.host,t.guest)) then
      return '{"error":"Leave your other table first."}'::jsonb;
    end if;
    insert into public.after_hours_tables(room,board,kind,host) values(code,table_id,game_kind,session_id);
  elsif verb='join' then
    if current_table.host is null then return '{"error":"This table is empty. Start a game to invite a friend."}'::jsonb; end if;
    if session_id in (current_table.host,current_table.guest) then
      return jsonb_build_object('tables',public.after_hours_table_states(code));
    end if;
    if current_table.guest is not null then return '{"error":"This game already has two players."}'::jsonb; end if;
    if exists(select 1 from public.after_hours_tables t where t.room=code and session_id in (t.host,t.guest)) then
      return '{"error":"Leave your other table first."}'::jsonb;
    end if;
    update public.after_hours_tables set guest=session_id where room=code and board=table_id;
  else
    if current_table.host is null or (session_id <> current_table.host and session_id is distinct from current_table.guest) then
      return '{"error":"Join the table to play."}'::jsonb;
    end if;
    if round_id is distinct from current_table.version or move_index is distinct from cardinality(current_table.moves) then
      if verb='move' and round_id=current_table.version and current_table.moves[move_index+1]=move_value then
        return jsonb_build_object('tables',public.after_hours_table_states(code));
      end if;
      return '{"error":"The table changed. Try again."}'::jsonb;
    end if;
    if verb='reset' then
      if current_table.guest is null then return '{"error":"Wait for the other player."}'::jsonb; end if;
      update public.after_hours_tables set moves='{}',version=default,host=current_table.guest,guest=current_table.host
        where room=code and board=table_id;
    else
      if current_table.guest is null then return '{"error":"Wait for the other player."}'::jsonb; end if;
      if move_value is null or move_value not between 0 and 41 or cardinality(current_table.moves)>=42 then
        return '{"error":"Choose a valid move."}'::jsonb;
      end if;
      update public.after_hours_tables set moves=array_append(moves,move_value::smallint) where room=code and board=table_id;
    end if;
  end if;
  return jsonb_build_object('tables',public.after_hours_table_states(code));
end;
$$;

revoke all on function public.after_hours_table_states(text) from public,anon,authenticated;
revoke all on function public.after_hours_room_with_lounge(text,text,uuid,real,real,real,real,uuid,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.after_hours_table_action(text,uuid,integer,text,real,real,text,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.after_hours_table_states(text) to service_role;
grant execute on function public.after_hours_room_with_lounge(text,text,uuid,real,real,real,real,uuid,boolean,boolean,boolean) to service_role;
grant execute on function public.after_hours_table_action(text,uuid,integer,text,real,real,text,bigint,integer,integer) to service_role;
