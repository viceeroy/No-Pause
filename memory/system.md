# NoPause Project Memory

Single source of truth for AI agents picking up this project. Update this file whenever architecture, data flow, scoring, schema, env, or deployment assumptions change.

> Refactoring history lives in `memory/CHANGELOG.md` (append-only).

---

## What the App Does

NoPause is a speech-fluency trainer. Users record themselves speaking, the app measures pauses and hesitations in real time using browser audio analysis, then shows a **Flow Score** with a transcript and optional AI coaching feedback. A Telegram bot accepts voice notes and scores them through the same pipeline.

Live at **https://nopause.org**.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui (Radix) |
| Auth + Database | Supabase (auth, DB, RPC) |
| STT | Groq Whisper (`whisper-large-v3-turbo`) — server-side only |
| AI feedback | Groq LLaMA — server-side only |
| Telegram bot | Telegraf via Vercel serverless webhook |
| Deployment | Vercel (project root at repo root, not at `No-Pause/`) |
| Error tracking | Sentry (`src/instrument.ts`, loaded first in `main.tsx`) |
| Analytics | Vercel Analytics + Speed Insights |
| PWA | `sw.js`, cache name `nopause-shell-v2` |

The deployable app lives under `No-Pause/`. The Vercel project is rooted at the repository root (one level up), so **`npx vercel deploy --prod --yes` must be run from the repo root**, never from `No-Pause/`.

---

## Source Layout (under `No-Pause/src/`)

```
main.tsx                    Entry; wraps app in AuthProvider > PWAInstallProvider > ServiceWorkerUpdateProvider
App.tsx                     Routing, SEO, auth gating, Vercel analytics
instrument.ts               Sentry init (imported first in main.tsx)

pages/
  PracticePage.tsx          Speaking Mode screen; maps optional prompt_text
  PromptsPage.tsx           Prompt picker
  HelpPage.tsx              Public /help page; collapsible article cards
  ConnectTelegram.tsx       Telegram account-linking UI
  Sessions.tsx              Auth-gated stats view for Telegram links

features/
  practice/
    pages/
      usePracticeState.ts       Practice state hook
      useRecordingController.ts Coordinates recording/scoring/session/transcription/feedback
      RecordingPanel.tsx        Recording UI
      ResultPanel.tsx           Results UI (Flow Score, pauses, speaking time, transcript, feedback)
      SetupCountdownPanel.tsx   Pre-recording countdown overlay
      ResultSkeletonPanel.tsx   Loading skeleton shown during result processing
      types.ts                  PracticeState, SessionResult, TopicPrompt, PracticeStateStore
      time.ts                   toMMSS, formatTime, formatMMSS
    hooks/
      useRecording.ts           Recording lifecycle and mic/audio-analyzer orchestration
      useScoring.ts             Builds SessionResult from AnalyzerResults via core scoring
      useSession.ts             Session persistence, transcription requests, feedback requests
    lib/
      speechAnalyzer.ts         Top-level practice orchestrator (composes below)
      audioCapture.ts           MediaRecorder/Web Audio, analyser samples, audio chunks, diagnostics
      speechSession.ts          Speech/silence state, pause-unit tracking, scoring preview
      transcription.ts          Browser SpeechRecognition + Android/server fallback coordination
      speechTypes.ts            Shared AnalyzerResults and AudioDataPayload types
      audioRecording.ts         createAudioAnalyzer
      micService.ts             MicInitOptions, micService
      analyzer/
        micStateMachine.ts      Pure state machine: applyMicStateFrame, finalizeMicState
        diagnostics.ts          Diagnostics snapshot builder
  auth/
    pages/                      AuthPage, SignUpPage, AuthCallbackPage
  stats/
    pages/
      DashboardPage.tsx         Authenticated homepage (route /)
      StatsPage.tsx             Stats/session history (route /stats and /sessions)

lib/
  core/
    scoring.ts                  Flow Score source of truth (calculateFlowScore, getScoreLabel)
    silence.ts                  Shared silence + speaking time from word timestamps (analyzeSilenceFromTimestamps)
    constants.ts                DEFAULT_PAUSE_THRESHOLD, SCORING_VERSION, thresholds, labels
    session.ts                  insertSession, updateStreak, missing-column fallback helpers
    queries.ts                  Session/streak reads, stats aggregation, buildPracticeStats
    modes.ts                    normalizeMode (always returns "speaking"), PracticeMode
    prompts.ts                  opinionPrompts, getRandomPrompt (shared by web and Telegram)
    user.ts                     resolveTelegramUser (Telegram ID → Supabase user)
    utils.ts                    getWordCount, escapeTelegramHtml
    time.ts                     formatDuration
  telegram/
    router.ts                   Telegraf command/action routing, stats, prompt messages
    voiceHandler.ts             Voice download, transcription, pause analysis, persistence, replies
    challenges.ts               Friend/group challenge CRUD, leaderboard, expiry, callbacks
    constants.ts                Bot constants, keyboards, message builders (MESSAGES)
  practiceApi.ts                Browser-facing API facade (sessions, streaks, stats, transcription, feedback)
  telegramAuth.ts               upsertTelegramConnection
  telegramBot.ts                Re-export of createTelegramBot

services/
  supabase.ts                   Browser Supabase anon client
  supabaseServer.ts             Server Supabase service-role client (server-only)
  groq.ts                       Groq Whisper transcription + chat completions (server-only)
  aiFeedback.ts                 analyzePracticeSpeech — requires topic; new FEEDBACK_SYSTEM_PROMPT evaluates 4 topic-relative criteria (relevance, development, details, logic), band 1–9; user message includes TOPIC/TRANSCRIPT/STATS; topic-gated at 3 layers: ResultPanel (UI), useSession (requestFeedback early-return + requestTranscription shouldAnalyze gate), api/feedback.ts (400 if topic missing) (server-only)
  apiQuota.ts                   API quota enforcement via Supabase RPC

providers/
  AuthContext.tsx               Supabase session, Google sign-in, DifficultyLevel
  PWAInstallContext.tsx         PWA install prompt
  ServiceWorkerUpdateContext.tsx SW update tracking

shared/
  components/ui/               shadcn/ui primitives (dialog, toast, tooltip, sonner)
  components/Confetti.tsx      Confetti effect on results
  hooks/                       use-toast, useInstallPlatform
  lib/utils.ts                 cn (Tailwind merge), arrayBufferToBase64
  seo/routeSeo.ts              RouteSeoConfig, getRouteSeoConfig, seoDefaults
```

---

## Exposed Routes

| Route | Component | Auth |
|-------|-----------|------|
| `/` | DashboardPage | Required |
| `/practice` | PracticePage | Required |
| `/prompts` | PromptsPage | Required |
| `/stats` | StatsPage | Required |
| `/history` | → redirects to `/stats` | — |
| `/sessions` | Sessions (StatsPage) | Required |
| `/help` | HelpPage | Public |
| `/connect?tg=<id>` | ConnectTelegram | Required |
| `/auth/*`, `/login/*`, `/auth/sign-up/*`, `/auth/callback` | Auth pages | Public |
| `*` | NotFound | — |

## API Endpoints

| Route | File | Notes |
|-------|------|-------|
| `POST /api/transcription` | `api/transcription.ts` | `multipart/form-data` audio; requires Supabase bearer or internal token; calls Groq Whisper; returns `{ text, words }` |
| `POST /api/feedback` | `api/feedback.ts` | JSON transcript + scoring; requires Supabase bearer; calls Groq |
| `POST /api/telegram/webhook` | `api/telegram/webhook.ts` | Receives Telegram updates; delegates to Telegraf; `maxDuration = 30s` |
| `POST /api/telegram/connect` | `api/telegram/connect.ts` | Requires Supabase bearer; upserts `telegram_connections`; sends welcome message |

---

## Data Flow

### Web Speaking Mode

1. Authenticated user opens `/practice` (optionally with a prompt from `/prompts`).
2. `useRecordingController` initializes microphone services and `SpeechAnalyzer`.
3. `AudioCapture` samples Web Audio RMS, records chunks, and reports diagnostics.
4. `SpeechSession` still tracks speech/silence via `micStateMachine`, but browser `SpeechRecognition` is disabled in `transcription.ts` (commented out, not deleted).
5. After recording stops, the audio blob is always sent through `practiceApi.transcribeAudio()` → `/api/transcription` → Groq Whisper, which returns the transcript plus word-level timestamps (`{ word, start, end }`).
6. `useScoring.buildSessionResult` calls `analyzeSilenceFromTimestamps` (shared helper in `src/lib/core/silence.ts`) to compute `totalSilenceSec` and `speakingTimeSec` from word timestamp gaps (≥ 1.5s threshold), then runs `calculateFlowScore` and assembles `SessionResult`. If fewer than 3 word timestamps are available, scoring fails with an error ("Couldn't score this session — please try again"). No RMS fallback — Groq timestamps are the sole scoring input. Note that Web and Telegram differ in their transcript gating (web gates on timestamp count ≥ 3; Telegram gates on transcript word count ≥ 3).
7. `useSession.saveSession` writes to `sessions`; `updateStreak` writes to `streaks`.
8. If the transcript is missing post-session and `audioBlob` exists, `ResultPanel` can show a manual Transcribe button that triggers `useSession.requestTranscription()` → `practiceApi.transcribeAudio()` → `/api/transcription`.
9. Optional AI feedback: `practiceApi.analyzeSpeech()` → `/api/feedback` → Groq → stored on session.
10. Stats pages read via `getPracticeStats` / `buildPracticeStats`.

### Telegram Voice / Challenge

1. Telegram posts updates to `/api/telegram/webhook`.
2. `createTelegramBot` resolves user via `telegram_connections`; unconnected users get `/connect?tg=...`.
3. `handleVoiceMessage` preflights: user lookup → pending challenge lookup → challenge validity → expiry → duplicate Telegram message guard.
4. Invalid or expired pending challenge state is deleted; bot replies without downloading audio.
5. Voice file downloaded from Telegram; transcribed via Groq Whisper.
6. Transcripts under 3 words (`getWordCount`) are rejected.
7. `analyzeTranscript` calls `analyzeSilenceFromTimestamps` (same shared helper as web) to compute `totalSilenceSec` and `speakingTimeSec`; `calculateFlowScore` scores them. If a challenge topic exists, `analyzePracticeSpeech` runs and `applyBandBonus(baseScore, band)` adds `band * 10` to produce `finalScore` (only when `baseScore > 0`).
8. `insertTelegramSession` stores `finalScore` (band-adjusted when applicable) as `flow_score`; `updateStreak` follows.
9. AI feedback runs only when a challenge topic exists (`challenge.topic`); regular (no-challenge) sessions skip AI feedback and append a note prompting the user to pick a topic.
10. Bot replies with Flow Score, silence, speaking time, transcript, and optional AI feedback.
11. `replyWithAiFeedback` (on-demand "AI Feedback" button callback): sessions table has no topic column → always replies with the no-topic note, never calls Groq. Groq call block removed entirely.

---

## Flow Score Formula

**Source of truth:** `src/lib/core/scoring.ts` — `calculateFlowScore(totalSilenceSeconds, options)`.

Silence detection: `src/lib/core/silence.ts` — `analyzeSilenceFromTimestamps(words, totalSessionTimeSec)`. Returns `totalSilenceSec` (rounded once at end), `speakingTimeSec` (Σ word durations), `gapCount`, and `gaps[]`. Used identically by web (`useScoring.ts`) and Telegram (`voiceHandler.ts`).

```
speakingTime = floor(speakingTimeSec)   ← floored before the 5s check
speakingTime < 5  →  score = 0, isCompleted = false

otherwise:
  completedSpeakingMinutes = floor(speakingTime / 60)
  score = max(0, speakingTime + completedSpeakingMinutes * 40 - round(totalSilenceSeconds))
  isCompleted = true
```

The sub-5s case returns score 0 inside calculateFlowScore, but the session is still scored and persisted normally — the 5s floor does not skip saving. The band bonus is gated separately by isScorableSession(baseScore > 0), not by the 5s floor.

**Telegram challenge band bonus (current, post-2026-05-24):** When a Telegram voice is submitted under a challenge with a topic, `analyzePracticeSpeech` returns a `band` (1–9). `applyBandBonus(baseScore, band)` then adds `band * 10` to the score — gated by `isScorableSession(baseScore)` (`baseScore > 0`), not by the 5s speaking floor directly. The adjusted score is what `insertTelegramSession` stores. Regular (no-topic) sessions skip this step entirely.

A gap between words counts as silence if ≥ `DEFAULT_PAUSE_THRESHOLD` (1.5s). Below 1.5s is ignored (normal speech rhythm). When a gap qualifies, its full duration counts. Leading silence (before first word) and trailing silence (after last word to end of session, clamped ≥ 0) are each included only when they exceed the 1.5s threshold — same gate as inter-word gaps. The 3s countdown is the only grace. Total silence = sum of all qualifying gap durations, rounded once at end to nearest second. Penalty = −1 per second of total silence.

Minimum 3 word timestamps required for web scoring. Fewer → scoring error surfaced to user. Telegram uses `isUsableTranscript` (exported from `src/services/aiFeedback.ts`) to gate on word count ≥ 3 in the transcript text, not on timestamp count.

**Labels:** `< 50` Needs Practice · `50–99` Getting There · `100–199` Good Flow · `200–299` Great Flow · `≥ 300` Perfect Flow.

**Rules:**
- Only `src/lib/core/scoring.ts` defines the formula. Never fork constants or formulas elsewhere.
- `DEFAULT_PAUSE_THRESHOLD = 1.5s` lives only in `src/lib/core/constants.ts`. No hardcoded literals.
- Both web and Telegram derive `speakingTimeSec` and `totalSilenceSec` from Groq word timestamps via the same shared helper. No RMS-based scoring fallback.

---

## Practice State Machine

**States:** `setup → countdown → recording → finishing → done`

The `finishing` state is set immediately when the user taps Finish, showing `ResultSkeletonPanel` until the async stop/transcription/scoring/save pipeline completes. Result display already has async latency: results appear only after `saveFinishedSession` completes the session save and streak update. There is no instant post-stop result today.

### Audio Analysis Internals

| Parameter | Value |
|-----------|-------|
| Silence threshold | `DEFAULT_PAUSE_THRESHOLD = 1.5s` (in `constants.ts`) |
| Micro-pause filter | 300 ms (RMS pipeline only, not used for scoring) |
| Calibration window | 1.5 s |

- `SpeechSession` drives the per-frame RMS analysis via `micStateMachine.applyMicStateFrame`. The RMS pipeline still runs during recording but its output does **not** feed scoring — scoring is entirely timestamp-derived via `analyzeSilenceFromTimestamps`.
- Start/end buffers removed — silence is measured across the entire session with leading and trailing silence both included (when they exceed the 1.5s threshold).
- `TranscriptionController` goes straight to Groq server-side transcription for all platforms; browser SpeechRecognition is disabled (commented out in code for rollback safety).
- `RecordingPanel` does not show live pause count or preview score during recording. The RMS pipeline computes `hesitationCount` live via `SpeechSession`, but `onHesitation` is wired as an empty callback in `useRecording.ts`, so those events are computed but never surfaced in UI.
- `AudioCapture.stop()` flips `isRunning` false immediately; repeated taps during the pending stop phase silently no-op.

---

## Database Tables

| Table | Key fields |
|-------|-----------|
| `auth.users` | `id`, `email`, name/avatar metadata |
| `public.sessions` | `id`, `user_id`, `created_at`, `mode`, `duration`, `speaking_time`, `total_silence_time`, `pauses`, `pause_count`, `hesitations_per_minute`, `words`, `flow_score`, `completed`, `hesitation_log`, `transcript`, `analysis_feedback`, `scoring_version`, `source` |
| `public.streaks` | `user_id`, `current_streak`, `longest_streak`, `last_session_date` |
| `public.telegram_connections` | `telegram_id`, `user_id`, `connected_at` |
| `public.challenges` | `id`, `topic`, `creator_telegram_id`, `status`, `created_at` |
| `public.telegram_challenge_state` | `telegram_id`, `challenge_id`, `challenge_type`, `group_id`, `group_message_id`, `participant_username`, `creator_username`, `created_at`, `updated_at` |
| `public.telegram_challenge_attempts` | `id`, `challenge_id`, `telegram_id`, `session_id`, `created_at` |

Notes:
- `insertSession` / query helpers include fallbacks for deployments missing newer columns like `pause_count` or `total_silence_time`.
- Telegram stats filter by `sessions.source = 'telegram'`; older rows without source may not appear.
- Base `sessions`/`streaks` schema and RLS policies are not fully represented in repo migrations.
- `scoring_version` column exists but has no defined versioning scheme yet (S3 pending); code currently assigns only "1.0". See Notable Quirks → Scoring cohorts.

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Supabase anon key |
| `VITE_SENTRY_DSN` | Browser | Sentry DSN (or hardcoded in `instrument.ts`) |
| `GROQ_API_KEY` | Server only | Groq transcription + AI feedback |
| `SUPABASE_URL` | Server only | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service-role key |
| `TELEGRAM_BOT_TOKEN` | Server only | Telegram bot token |
| `TELEGRAM_WEBHOOK_SECRET` | Server only | Telegram webhook secret header |
| `NOPAUSE_INTERNAL_API_TOKEN` | Server only | Internal Telegram-to-API auth |
| `NOPAUSE_API_URL` / `NOPAUSE_INTERNAL_API_URL` / `VERCEL_URL` | Server only | Routing |

**Never add `VITE_GROQ_API_KEY`** — provider keys are server-only.

---

## Key Components

- **`calculateFlowScore`** — `src/lib/core/scoring.ts` — single authoritative scoring function. First arg is `totalSilenceSeconds`.
- **`applyBandBonus(baseScore, band)`** — `src/lib/core/scoring.ts` — adds `band * 10` to baseScore when `isScorableSession(baseScore)` is true. Used by Telegram voice handler for challenge sessions with a topic.
- **`isScorableSession(flowScore)`** — `src/lib/core/scoring.ts` — returns `flowScore > 0`. Gates `applyBandBonus` and other bonus logic.
- **`isUsableTranscript(transcript)`** — `src/services/aiFeedback.ts` — returns `getWordCount(transcript) >= 3`. Telegram transcript gate.
- **`analyzeSilenceFromTimestamps`** — `src/lib/core/silence.ts` — shared silence + speaking time computation from word timestamps. Used by both web and Telegram.
- **`insertSession` / `updateStreak`** — `src/lib/core/session.ts` — shared persistence with missing-column fallbacks.
- **`buildPracticeStats`** — `src/lib/core/queries.ts` — aggregates dashboard/stat values from raw session rows.
- **`SpeechAnalyzer`** — `src/features/practice/lib/speechAnalyzer.ts` — top-level browser practice orchestrator.
- **`useRecordingController`** — `src/features/practice/pages/useRecordingController.ts` — coordinates all practice hooks.
- **`handleVoiceMessage`** — `src/lib/telegram/voiceHandler.ts` — Telegram voice analysis pipeline.
- **`createTelegramBot`** — `src/lib/telegram/router.ts` — Telegraf command/action registration.
- **`practiceApi`** — `src/lib/practiceApi.ts` — browser-facing facade for all data operations.
- **`getWordCount`** — `src/lib/core/utils.ts` — canonical word count helper used everywhere a transcript word threshold is needed.
- **`parseTranscribedWords`** — `src/lib/core/utils.ts` — canonical word timestamp parser, used by `practiceApi.ts`, `transcription.ts`, and `useScoring.ts`.
- **`TranscribedWord`** — `src/lib/core/utils.ts` — canonical word timestamp type.
- **`arrayBufferToBase64`** — `src/shared/lib/utils.ts` — canonical audio buffer encoder used by session and transcription paths.

---

## Notable Quirks

- **`normalizeMode()` always returns `"speaking"`** — `src/lib/core/modes.ts`. Only one mode exists; the structure is a placeholder for potential future modes.
- **`window.__nopauseExportLogs`** — debug hook in `ResultPanel.tsx`; visible only when `localStorage.getItem('debugLogs') === 'true'`.
- **Browser SpeechRecognition disabled** — Browser `SpeechRecognition` is commented out in `transcription.ts` (not deleted) for easy rollback. Android no longer needs special transcription handling because browser SpeechRecognition is disabled for all platforms. Do not re-enable browser SpeechRecognition as primary without removing the Groq-primary path first.
- **RMS pipeline still running** — `micStateMachine`, `speechSession`, and `audioCapture` still run during recording, but RMS-derived data is no longer used for scoring at all. Scoring is entirely timestamp-derived via `analyzeSilenceFromTimestamps`. The RMS pipeline can be removed in a future cleanup.
- **Legacy column fallback** — `practiceApi.ts` and `insertSession` retry with a smaller column set if `total_silence_time` or `analysis_feedback` columns are missing (schema migration safety net).
- **Vercel root** — The Vercel project root is the repo root, not `No-Pause/`. Running `vercel deploy` from `No-Pause/` causes a doubled `No-Pause/No-Pause` path error.
- **`APP_URL`, `SITE_URL`, and Google redirect URLs** are hardcoded and require code changes for non-production domains.
- **`src/lib/core/prompts.ts`** must not be removed; Telegram prompt/challenge behavior depends on it.
- **Service worker** (`sw.js`) uses stale-while-revalidate for core assets, network-first for navigation.
- **Filler tracking** was removed repo-wide on 2026-05-18. Any memory or code reference to `filler_count`, `fillerCount`, `generateFillerCount`, or `fillerWordCount` is historical only.
- **Telegram voice duration cap** — `MAX_TELEGRAM_VOICE_DURATION_SECONDS = 300` (5 min) enforced in `voiceHandler.ts` before download. Messages over this limit are rejected with a reply.
- **Scoring cohorts (behavioral)** — The database contains two distinct scoring cohorts based on submission date:
  - Pre-2026-05-24: `blendWithAiScore` (AI speech quality 0–100 added to flow score) ran before `insertSession` on the bot, so Telegram sessions saved before that date may have higher `flow_score` values than the formula alone would produce (web sessions are unaffected as their blend was on-demand and never saved back to the DB).
  - Post-2026-05-24: `applyBandBonus` (`band × 10`) is applied for topic challenges only (gated by `isScorableSession` / `baseScore > 0`). Sessions without a topic skip this entirely.
- **scoring_version column** — Present in `public.sessions` but not yet populated with a defined versioning scheme (pending the S3 migration). The codebase currently only assigns the literal `"1.0"` (from `SCORING_VERSION` in `src/lib/core/constants.ts`).

---

## Deploy Workflow

Run from the **repo root** (`/Users/viseeroy/Documents/GitHub/No-Pause`):

```bash
git add -A && git commit -m "Deploy" && git push
cd No-Pause && npm run build
cd .. && npx vercel deploy --prod --yes
```

When the user says `deploy`, execute this immediately without confirmation.
