alter table public.sessions
  add column if not exists source text not null default 'web';

update public.sessions
set source = 'web'
where source is null;

alter table public.sessions
  add constraint sessions_source_check
  check (source in ('web', 'telegram'));

create index if not exists sessions_user_source_created_at_idx
  on public.sessions (user_id, source, created_at desc);
