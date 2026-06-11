-- F4: remove unnecessary anon grant on get_telegram_challenge_stats
revoke execute on function public.get_telegram_challenge_stats() from anon;

-- F5: drop duplicate index (identical to sessions_user_created_at_idx)
drop index if exists public.sessions_user_id_created_at_idx;

-- F6: initplan-wrap auth fn calls in RLS policies to avoid per-row re-evaluation
-- (Supabase lint 0003 remediation)

alter policy "Service role manages API usage"
  on public.api_usage_daily
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

alter policy "Service role manages challenges"
  on public.challenges
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

alter policy "Service role manages Telegram challenge attempts"
  on public.telegram_challenge_attempts
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

alter policy "Service role manages Telegram challenge state"
  on public.telegram_challenge_state
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- telegram_connections has USING only (no WITH CHECK) — preserve shape
alter policy "Users can manage their own telegram connection"
  on public.telegram_connections
  using ((select auth.uid()) = user_id);

alter policy "Service role manages Telegram friend result sends"
  on public.telegram_friend_result_sends
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- user_prompts policies created in add_user_prompts migration without initplan wrapping
alter policy "user_prompts_select_own"
  on public.user_prompts
  using ((select auth.uid()) = user_id);

alter policy "user_prompts_insert_own"
  on public.user_prompts
  with check ((select auth.uid()) = user_id);

alter policy "user_prompts_update_own"
  on public.user_prompts
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "user_prompts_service_role"
  on public.user_prompts
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
