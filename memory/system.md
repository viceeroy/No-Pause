# NoPause Project Memory

Single source of truth for AI agents picking up this project. Update this file whenever architecture, data flow, scoring, schema, env, or deployment assumptions change.

> Refactoring history lives in `memory/CHANGELOG.md` (append-only).

---

**2026-06-13:** **Help-page accuracy pass + practice/stats UI polish.**
- **Help content corrected to match live Flow 2.0** (`src/features/help/helpContent.ts`). The `understanding-flow-score` article still described the **pre-2.0** model (per-completed-minute `*20` bonus, silence subtracted as seconds). Rewritten to the real mechanics: base flow = continuity ratio scaled by `durationFactor` (no per-minute bonus), with a separate duration bonus and AI-feedback bonus on top. Removed all "full minute" / "full-minute bonus kicks in twice" copy. ⚠️ **CLAUDE.md frozen-rule text is still the stale pre-2.0 formula** — left untouched (governance doc); needs founder reconciliation against `scoring.ts` (`calculateFlowScore`/`calculateTotalScore`).
- **Telegram/Privacy help corrected:** there is **no web "settings page" and no disconnect/unlink feature** (web or bot — bot commands are only `start`, `register`, `nopause`; no browser delete on `telegram_connections`). Connect flow starts in the bot (`/start`/`/register` → deep link → web `/connect` handler). Help no longer claims a settings page or a removable/disconnectable link; account switch documented as sending `/register`. **Follow-up gap:** no Telegram disconnect path exists anywhere — build if needed.
- **Weekly Activity restyled** (`StatsPage.tsx` `WeeklyActivityRow`): variable-height score bars → uniform flat pills. Orange (`bg-primary`) when that day has a completed session (shows best score above the peak day only), muted (`bg-surface-elevated`) otherwise. Dropped height-scaling (`MAX_HEIGHT`/`MIN_BAR`/`maxScore`/`barH`). Data source unchanged (`getWeeklyActivityDays`/`buildWeeklyActivityDays`).
- **Setup carousel input fixes** (`src/features/practice/pages/SetupCountdownPanel.tsx`): trackpad two-finger horizontal swipe now navigates (accumulate `deltaX`, fire once, lock until the wheel stream goes quiet ~150ms so the inertial tail can't double-skip; `overscrollBehaviorX: contain`); mouse drag no longer sticks to cursor (move/up bound to `window` synchronously in `onPointerDown` — no render-gap race that dropped `pointerup`); `select-none` + `cursor-grab/grabbing`; `touch-action: pan-y` retained for mobile vertical scroll.
- **iOS safe-area wrapper hoisted** (`src/App.tsx`): `app-safe-area` moved above the full route switch in `AuthAwareRoutes` so `/auth/*`, `/login/*`, `/help`, `/connect`, `/sessions` get notch padding in standalone PWA (previously only the `/*` catch-all did).

---

**2026-06-10:** **Live Supabase audit + fixes (project `nuwdjopbvxpfeaxfirot`).** Audit report: `Desktop/NoPause.sd/Audits/2026-06-10-supabase-audit.md`. Applied via MCP `apply_migration`, mirrored as repo files under `No-Pause/supabase/migrations/`:
- **`user_prompts` table now LIVE.** Repo migration `20260605000000_add_user_prompts.sql` had never been applied to prod — the AI-prompts feature (`/api/generate-prompts`, Telegram `pickPromptForUser`) was dead. Applied as migration `add_user_prompts`.
- **`api_usage_daily_kind_check` widened** to `('transcription','feedback','prompts')` (was 2-kind; `consume_api_usage_daily` already accepted `'prompts'` but the table CHECK rejected the insert). Repo: `20260610120000_widen_api_usage_kind_check.sql`. **Prompts feature is now fully live in prod** (frontend was already deployed).
- **`get_telegram_challenge_stats` no longer anon-callable.** Default PUBLIC execute grant removed; re-granted to `authenticated` + `service_role` only. (`REVOKE FROM anon` alone was insufficient — anon inherits PUBLIC.) Repo: `20260610120001` (partial) + `20260610120002_revoke_anon_rpc_from_public.sql`. All 3 RPCs now `{authenticated, service_role}`, anon=false.
- **Duplicate index dropped.** `sessions_user_id_created_at_idx` (identical to `sessions_user_created_at_idx`, both `(user_id, created_at DESC)`). sessions now has 3 indexes.
- **RLS policies initplan-wrapped.** All policies using bare `auth.uid()`/`auth.role()` rewritten to `(select auth.…)` per Supabase lint 0003 (per-row re-eval → once). `sessions`/`streaks` were already wrapped (untouched). `telegram_connections` kept USING-only (no WITH CHECK). Repo: `20260610120001_audit_perf_and_grant_fixes.sql`.
- **`user_prompts_service_role` scoped `TO service_role`** to clear `multiple_permissive_policies` (lint 0006, 18 warns) — the `FOR ALL` policy overlapped the 3 own per-action policies on every role. Repo: `20260610120003_scope_user_prompts_service_role.sql`.
- **Data cleanup (one-time).** Deleted 36 stale unreferenced pending challenges (>30d, no attempts/state/friend_result_sends refs) + 3 stale `telegram_challenge_state` rows (>7d). FK `telegram_challenge_state_challenge_id_fkey` is ON DELETE CASCADE.
- **Disaster-recovery baseline added.** `No-Pause/supabase/schema/baseline_schema.sql` (NOT in `migrations/`) captures full live schema (9 tables, indexes, policies, 3 RPCs, grants) post-fix. **This file IS the disaster-recovery path — the ONLY artifact that rebuilds the DB from zero.** The dated `migrations/` chain CANNOT rebuild from empty: base `sessions`/`streaks` tables are created by NO migration (existed only in live DB), and the chain's first file `20260507133131` FKs to `public.challenges`, created only in CLI-invisible `migrations/_legacy/`. So the chain throws on the first file against an empty DB; it is incremental history that assumes the live base. Baseline lives in `schema/` (outside `migrations/`) so the CLI won't auto-run it alongside the chain — apply manually via psql on rebuild. 6 unversioned `add_*.sql` files moved to `migrations/_legacy/` (untrackable by CLI — no timestamp prefix).
- Remaining advisors (all intentional/IGNORE): 3 authenticated SECURITY DEFINER RPC notices (by design), leaked-password disabled (Google-OAuth-only, no password flow), 2 unindexed-FK INFO on tiny tables.
- **Live public tables (9):** sessions, streaks, telegram_connections, challenges, telegram_challenge_state, telegram_challenge_attempts, **api_usage_daily**, **telegram_friend_result_sends**, **user_prompts** (last 3 were missing from the Database Tables section below — now noted here).

---

**2026-06-10:** **Duration factor, AI score scaling, total rounding, expanded AI prompt.**
- `getDurationFactor(speakingTimeSec)` exported from `src/lib/core/scoring.ts` — `Math.min(Math.sqrt(speakingTimeSec / 120), 1.0)`. Short sessions (<120s) receive a sub-1.0 multiplier; sessions ≥120s get full weight.
- `calculateFlowScore` now applies `durationFactor` internally: `score = clamp(round(continuityRatio * 100 * durationFactor) − pausePenalty, 0, 100)`.
- `calculateTotalScore` rounds total to nearest 5: `Math.round(capped / 5) * 5` (e.g. 198→200, 43→45). The old per-component clamping via `clamp()` was removed — raw sum → cap → round.
- AI score scaled by `getDurationFactor(speakingTimeSec)` before `calculateTotalScore` at both call sites: `useSession.requestFeedback` (uses `input.speakingTime`) and `useSession.requestTranscription` (uses `lastResults.totalSpeakingTime`). Same scaling in `voiceHandler.handleVoiceMessage` (uses `analysis.speakingTimeSec`).
- `FEEDBACK_SYSTEM_PROMPT` expanded to 5-part coaching structure (flow pattern, linking quality, why, drill/habit, score explanation) producing 5–6 sentences. Quotes transcript directly. Single quotes required for in-feedback transcript quotes to prevent JSON parse failures.
- `has_topic` field removed from PostHog `ai_feedback_received` event in `useSession.ts`.
- `createEmptyWeeklyActivity()` in `StatsPage.tsx` now includes `bestScore: null` (fixes pre-existing tsc error from `WeeklyActivityDay.bestScore` being required).

---

**2026-06-08:** **Flow Score 2.0 — full scoring replacement (web + Telegram).** Headline score is now a **0–230 total** = `flowScore (0–100)` + `aiScore (0–100)` + `durationBonus (0–30)`. `src/lib/core/scoring.ts` rewritten: `calculateFlowScore({ cleanSpeakingTime, totalSessionTime, speakingTime, pauseCount })` → `{score,isCompleted}` where `continuityRatio = cleanSpeakingTime/totalSessionTime`, `pausePenalty = round((pauseCount/(speakingTime/60))*2)`, `score = clamp(round(continuityRatio*100) − pausePenalty, 0, 100)`, `isCompleted = speakingTime ≥ 5` (`cleanSpeakingTime = totalSessionTime − totalSilenceSec`). New `calculateDurationBonus(speakingTimeSec) = clamp(round(/10),0,30)` and `calculateTotalScore(flow,ai,duration) = min(sum,230)`. **`applyBandBonus` + `isScorableSession` deleted.** AI role changed: `aiFeedback.ts` no longer grades content/topic (no band 1–9). It receives the transcript with silence gaps marked inline as `[——Xs——]` (built by new `buildMarkedTranscript(transcript, words, gaps)`) plus stats, and returns `{score: 0–100, feedback}` from a single fluency-pattern prompt (temperature 0). `getAIFeedback` (groq.ts) gained a `temperature?` param. Input/return types: `AnalyzePracticeSpeechInput { transcript, words, gaps, speakingTimeSec, totalSilenceSec, pauseCount, wordCount }`; `AiFeedbackResult { score, feedback }`. `POST /api/feedback` body now takes `words/gaps/totalSilenceSec/...`, returns `{score, feedback}`. **Web flow:** `useScoring.buildSessionResult` now keeps `gaps` + `transcribedWords` + `flowScoreBase` + `durationBonus` on `SessionResult`; `useRecording.stopRecording` threads them into `useSession.requestFeedback`, which calls `analyzeSpeech`, computes `calculateTotalScore`, writes `flow_score = totalScore` + `scoring_version = flow-2.0`, and surfaces `bonusPoints` (renamed from `bandPoints`) in `ResultPanel`. Manual `requestTranscription` recomputes gaps from its fresh words. **Telegram:** `voiceHandler.analyzeTranscript` uses the new formula and carries `gaps` in `FlowAnalysis`; `handleVoiceMessage` drops `topic` from the AI call, computes `totalScore`, stores it in `flow_score` with `scoring_version = flow-2.0`. `getSessionAnalysis` (DB re-display only, never feeds AI) sets `gaps: []`. All new sessions tagged `flow-2.0`; old rows + old `scoring_version` constants untouched. PostHog `ai_feedback_received` now emits `ai_score`/`bonus_points` (was `band`/`band_points`). Parse-failure fallback in `aiFeedback` is `{score:0, feedback:"Feedback unavailable — please try again."}` (no phantom bonus). Labels rescaled (see Flow Score Formula). `src/lib/core/silence.ts` and DB migrations unchanged.

---

**2026-06-05:** **AI-generated practice prompts (per user, DB-backed).** New user-triggered button on `/prompts` (`src/pages/PromptsPage.tsx`) generates fresh prompts for the active category in the same style as the built-in set. Flow: `PromptsPage` → `generatePrompts(categoryId)` (`src/lib/practiceApi.ts`) → `POST /api/generate-prompts.ts` (auth + `consumeApiQuota` kind `"prompts"`, `DAILY_PROMPTS_LIMIT=20`) → `generateCategoryPrompts()` (`src/services/groq.ts`, Groq chat `llama-3.3-70b-versatile`, `response_format: json_object`, returns `{prompts:[]}`) → `appendUserGeneratedPrompts()` (`src/services/userPrompts.ts`, service-role upsert). New table **`public.user_prompts`** (`user_id` PK FK→auth.users, `generated jsonb` = `Record<categoryId,string[]>`, `updated_at`) with RLS own-row select/insert/update + service-role all (migration `20260605000000_add_user_prompts.sql`). Client reads own generated prompts via `fetchUserGeneratedPrompts()` (browser RLS). `PromptsPage` renders built-in prompts then generated ones; button gated behind `user`. **Telegram now prefers the user's generated prompts**: `pickPromptForUser(userId, excludeLast?)` (`userPrompts.ts`) random-picks from `[...opinionPrompts, ...flattenedGenerated]`, falling back to `getRandomPrompt` when user unresolved/empty. Wired into `router.ts` (`replyWithPrompt`, `CHANGE_PROMPT_ACTION`) and `challenges.ts` (`pickChallengeTopic` helper → friend/group create + change-topic). `getRandomPrompt` itself unchanged. New quota kind added to `ApiUsageKind` (`src/services/apiQuota.ts`); no quota-RPC change (keyed on text). **Migration must be applied to the DB before this works in prod.**

---

**2026-06-03:** **PostHog analytics added (EU region).** `posthog-js` installed. Init in `src/main.tsx` via `src/services/posthog.ts` (EU host `https://eu.i.posthog.com`, `person_profiles: 'identified_only'`). User identified/reset on auth state change in `AuthContext.tsx`. Key events: `session_completed` (mode, duration_s, flow_score, words, completed, pause_count) fired in `useSession.ts` after successful save; `ai_feedback_received` (ai_score, bonus_points, flow_score_before, flow_score_after) fired after AI analysis. (`band`, `band_points`, `has_topic` removed 2026-06-08/10.) Env var: `VITE_POSTHOG_KEY` (must be set in Vercel before build — Vite bakes it at compile time). Project ID: 192820, EU Cloud. PR #3 merged to main. Vercel Analytics + Speed Insights still active alongside PostHog.

---

**2026-06-03:** **Flow Score formula changed** — per-completed-minute bonus halved from `*40` to `*20`. Now `score = max(0, speakingTimeSec + floor(speakingTimeSec/60)*20 - round(totalSilenceSeconds))` in `calculateFlowScore` (`src/lib/core/scoring.ts`). Applies to both web and Telegram (shared fn). AI band bonus (`applyBandBonus`, `+band*10`) unchanged. CLAUDE.md frozen-rule text updated to match. Results UI: web ResultPanel now shows a 3-card metric row — **Pauses / Silence / Speaking time** (Pauses uses `pauseCount`, was dropped after silence-seconds refactor); minute bonus shown as `+N bonus` on the Speaking time card; AI band bonus labelled "AI feedback bonus" beside the green `+N`. Telegram result message (`formatResultFields`, `constants.ts`) dropped the "Session length" line and added a "Pauses: N" line; its minute "Bonus" line now reflects `*20`.

---

**2026-06-03:** Added `public.get_telegram_challenge_stats()` RPC (SECURITY DEFINER) for web Stats page. Resolves caller's `telegram_id` from `auth.uid()` and returns `{friendChallenges, groupChallenges, friendWins, groupWins}`. Replaces RLS-blocked browser query (`getTelegramChallengeCounts` / `getTelegramChallengeWins` still used by Telegram bot via service role). Web StatsPage.tsx calls `supabase.rpc('get_telegram_challenge_stats')`. Returns `null` when user has no Telegram connection (card hides). Migration: `20260602010000_get_telegram_challenge_stats_rpc.sql`.

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
| Analytics | Vercel Analytics + Speed Insights + PostHog (EU, project 192820) |
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
    constants.ts                DEFAULT_PAUSE_THRESHOLD, SCORING_VERSION_BASE, SCORING_VERSION_TG_BAND, thresholds, labels
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
  aiFeedback.ts                 analyzePracticeSpeech — fluency-pattern analysis only (Flow Score 2.0, 2026-06-08). One FEEDBACK_SYSTEM_PROMPT, temperature 0, ignores content/topic. Input: transcript with `[——Xs——]` gap markers (buildMarkedTranscript) + STATS. Returns `{score: 0–100, feedback}`. No band, no topic-relative rubric. Runs on every scorable session (web + Telegram), server-only
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
10. Stats pages read via `getPracticeStats` / `buildPracticeStats`. The RPC excludes `tg-band-1.0`, `tg-legacy`, and `free-speech-band-1.0` versions from averages and bests via an `is_comparable` flag (null/unknown treated as comparable). Total counts, practice time, and streaks still span all sessions, and `recentSessions` includes all rows with their `scoringVersion`. For silence, the RPC prefers the stored `total_silence_time` and falls back to derived `duration − speaking_time` only when it is NULL (pre-S6 rows).

### Telegram Voice / Challenge

1. Telegram posts updates to `/api/telegram/webhook`.
2. `createTelegramBot` resolves user via `telegram_connections`; unconnected users get `/connect?tg=...`.
3. `handleVoiceMessage` preflights: user lookup → pending challenge lookup → challenge validity → expiry → duplicate Telegram message guard.
4. Invalid or expired pending challenge state is deleted; bot replies without downloading audio.
5. Voice file downloaded from Telegram; transcribed via Groq Whisper.
6. Transcripts under 3 words (`getWordCount`) are rejected.
7. `analyzeTranscript` calls `analyzeSilenceFromTimestamps` (same shared helper as web) to compute `totalSilenceSec`, `speakingTimeSec`, and `gaps`; `calculateFlowScore` (continuity-based) scores them, giving the **raw Flow Score** (`analysis.flowScore`, 0–100).
8. **Streamed result (message-then-edit, since 2026-06-14).** `insertTelegramSession` stores the **raw Flow Score** (no AI yet, `analysis_feedback = null`) as `flow_score`; insert remains the single duplicate guard (unique-violation). `scoring_version = flow-2.0`; `updateStreak` follows. The bot **immediately** sends the result message showing the raw Flow Score (no feedback) — perceived latency is now just download+transcribe, decoupled from Groq.
9. After the first message, `runAiFeedback` runs the slow `analyzePracticeSpeech` (marked transcript: gaps + STATS, **no topic**) → AI score (0–100); `calculateTotalScore(flowScore, aiScore, durationBonus)` produces `finalScore` (capped 230). Non-fatal: on failure returns raw Flow Score + no feedback, first message stands. `updateTelegramSessionScore` then patches the row (`flow_score = finalScore`, `analysis_feedback`), and `editMessageText` upgrades the sent message to `finalScore` + AI feedback suffix. Both update + edit are non-fatal.
   - **Score-display note:** the "Flow Score:" field shows the raw flow number first, then the edit replaces it with the 230-scale total. Friend/group **other-party notifications** (auto-notify creator/friend, `updateFriendChallengeCreatorScore`) fire in the streaming `onFinal` callback *after* AI, so they always carry `finalScore`.
10. All three result paths (solo speaking, friend challenge, group challenge) go through the shared `sendStreamingResult` helper (send pre-AI → run AI → persist → edit → path-specific `onFinal`). Verbose progress logs throughout `handleVoiceMessage` are gated behind `NOPAUSE_DEBUG_TELEGRAM` via `debugLog`.
11. `replyWithAiFeedback` (on-demand "AI Feedback" button callback): sessions table has no topic column → always replies with the no-topic note, never calls Groq. Groq call block removed entirely. (Inline free-speech feedback in step 9 is what surfaces feedback for topic-less sessions; this on-demand handler stays a no-op stub by design.)

---

## Flow Score Formula

**Flow Score 2.0 (current, updated 2026-06-10).** Headline score = `flowScore + adjustedAiScore + durationBonus`, rounded to nearest 5, capped at **230**.

**Source of truth:** `src/lib/core/scoring.ts` — `calculateFlowScore(...)`, `getDurationFactor(speakingTimeSec)`, `calculateDurationBonus(speakingTimeSec)`, `calculateTotalScore(flowScore, aiScore, durationBonus)`, `getScoreLabel(score)`.

Silence detection: `src/lib/core/silence.ts` — `analyzeSilenceFromTimestamps(words, totalSessionTimeSec)`. Returns `totalSilenceSec` (rounded once at end), `speakingTimeSec` (Σ word durations), `gapCount`, and `gaps[]`. Used identically by web (`useScoring.ts`) and Telegram (`voiceHandler.ts`). `cleanSpeakingTime = totalSessionTimeSec − totalSilenceSec`.

```
durationFactor           = min(sqrt(speakingTimeSec / 120), 1.0)   ← 1.0 at ≥120s, scales down below

flow score (0–100):
  guard: speakingTime ≤ 0 OR totalSessionTime ≤ 0  →  score = 0, isCompleted = false
  continuityRatio = cleanSpeakingTime / totalSessionTime
  pausePenalty    = round((pauseCount / (speakingTime / 60)) * 2)
  score           = clamp(round(continuityRatio * 100 * durationFactor) − pausePenalty, 0, 100)
  isCompleted     = speakingTime ≥ 5     ← computed independently of score

adjustedAiScore (0–100) = round(aiResult.score * durationFactor)   ← applied at call sites, not inside aiFeedback.ts
durationBonus (0–30)    = clamp(round(speakingTimeSec / 10), 0, 30)
total (0–230, ×5)       = round(min(flowScore + adjustedAiScore + durationBonus, 230) / 5) * 5
```

`isCompleted` is separate from `score`: a sub-5s session can still produce a non-zero flow score but is marked not-completed. Sessions are persisted regardless.

**AI score (replaces the old 1–9 band).** Every scorable session (web + Telegram) runs `analyzePracticeSpeech` (`src/services/aiFeedback.ts`), which **ignores content/topic** and analyzes fluency only. It is given the transcript with silence gaps marked inline as `[——Xs——]` (built by `buildMarkedTranscript(transcript, words, gaps)`, gap durations rounded to 1 decimal) plus STATS (speaking time, total silence, pause count, word count), via one `FEEDBACK_SYSTEM_PROMPT` at **temperature 0**, and returns `{score: 0–100, feedback}`. The prompt produces 5–6 sentences covering flow pattern, linking quality, mechanical why, drill/habit, and score explanation — always quotes transcript directly using single quotes. Non-English → `{score:0, feedback:"Please speak in English…"}`; JSON parse failure → `{score:0, feedback:"Feedback unavailable — please try again."}`. The AI score is scaled by `getDurationFactor` at the call site before `calculateTotalScore`; result written to `flow_score` tagged `scoring_version = flow-2.0`. Web surfaces the post-AI delta as `bonusPoints` (= adjustedAiScore + durationBonus) in `ResultPanel`.

A gap between words counts as silence if ≥ `DEFAULT_PAUSE_THRESHOLD` (1.5s). Below 1.5s is ignored (normal speech rhythm). When a gap qualifies, its full duration counts. Leading silence (before first word) and trailing silence (after last word to end of session, clamped ≥ 0) are each included only when they exceed the 1.5s threshold — same gate as inter-word gaps. The 3s countdown is the only grace. Total silence = sum of all qualifying gap durations, rounded once at end.

Minimum 3 word timestamps required for web scoring. Fewer → scoring error surfaced to user. Telegram uses `isUsableTranscript` (exported from `src/services/aiFeedback.ts`) to gate on word count ≥ 3 in the transcript text, not on timestamp count.

**Labels (0–230 scale):** `0–50` Needs Practice · `51–100` Getting There · `101–150` Good Flow · `151–200` Great Flow · `201–230` Perfect Flow.

**Rules:**
- Only `src/lib/core/scoring.ts` defines the formula. Never fork constants or formulas elsewhere.
- `DEFAULT_PAUSE_THRESHOLD = 1.5s` lives only in `src/lib/core/constants.ts`. No hardcoded literals.
- Both web and Telegram derive `speakingTimeSec` and `totalSilenceSec` from Groq word timestamps via the same shared helper. No RMS-based scoring fallback.
- The AI never sees the topic and never grades content — fluency pattern only. Marked-transcript `gaps` must be the real `SilenceGap[]`; `getSessionAnalysis` (DB re-display) passes `gaps: []` and must never feed the AI.

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
- `total_silence_time` (integer, nullable) now exists on `sessions`. New sessions persist the measured (timestamp-derived) silence; pre-S6 rows are NULL. `get_practice_stats` coalesces the stored value with the derived `duration − speaking_time` fallback for NULL/old rows.
- `insertSession` / query helpers include fallbacks for deployments missing newer columns. The stripped/checked set is `pause_count`, `hesitations_per_minute`, `telegram_chat_id`, `telegram_message_id` (see Notable Quirks → Legacy column fallback). `total_silence_time` and `analysis_feedback` are no longer in this set.
- Telegram stats filter by `sessions.source = 'telegram'`; older rows without source may not appear.
- Base `sessions`/`streaks` schema and RLS policies are not fully represented in repo migrations.
- `scoring_version` column: DB default is `base-1.0` (unchanged), but all live code writes `flow-2.0`. Historical values: `base-1.0`, `tg-band-1.0`, `free-speech-band-1.0`, `tg-legacy`. See Notable Quirks → Scoring cohorts.

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
| `NOPAUSE_DEBUG_TELEGRAM` | Server only | When `"true"`, enables verbose Telegram voice-handler debug logging via `debugLog`; silent otherwise |

**Never add `VITE_GROQ_API_KEY`** — provider keys are server-only.

---

## Key Components

- **`calculateFlowScore({ cleanSpeakingTime, totalSessionTime, speakingTime, pauseCount })`** — `src/lib/core/scoring.ts` — authoritative flow score (0–100), continuity-based with `durationFactor` applied. Object arg (not positional).
- **`getDurationFactor(speakingTimeSec)`** — `src/lib/core/scoring.ts` — `min(sqrt(speakingTimeSec/120), 1.0)`. Full weight at ≥120s; sub-1.0 for shorter sessions. Applied inside `calculateFlowScore` and at AI score call sites.
- **`calculateDurationBonus(speakingTimeSec)`** / **`calculateTotalScore(flow, ai, duration)`** — `src/lib/core/scoring.ts` — duration bonus (0–30) and the 0–230 total rounded to nearest 5. (`applyBandBonus`/`isScorableSession` removed 2026-06-08.)
- **`buildMarkedTranscript(transcript, words, gaps)`** — `src/services/aiFeedback.ts` — inserts `[——Xs——]` gap markers into the transcript for the fluency-analysis prompt.
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
- **Legacy column fallback** — `isMissingSessionAnalysisColumnError` (`session.ts`) detects a missing-column error via Postgres codes `PGRST204`/`42703` or a message mentioning `pause_count`, `hesitations_per_minute`, `telegram_chat_id`, or `telegram_message_id`. On a hit, `buildLegacySessionInsertValues` strips exactly those four columns for the retry insert, and `practiceApi.ts` re-queries with a smaller select (it reuses the same predicate — no separate column list of its own). `total_silence_time` and `analysis_feedback` are **not** in the strip set: `total_silence_time` was removed once the column shipped (S6), and `analysis_feedback` was never in it.
- **Vercel root** — The Vercel project root is the repo root, not `No-Pause/`. Running `vercel deploy` from `No-Pause/` causes a doubled `No-Pause/No-Pause` path error.
- **`APP_URL`, `SITE_URL`, and Google redirect URLs** are hardcoded and require code changes for non-production domains.
- **`src/lib/core/prompts.ts`** must not be removed; Telegram prompt/challenge behavior depends on it.
- **Service worker** (`sw.js`) uses stale-while-revalidate for core assets, network-first for navigation.
- **Filler tracking** was removed repo-wide on 2026-05-18. Any memory or code reference to `filler_count`, `fillerCount`, `generateFillerCount`, or `fillerWordCount` is historical only.
- **Telegram voice duration cap** — `MAX_TELEGRAM_VOICE_DURATION_SECONDS = 300` (5 min) enforced in `voiceHandler.ts` before download. Messages over this limit are rejected with a reply.
- **Streamed-result group race (accepted)** — Since the 2026-06-14 streamed result, the group-challenge keyboard (incl. "Send to Group") appears on the *instant* pre-AI message. If a user taps "Send to Group" during the AI window (before `updateTelegramSessionScore` patches `flow_score`), `postGroupChallengeResultToGroup` reads the **raw** Flow Score from the DB and posts that to the group (the in-chat message still self-corrects via the edit). Accepted, not guarded: a null-`analysis_feedback` "still scoring" check can't distinguish in-progress from a legitimate AI-failure session (which keeps raw score + null feedback by design), so it would permanently disable the button on AI-failure sessions — worse than the seconds-long race.
- **Scoring cohorts (versioned in DB)** — The `scoring_version` column classifies sessions:
  - `flow-2.0` — **current.** Written for ALL new web + Telegram sessions (2026-06-08 onward). `flow_score` = `flowScore + aiScore + durationBonus` (0–230, Flow Score 2.0). DB column default is still `base-1.0` (unchanged), but live code always writes `flow-2.0`.
  - `base-1.0` / `tg-band-1.0` / `free-speech-band-1.0` / `tg-legacy` — **historical only.** No longer written by current code (old band-era + blend-era rows). Kept for backfill/stat-cohort separation; their constants remain in `constants.ts` for old rows.
  These older cohorts mix different scales (old 0–~300+ band era vs new 0–230); stats that span cohorts compare across scales — acceptable per the migration (old rows never rewritten).

---

## Deploy Workflow

Run from the **repo root** (`/Users/viseeroy/Documents/GitHub/No-Pause`):

```bash
git add -A && git commit -m "Deploy" && git push
cd No-Pause && npm run build
cd .. && npx vercel deploy --prod --yes
```

When the user says `deploy`, execute this immediately without confirmation.
