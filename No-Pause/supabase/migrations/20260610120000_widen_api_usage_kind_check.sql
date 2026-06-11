alter table public.api_usage_daily drop constraint api_usage_daily_kind_check;
alter table public.api_usage_daily add constraint api_usage_daily_kind_check
  check (kind = any (array['transcription'::text, 'feedback'::text, 'prompts'::text]));
