create table if not exists public.telegram_friend_result_sends (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.challenges(id) on delete cascade,
  telegram_id bigint not null,
  session_id uuid not null references public.sessions(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create unique index if not exists telegram_friend_result_sends_session_id_idx
  on public.telegram_friend_result_sends (session_id);

create index if not exists telegram_friend_result_sends_challenge_user_idx
  on public.telegram_friend_result_sends (challenge_id, telegram_id, sent_at);

alter table public.telegram_friend_result_sends enable row level security;

drop policy if exists "Service role manages Telegram friend result sends"
  on public.telegram_friend_result_sends;

create policy "Service role manages Telegram friend result sends"
  on public.telegram_friend_result_sends
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
