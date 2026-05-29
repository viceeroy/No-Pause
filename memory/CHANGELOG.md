# NoPause Refactoring History

Historical refactoring detail. Current-state facts live in `memory/system.md`.
Append new entries here — append-only, never delete or edit old ones.

---

## #1 — Convex environment variables removed

**What changed:** `No-Pause/.env.local` previously contained Convex credentials (`cautious-canary-504` deployment). Those variables have been removed.

**Why:** Convex was never used in this codebase; all backend work goes through Supabase. The credentials were a leftover from an earlier architecture experiment.

**Current state:** `.env.local` contains only Supabase and runtime variables. `.env.example` lists `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SENTRY_DSN`.

---

## #7 — `arrayBufferToBase64` consolidated

**What changed:** Both `src/features/practice/hooks/useSession.ts` and `src/features/practice/lib/transcription.ts` had identical inline implementations of `arrayBufferToBase64`. Both were removed and replaced with an import from `src/shared/lib/utils.ts`.

**Canonical location:** `src/shared/lib/utils.ts` — exported as `arrayBufferToBase64`.

**Importers:** `useSession.ts` and `transcription.ts`.

**Do not** re-introduce inline copies.

---

## #8 — `getWordCount` unified

**What changed:** `src/services/aiFeedback.ts` had a local private `getWordCount` function. It was removed and replaced with an import from `src/lib/core/utils.ts`, which already exported the same function for Telegram voice handling.

**Canonical location:** `src/lib/core/utils.ts` — exported as `getWordCount`.

**Importers:** `aiFeedback.ts`, `voiceHandler.ts`, `useSession.ts`, `useScoring.ts`.

**Do not** re-introduce inline copies in any file.

---

## #12 / #13 — `useScoring.ts` cleanup

**What changed:**
- `useScoring.ts` previously computed word count inline with a raw `split(/\s+/)` expression. That inline logic was replaced with `getWordCount` imported from `src/lib/core/utils.ts`.
- `BuildSessionResultOutput.words` is now typed as `number | null` (was previously implicitly typed or inconsistently handled). Null is returned when the transcript is empty or absent.

**Current shape of `useScoring.ts`:**
- Imports: `calculateFlowScore` from `@/lib/core/scoring`, `getWordCount` from `@/lib/core/utils`, `AnalyzerResults`, `SessionResult`, `formatMMSS`.
- Exports: `BuildSessionResultInput`, `BuildSessionResultOutput`, `buildSessionResult`, `useScoring`.
- `words` field in output is `number | null`; also written to `sessionResult.wordCount`.

---

## #14 — Groq-primary web transcription and timestamp-based scoring

**What changed:** Browser SpeechRecognition disabled as primary transcription source. Groq Whisper is now called on every web session (was previously fallback only). Word timestamps from Groq are passed through practiceApi → transcription → useScoring. Hesitation count is now computed from word timestamp gaps (same method as Telegram bot in voiceHandler.ts). RMS pipeline still runs but its hesitationCount is only used as fallback when timestamps are unavailable. parseTranscribedWords and TranscribedWord type deduplicated into src/lib/core/utils.ts.

**Files changed:** practiceApi.ts, transcription.ts, useScoring.ts, useSession.ts, speechAnalyzer.ts, speechTypes.ts, lib/core/utils.ts

**Do not** re-enable browser SpeechRecognition as primary without removing the Groq-primary path first.

---

## Filler-word tracking removed (2026-05-18)

**What changed:** Filler-word tracking removed repo-wide. It plays no role in scoring, display, or persistence. Transcription returns transcript text and word timestamps only; saved sessions no longer write `filler_count`; Telegram voice scoring uses pause units instead of filler counts.

**Do not** re-introduce. Any reference to `filler_count`, `fillerCount`, `generateFillerCount`, or `fillerWordCount` is historical only.

---

## blendWithAiScore removed (2026-05-24)

**What changed:** `blendWithAiScore` removed. Previously, `scoreSpeechQuality` called Groq to score speech 0–100 on coherence/grammar/word choice and added that integer to the flow score. Was on-demand on web (triggered by "Get AI Feedback" button) but ran **automatically before `insertSession`** on Telegram, meaning Telegram sessions before 2026-05-24 may have inflated `flow_score` values in the DB. Related state fields `baseFlowScore`, `aiScore`, `aiScoreFeedback` also removed.

**Live caveat** (also noted in system.md Notable Quirks): Telegram sessions saved before 2026-05-24 may carry inflated `flow_score`. Web sessions unaffected — the blend was on-demand and never written back to the DB.
