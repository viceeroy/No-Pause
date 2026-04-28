# No Pause AI Context

High-signal architecture notes for AI agents. Keep this file compact.

## Agent Rules

- Only Free Speaking is exposed in the web UI.
- Lemon, topic, reading challenge, blog, and prompt-browser code may still exist, but current web UI should not link to those flows.
- Do not remove `src/lib/core/prompts.ts`; it is used by Telegram.
- `SYSTEM.md` should only change for architecture-level changes: scoring, data flow, API behavior, database shape, environment variables, deployment assumptions, or major product-surface changes.
- Do not update `SYSTEM.md` for UI styling, layout, copy, or navigation-only changes.
- Source of truth for Flow Score is `src/lib/core/scoring.ts`; do not duplicate or fork scoring logic.
- Do not casually modify scoring, analyzer, Supabase, or Telegram bot behavior when doing UI work.

## Architecture

### Web

- Vite + React + TypeScript app.
- Entry: `src/main.tsx`.
- Router: `src/App.tsx`.
- Auth: Supabase Google auth through `AuthContext` and `src/lib/supabase.ts`.
- Practice UI: `src/pages/PracticePage.tsx`.
- Web practice state/controllers: `src/features/practice/pages/*`.
- Web audio analysis: `src/features/practice/lib/speechAnalyzer.ts`, `src/features/practice/lib/analyzer/micStateMachine.ts`.
- Persistence/API wrapper: `src/lib/practiceApi.ts`.
- Current web practice mode: Free Speaking only; `usePromptLoader` forces mode to `free` regardless of route/query.

### Telegram

- Webhook: `api/telegram/webhook.ts`.
- Bot implementation: `src/lib/telegramBot.ts`.
- Bot username: `NoPauseAI_bot`.
- Telegram connects to web through `/connect?tg=<telegram_id>`.
- Telegram voice analysis uses Groq Whisper timestamps, Groq chat filler analysis, core scoring, and Supabase service-role writes.

### Supabase

- Browser uses anon client + user auth.
- Server/API/bot uses service-role client.
- Stores users, sessions, streaks, Telegram links, challenge records, and pending Telegram challenge state.
- Base migrations for `sessions` and `streaks` are incomplete in repo; some production schema/policies may exist outside repo.

### Groq

- Module: `src/lib/core/groq.ts`.
- Transcription endpoint: `/openai/v1/audio/transcriptions`.
- Chat endpoint: `/openai/v1/chat/completions`.
- Whisper model: `whisper-large-v3-turbo`.
- Chat model: `llama-3.3-70b-versatile`.
- Browser Groq calls may use `VITE_GROQ_API_KEY`; server/bot uses `GROQ_API_KEY`.

## Core Flows

### Web Practice Flow

1. Authenticated user opens `/practice` or `/practice/free-speaking`.
2. `usePromptLoader` resolves mode as `free`; optional `prompt_text` becomes a Free Speaking prompt.
3. `useRecordingController` obtains mic stream via `micService`.
4. `AudioAnalyzer` samples Web Audio RMS, calibrates noise, tracks speech/silence transitions, and counts pause units.
5. Browser `SpeechRecognition`, when available, builds transcript and filler-word display data.
6. `calculateFlowScore` scores filtered pause units with speaking time and total duration.
7. `saveSession`/`insertSession` writes session metrics and transcript to Supabase; `updateStreak` updates streaks.
8. Stats read through `getPracticeStats`.

### Telegram Voice Flow

1. Telegram sends POST update to `/api/telegram/webhook`.
2. `createTelegramBot` delegates voice messages to `handleVoiceMessage`.
3. Bot resolves connected Supabase user from `telegram_connections`; unconnected users get a connect prompt.
4. Bot downloads voice file from Telegram file API.
5. `transcribeAudioVerbose` sends audio to Groq Whisper with `verbose_json` word timestamps.
6. Empty, under-3-word, or high `no_speech_prob` transcripts are rejected.
7. Bot counts real pauses from inter-word timestamp gaps using the default pause threshold.
8. `analyzeGroqSpeech` counts spoken filler hesitations from transcript text; this is display/storage only.
9. Bot calculates Flow Score from pause count, speaking time, total voice duration, and mode.
10. Bot writes session, updates streak, stores temporary transcript memory for AI feedback, and replies with score, pauses, hesitations, speaking time, and transcript.

### Telegram Challenges

- `/nopause` in groups creates a durable challenge and stores pending state in `telegram_challenge_state`.
- Friend/group challenge voice notes reuse the same voice analysis and session write flow.
- Challenge topics and pending challenge context are durable in Supabase; AI feedback transcript cache is process-local and can disappear on cold starts.

## Scoring

Source: `src/lib/core/scoring.ts`. Re-exported by `src/features/practice/lib/scoringConstants.ts` and `src/features/practice/lib/analyzer/scoring.ts`.

### Key Constants

- `SCORING_VERSION = "1.0"`.
- Pause thresholds: beginner `1.8s`, intermediate `1.2s`, advanced `0.8s`.
- Default pause threshold: beginner.
- `GRACE_RATE = 1.0`.
- `PENALTY_PER_HPM = 10`.
- `MIN_RATIO_FOR_UNCAPPED = 0.65`.
- `CAP_AT_MIN_RATIO = 70`.
- Minimum speaking ratio for completion: `0.5`.
- Min total duration: free `60s`, lemon `60s`, topic `120s`.

### Completion

`calculateFlowScore(rawHesitationCount, options)` treats `rawHesitationCount` as penalized interruption units. Current Telegram passes `pauseCount`.

- If `totalSessionTimeSec <= 0`: score `0`, incomplete, reason `duration`.
- `free`: complete when total duration >= `60s` and speaking ratio >= `0.5`.
- `lemon`: complete when total duration >= `60s` and speaking ratio >= `0.5`.
- `topic`: complete when total duration >= `120s` and speaking ratio >= `0.5`.
- Incomplete sessions return score `0` and reason `duration` or `speaking`.

### Formula

```text
speakingRatio = speakingTimeSec / totalSessionTimeSec
speakingMinutes = max(speakingTimeSec / 60, 0.5)
hesitationsPerMinute = penalizedCount / speakingMinutes
excessRate = max(0, hesitationsPerMinute - GRACE_RATE)
baseScore = max(0, round(100 - excessRate * PENALTY_PER_HPM))

if speakingRatio < MIN_RATIO_FOR_UNCAPPED:
  ratioRange = MIN_RATIO_FOR_UNCAPPED - 0.5
  ratioProgress = min(1, (speakingRatio - 0.5) / ratioRange)
  maxScore = round(CAP_AT_MIN_RATIO + ratioProgress * (100 - CAP_AT_MIN_RATIO))
  finalScore = min(baseScore, maxScore)
else:
  finalScore = baseScore
```

With current constants:

```text
baseScore = max(0, round(100 - max(0, HPM - 1.0) * 10))
```

Labels: `96-100 Perfect Flow`, `81-95 Great Flow`, `61-80 Good Flow`, `41-60 Getting There`, `0-40 Needs Practice`.

### Pause vs Filler Semantics

- Web `hesitationCount` means real pause units from audio silence detection; it affects score.
- Telegram `pauseCount` means real pause units from word timestamp gaps; it affects score.
- Telegram `hesitationCount` means LLM-counted spoken fillers; it is display/storage only (`filler_count`) and does not affect score.
- `sessions.pauses` is legacy naming; `insertSession` also writes `pause_count` when available.

### Web Pause Detection

- RMS smoothing window: `10`.
- Calibration: `1500ms`.
- Speech-on threshold: `max(0.01, noiseFloor * 3)`, capped at `0.06`.
- Speech-off threshold: `speechOnThreshold * 0.7`.
- Ignore micro-pauses under `300ms`.
- Pause units: `floor(silenceDuration / hesitationMinDuration)`.
- Final trailing silence handled with `END_BUFFER_MS = 1000`.
- Difficulty threshold comes from Supabase user metadata.

### Telegram Pause Detection

- Uses Groq Whisper `verbose_json` with word timestamps.
- Inter-word gap = `word.start - previousWord.end`.
- Gap >= default threshold (`1.8s`) counts `floor(gap / 1.8s)` pause units.
- Speaking time uses sum of word durations when possible; otherwise Telegram voice duration.
- Total session time uses Telegram voice duration, minimum `1s`.

## API Surface

- `POST /api/telegram/webhook`
  - File: `api/telegram/webhook.ts`.
  - Receives Telegram updates and delegates to Telegraf.
- `POST /api/telegram/connect`
  - File: `api/telegram/connect.ts`.
  - Requires Supabase bearer token, validates logged-in user, upserts `telegram_connections`, sends Telegram welcome message.

## Database

### `auth.users`

- Managed by Supabase Auth.
- Used fields: `id`, `email`, `user_metadata.full_name/name/avatar_url`, difficulty metadata.
- Difficulty controls web pause threshold.

### `public.sessions`

- Durable practice/voice records.
- Critical fields: `user_id`, `created_at`, `mode`, `duration`, `speaking_time`, `pauses`, `pause_count`, `filler_count`, `hesitations_per_minute`, `words`, `flow_score`, `completed`, `hesitation_log`, `transcript`, `analysis_feedback`, `scoring_version`.
- Values for `mode` can include `free`, `lemon`, `topic`, `readingchallenge`; `free_speaking` normalizes to `free`.
- Written by web and Telegram through shared `insertSession`; updated by web `updateSession`.
- Read by stats, session history, and Telegram status.

### `public.streaks`

- Durable streak counters.
- Critical fields: `user_id`, `current_streak`, `longest_streak`, `last_session_date`.
- Written by shared `updateStreak`; read by stats and Telegram status.

### `public.telegram_connections`

- Links Telegram ID to Supabase user ID.
- Critical fields: `user_id`, `telegram_id`, `connected_at`.
- Written by `/api/telegram/connect`; read by bot user resolution.

### `public.challenges`

- Durable Telegram friend/group challenge records.
- Critical fields: `id`, `topic`, `creator_telegram_id`, `creator_score`, `status`, `created_at`.
- Service-role managed.

### `public.telegram_challenge_state`

- Durable pending friend/group challenge context by Telegram user.
- Critical fields: `telegram_id`, `challenge_type`, `challenge_id`, `group_id`, `group_message_id`, `participant_username`, `creator_username`.
- Service-role managed.

## Core Modules

- `src/lib/core/scoring.ts`: Flow Score source of truth.
- `src/lib/core/session.ts`: shared session/streak writes; falls back when newer columns are absent.
- `src/lib/core/queries.ts`: shared stats reads/aggregation; reads `pause_count` with `pauses` fallback.
- `src/lib/core/groq.ts`: Groq transcription, verbose transcription, filler analysis, AI feedback.
- `src/lib/core/modes.ts`: mode normalization/labels.
- `src/lib/core/prompts.ts`: built-in Telegram prompts.
- `src/lib/core/user.ts`: Telegram ID to Supabase user resolution.

## Environment Variables

### Browser

- `VITE_SUPABASE_URL`: required by `src/lib/supabase.ts`.
- `VITE_SUPABASE_ANON_KEY`: required by `src/lib/supabase.ts`.
- `VITE_GROQ_API_KEY`: browser-exposed Groq key when browser-side Groq calls run.

### Server / Vercel

- `SUPABASE_URL`: server Supabase URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key.
- `TELEGRAM_BOT_TOKEN`: Telegraf bot and Telegram file API token.
- `GROQ_API_KEY`: server-only Groq key.

### Build/Test

- `import.meta.env.DEV`: debug logging gates.
- `import.meta.env.VITEST` / `MODE === "test"`: suppresses scoring debug output in tests.

## Constraints / Risks

- Do not expose service-role keys client-side.
- `VITE_*` keys are bundled into browser code.
- `sessions` and `streaks` RLS policies are not defined in repo migrations; verify production policies before changing data access.
- Telegram stats prefer `sessions.source = 'telegram'`; if absent, fallback can include indistinguishable connected-user free sessions.
- AI feedback transcript memory is process-local and not durable.
- `hasSpeechEvidence` exists in `FlowScoreOptions` but is not currently used by `calculateFlowScore`.
- `api/telegram/connect.ts` and auth redirect URLs contain hardcoded production URLs in code.
