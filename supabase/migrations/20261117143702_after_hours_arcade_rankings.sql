create table public.after_hours_arcade_scores (
  game text not null,
  profile_id uuid not null references public.after_hours_usernames(profile_id) on delete cascade,
  score integer not null,
  achieved_at timestamptz not null default statement_timestamp(),
  primary key (game, profile_id),
  check (
    (game='neon' and score between 100 and 13300 and score%100=0)
    or (game='signal' and score between 1 and 8)
    or (game='circuit' and score between 1 and 12)
  )
);
create index after_hours_arcade_score_order
  on public.after_hours_arcade_scores(game, score desc, achieved_at, profile_id);
create index after_hours_arcade_scores_profile
  on public.after_hours_arcade_scores(profile_id);

create table public.after_hours_arcade_attempts (
  game text not null check (game in ('neon','signal','circuit')),
  profile_id uuid not null references public.after_hours_usernames(profile_id) on delete cascade,
  attempt_id uuid primary key,
  seed bigint not null check (seed between 0 and 4294967295),
  started_at timestamptz not null default statement_timestamp(),
  result integer
);
create index after_hours_arcade_attempts_profile
  on public.after_hours_arcade_attempts(profile_id);
create index after_hours_arcade_attempts_expiry
  on public.after_hours_arcade_attempts(started_at);

alter table public.after_hours_arcade_scores enable row level security;
alter table public.after_hours_arcade_attempts enable row level security;
revoke all on public.after_hours_arcade_scores, public.after_hours_arcade_attempts from public, anon, authenticated;
grant select,insert,update on public.after_hours_arcade_scores, public.after_hours_arcade_attempts to service_role;
grant delete on public.after_hours_arcade_attempts to service_role;

create function public.after_hours_arcade_rankings(cabinet text, player_id uuid default null)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'leaders', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'rank', t.place, 'name', n.username, 'score', t.score, 'you', t.profile_id is not distinct from player_id
      ) order by t.score desc,t.achieved_at,t.profile_id),'[]'::jsonb)
      from (
        select s.profile_id, s.score, s.achieved_at, rank() over (order by s.score desc) as place
        from public.after_hours_arcade_scores s
        where s.game=cabinet
        order by s.score desc,s.achieved_at,s.profile_id
        limit 10
      ) t join public.after_hours_usernames n using (profile_id)
    ),
    'personal', (
      select jsonb_build_object('score', p.score, 'rank', 1+(
        select count(*) from public.after_hours_arcade_scores s where s.game=cabinet and s.score>p.score
      ))
      from public.after_hours_arcade_scores p where p.game=cabinet and p.profile_id=player_id
    )
  );
$$;

create function public.after_hours_arcade_start(cabinet text, player_id uuid, ticket uuid, cue_seed bigint)
returns boolean language plpgsql set search_path = '' as $$
begin
  delete from public.after_hours_arcade_attempts where started_at < statement_timestamp()-interval '45 minutes';
  insert into public.after_hours_arcade_attempts(game,profile_id,attempt_id,seed)
    select cabinet,n.profile_id,ticket,cue_seed from public.after_hours_usernames n where n.profile_id=player_id
  on conflict (attempt_id) do nothing;
  return found or exists (
    select 1 from public.after_hours_arcade_attempts
    where game=cabinet and profile_id=player_id and attempt_id=ticket and seed=cue_seed
  );
end;
$$;

create function public.after_hours_arcade_seed(cabinet text, player_id uuid, ticket uuid)
returns bigint language sql stable set search_path = '' as $$
  select a.seed from public.after_hours_arcade_attempts a
  where a.game=cabinet and a.profile_id=player_id and a.attempt_id=ticket
    and a.started_at >= statement_timestamp()-interval '45 minutes';
$$;

create function public.after_hours_arcade_finish(
  cabinet text, player_id uuid, ticket uuid, run_score integer, elapsed_ms integer
) returns jsonb language plpgsql set search_path = '' as $$
declare
  run public.after_hours_arcade_attempts%rowtype;
  improved boolean := false;
begin
  select * into run from public.after_hours_arcade_attempts a
  where a.game=cabinet and a.profile_id=player_id and a.attempt_id=ticket
    and a.started_at >= statement_timestamp()-interval '45 minutes'
  for update;
  if not found then return '{"expired":true}'::jsonb; end if;
  if run.result is not null then
    return jsonb_build_object('recorded',run.result,'improved',false);
  end if;
  if elapsed_ms > 5000+extract(epoch from statement_timestamp()-run.started_at)*1000 then
    return '{"error":"The run finished before its timer elapsed."}'::jsonb;
  end if;
  if run_score>0 then
    insert into public.after_hours_arcade_scores as s(game,profile_id,score)
      values(cabinet,player_id,run_score)
    on conflict (game,profile_id) do update
      set score=excluded.score,achieved_at=excluded.achieved_at
      where s.score<excluded.score;
    improved := found;
  end if;
  update public.after_hours_arcade_attempts set result=run_score
    where game=cabinet and profile_id=player_id and attempt_id=ticket;
  return jsonb_build_object('recorded',run_score,'improved',improved);
end;
$$;

revoke all on function public.after_hours_arcade_rankings(text,uuid) from public,anon,authenticated;
revoke all on function public.after_hours_arcade_start(text,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.after_hours_arcade_seed(text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.after_hours_arcade_finish(text,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.after_hours_arcade_rankings(text,uuid) to service_role;
grant execute on function public.after_hours_arcade_start(text,uuid,uuid,bigint) to service_role;
grant execute on function public.after_hours_arcade_seed(text,uuid,uuid) to service_role;
grant execute on function public.after_hours_arcade_finish(text,uuid,uuid,integer,integer) to service_role;
