# No Pause System Architecture

This is the living architecture document for No Pause. Keep it updated after every task that changes architecture, scoring, data flow, API behavior, database shape, environment variables, or deployment assumptions.

Last audited: 2026-04-27.

## Architecture

No Pause has five main surfaces:

```text
User browser / PWA
  |
  | Vite React app
  | - Supabase Auth via VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
  | - Web Audio API + SpeechRecognition for live practice
  | - Optional Groq transcription/feedback from browser through src/lib/practiceApi.ts
  |
  v
Supabase
  |-- auth.users: Google auth identities and user metadata
  |-- public.sessions: practice session metrics/transcripts/feedback
  |-- public.streaks: current/longest streak by user
  |-- public.telegram_connections: Telegram ID to Supabase user ID
  |-- public.challenges: Telegram challenge records
  |-- public.telegram_challenge_state: durable pending Telegram challenge state

Telegram user
  |
  | Telegram Bot API webhook POST /api/telegram/webhook
  v
Vercel Serverless API
  |-- api/telegram/webhook.ts creates Telegraf bot and handles updates
  |-- src/lib/telegramBot.ts handles commands, callbacks, voice analysis
  |
  | voice download
  v
Telegram file API
  |
  | audio bytes
  v
Groq
  |-- Whisper large v3 turbo transcription
  |-- verbose_json word timestamps for Telegram pause detection
  |-- chat model for filler hesitation counts and feedback
  |
  v
Supabase service-role writes
```

### Web Surface

- Entry: `src/main.tsx` renders `App` with providers.
- Router: `src/App.tsx`.
- Authenticated app routes:
  - `/`: dashboard/mode picker.
  - `/practice`: practice page, mode driven by query string.
  - `/practice/free-speaking`: free speaking route.
  - `/prompts`: prompt browser.
  - `/stats`: stats dashboard.
  - `/sessions`: authenticated wrapper around `StatsPage`, targeted at Telegram users.
  - `/blog`, `/blog/:slug`: SEO blog content.
- Auth routes:
  - `/auth`, `/login`: Google sign-in.
  - `/auth/sign-up`: sign-up page.
  - `/auth/callback`: OAuth callback.
  - `/connect?tg=<telegram_id>`: links a Telegram user after Google sign-in.
- Web persistence:
  - Browser Supabase client in `src/lib/supabase.ts`.
  - `src/lib/practiceApi.ts` writes sessions and streaks through shared core helpers.
  - Stats are loaded from Supabase by `getPracticeStats`.

### Telegram Surface

- Webhook route: `api/telegram/webhook.ts`.
- Bot implementation: `src/lib/telegramBot.ts`.
- Telegram connects to web through `/connect?tg=<telegram_id>`.
- Voice messages are downloaded from Telegram, transcribed by Groq, analyzed, scored, stored in Supabase, and returned as Telegram HTML messages.

### API Surface

- API routes are Vercel serverless handlers under `/api`.
- `/api/telegram/webhook` receives Telegram update POSTs.
- `/api/telegram/connect` links a logged-in Supabase user to a Telegram ID and sends a welcome Telegram message.

### Supabase Surface

- Browser access uses anonymous Supabase key and user auth.
- Server/API/bot access uses service-role Supabase client.
- Supabase stores auth users, sessions, streaks, Telegram connections, and challenge records.

### Groq Surface

- Transcription endpoint: `https://api.groq.com/openai/v1/audio/transcriptions`.
- Chat endpoint: `https://api.groq.com/openai/v1/chat/completions`.
- Whisper model: `whisper-large-v3-turbo`.
- Chat model: `llama-3.3-70b-versatile`.
- Browser transcription/feedback may use `VITE_GROQ_API_KEY`; server/bot uses `GROQ_API_KEY`.

## Scoring System

Source of truth: `src/lib/core/scoring.ts`. `src/features/practice/lib/scoringConstants.ts` and `src/features/practice/lib/analyzer/scoring.ts` re-export it.

### Constants

- `SCORING_VERSION`: `1.0` in `src/lib/core/constants.ts`.
- `TOPIC_MIN_TOTAL_SECONDS`: `120`.
- `LEMON_MIN_TOTAL_SECONDS`: `60`.
- `THRESHOLD_BEGINNER`: `1.8` seconds.
- `THRESHOLD_INTERMEDIATE`: `1.2` seconds.
- `THRESHOLD_ADVANCED`: `0.8` seconds.
- `DEFAULT_PAUSE_THRESHOLD_LEVEL`: `beginner`.
- `DEFAULT_PAUSE_THRESHOLD_MS`: beginner threshold in milliseconds.
- `GRACE_RATE`: `1.0`.
- `PENALTY_PER_HPM`: `10`.
- `MIN_RATIO_FOR_UNCAPPED`: `0.65`.
- `CAP_AT_MIN_RATIO`: `70`.
- Internal minimum speaking ratio for score: `0.5`.
- Telegram uses `DEFAULT_PAUSE_THRESHOLD_MS` from core scoring for pause detection.

### Completion Rules

Input to `calculateFlowScore(rawHesitationCount, options)`:

- `rawHesitationCount`: historically named hesitation count, but function treats it as the penalized interruption count. Current Telegram passes `pauseCount`.
- `speakingTimeSec`.
- `totalSessionTimeSec`.
- `mode`: `free`, `lemon`, or `topic`.

Rules:

- If `totalSessionTimeSec <= 0`, score is `0`, incomplete, reason `duration`.
- `free`: complete only when total session is at least `60` seconds and speaking ratio is at least `0.5`.
- `lemon`: complete only when total session is at least `60` seconds and speaking ratio is at least `0.5`.
- `topic`: complete only when total session is at least `120` seconds and speaking ratio is at least `0.5`.
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

### Score Labels

- `96-100`: `Perfect Flow`.
- `81-95`: `Great Flow`.
- `61-80`: `Good Flow`.
- `41-60`: `Getting There`.
- `0-40`: `Needs Practice`.

### Web Pause Detection

Files:

- `src/features/practice/lib/speechAnalyzer.ts`.
- `src/features/practice/lib/analyzer/micStateMachine.ts`.
- `src/features/practice/pages/useRecordingController.ts`.

How it works:

1. Web obtains a microphone stream through `micService`.
2. `AudioAnalyzer` samples audio with an `AnalyserNode`.
3. RMS is smoothed over a `SMOOTHING_WINDOW` of `10`.
4. Calibration runs for `1500ms`; speech threshold is `max(0.01, noiseFloor * 3)` capped at `0.06`.
5. Speech-off threshold is `speechOnThreshold * 0.7`.
6. `applyMicStateFrame` tracks transitions from speaking to silence and silence back to speaking.
7. A pause is counted only after speech has happened at least once and silence duration is both:
   - at least `MICRO_PAUSE_IGNORE = 300ms`, and
   - at least the selected `hesitationMinDuration`.
8. The count is in units: `floor(silenceDuration / hesitationMinDuration)`.
9. Final trailing silence is handled by `finalizeMicState`, with `END_BUFFER_MS = 1000`.
10. Filtered pause units become `results.hesitationCount`, which the web stores as `sessions.pauses` and, through `insertSession`, as `sessions.pause_count` when that column exists. The same count is used for Flow Score.

Web threshold selection:

- User difficulty comes from Supabase user metadata in `AuthContext`.
- `beginner`: `1.8s`.
- `intermediate`: `1.2s`.
- `advanced`: `0.8s`.
- The analyzer receives `hesitationMinDurationMs = round(PAUSE_THRESHOLD_BY_LEVEL[difficultyLevel] * 1000)`.

### Telegram Pause Detection

Files:

- `src/lib/core/groq.ts`.
- `src/lib/telegramBot.ts`.

How it works:

1. Telegram voice audio is downloaded from Telegram file API.
2. `transcribeAudioVerbose` calls Groq Whisper with:
   - `response_format = verbose_json`.
   - `timestamp_granularities[] = word`.
3. The bot sorts valid words by timestamp.
4. It computes each inter-word gap: `word.start - previousWord.end`.
5. If the gap is at least `1.8s`, it counts pause units as `floor(gap / 1.8s)`.
6. Each pause log item stores:
   - `timestamp`: next word start in milliseconds.
   - `duration`: gap duration in milliseconds.
   - `units`: penalty units.
7. Telegram Flow Score is calculated with `pauseCount` only.

Current Telegram speaking time:

- Uses the sum of transcribed word durations when word timestamps exist.
- Falls back to Telegram voice duration if no usable word timings exist.
- Total session time uses Telegram voice duration, minimum `1` second.

### Hesitation Detection

There are two meanings in the current codebase:

- Web `hesitationCount`: actually pause units from audio silence detection. This affects score.
- Telegram `hesitationCount`: LLM-counted filler hesitations from transcript text only. This is display-only and stored as `filler_count`; it does not affect score.

Web filler words:

- `speechAnalyzer.ts` uses browser `SpeechRecognition` when available.
- It highlights/counts filler phrases from `FILLER_WORDS`: `um`, `uh`, `like`, `you know`, `basically`, `literally`, `actually`, `right`, `so`, `well`.
- This `fillerWordCount` does not affect Flow Score.

Telegram filler words:

- `analyzeGroqSpeech` asks the LLM to count only spoken fillers like `um`, `uh`, `er`, and `ah`.
- It explicitly says not to infer silent pauses.
- The count is displayed as `Hesitations`.
- The count is stored as `filler_count`.

## Telegram Bot

Implementation: `src/lib/telegramBot.ts`.

Bot username constant: `NoPauseAI_bot`.

### Commands and Text Buttons

- `/start`
  - If payload starts with `challenge_`, loads friend challenge by ID and sets pending friend challenge memory.
  - Otherwise sends the account connection welcome message with a `Connect Account` button.
- `/status`
  - Private chats only.
  - Loads only Telegram-originated free-speaking activity for the connected user.
  - Sends current Telegram streak, total Telegram sessions, average Flow Score, and best Flow Score.
  - In groups, replies that stats are private.
- `/prompt`
  - Sends a random speaking prompt.
  - Avoids repeating the last prompt for that Telegram user when possible.
- `/nopause`
  - Private chat: invites user to send a voice note.
  - Group chat: creates a group challenge prompt message with `Speak` and `Change Topic` buttons.
- `⚔️ Challenge`
  - Private keyboard button.
  - Creates a friend challenge record in Supabase and sends one Telegram share URL button.
- `📈 My Stats`
  - Same behavior as `/status`.
- `💡 Get Prompt`
  - Same behavior as `/prompt`.
- `ℹ️ About`
  - Sends bot/product explanation.
- `voice`
  - Triggers the voice analysis flow.

### Inline Buttons and Callback Actions

- `🔑 Connect Account`
  - URL button to `https://nopause.org/connect?tg=<telegram_id>`.
- `📊 View on NoPause`
  - URL button to `https://nopause.org`.
- `📊 Open NoPause`
  - URL button to `https://nopause.org`.
- `🔄 Change Prompt`
  - Action: `change_prompt`.
  - Replaces the current prompt text.
- `🗣 Speak`
  - Action prefix: `sg:<challengeId>`.
  - DMs the group challenge topic to the user and records pending group challenge state.
- `🔄 Change Topic`
  - Action prefix: `cg:<challengeId>`.
  - Changes the group challenge topic in-place.
- `⚔️ Share Challenge`
  - URL button to Telegram share URL with the friend challenge deep link.
- `📤 Share to Group`
  - Action prefix: `shg:<sessionId>:<chatId>`.
  - Posts a recent group challenge result back to the originating group.
- `👥 Share to Friends`
  - URL button to Telegram share URL with a result text.
- `📤 Send Result to @username`
  - Action prefix: `scr:<challengeId>:<creatorTelegramId>`.
  - Sends friend challenge result to the creator.
- `🎯 Try Challenge`
  - Action prefix: `tg:<challengeId>`.
  - Sets pending friend challenge state for the creator to respond.
- `🔄 Try Again`
  - Action: `try_again:free_speaking`.
  - Re-prompts group or private users to send another voice note.
- `🤖 AI Feedback`
  - Action prefix: `ai_feedback:<sessionId>`.
  - Uses in-memory transcript to generate feedback.

### Voice Message Flow

1. `bot.on("voice")` calls `handleVoiceMessage`.
2. Bot checks Telegram ID.
3. Bot resolves Supabase user via `telegram_connections`.
4. If no connected user, bot sends connect prompt.
5. Bot replies with "Voice note received".
6. Bot downloads the voice file:
   - Calls Telegram `getFile`.
   - Fetches `https://api.telegram.org/file/bot<TOKEN>/<file_path>`.
7. Bot sends audio to Groq Whisper verbose transcription.
8. If transcript is empty, under 3 words, or has high Whisper `no_speech_prob`, bot replies: `Couldn't hear anything clearly. Please speak louder and try again 🎤`.
9. Bot computes:
   - `pauseCount` from timestamp gaps.
   - `hesitationCount` from Groq chat filler count.
   - `speakingTimeSec` from word durations, fallback Telegram duration.
   - `totalSessionTimeSec` from Telegram voice duration.
10. Bot calculates Flow Score with `pauseCount`.
11. Bot inserts a session in Supabase:
   - `pauses = pauseCount`.
   - `pause_count = pauseCount` when column exists.
   - `filler_count = hesitationCount` when column exists.
   - `hesitation_log = pauseLog`.
12. Bot updates streak.
13. Bot stores transcript in memory keyed by Telegram ID/session ID for AI feedback.
14. Bot replies with:
   - Flow Score.
   - Pauses.
   - Hesitations.
   - Speaking time.
   - Transcript for private challenge/free-speaking cases.

### Group Challenge Flow

1. In a group, user runs `/nopause`.
2. Bot creates a group challenge record in Supabase and posts a random topic with `Speak` and `Change Topic`.
3. The challenge ID is carried in callback data.
4. `Change Topic` updates the challenge topic in Supabase and edits the group message.
5. `Speak` tries to DM the user with the topic.
6. Pending group challenge is stored in `telegram_challenge_state` by Telegram user ID.
7. User sends voice note in private chat.
8. Bot analyzes voice, saves session, and replies privately with a share-to-group action.
9. `Share to Group` posts the result into the original group.

### Friend Challenge Flow

1. User presses `⚔️ Challenge`.
2. Bot creates a random topic and challenge ID.
3. Bot inserts into `public.challenges`.
4. Bot sends the topic and one `⚔️ Share Challenge` URL button with deep link `/start challenge_<id>`.
6. Friend opens deep link.
7. Bot loads challenge from Supabase.
8. Bot sets pending friend challenge state in `telegram_challenge_state` by friend Telegram ID.
9. Friend sends voice note.
10. Bot analyzes and saves session.
11. If the creator is responding to their own challenge, bot updates `creator_score`.
12. Otherwise bot offers `Send Result to @creator`.
13. `Send Result` sends the creator a challenge update and can set pending challenge state for the creator to respond.

### Memory vs Supabase State

In-memory maps:

- `sessionTranscriptsByTelegramId`: temporary transcripts for AI feedback buttons.
- `lastPromptByTelegramId`: last prompt to avoid immediate repeats.

Supabase state:

- `telegram_connections`: durable Telegram account linking.
- `sessions`: durable voice/practice session results.
- `streaks`: durable streak counters.
- `challenges`: durable Telegram challenge record, topic, creator, and creator score.
- `telegram_challenge_state`: durable pending friend/group challenge context by Telegram user.

Important: AI feedback transcript cache and last prompt memory are still process-local and can disappear on serverless cold starts or scaling. Pending challenges are durable.

## Database Tables

The repo contains migrations for Telegram-related additions, but not a full base schema migration for `sessions` or `streaks`. Column details below combine migrations and actual code reads/writes.

### `auth.users`

Managed by Supabase Auth.

Used columns/fields:

- `id`: user UUID. Referenced by app code and `telegram_connections.user_id`.
- `email`: displayed in stats/profile.
- `user_metadata.full_name`, `name`, `avatar_url`: displayed in profile.
- `user_metadata.difficulty`, `difficultyLevel`, `pauseThresholdLevel`: used for web pause threshold.

Code:

- Read by `AuthContext`.
- Updated by `AuthContext.updateDifficultyLevel`.
- Validated by `api/telegram/connect.ts` through `supabaseServer.auth.getUser(accessToken)`.

### `public.telegram_connections`

Migration: `supabase/migrations/add_telegram_connections.sql`.

Columns:

- `id uuid primary key default gen_random_uuid()`: row ID.
- `user_id uuid references auth.users`: linked Supabase user.
- `telegram_id bigint unique not null`: Telegram user ID.
- `connected_at timestamptz default now()`: link/update time.

RLS:

- RLS enabled.
- Policy `Users can read their Telegram connection`: select when `auth.uid() = user_id`.
- Policy `Service role manages Telegram connections`: all operations when `auth.role() = 'service_role'`, with matching check.

Code:

- Written by `upsertTelegramConnection` from `/api/telegram/connect`.
- Read by `resolveTelegramUser` in bot flows.

### `public.sessions`

Base schema is not fully present in repo. Inferred from code and migrations.

Columns:

- `id`: session ID, selected after inserts and in stats. Type likely UUID.
- `user_id`: Supabase user ID. Written by session inserts and used for reads.
- `created_at`: timestamp selected for stats and recent sessions.
- `mode`: practice mode. Values include `free`, `lemon`, `topic`, `readingchallenge`; `free_speaking` is normalized to `free`.
- `duration`: total session duration in seconds.
- `speaking_time`: speaking time in seconds.
- `pauses`: legacy/interoperability pause count. Web writes pause units; Telegram now writes `pauseCount`.
- `pause_count`: explicit real pause count. Added by `supabase/migrations/add_sessions_pause_count.sql`.
- `filler_count`: LLM/browser filler count. Added by `supabase/migrations/add_telegram_session_analysis_columns.sql`.
- `hesitations_per_minute`: numeric rate. Added by `supabase/migrations/add_telegram_session_analysis_columns.sql`.
- `words`: transcript word count.
- `flow_score`: computed Flow Score.
- `completed`: whether scoring completion requirements were met.
- `hesitation_log`: JSON array of pause events `{ timestamp, duration, units, trailing? }`.
- `transcript`: transcript text.
- `analysis_feedback`: AI feedback text.
- `scoring_version`: text, added by `add_telegram_connections.sql`.

RLS:

- No `sessions` RLS policy definitions are present in this repo. The browser app uses the anon client, so production must have suitable Supabase policies outside this repo.

Code:

- Written by web `saveSession` through `insertSession`.
- Written by Telegram `insertTelegramSession` through `insertSession`.
- Updated by web `updateSession`.
- Read by `getPracticeStats`, `getSessions`, `StatsPage`, and Telegram stats.

### `public.streaks`

Base schema is not present in repo. Inferred from code.

Columns:

- `user_id`: Supabase user ID, used as conflict key in upsert.
- `current_streak`: current streak count.
- `longest_streak`: longest streak count.
- `last_session_date`: local date string for last counted session.

RLS:

- No `streaks` RLS policy definitions are present in this repo.

Code:

- Read by `getStreak`.
- Written by `updateStreak`.
- Web uses local date from browser with `toLocaleDateString('en-CA')`.
- Telegram uses `formatLocalDate(new Date())` on the server runtime date.

### `public.challenges`

Migration: `supabase/migrations/add_telegram_challenge_state.sql`.

Columns:

- `id text primary key`: generated 16-character challenge ID.
- `topic text not null`: challenge prompt.
- `creator_telegram_id bigint not null`: Telegram ID of creator.
- `creator_score integer`: creator's Flow Score if completed.
- `status text not null default 'pending'`: challenge status.
- `created_at timestamptz not null default now()`: creation time.

RLS:

- RLS enabled.
- Policy `Service role manages challenges`: all operations for service role.

Code:

- Inserted by `createFriendChallenge`.
- Inserted by `createGroupChallenge`.
- Read by `getFriendChallenge`.
- Updated by `updateChallengeTopic` and `updateFriendChallengeCreatorScore`.

### `public.telegram_challenge_state`

Migration: `supabase/migrations/add_telegram_challenge_state.sql`.

Columns:

- `telegram_id bigint primary key`: Telegram user ID with pending challenge context.
- `challenge_type text not null`: `friend` or `group`.
- `challenge_id text references public.challenges(id) on delete cascade`.
- `group_id bigint`: originating group chat ID for group challenges.
- `group_message_id bigint`: originating group message ID for group challenges.
- `participant_username text`: participant username when known.
- `creator_username text`: creator username when known.
- `created_at timestamptz not null default now()`: creation time.
- `updated_at timestamptz not null default now()`: last state update time.

RLS:

- RLS enabled.
- Policy `Service role manages telegram challenge state`: all operations for service role.

Code:

- Written by `upsertPendingChallenge`.
- Read by `getPendingChallenge`.
- Deleted by `deletePendingChallenge` after use.

## Core Library (`src/lib/core/`)

### `constants.ts`

Exports:

- `SCORING_VERSION = "1.0"`.
- `TELEGRAM_MIN_DURATION = 1`.
- `APP_URL = "https://nopause.org"`.

Purpose:

- Shared constants for scoring metadata, Telegram duration guard, and site URL.

### `groq.ts`

Exports:

- `TranscribedWord`.
- `VerboseTranscription`.
- `Base64TranscriptionInput`.
- `transcribeAudio(audio): Promise<string>`.
- `transcribeAudioVerbose(audio): Promise<VerboseTranscription>`.
- `transcribeBase64Audio(input): Promise<string>`.
- `isUsableTranscript(transcript): boolean`.
- `analyzeSpeech(transcript): Promise<{ hesitation_count: number }>` via inferred return type.
- `getAIFeedback(transcript, systemPrompt?)`.

Purpose:

- Single Groq integration module for Whisper transcription, verbose word timestamps, filler hesitation analysis, and AI feedback.
- Logs Whisper `no_speech_prob` and rejects empty, whitespace-only, or under-3-word transcripts before analysis.

### `modes.ts`

Exports:

- `PracticeMode = "free" | "lemon" | "topic"`.
- `VALID_MODES`.
- `MODE_LABELS`.
- `normalizeMode(mode)`.

Purpose:

- Normalizes and labels practice modes for stats/UI.

### `prompts.ts`

Exports:

- `getRandomPrompt(excludeLast?)`.

Purpose:

- Supplies built-in opinion prompts for Telegram challenges and prompt actions.

### `queries.ts`

Exports:

- `SessionRecord`.
- `StreakRecord`.
- `PracticeStats`.
- `getSessions(userId, limit?)`.
- `getStreak(userId)`.
- `buildPracticeStats(sessions, streak)`.

Purpose:

- Shared stats reads and aggregation.
- Reads `pause_count` when available and falls back to legacy `pauses`.

### `scoring.ts`

Exports:

- Scoring constants and pause threshold constants.
- `PauseThresholdLevel`.
- `FlowScoreOptions`.
- `FlowScoreResult`.
- `calculateFlowScore`.
- `getScoreLabel`.

Purpose:

- Source of truth for Flow Score completion and calculation.

### `session.ts`

Exports:

- `SupabaseLike`.
- `InsertSessionInput`.
- `UpdateStreakInput`.
- `formatLocalDate`.
- `addDaysToDateString`.
- `insertSession`.
- `updateStreak`.

Purpose:

- Shared write helpers for sessions and streaks.
- Writes new session analysis columns when available and falls back to legacy insert when columns are missing.

### `user.ts`

Exports:

- `resolveTelegramUser(telegramId)`.

Purpose:

- Resolves Telegram IDs to Supabase user IDs through `telegram_connections`.

## API Routes

### `POST /api/telegram/connect`

File: `api/telegram/connect.ts`.

Purpose:

- Links a Telegram ID to the currently authenticated Supabase user.

Flow:

1. Rejects non-POST with `405`.
2. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Reads JSON body with `telegram_id` and `user_id`.
4. Requires `Authorization: Bearer <supabase_access_token>`.
5. Validates token through `supabaseServer.auth.getUser`.
6. Ensures token user ID matches body user ID.
7. Upserts `telegram_connections`.
8. Sends Telegram welcome message with `TELEGRAM_BOT_TOKEN`.
9. Returns `{ success: true }`.

### `POST /api/telegram/webhook`

File: `api/telegram/webhook.ts`.

Purpose:

- Receives Telegram webhook updates and delegates to Telegraf.

Flow:

1. Rejects non-POST with `405`.
2. Creates bot with `createTelegramBot`.
3. Passes request/response to `bot.webhookCallback("/api/telegram/webhook")`.

## Environment Variables

### Browser

- `VITE_SUPABASE_URL`
  - Used by `src/lib/supabase.ts`.
  - Required at app startup.
- `VITE_SUPABASE_ANON_KEY`
  - Used by `src/lib/supabase.ts`.
  - Required at app startup.
- `VITE_GROQ_API_KEY`
  - Used by `src/lib/core/groq.ts` when Groq calls run in the browser.
  - This is browser-exposed by design because Vite env vars are bundled client-side.

### Server / Vercel API / Telegram Bot

- `SUPABASE_URL`
  - Used by `src/lib/supabaseServer.ts` and checked in `/api/telegram/connect`.
- `SUPABASE_SERVICE_ROLE_KEY`
  - Used by `src/lib/supabaseServer.ts` and checked in `/api/telegram/connect`.
  - Must remain server-only.
- `TELEGRAM_BOT_TOKEN`
  - Used by `api/telegram/connect.ts` for welcome messages.
  - Used by `src/lib/telegramBot.ts` for Telegraf and file downloads.
- `GROQ_API_KEY`
  - Used by `src/lib/core/groq.ts` server-side.
  - Must remain server-only.

### Build/Dev Flags

- `import.meta.env.DEV`
  - Used by scoring debug logs, mic service logs, and speech analyzer logs.
- `import.meta.env.VITEST` / `import.meta.env.MODE === "test"`
  - Used to suppress scoring debug output in tests.

## Known Issues / Dead Code / Risk

- `SCORING_SPEC.md` exists but is empty.
- `src/features/practice/lib/scoringConstants.ts` and `src/features/practice/lib/analyzer/scoring.ts` are barrel re-exports only; all real scoring logic is in `src/lib/core/scoring.ts`.
- The term `hesitationCount` is overloaded:
  - Web uses it for real pause units.
  - Telegram now uses it for filler hesitations only.
  - `calculateFlowScore` still accepts `rawHesitationCount`, but the penalized count should be interpreted as pause units.
- `sessions.pauses` remains a legacy column name. `insertSession` now maps the same value to `pause_count` when that column exists.
- The full base schema for `sessions` and `streaks` is not present in repo migrations.
- RLS policies for `sessions` and `streaks` are not present in repo migrations.
- Telegram stats prefer `sessions.source = 'telegram'`; if that column is missing, the bot falls back to connected-user `mode = 'free'` sessions, which can include indistinguishable web free-speaking sessions.
- AI feedback transcript cache can disappear on serverless cold starts or scaling.
- Browser Groq usage can expose `VITE_GROQ_API_KEY` to clients. Consider moving browser transcription/feedback behind server routes if abuse or key exposure matters.
- `supabase/.temp/cli-latest` is tracked in the repo even though it is generated Supabase CLI temp metadata.
- `api/telegram/connect.ts` hardcodes `https://nopause.org` separately from `APP_URL`.
- `AuthContext` hardcodes Google redirect to `https://www.nopause.org/auth/callback`.
- Blog copy still says the penalty is 15 points in `src/features/blog/data/how-is-flow-score-calculated.ts`; the actual constant is now `10`.
- `hasSpeechEvidence` exists in `FlowScoreOptions` and is passed in several places, but `calculateFlowScore` does not currently use it.
- `ReadingChallengePanel` saves `pauses` from web analyzer and likely still follows legacy naming.
