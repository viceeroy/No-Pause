-- =============================================================================
-- BASELINE SCHEMA — NoPause
-- Captured from live DB: 2026-06-10 (post audit-fix migrations F1a, F1b, F3)
-- =============================================================================
-- PURPOSE: Fresh-environment rebuild only. THIS FILE IS THE DISASTER-RECOVERY
--   PATH — it is the ONLY artifact that can rebuild the DB from zero.
--   The dated migrations/ chain CANNOT rebuild from empty: the base tables
--   (sessions, streaks) are created by NO migration — they exist only in the
--   live DB — and the chain's first file (20260507133131) FKs to public.challenges,
--   which is created only in migrations/_legacy/ (CLI-invisible). Run this file
--   against an empty DB to recover; the dated chain is incremental history that
--   assumes the live base already exists.
--
--   This file lives in supabase/schema/ (NOT migrations/) so the Supabase CLI
--   does not auto-run it alongside the chain. Apply manually (psql) on rebuild.
--
--   Tables/indexes/functions use IF NOT EXISTS / CREATE OR REPLACE.
--   POLICIES are NOT idempotent — each is preceded by DROP POLICY IF EXISTS
--   so this file can be re-run on an empty schema without errors.
--   DO NOT apply to an existing production DB (policies will double-up even
--   with the drops if rows exist that depend on them — run only against empty).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

create table if not exists public.sessions (
  id                   uuid        not null default gen_random_uuid(),
  user_id              uuid,
  created_at           timestamptz          default now(),
  mode                 text        not null,
  duration             numeric     not null,
  speaking_time        numeric,
  pauses               integer,
  words                integer,
  flow_score           numeric,
  completed            boolean              default false,
  hesitation_log       jsonb,
  transcript           text,
  analysis_feedback    text,
  scoring_version      text                 default 'base-1.0',
  hesitations_per_minute numeric,
  pause_count          integer,
  source               text,
  telegram_chat_id     bigint,
  telegram_message_id  bigint,
  total_silence_time   integer,
  constraint sessions_pkey primary key (id),
  constraint sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.streaks (
  id               uuid    not null default gen_random_uuid(),
  user_id          uuid             unique,
  current_streak   integer          default 0,
  longest_streak   integer          default 0,
  last_session_date date,
  constraint streaks_pkey primary key (id),
  constraint streaks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.telegram_connections (
  id           uuid        not null default gen_random_uuid(),
  user_id      uuid,
  telegram_id  bigint      not null unique,
  connected_at timestamptz          default now(),
  constraint telegram_connections_pkey primary key (id),
  constraint telegram_connections_user_id_fkey foreign key (user_id) references auth.users(id)
);

create table if not exists public.challenges (
  id                  text        not null,
  topic               text        not null,
  creator_telegram_id bigint      not null,
  creator_score       integer,
  status              text        not null default 'pending',
  created_at          timestamptz not null default now(),
  constraint challenges_pkey primary key (id)
);

create table if not exists public.telegram_challenge_state (
  telegram_id         bigint      not null,
  challenge_id        text        not null,
  challenge_type      text        not null,
  group_id            bigint,
  group_message_id    bigint,
  participant_username text,
  creator_username    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint telegram_challenge_state_pkey primary key (telegram_id),
  constraint telegram_challenge_state_challenge_id_fkey
    foreign key (challenge_id) references public.challenges(id) on delete cascade,
  constraint telegram_challenge_state_challenge_type_check
    check (challenge_type = any (array['friend'::text, 'group'::text]))
);

create table if not exists public.telegram_challenge_attempts (
  id           uuid        not null default gen_random_uuid(),
  challenge_id text        not null,
  telegram_id  bigint      not null,
  session_id   uuid,
  created_at   timestamptz not null default now(),
  constraint telegram_challenge_attempts_pkey primary key (id),
  constraint telegram_challenge_attempts_challenge_id_fkey
    foreign key (challenge_id) references public.challenges(id) on delete cascade
);

create table if not exists public.api_usage_daily (
  user_id    uuid    not null,
  usage_date date    not null,
  kind       text    not null,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint api_usage_daily_pkey primary key (user_id, usage_date, kind),
  constraint api_usage_daily_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint api_usage_daily_kind_check
    check (kind = any (array['transcription'::text, 'feedback'::text, 'prompts'::text])),
  constraint api_usage_daily_count_check
    check (count >= 0)
);

create table if not exists public.telegram_friend_result_sends (
  id           uuid        not null default gen_random_uuid(),
  challenge_id text        not null,
  telegram_id  bigint      not null,
  session_id   uuid        not null,
  sent_at      timestamptz not null default now(),
  constraint telegram_friend_result_sends_pkey primary key (id),
  constraint telegram_friend_result_sends_challenge_id_fkey
    foreign key (challenge_id) references public.challenges(id) on delete cascade,
  constraint telegram_friend_result_sends_session_id_fkey
    foreign key (session_id) references public.sessions(id) on delete cascade
);

create table if not exists public.user_prompts (
  user_id    uuid    not null,
  generated  jsonb   not null default '{}'::jsonb,
  updated_at timestamptz      default now(),
  constraint user_prompts_pkey primary key (user_id),
  constraint user_prompts_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- INDEXES (non-PK)
-- ---------------------------------------------------------------------------

create index if not exists sessions_user_created_at_idx
  on public.sessions using btree (user_id, created_at desc);

create unique index if not exists sessions_user_telegram_message_id_idx
  on public.sessions using btree (user_id, telegram_chat_id, telegram_message_id)
  where (telegram_chat_id is not null and telegram_message_id is not null and source = 'telegram');

create index if not exists telegram_challenge_attempts_challenge_user_idx
  on public.telegram_challenge_attempts using btree (challenge_id, telegram_id, created_at);

create unique index if not exists telegram_friend_result_sends_session_id_idx
  on public.telegram_friend_result_sends using btree (session_id);

create index if not exists telegram_friend_result_sends_challenge_user_idx
  on public.telegram_friend_result_sends using btree (challenge_id, telegram_id, sent_at);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.sessions              enable row level security;
alter table public.streaks               enable row level security;
alter table public.telegram_connections  enable row level security;
alter table public.challenges            enable row level security;
alter table public.telegram_challenge_state    enable row level security;
alter table public.telegram_challenge_attempts enable row level security;
alter table public.api_usage_daily             enable row level security;
alter table public.telegram_friend_result_sends enable row level security;
alter table public.user_prompts                enable row level security;

-- sessions
drop policy if exists "own sessions only" on public.sessions;
create policy "own sessions only" on public.sessions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- streaks
drop policy if exists "own streak only" on public.streaks;
create policy "own streak only" on public.streaks
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- telegram_connections (USING only — no WITH CHECK by design)
drop policy if exists "Users can manage their own telegram connection" on public.telegram_connections;
create policy "Users can manage their own telegram connection" on public.telegram_connections
  for all
  using ((select auth.uid()) = user_id);

-- challenges
drop policy if exists "Service role manages challenges" on public.challenges;
create policy "Service role manages challenges" on public.challenges
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- telegram_challenge_state
drop policy if exists "Service role manages Telegram challenge state" on public.telegram_challenge_state;
create policy "Service role manages Telegram challenge state" on public.telegram_challenge_state
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- telegram_challenge_attempts
drop policy if exists "Service role manages Telegram challenge attempts" on public.telegram_challenge_attempts;
create policy "Service role manages Telegram challenge attempts" on public.telegram_challenge_attempts
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- api_usage_daily
drop policy if exists "Service role manages API usage" on public.api_usage_daily;
create policy "Service role manages API usage" on public.api_usage_daily
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- telegram_friend_result_sends
drop policy if exists "Service role manages Telegram friend result sends" on public.telegram_friend_result_sends;
create policy "Service role manages Telegram friend result sends" on public.telegram_friend_result_sends
  for all
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- user_prompts
drop policy if exists "user_prompts_select_own" on public.user_prompts;
create policy "user_prompts_select_own" on public.user_prompts
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "user_prompts_insert_own" on public.user_prompts;
create policy "user_prompts_insert_own" on public.user_prompts
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_prompts_update_own" on public.user_prompts;
create policy "user_prompts_update_own" on public.user_prompts
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_prompts_service_role" on public.user_prompts;
create policy "user_prompts_service_role" on public.user_prompts
  for all
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- FUNCTIONS (RPCs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.consume_api_usage_daily(p_user_id uuid, p_kind text, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  usage_day date := (now() at time zone 'utc')::date;
  next_count integer;
begin
  if auth.role() = 'service_role' then
    v_user_id := p_user_id;
  elsif auth.role() = 'authenticated' then
    v_user_id := auth.uid();
  else
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'no user context' using errcode = '42501';
  end if;

  if p_limit < 1 or p_kind not in ('transcription', 'feedback', 'prompts') then
    return false;
  end if;

  insert into public.api_usage_daily (user_id, usage_date, kind, count, updated_at)
  values (v_user_id, usage_day, p_kind, 1, now())
  on conflict (user_id, usage_date, kind)
  do update
    set count = public.api_usage_daily.count + 1,
        updated_at = now()
    where public.api_usage_daily.count < p_limit
  returning count into next_count;

  return next_count is not null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_practice_stats(p_user_id uuid, p_recent_limit integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_limit integer;
begin
  if auth.role() = 'service_role' then
    v_user_id := p_user_id;
  elsif auth.role() = 'authenticated' then
    v_user_id := auth.uid();
  else
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'no user context' using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_recent_limit, 15), 200));

  return (
    with
    month_bounds as (
      select
        (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC') as month_start,
        ((date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC') as month_end
    ),
    user_sessions as (
      select
        s.id,
        s.created_at,
        case
          when lower(coalesce(s.mode, 'speaking')) in ('speaking', 'free', 'free_speaking') then 'speaking'
          else lower(coalesce(s.mode, 'speaking'))
        end as normalized_mode,
        coalesce(s.duration, 0)::numeric as duration,
        coalesce(s.speaking_time, s.duration, 0)::numeric as speaking_time,
        coalesce(
          s.total_silence_time,
          greatest(0, coalesce(s.duration, 0) - coalesce(s.speaking_time, s.duration, 0))
        )::integer as total_silence_time,
        coalesce(s.pause_count, s.pauses, 0)::integer as hesitation_count,
        s.flow_score,
        s.source,
        s.scoring_version,
        (coalesce(s.scoring_version, '') not in ('tg-band-1.0', 'tg-legacy', 'free-speech-band-1.0')) as is_comparable,
        coalesce(s.completed, false) as completed
      from public.sessions s
      where s.user_id = v_user_id
    ),
    completed_sessions as (
      select * from user_sessions where completed = true
    ),
    scored as (
      select * from user_sessions where flow_score is not null and is_comparable
    ),
    monthly_sessions as (
      select us.*
      from user_sessions us, month_bounds mb
      where us.created_at >= mb.month_start
        and us.created_at < mb.month_end
    ),
    monthly_scored as (
      select * from monthly_sessions where flow_score is not null and is_comparable
    ),
    mode_rows as (
      select
        normalized_mode as mode,
        count(*)::integer as total_sessions,
        coalesce(sum(duration), 0)::integer as total_duration,
        case
          when count(flow_score) filter (where is_comparable) > 0
            then round(avg(flow_score) filter (where is_comparable))::integer
          else null
        end as avg_flow_score
      from user_sessions
      group by normalized_mode
    ),
    recent_rows as (
      select us.*
      from user_sessions us
      order by us.created_at desc
      limit v_limit
    ),
    streak_row as (
      select current_streak, longest_streak
      from public.streaks
      where streaks.user_id = v_user_id
      limit 1
    )
    select jsonb_build_object(
      'scoredSessions', (select count(*)::integer from scored),
      'totalSessions', (select count(*)::integer from completed_sessions),
      'totalPracticeTime', (select coalesce(sum(duration), 0)::integer from completed_sessions),
      'avgFlowScore', (
        select case
          when coalesce(sum(duration), 0) > 0 then round(sum(flow_score * duration) / sum(duration))::integer
          else 0
        end
        from scored
      ),
      'bestFlowScore', (select coalesce(max(flow_score), 0)::integer from scored),
      'monthlyStats', jsonb_build_object(
        'totalSessions', (select count(*)::integer from monthly_sessions),
        'totalSpeakingTime', (select coalesce(sum(speaking_time), 0)::integer from monthly_sessions),
        'avgFlowScore', (
          select case
            when coalesce(sum(duration), 0) > 0 then round(sum(flow_score * duration) / sum(duration))::integer
            else 0
          end
          from monthly_scored
        )
      ),
      'lastSessionDate', (select max(created_at) from user_sessions),
      'currentStreak', (select coalesce(max(current_streak), 0)::integer from streak_row),
      'bestStreak', (select coalesce(max(longest_streak), 0)::integer from streak_row),
      'modeBreakdown', coalesce((
        select jsonb_agg(jsonb_build_object(
          'mode', mode,
          'totalSessions', total_sessions,
          'totalDuration', total_duration,
          'avgFlowScore', avg_flow_score
        ) order by mode)
        from mode_rows
      ), '[]'::jsonb),
      'recentSessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'duration', duration::integer,
          'speakingTime', speaking_time::integer,
          'totalSilenceTime', total_silence_time,
          'hesitationCount', hesitation_count,
          'flowScore', flow_score,
          'mode', normalized_mode,
          'source', source,
          'scoringVersion', scoring_version
        ) order by created_at desc)
        from recent_rows
      ), '[]'::jsonb)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_telegram_challenge_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with conn as (
  select telegram_id
  from public.telegram_connections
  where user_id = auth.uid()
  limit 1
),
user_attempts as (
  select c.status
  from public.telegram_challenge_attempts a
  join public.challenges c on c.id = a.challenge_id
  where a.telegram_id = (select telegram_id from conn)
),
user_challenges as (
  select distinct a.challenge_id, c.status
  from public.telegram_challenge_attempts a
  join public.challenges c on c.id = a.challenge_id
  where a.telegram_id = (select telegram_id from conn)
),
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
$function$;

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------

-- consume_api_usage_daily: authenticated + service_role only
revoke execute on function public.consume_api_usage_daily(uuid, text, integer) from public;
grant execute on function public.consume_api_usage_daily(uuid, text, integer) to authenticated;
grant execute on function public.consume_api_usage_daily(uuid, text, integer) to service_role;

-- get_practice_stats: authenticated + service_role only
revoke execute on function public.get_practice_stats(uuid, integer) from public;
grant execute on function public.get_practice_stats(uuid, integer) to authenticated;
grant execute on function public.get_practice_stats(uuid, integer) to service_role;

-- get_telegram_challenge_stats: authenticated + service_role only (anon excluded)
revoke execute on function public.get_telegram_challenge_stats() from public;
grant execute on function public.get_telegram_challenge_stats() to authenticated;
grant execute on function public.get_telegram_challenge_stats() to service_role;
