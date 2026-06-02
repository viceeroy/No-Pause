-- Free-speech band sessions ('free-speech-band-1.0') are judged on a 3-criterion rubric
-- (development, details, logic — no topic relevance) vs the 4-criterion prompted rubric,
-- so their band-adjusted flow scores are not comparable. Add them to the existing
-- is_comparable exclusion set alongside 'tg-band-1.0' and 'tg-legacy'.
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
