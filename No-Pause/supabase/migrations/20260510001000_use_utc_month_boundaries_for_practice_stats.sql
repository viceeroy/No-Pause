create or replace function public.get_practice_stats(
  p_user_id uuid,
  p_recent_limit integer default 15
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with safe_input as (
  select
    greatest(1, least(coalesce(p_recent_limit, 15), 200)) as recent_limit,
    (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC') as month_start,
    ((date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC') as month_end
),
user_sessions as (
  select
    id,
    created_at,
    case
      when lower(coalesce(mode, 'speaking')) in ('speaking', 'free', 'free_speaking') then 'speaking'
      else lower(coalesce(mode, 'speaking'))
    end as normalized_mode,
    coalesce(duration, 0)::numeric as duration,
    coalesce(speaking_time, duration, 0)::numeric as speaking_time,
    coalesce(pause_count, pauses, 0)::integer as hesitation_count,
    flow_score,
    source
  from public.sessions
  where user_id = p_user_id
),
scored as (
  select *
  from user_sessions
  where flow_score is not null
),
monthly_sessions as (
  select us.*
  from user_sessions us, safe_input si
  where us.created_at >= si.month_start
    and us.created_at < si.month_end
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
  from user_sessions us, safe_input si
  order by us.created_at desc
  limit (select recent_limit from safe_input)
),
streak_row as (
  select current_streak, longest_streak
  from public.streaks
  where user_id = p_user_id
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
      'hesitationCount', hesitation_count,
      'flowScore', flow_score,
      'mode', normalized_mode,
      'source', source
    ) order by created_at desc)
    from recent_rows
  ), '[]'::jsonb)
);
$$;
