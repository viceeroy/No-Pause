# No Pause Architecture

Compact current-state notes for AI agents. Update only when architecture, data flow, API behavior, scoring, schema, env, or deployment assumptions change.

## Product Surface

- Web UI exposes authenticated Speaking Mode at `/practice`; `PracticePage` currently uses mode `speaking`.
- `/prompts` is an authenticated prompt picker. Selected prompt text is passed into Speaking Mode as display/practice context and is scored as `speaking`.
- Telegram uses prompts and friend/group challenges. Do not remove `src/lib/core/prompts.ts` unless Telegram prompt/challenge behavior is replaced.

## Exposed Routes

- `/`: authenticated dashboard, `DashboardPage`.
- `/practice`: Speaking Mode, `PracticePage`.
- `/prompts`: authenticated prompt picker.
- `/stats`: stats/session history, `StatsPage`.
- `/history`: redirects to `/stats`.
- `/connect?tg=<telegram_id>`: Telegram account linking page.
- `/sessions`: auth-gated stats page used from Telegram links.
- `/auth/*`, `/login/*`, `/auth/sign-up/*`, `/auth/callback`: Supabase Google auth.
- `*`: `NotFound`.

## API Endpoints

- `POST /api/transcription`: `api/transcription.ts`; accepts `multipart/form-data` audio upload in `audio` or `file`, requires either a Supabase bearer token or an internal token, calls Groq Whisper with the server-side `GROQ_API_KEY`, and returns transcript text plus word timestamps.
- `POST /api/feedback`: `api/feedback.ts`; accepts transcript text and scoring data as JSON, requires a Supabase bearer token, calls Groq chat with the server-side `GROQ_API_KEY`, and returns coaching feedback.
- `POST /api/telegram/webhook`: `api/telegram/webhook.ts`; receives Telegram updates and delegates to Telegraf.
- `POST /api/telegram/connect`: `api/telegram/connect.ts`; requires Supabase bearer token, validates the user, upserts `telegram_connections`, and sends a Telegram welcome message.

## Important Files

- `src/main.tsx`: React entry and providers.
- `src/App.tsx`: routing, auth gating, SEO updates, Vercel analytics/speed insights.
- `src/providers/AuthContext.tsx`: Supabase session state, Google sign-in, difficulty metadata.
- `src/services/supabase.ts`: browser Supabase anon client.
- `src/services/supabaseServer.ts`: server Supabase service-role client.
- `src/lib/supabase.ts` and `src/lib/supabaseServer.ts`: compatibility re-exports for Supabase clients when present in the worktree.
- `src/services/groq.ts`: server-only Groq implementation for Whisper transcription, verbose word timestamps, and AI feedback. Browser code must not import this file.
- `api/transcription.ts`: serverless audio transcription boundary.
- `api/feedback.ts`: serverless AI feedback boundary.
- `src/pages/PracticePage.tsx`: current web practice screen; maps optional `prompt_text` into the session context.
- `src/features/practice/pages/useRecordingController.ts`: coordinates recording, scoring, session persistence, transcription, and feedback hooks.
- `src/features/practice/hooks/useRecording.ts`: web recording lifecycle and microphone/audio analyzer orchestration.
- `src/features/practice/hooks/useScoring.ts`: builds web session result using core scoring.
- `src/features/practice/hooks/useSession.ts`: web session persistence, transcription, and feedback requests.
- `src/features/practice/lib/speechAnalyzer.ts`: high-level practice analyzer that composes audio capture, speech session state, and transcription.
- `src/features/practice/lib/audioCapture.ts`: MediaRecorder/Web Audio stream setup, analyser samples, audio chunks, diagnostics, and health checks.
- `src/features/practice/lib/speechSession.ts`: speech/silence state, pause-unit tracking, scoring preview, and mic state-machine integration.
- `src/features/practice/lib/transcription.ts`: browser SpeechRecognition plus Android/server transcription fallback coordination.
- `src/features/practice/lib/speechTypes.ts`: shared practice analyzer types.
- `src/lib/practiceApi.ts`: browser-facing API facade for sessions, streaks, stats, transcription, and feedback. Groq work is routed through `/api/transcription` and `/api/feedback`.
- `src/lib/telegram/router.ts`: Telegraf command/action routing, connection checks, stats, and prompt messages.
- `src/lib/telegram/voiceHandler.ts`: Telegram voice download, transcription endpoint call, pause/filler analysis, persistence, and reply formatting.
- `src/lib/telegram/challenges.ts`: friend/group challenge creation, state, callbacks, and result updates.
- `src/lib/telegram/constants.ts`: Telegram bot constants.
- `src/lib/telegramAuth.ts`: Telegram connection upsert.
- `src/lib/core/scoring.ts`: Flow Score source of truth.
- `src/lib/core/session.ts`: shared `sessions` insert and `streaks` update.
- `src/lib/core/queries.ts`: shared stats/session reads and aggregation.
- `src/lib/core/modes.ts`: mode normalization and labels.
- `src/lib/core/prompts.ts`: built-in prompts used by web prompts and Telegram.
- `src/lib/core/user.ts`: Telegram ID to Supabase user lookup.
- `supabase/migrations/*.sql`: additive migrations for Telegram connections, challenge tables, and newer session columns. Base `sessions`/`streaks` schema is not fully represented in this repo.

## Core Functions / Modules

- `calculateFlowScore(rawHesitationCount, options)`: authoritative scoring function.
- `insertSession(supabase, input)`: writes session rows with mode `speaking`, falling back when newer analysis columns are missing.
- `updateStreak(supabase, input)`: updates daily streak counters.
- `buildPracticeStats(sessions, streak)`: aggregates dashboard/stat values.
- `SpeechAnalyzer`: top-level browser practice orchestrator.
- `AudioCapture`: browser audio capture/analyser/recorder helper.
- `SpeechSession`: pause detection and scoring session state.
- `TranscriptionController`: browser SpeechRecognition and server transcription fallback helper.
- `createTelegramBot()`: registers Telegram commands, actions, and voice handling.
- `handleVoiceMessage()`: Telegram voice analysis pipeline.
- `transcribeAudioVerbose()`: server-side Groq Whisper transcription with word timestamps.
- `getAIFeedback()` / `analyzePracticeSpeech()`: server-side Groq chat-based feedback.

## Active Data Flow

### Web Speaking Mode

1. Authenticated user opens `/practice` or chooses a prompt from `/prompts`.
2. `PracticePage` runs Speaking Mode; optional `prompt_text` becomes prompt context.
3. `useRecordingController` initializes microphone services and the practice analyzer.
4. `AudioCapture` samples Web Audio RMS, records chunks, and reports capture diagnostics.
5. `SpeechSession` tracks speech/silence, emits pause units, and uses `calculateFlowScore` for preview/final scoring.
6. Browser SpeechRecognition may produce an initial transcript. Android fallback or manual transcription sends the audio blob through `practiceApi.transcribeAudio()` to `/api/transcription`.
7. `/api/transcription` validates the Supabase bearer token, calls Groq Whisper server-side, and returns transcript text and optional word timestamps.
8. `saveSession` writes to `sessions`; `updateStreak` writes to `streaks`.
9. Optional coaching feedback sends transcript and scoring data through `practiceApi.analyzeSpeech()` to `/api/feedback`; the endpoint calls Groq server-side and stores/returns feedback through the session flow.
10. Stats pages read `sessions` and `streaks` through `getPracticeStats` / `buildPracticeStats`.

### Telegram Voice / Challenge

1. Telegram posts updates to `/api/telegram/webhook`.
2. `createTelegramBot` resolves the Telegram user through `telegram_connections`; unconnected users get `/connect?tg=...`.
3. `voiceHandler` downloads Telegram voice files from Telegram.
4. `voiceHandler` uploads the audio to `/api/transcription` with `x-nopause-internal-token`; the transcription endpoint calls Groq Whisper server-side and returns transcript plus word timestamps.
5. Telegram rejects unusable transcripts under 3 words.
6. Pause units are calculated from inter-word timestamp gaps; spoken filler count may be included for display/storage when available.
7. `calculateFlowScore` scores pause units as mode `speaking`.
8. `insertSession` writes source `telegram`; `updateStreak` updates streaks.
9. Bot replies with Flow Score, pauses, filler hesitations, speaking time, transcript, and optional AI feedback.
10. Friend/group challenge state uses `challenges` and `telegram_challenge_state`; prompt text comes from `src/lib/core/prompts.ts`.

## External Service Boundaries

- Browser code may call Supabase with the anon key and local serverless endpoints under `/api/*`.
- Browser code must not call Groq URLs directly and must not import `src/services/groq.ts`.
- `api/transcription.ts`, `api/feedback.ts`, and server-side Telegram code are the Groq boundary.
- Telegram voice transcription goes through `/api/transcription` even though it runs server-side, so the Whisper upload path stays centralized.
- Supabase service-role access is server-only. Browser data writes use authenticated Supabase client calls or serverless endpoints that validate the user.

## Scoring Source Of Truth

- Only `src/lib/core/scoring.ts` defines Flow Score. UI/analyzer modules import it directly; do not fork constants or formulas.
- `rawHesitationCount` means penalized pause units for scoring.
- Current scoring formula: `speaking seconds + 40 * completed speaking minutes - 10 * hesitation units`, with a minimum score of `0`.
- There is no minimum session duration gate and no speaking-ratio completion gate.
- `getScoreLabel` uses the current open-ended scale: `<50` Needs Practice, `50-99` Getting There, `100-199` Good Flow, `200-299` Great Flow, `300+` Perfect Flow.
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
- Server/Vercel/Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`.
- Internal Telegram-to-API auth/routing: `NOPAUSE_INTERNAL_API_TOKEN`, `NOPAUSE_API_URL`, `NOPAUSE_INTERNAL_API_URL`, `VERCEL_URL`.
- Runtime flags used by code: `import.meta.env.DEV`, `import.meta.env.VITEST`, `import.meta.env.MODE`.
- Do not add `VITE_GROQ_API_KEY`; Groq keys are server-only.

## Architecture Risks / Constraints

- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, Telegram tokens, or internal API tokens to browser code; `VITE_*` values are bundled client-side.
- Groq must remain behind serverless/server code. Browser transcription and feedback must use `/api/transcription` and `/api/feedback`.
- `/api/transcription` accepts either a Supabase bearer token or the internal token used by Telegram. `/api/feedback` currently requires a Supabase bearer token.
- Base `sessions` and `streaks` schema/RLS policies are incomplete in repo migrations; verify production Supabase before changing access patterns.
- `insertSession` and query helpers include fallbacks for deployments missing newer columns like `pause_count`, `filler_count`, or `hesitations_per_minute`.
- Telegram stats filter by `sessions.source = 'telegram'`; older rows without source may not be represented accurately.
- Telegram prompt/challenge behavior is active and shares prompt data with the web prompt picker.
- AI feedback generation depends on stored or generated transcripts; no separate durable transcript cache exists beyond `sessions.transcript`.
- `APP_URL`, `SITE_URL`, and Google redirect URLs are hardcoded in code and may require code changes for non-production domains.
- Microphone capture requires secure context except localhost and depends on browser MediaRecorder/Web Audio support.
