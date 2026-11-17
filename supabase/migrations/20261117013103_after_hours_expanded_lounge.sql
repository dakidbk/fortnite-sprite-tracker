alter table public.after_hours_tables
  drop constraint after_hours_tables_board_check,
  drop constraint after_hours_tables_kind_check,
  drop constraint after_hours_tables_moves_check,
  add constraint after_hours_tables_board_check check (board between 0 and 9),
  add constraint after_hours_tables_kind_check check (
    kind in ('four','three','reversi','dots','checkers','gomoku','mancala','hex','nim','breakthrough')
  ),
  add constraint after_hours_tables_moves_check check (cardinality(moves) <= 320);

create or replace function public.after_hours_table_action(
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
  table_kind text;
  member_slot integer;
  current_table public.after_hours_tables%rowtype;
begin
  if table_id is null or table_id not between 0 and 9 then return '{"error":"Unknown table."}'::jsonb; end if;
  if verb is null or verb not in ('view','host','join','move','reset','leave') then return '{"error":"Unknown table action."}'::jsonb; end if;
  select x,z,slot into member_x,member_z,member_slot from public.after_hours_players
    where room=code and token=session_id and seen_at>=active_since for key share;
  if not found then return '{"expired":true}'::jsonb; end if;
  if verb='view' then
    return jsonb_build_object('slot',member_slot,'tables',public.after_hours_table_states(code));
  end if;
  -- Same positions and games as tableLayout in lounge-rules.js.
  select layout.x, layout.z, layout.kind into table_x, table_z, table_kind
  from (values
    (0, 2.05, -23.55, 'four'),
    (1, 6.48, -25.85, 'three'),
    (2, -2.85, -23.55, 'reversi'),
    (3, -7.10, -23.55, 'dots'),
    (4, -7.10, -29.00, 'checkers'),
    (5, -2.85, -29.00, 'gomoku'),
    (6, 2.05, -29.00, 'mancala'),
    (7, 6.48, -31.00, 'hex'),
    (8, -5.30, -34.20, 'nim'),
    (9, .15, -34.20, 'breakthrough')
  ) as layout(board,x,z,kind) where layout.board=table_id;
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
    if game_kind is distinct from table_kind then return '{"error":"This table is reserved for its posted game."}'::jsonb; end if;
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
      if move_value is null or move_value not between 0 and 4095 or cardinality(current_table.moves)>=320 then
        return '{"error":"Choose a valid move."}'::jsonb;
      end if;
      update public.after_hours_tables set moves=array_append(moves,move_value::smallint) where room=code and board=table_id;
    end if;
  end if;
  return jsonb_build_object('tables',public.after_hours_table_states(code));
end;
$$;
