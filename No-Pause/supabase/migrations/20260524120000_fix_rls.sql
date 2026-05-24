-- Fix CRITICAL RLS bypass in get_practice_stats and consume_api_usage_daily.
--
-- Both functions are SECURITY DEFINER with no auth check on p_user_id.
-- Any caller (including anon) could pass an arbitrary p_user_id and
-- read/mutate another user's data. Default PostgreSQL GRANTs give
-- anon EXECUTE access.
--
-- This migration:
--   1. Rewrites both functions with an explicit role check:
--      - service_role  → uses p_user_id (Telegram bot / server-side calls)
--      - authenticated → uses auth.uid(), ignores p_user_id
--      - anon/other    → raises 'unauthorized'
--   2. Revokes EXECUTE from anon and public, grants only to authenticated + service_role.
--
-- get_practice_stats remains SECURITY DEFINER because it reads from the
-- streaks table which has RLS restricted to service_role.
-- SET search_path = public prevents search-path attacks.


-- ===================================================================
-- get_practice_stats
-- ===================================================================

drop function if exists public.get_practice_stats(uuid, integer);

create function public.get_practice_stats(
  p_user_id uuid,
  p_recent_limit integer default 15
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_limit integer;
begin
  -- Resolve the effective user based on caller role.
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
        coalesce(s.total_silence_time, 0)::integer as total_silence_time,
        coalesce(s.pause_count, s.pauses, 0)::integer as hesitation_count,
        s.flow_score,
        s.source
      from public.sessions s
      where s.user_id = v_user_id
    ),
    scored as (
      select *
      from user_sessions
      where flow_score is not null
    ),
    monthly_sessions as (
      select us.*
      from user_sessions us, month_bounds mb
      where us.created_at >= mb.month_start
        and us.created_at < mb.month_end
    ),
    monthly_scored as (
      select *
      from monthly_sessions
      where flow_score is not null
    ),
    mode_rows as (
      select
        normalized_mode as mode,
        count(*)::integer as total_sessions,
        coalesce(sum(duration), 0)::integer as total_duration,
        case
          when count(flow_score) > 0 then round(avg(flow_score))::integer
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
      'totalPracticeTime', (select coalesce(sum(duration), 0)::integer from user_sessions),
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
          'source', source
        ) order by created_at desc)
        from recent_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Lock down access: only authenticated users and service_role can call this.
revoke execute on function public.get_practice_stats(uuid, integer) from anon, public;
grant execute on function public.get_practice_stats(uuid, integer) to authenticated, service_role;


-- ===================================================================
-- consume_api_usage_daily
-- ===================================================================

drop function if exists public.consume_api_usage_daily(uuid, text, integer);

create function public.consume_api_usage_daily(
  p_user_id uuid,
  p_kind text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  usage_day date := (now() at time zone 'utc')::date;
  next_count integer;
begin
  -- Resolve the effective user based on caller role.
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

  if p_limit < 1 or p_kind not in ('transcription', 'feedback') then
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
$$;

revoke execute on function public.consume_api_usage_daily(uuid, text, integer) from anon, public;
grant execute on function public.consume_api_usage_daily(uuid, text, integer) to authenticated, service_role;
