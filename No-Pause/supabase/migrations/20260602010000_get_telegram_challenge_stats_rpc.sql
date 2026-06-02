-- Web Stats page reads Telegram challenge counts/wins under the browser anon
-- client (RLS). telegram_challenge_attempts and challenges only have
-- service_role policies, so the browser query returns empty -> 0/0.
-- This SECURITY DEFINER RPC resolves the caller's telegram_id from auth.uid()
-- and computes counts + wins server-side, mirroring the bot's TS logic in
-- src/lib/core/queries.ts (getTelegramChallengeCounts / getTelegramChallengeWins).

create or replace function public.get_telegram_challenge_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with conn as (
  select telegram_id
  from public.telegram_connections
  where user_id = auth.uid()
  limit 1
),
-- Counts: one row per attempt (matches bot's per-attempt tally in queries.ts).
user_attempts as (
  select c.status
  from public.telegram_challenge_attempts a
  join public.challenges c on c.id = a.challenge_id
  where a.telegram_id = (select telegram_id from conn)
),
-- Wins: distinct challenges the caller attempted, with status.
user_challenges as (
  select distinct a.challenge_id, c.status
  from public.telegram_challenge_attempts a
  join public.challenges c on c.id = a.challenge_id
  where a.telegram_id = (select telegram_id from conn)
),
-- All attempts on those challenges (any participant), joined to flow scores.
attempt_scores as (
  select
    a.challenge_id,
    a.telegram_id,
    s.flow_score
  from public.telegram_challenge_attempts a
  join public.sessions s on s.id = a.session_id
  where a.challenge_id in (select challenge_id from user_challenges)
    and a.session_id is not null
    and s.flow_score is not null
),
-- Per-challenge: best score overall vs caller's best score.
challenge_outcome as (
  select
    challenge_id,
    max(flow_score) as best_score,
    max(flow_score) filter (
      where telegram_id = (select telegram_id from conn)
    ) as user_best_score
  from attempt_scores
  group by challenge_id
),
wins as (
  select uc.status
  from challenge_outcome co
  join user_challenges uc on uc.challenge_id = co.challenge_id
  where co.user_best_score is not null
    and co.user_best_score = co.best_score
)
-- Returns null when the caller has no Telegram connection, so the web card stays
-- hidden (matches prior behavior). Connected users with zero challenges get a
-- zero-filled object and the card shows 0/0.
select case
  when not exists (select 1 from conn)
    then null::jsonb
  else jsonb_build_object(
    'friendChallenges', (
      select count(*)::integer from user_attempts
      where status not like 'group_pending%'
    ),
    'groupChallenges', (
      select count(*)::integer from user_attempts
      where status like 'group_pending%'
    ),
    'friendWins', (
      select count(*)::integer from wins
      where status not like 'group_pending%'
    ),
    'groupWins', (
      select count(*)::integer from wins
      where status like 'group_pending%'
    )
  )
end;
$$;

grant execute on function public.get_telegram_challenge_stats() to authenticated;
