create table public.after_hours_chat (
  player_token uuid not null references public.after_hours_players(token) on delete cascade,
  message_id uuid not null,
  body text not null check (char_length(body) between 1 and 60 and btrim(body) <> ''),
  sent_at timestamptz not null default clock_timestamp(),
  primary key (player_token, message_id)
);

alter table public.after_hours_chat enable row level security;
revoke all on public.after_hours_chat from public, anon, authenticated;
grant select, insert, delete on public.after_hours_chat to service_role;

create function public.after_hours_room_with_chat(
  op text, code text, session_id uuid, px real, pz real, angle real, pace real,
  profile_token uuid, message_text text default null, nonce uuid default null
) returns jsonb language plpgsql set search_path = '' as $$
declare
  state jsonb := '{}'::jsonb;
  sent_after timestamptz;
  checked_at timestamptz;
  messages jsonb;
begin
  if op = 'chat' then
    if nonce is null or message_text is null or char_length(message_text) not between 1 and 60
        or btrim(message_text) = '' then
      return '{"error":"Enter a message up to 60 characters."}'::jsonb;
    end if;

    perform 1 from public.after_hours_players
      where room = code and token = session_id and seen_at >= statement_timestamp() - interval '25 seconds'
      for update;
    if not found then return '{"expired":true}'::jsonb; end if;

    checked_at := clock_timestamp();
    if not exists (
      select 1 from public.after_hours_chat
        where player_token = session_id and message_id = nonce and sent_at > checked_at - interval '10 seconds'
    ) then
      if exists (
        select 1 from public.after_hours_chat
          where player_token = session_id and sent_at > checked_at - interval '1 second'
      ) then
        return '{"error":"Wait a second before sending another message.","rate_limited":true}'::jsonb;
      end if;
      insert into public.after_hours_chat (player_token, message_id, body, sent_at)
        values (session_id, nonce, message_text, checked_at)
        on conflict (player_token, message_id) do nothing;
    end if;
  else
    state := public.after_hours_room_named(op, code, session_id, px, pz, angle, pace, profile_token);
    if not state ? 'players' then return state; end if;
  end if;

  checked_at := clock_timestamp();
  sent_after := checked_at - interval '10 seconds';
  if op in ('sync', 'chat') then
    delete from public.after_hours_chat where player_token = session_id and sent_at <= sent_after;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', chat.message_id,
    'slot', member.slot,
    'username', profile.username,
    'text', chat.body,
    'remaining_ms', floor(extract(epoch from (chat.sent_at - sent_after)) * 1000)
  ) order by chat.sent_at, member.slot, chat.message_id), '[]'::jsonb)
    into messages
    from public.after_hours_players member
    join public.after_hours_chat chat on chat.player_token = member.token and chat.sent_at > sent_after
    left join public.after_hours_usernames profile on profile.profile_id = member.profile_id
    where member.room = code;

  return state || jsonb_build_object('messages', messages);
end;
$$;

revoke all on function public.after_hours_room_with_chat(text,text,uuid,real,real,real,real,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.after_hours_room_with_chat(text,text,uuid,real,real,real,real,uuid,text,uuid)
  to service_role;
