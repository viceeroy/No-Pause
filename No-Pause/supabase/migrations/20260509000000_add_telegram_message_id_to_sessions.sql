alter table public.sessions
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_message_id bigint;

create unique index if not exists sessions_user_telegram_message_id_idx
  on public.sessions (user_id, telegram_chat_id, telegram_message_id)
  where telegram_chat_id is not null and telegram_message_id is not null and source = 'telegram';
