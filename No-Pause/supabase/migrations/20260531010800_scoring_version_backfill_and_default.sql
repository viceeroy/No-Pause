-- Backfill scoring_version on all existing sessions and set the column default.
-- Three cohorts:
--   tg-legacy   : Telegram sessions before 2026-05-24 (blendWithAiScore era)
--   tg-band-1.0 : Telegram sessions from a topic challenge where band bonus was applied
--   base-1.0    : everything else (all web sessions, no-topic Telegram sessions)
-- All three statements are idempotent.

UPDATE public.sessions SET scoring_version = CASE
  WHEN source = 'telegram' AND created_at < '2026-05-24' THEN 'tg-legacy'
  WHEN source = 'telegram' AND created_at >= '2026-05-24'
       AND id IN (
         SELECT ca.session_id FROM public.telegram_challenge_attempts ca
         JOIN public.challenges c ON c.id = ca.challenge_id
         WHERE c.topic IS NOT NULL AND length(btrim(c.topic)) > 0
       ) THEN 'tg-band-1.0'
  ELSE 'base-1.0'
END;

ALTER TABLE public.sessions ALTER COLUMN scoring_version SET DEFAULT 'base-1.0';
