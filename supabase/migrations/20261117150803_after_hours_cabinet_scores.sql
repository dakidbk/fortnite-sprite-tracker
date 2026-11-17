-- Keep gameplay attempts independent of whether the device has chosen a public username.
alter table public.after_hours_arcade_attempts
  drop constraint after_hours_arcade_attempts_profile_id_fkey;

create or replace function public.after_hours_arcade_start(cabinet text, player_id uuid, ticket uuid, cue_seed bigint)
returns boolean language plpgsql set search_path = '' as $$
begin
  delete from public.after_hours_arcade_attempts where attempt_id in (
    select attempt_id from public.after_hours_arcade_attempts
    where started_at < statement_timestamp()-interval '45 minutes'
    order by started_at limit 128 for update skip locked
  );
  insert into public.after_hours_arcade_attempts(game,profile_id,attempt_id,seed)
    values(cabinet,player_id,ticket,cue_seed)
  on conflict (attempt_id) do nothing;
  return found or exists (
    select 1 from public.after_hours_arcade_attempts
    where game=cabinet and profile_id=player_id and attempt_id=ticket and seed=cue_seed
  );
end;
$$;

create or replace function public.after_hours_arcade_finish(
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
  -- A player may choose a public username after completing the run.
  perform 1 from public.after_hours_usernames n where n.profile_id=player_id for key share;
  if not found then return '{"name_required":true}'::jsonb; end if;
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
