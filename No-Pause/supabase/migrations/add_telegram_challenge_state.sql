create table if not exists public.challenges (
  id text primary key,
  topic text not null,
  creator_telegram_id bigint not null,
  creator_score integer,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_challenge_state (
  telegram_id bigint primary key,
  challenge_id text not null references public.challenges(id) on delete cascade,
  challenge_type text not null check (challenge_type in ('friend', 'group')),
  group_id bigint,
  group_message_id bigint,
  participant_username text,
  creator_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.challenges enable row level security;
alter table public.telegram_challenge_state enable row level security;

create policy "Service role manages challenges"
  on public.challenges
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role manages Telegram challenge state"
  on public.telegram_challenge_state
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
