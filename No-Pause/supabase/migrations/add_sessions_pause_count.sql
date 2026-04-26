alter table public.sessions
  add column if not exists pause_count integer;
