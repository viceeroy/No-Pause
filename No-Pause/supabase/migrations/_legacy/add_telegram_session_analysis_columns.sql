alter table public.sessions
  add column if not exists hesitations_per_minute numeric;
