-- get_telegram_challenge_stats was created with default PUBLIC execute grant.
-- REVOKE FROM anon (applied in audit_perf_and_grant_fixes) was insufficient
-- because anon inherits from PUBLIC. Revoke from PUBLIC and re-grant explicitly.
revoke execute on function public.get_telegram_challenge_stats() from public;
grant execute on function public.get_telegram_challenge_stats() to authenticated;
grant execute on function public.get_telegram_challenge_stats() to service_role;
