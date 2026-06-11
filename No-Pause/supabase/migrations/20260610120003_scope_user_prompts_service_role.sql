-- user_prompts had 3 per-action own policies + a FOR ALL service_role policy,
-- all scoped TO public. The service_role policy overlapped the own policies on
-- every role/action (Supabase lint 0006 multiple_permissive_policies, 18 warns).
-- Scope service_role policy TO service_role so no two permissive policies
-- coexist for any other role. Postgres cannot ALTER a policy's role — drop/recreate.
drop policy if exists "user_prompts_service_role" on public.user_prompts;

create policy "user_prompts_service_role"
  on public.user_prompts
  for all
  to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');
