# No Pause Architecture

Compact current-state notes for AI agents. Update only when architecture, data flow, API behavior, scoring, schema, env, or deployment assumptions change.

## Product Surface

- Web UI currently exposes authenticated Free Speaking practice only. `/practice` and `/practice/free-speaking` both render `PracticePage`; `PracticePage` always uses mode `free`.
- Web no longer exposes `/prompts` or prompt-browser files. Free Speaking can still accept `prompt_text`; this is display context only and is scored as `free`.
- Telegram may still use prompts and friend/group challenges. Do not remove `src/lib/core/prompts.ts` unless Telegram prompt/challenge behavior is replaced.
- `lemon`, `topic`, and `readingchallenge` mode values may exist in old data or Telegram-related copy, but they are not separate current web practice modes.

## Exposed Routes

- `/`: authenticated dashboard, `DashboardPage`.
- `/practice`: Free Speaking practice, `PracticePage`.
- `/practice/free-speaking`: Free Speaking practice, `PracticePage`.
- `/stats`: stats/session history, `StatsPage`.
- `/history`: redirects to `/stats`.
- `/connect?tg=<telegram_id>`: Telegram account linking page.
- `/sessions`: auth-gated stats page used from Telegram links.
- `/auth/*`, `/login/*`, `/auth/sign-up/*`, `/auth/callback`: Supabase Google auth.
- `*`: `NotFound`.

## API Endpoints

- `POST /api/telegram/webhook`: `api/telegram/webhook.ts`; receives Telegram updates and delegates to Telegraf.
- `POST /api/telegram/connect`: `api/telegram/connect.ts`; requires Supabase bearer token, validates the user, upserts `telegram_connections`, and sends a Telegram welcome message.

## Important Files

- `src/main.tsx`: React entry and providers.
- `src/App.tsx`: routing, auth gating, SEO updates, Vercel analytics/speed insights.
- `src/providers/AuthContext.tsx`: Supabase session state, Google sign-in, difficulty metadata.
- `src/services/supabase.ts`: browser Supabase anon client.
- `src/services/supabaseServer.ts`: server Supabase service-role client.
- `src/lib/supabase.ts` and `src/lib/supabaseServer.ts`: compatibility re-exports for Supabase clients.
- `src/services/groq.ts`: Groq Whisper transcription, verbose word timestamps, filler analysis, AI feedback.
- `src/pages/PracticePage.tsx`: current web practice screen; enforces `mode = "free"` and maps optional `prompt_text`.
- `src/features/practice/pages/useRecordingController.ts`: coordinates recording, scoring, session persistence, and optional Groq transcription/feedback hooks.
- `src/features/practice/hooks/useRecording.ts`: web recording lifecycle and microphone/audio analyzer orchestration.
- `src/features/practice/hooks/useScoring.ts`: builds web session result using core scoring.
- `src/features/practice/hooks/useSession.ts`: web session persistence, transcription, and feedback requests.
- `src/features/practice/lib/speechAnalyzer.ts`: Web Audio analyzer, silence/pause detection, browser speech recognition, recorder diagnostics; imports core scoring directly.
- `src/lib/practiceApi.ts`: browser-facing session, streak, stats, Groq transcription, and feedback wrapper.
- `src/lib/telegramBot.ts`: Telegram bot commands, voice analysis, prompts, stats, friend/group challenges.
- `src/lib/telegramAuth.ts`: Telegram connection upsert.
- `src/lib/core/scoring.ts`: Flow Score source of truth.
- `src/lib/core/session.ts`: shared `sessions` insert and `streaks` update.
- `src/lib/core/queries.ts`: shared stats/session reads and aggregation.
- `src/lib/core/modes.ts`: mode normalization and labels.
- `src/lib/core/prompts.ts`: built-in prompts used by Telegram.
- `src/lib/core/user.ts`: Telegram ID to Supabase user lookup.
- `supabase/migrations/*.sql`: additive migrations for Telegram connections, challenge tables, and newer session columns. Base `sessions`/`streaks` schema is not fully represented in this repo.

## Core Functions / Modules

- `calculateFlowScore(rawHesitationCount, options)`: authoritative scoring function.
- `insertSession(supabase, input)`: normalizes `free_speaking` to `free`, writes session rows, falls back when newer analysis columns are missing.
- `updateStreak(supabase, input)`: updates daily streak counters.
- `buildPracticeStats(sessions, streak)`: aggregates dashboard/stat values.
- `AudioAnalyzer`: browser audio capture and pause-unit detection.
- `createTelegramBot()`: registers Telegram commands, actions, and voice handling.
- `transcribeAudioVerbose()`: Groq Whisper transcription with word timestamps for Telegram pause detection.
- `analyzeSpeech()` / `getAIFeedback()`: Groq chat-based filler counting and user feedback.

## Active Data Flow

### Web Free Speaking

1. Authenticated user opens `/practice` or `/practice/free-speaking`.
2. `PracticePage` sets mode to `free`; optional `prompt_text` becomes display prompt context only.
3. `useRecordingController` initializes `micService` and `AudioAnalyzer`.
4. `AudioAnalyzer` samples Web Audio RMS, calibrates noise, tracks speech/silence, and emits pause units.
5. Browser speech recognition may produce an initial transcript; user can request Groq transcription from the saved audio blob.
6. `calculateFlowScore` scores pause units using speaking time and total session time.
7. `saveSession` writes to `sessions`; `updateStreak` writes to `streaks`.
8. Stats pages read `sessions` and `streaks` through `getPracticeStats` / `buildPracticeStats`.

### Telegram Voice / Challenge

1. Telegram posts updates to `/api/telegram/webhook`.
2. `createTelegramBot` resolves the Telegram user through `telegram_connections`; unconnected users get `/connect?tg=...`.
3. Voice files are downloaded from Telegram and sent to Groq Whisper verbose transcription.
4. Telegram rejects unusable transcripts under 3 words.
5. Pause units are calculated from inter-word timestamp gaps; spoken filler count is calculated by Groq chat.
6. `calculateFlowScore` scores pause units as mode `free`.
7. `insertSession` writes source `telegram`; `updateStreak` updates streaks.
8. Bot replies with Flow Score, pauses, filler hesitations, speaking time, transcript, and optional AI feedback.
9. Friend/group challenge state uses `challenges` and `telegram_challenge_state`; prompt text comes from `src/lib/core/prompts.ts`.

## Scoring Source Of Truth

- Only `src/lib/core/scoring.ts` defines Flow Score. UI/analyzer modules import it directly; do not fork constants or formulas.
- `rawHesitationCount` means penalized pause units for scoring.
- Current completion rules: `free` and `lemon` require at least 60s total session time and 50% speaking ratio; `topic` requires at least 120s and 50% speaking ratio.
- Incomplete sessions return score `0` with reason `duration` or `speaking`.
- Pause thresholds by difficulty: beginner `1.8s`, intermediate `1.2s`, advanced `0.8s`; Telegram uses the default beginner threshold.
- Web `hesitationCount` is audio-derived pause units and affects score.
- Telegram `pauseCount` is word-gap pause units and affects score.
- Telegram `hesitationCount`/`filler_count` is LLM-counted spoken fillers for display/storage only.
- `sessions.pauses` is legacy naming; current writes also use `pause_count` when available.

## Database Tables Used

- `auth.users`: Supabase Auth users; code reads `id`, `email`, name/avatar metadata, and difficulty metadata.
- `public.sessions`: practice records. Used fields include `id`, `user_id`, `created_at`, `mode`, `duration`, `speaking_time`, `pauses`, `pause_count`, `filler_count`, `hesitations_per_minute`, `words`, `flow_score`, `completed`, `hesitation_log`, `transcript`, `analysis_feedback`, `scoring_version`, `source`.
- `public.streaks`: streak counters. Used fields: `user_id`, `current_streak`, `longest_streak`, `last_session_date`.
- `public.telegram_connections`: Telegram account links. Used fields: `telegram_id`, `user_id`, `connected_at`.
- `public.challenges`: Telegram friend/group challenge records. Used fields: `id`, `topic`, `creator_telegram_id`, `creator_score`, `status`, `created_at`.
- `public.telegram_challenge_state`: pending Telegram challenge context. Used fields: `telegram_id`, `challenge_id`, `challenge_type`, `group_id`, `group_message_id`, `participant_username`, `creator_username`, `created_at`, `updated_at`.

## Environment Variables

- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Server/API Groq: `GROQ_API_KEY`.
- Server/Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`.
- Runtime flags used by code: `import.meta.env.DEV`, `import.meta.env.VITEST`, `import.meta.env.MODE`.

## Architecture Risks / Constraints

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets to browser code; `VITE_*` values are bundled client-side.
- Base `sessions` and `streaks` schema/RLS policies are incomplete in repo migrations; verify production Supabase before changing access patterns.
- `insertSession` and query helpers include fallbacks for deployments missing newer columns like `pause_count`, `filler_count`, or `hesitations_per_minute`.
- Telegram stats filter by `sessions.source = 'telegram'`; older rows without source may not be represented accurately.
- Telegram prompt/challenge behavior is active even though web UI exposes Free Speaking only.
- AI feedback generation depends on stored transcripts; no separate durable transcript cache exists beyond `sessions.transcript`.
- `APP_URL`, `SITE_URL`, and Google redirect URLs are hardcoded in code and may require code changes for non-production domains.
- Microphone capture requires secure context except localhost and depends on browser MediaRecorder/Web Audio support.
