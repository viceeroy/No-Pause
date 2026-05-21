# NoPause Project Memory

Single source of truth for AI agents picking up this project. Update this file whenever architecture, data flow, scoring, schema, env, or deployment assumptions change.

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
  aiFeedback.ts                 generateAiFeedback, analyzePracticeSpeech (server-only; imports getWordCount from lib/core/utils)
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
4. `SpeechSession` tracks speech/silence via `micStateMachine`, emits pause units, runs preview scoring.
5. Browser SpeechRecognition may produce an initial transcript. Android or manual fallback sends the audio blob through `practiceApi.transcribeAudio()` → `/api/transcription` → Groq Whisper.
6. `useScoring.buildSessionResult` runs `calculateFlowScore` and assembles `SessionResult`.
7. `useSession.saveSession` writes to `sessions`; `updateStreak` writes to `streaks`.
8. Optional AI feedback: `practiceApi.analyzeSpeech()` → `/api/feedback` → Groq → stored on session.
9. Stats pages read via `getPracticeStats` / `buildPracticeStats`.

### Telegram Voice / Challenge

1. Telegram posts updates to `/api/telegram/webhook`.
2. `createTelegramBot` resolves user via `telegram_connections`; unconnected users get `/connect?tg=...`.
3. `handleVoiceMessage` preflights: user lookup → pending challenge lookup → challenge validity → expiry → duplicate Telegram message guard.
4. Invalid or expired pending challenge state is deleted; bot replies without downloading audio.
5. Voice file downloaded from Telegram; transcribed via Groq Whisper.
6. Transcripts under 3 words (`getWordCount`) are rejected.
7. Pause units calculated from inter-word timestamp gaps; `calculateFlowScore` scores them.
8. `insertSession` (source `telegram`) + `updateStreak`.
9. Bot replies with Flow Score, pauses, speaking time, transcript, and optional AI feedback.

---

## Flow Score Formula

**Source of truth:** `src/lib/core/scoring.ts` — `calculateFlowScore(rawHesitationCount, options)`.

```
speakingTime < 5 seconds  →  score = 0, isCompleted = false

otherwise:
  completedSpeakingMinutes = floor(speakingTimeSec / 60)
  score = max(0, speakingTimeSec + completedSpeakingMinutes * 40 - hesitationCount * 10)
  isCompleted = true
```

**Labels:** `< 50` Needs Practice · `50–99` Getting There · `100–199` Good Flow · `200–299` Great Flow · `≥ 300` Perfect Flow.

**Rules:**
- Only `src/lib/core/scoring.ts` defines the formula. Never fork constants or formulas elsewhere.
- `DEFAULT_PAUSE_THRESHOLD = 1.2s` (fixed; no user-adjustable difficulty).
- Web: `hesitationCount` = audio-derived pause units. Telegram: `pauseCount` = word-gap pause units.
- Filler-word tracking was removed repo-wide on 2026-05-18; it plays no role in scoring, display, or persistence.

---

## Practice State Machine

**States:** `setup → countdown → recording → finishing → done`

The `finishing` state is set immediately when the user taps Finish, showing `ResultSkeletonPanel` until the async stop/transcription/scoring/save pipeline completes.

### Audio Analysis Internals

| Parameter | Value |
|-----------|-------|
| Pause threshold | `DEFAULT_PAUSE_THRESHOLD = 1.2s` |
| Micro-pause filter | 300 ms (silences shorter than this are ignored) |
| Calibration window | 1.5 s |
| Start buffer | 2 000 ms (excluded from hesitation counting) |
| End buffer | 1 000 ms (excluded from hesitation counting) |

- `SpeechSession` drives the per-frame RMS analysis via `micStateMachine.applyMicStateFrame`.
- `TranscriptionController` uses browser Web Speech API first; Android skips this to avoid re-prompting for mic permission and goes straight to Groq fallback.
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

- **`calculateFlowScore`** — `src/lib/core/scoring.ts` — single authoritative scoring function.
- **`insertSession` / `updateStreak`** — `src/lib/core/session.ts` — shared persistence with missing-column fallbacks.
- **`buildPracticeStats`** — `src/lib/core/queries.ts` — aggregates dashboard/stat values from raw session rows.
- **`SpeechAnalyzer`** — `src/features/practice/lib/speechAnalyzer.ts` — top-level browser practice orchestrator.
- **`useRecordingController`** — `src/features/practice/pages/useRecordingController.ts` — coordinates all practice hooks.
- **`handleVoiceMessage`** — `src/lib/telegram/voiceHandler.ts` — Telegram voice analysis pipeline.
- **`createTelegramBot`** — `src/lib/telegram/router.ts` — Telegraf command/action registration.
- **`practiceApi`** — `src/lib/practiceApi.ts` — browser-facing facade for all data operations.
- **`getWordCount`** — `src/lib/core/utils.ts` — canonical word count helper used everywhere a transcript word threshold is needed.
- **`arrayBufferToBase64`** — `src/shared/lib/utils.ts` — canonical audio buffer encoder used by session and transcription paths.

---

## Notable Quirks

- **`normalizeMode()` always returns `"speaking"`** — `src/lib/core/modes.ts`. Only one mode exists; the structure is a placeholder for potential future modes.
- **`window.__nopauseExportLogs`** — debug hook in `ResultPanel.tsx`; visible only when `localStorage.getItem('debugLogs') === 'true'`.
- **Android transcription bypass** — Android skips browser `SpeechRecognition` to avoid triggering a second mic-permission prompt.
- **Legacy column fallback** — `practiceApi.ts` and `insertSession` retry with a smaller column set if `total_silence_time` or `analysis_feedback` columns are missing (schema migration safety net).
- **Vercel root** — The Vercel project root is the repo root, not `No-Pause/`. Running `vercel deploy` from `No-Pause/` causes a doubled `No-Pause/No-Pause` path error.
- **`APP_URL`, `SITE_URL`, and Google redirect URLs** are hardcoded and require code changes for non-production domains.
- **`src/lib/core/prompts.ts`** must not be removed; Telegram prompt/challenge behavior depends on it.
- **Service worker** (`sw.js`) uses stale-while-revalidate for core assets, network-first for navigation.
- **Filler tracking** was removed repo-wide on 2026-05-18. Any memory or code reference to `filler_count`, `fillerCount`, `generateFillerCount`, or `fillerWordCount` is historical only.

---

## Deploy Workflow

Run from the **repo root** (`/Users/viseeroy/Desktop/NoPause`):

```bash
git add -A && git commit -m "Deploy" && git push
cd No-Pause && npm run build
cd .. && npx vercel deploy --prod --yes
```

When the user says `deploy`, execute this immediately without confirmation.

---

## Recent Refactoring

The following cleanup items were completed in the most recent refactoring session. They are documented here so future agents understand the current consolidated state and do not re-introduce the old patterns.

### #1 — Convex environment variables removed

**What changed:** `No-Pause/.env.local` previously contained Convex credentials (`cautious-canary-504` deployment). Those variables have been removed.

**Why:** Convex was never used in this codebase; all backend work goes through Supabase. The credentials were a leftover from an earlier architecture experiment.

**Current state:** `.env.local` contains only Supabase and runtime variables. `.env.example` lists `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SENTRY_DSN`.

---

### #7 — `arrayBufferToBase64` consolidated

**What changed:** Both `src/features/practice/hooks/useSession.ts` and `src/features/practice/lib/transcription.ts` had identical inline implementations of `arrayBufferToBase64`. Both were removed and replaced with an import from `src/shared/lib/utils.ts`.

**Canonical location:** `src/shared/lib/utils.ts` — exported as `arrayBufferToBase64`.

**Importers:** `useSession.ts` and `transcription.ts`.

**Do not** re-introduce inline copies.

---

### #8 — `getWordCount` unified

**What changed:** `src/services/aiFeedback.ts` had a local private `getWordCount` function. It was removed and replaced with an import from `src/lib/core/utils.ts`, which already exported the same function for Telegram voice handling.

**Canonical location:** `src/lib/core/utils.ts` — exported as `getWordCount`.

**Importers:** `aiFeedback.ts`, `voiceHandler.ts`, `useSession.ts`, `useScoring.ts`.

**Do not** re-introduce inline copies in any file.

---

### #12 / #13 — `useScoring.ts` cleanup

**What changed:**
- `useScoring.ts` previously computed word count inline with a raw `split(/\s+/)` expression. That inline logic was replaced with `getWordCount` imported from `src/lib/core/utils.ts`.
- `BuildSessionResultOutput.words` is now typed as `number | null` (was previously implicitly typed or inconsistently handled). Null is returned when the transcript is empty or absent.

**Current shape of `useScoring.ts`:**
- Imports: `calculateFlowScore` from `@/lib/core/scoring`, `getWordCount` from `@/lib/core/utils`, `AnalyzerResults`, `SessionResult`, `formatMMSS`.
- Exports: `BuildSessionResultInput`, `BuildSessionResultOutput`, `buildSessionResult`, `useScoring`.
- `words` field in output is `number | null`; also written to `sessionResult.wordCount`.
