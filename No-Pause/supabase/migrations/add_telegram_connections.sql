create table if not exists telegram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  telegram_id bigint unique not null,
  connected_at timestamptz default now()
);

alter table telegram_connections enable row level security;

alter table sessions
  add column if not exists scoring_version text;

create policy "Users can read their Telegram connection"
  on telegram_connections
  for select
  using (auth.uid() = user_id);

create policy "Service role manages Telegram connections"
  on telegram_connections
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
