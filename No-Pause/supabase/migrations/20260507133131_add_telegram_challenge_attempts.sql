create table if not exists public.telegram_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.challenges(id) on delete cascade,
  telegram_id bigint not null,
  session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists telegram_challenge_attempts_challenge_user_idx
  on public.telegram_challenge_attempts (challenge_id, telegram_id, created_at);

alter table public.telegram_challenge_attempts enable row level security;

drop policy if exists "Service role manages Telegram challenge attempts"
  on public.telegram_challenge_attempts;

create policy "Service role manages Telegram challenge attempts"
  on public.telegram_challenge_attempts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
