alter table public.sessions
  add column if not exists hesitations_per_minute numeric,
  add column if not exists filler_count integer;
