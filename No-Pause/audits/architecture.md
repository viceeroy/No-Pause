# Audit #7: Architecture & Duplication

**Date:** 2026-05-24  
**Scope:** Code duplication, naming inconsistencies, module boundary violations, separation of concerns, dead abstractions, and cohesion issues

---

## Code Duplication

### HIGH-1: `sendJson` copied identically across 3 API files

**Files:** `api/feedback.ts:21`, `api/transcription.ts:46`, `api/telegram/connect.ts:25`  
**Evidence:** All three files define the identical function:
```ts
function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
```
Every API route independently declares the same utility. If you ever need to add CORS headers, content-length, or error wrapping, you'll need to change 3 files.  
**Fix:** Extract to `api/shared/httpUtils.ts` and import in all API routes.  
**What you gain:** Single place to add cross-cutting HTTP response logic.

---

### HIGH-2: `readJsonBody` duplicated in 2 API files with no size limit

**Files:** `api/feedback.ts:11-19`, `api/telegram/connect.ts:15-22`  
**Evidence:** Identical implementations — both stream the full request body with no size limit, `Buffer.concat`, and `JSON.parse`. Neither has a return type annotation (implicit `any`). Meanwhile, `api/transcription.ts` has its own `readBody` with a `MAX_AUDIO_BYTES` limit — the right approach, but a different API.  
**Impact:** Two independent copies that each need the same security fix (body size limit). A bug fix to one doesn't fix the other.  
**Fix:** Extract to a shared `readJsonBody(req, { maxBytes })` in `api/shared/httpUtils.ts` with explicit `Promise<Record<string, unknown>>` return type and a size limit.  
**What you gain:** One place to enforce body size limits and typing.

---

### HIGH-3: Error message extraction — 4+ divergent patterns across the codebase

**Evidence:** The codebase extracts error messages in at least 4 different ways:

| Pattern | Files | Example |
|---------|-------|---------|
| `getErrorMessage(error)` | `useSession.ts:23` | Local helper: `String((error as { message?: unknown }).message)` or `String(error)` |
| `String((error as { message?: unknown }).message)` | `transcription.ts:189`, `StatsPage.tsx:194` | Inline version of the same logic |
| `error instanceof Error ? error.message : String(error)` | `aiFeedback.ts:37,123`, `groq.ts:204`, `router.ts:358`, `voiceHandler.ts:879` | Standard pattern, used in 4 files |
| `error as { code?: string; message?: string }` | `session.ts:90`, `queries.ts:126`, `voiceHandler.ts:164,402`, `challenges.ts:72` | For Supabase/Telegram error objects, used in 5 locations |

**Impact:** Inconsistent error handling. The `getErrorMessage` helper in `useSession.ts` only serves that one file. The `error as { code?; message? }` pattern is repeated 5 times without a shared type guard. If you add structured error logging, you'd need to touch 10+ files.  
**Fix:** Create a shared `extractErrorMessage(error: unknown): string` in `src/lib/core/utils.ts` and a `isSupabaseError(error): error is { code: string; message: string }` type guard in `src/lib/core/session.ts`.  
**What you gain:** Consistent error handling, one place to enhance error reporting.

---

## Naming Inconsistencies

### HIGH-4: `hesitationCount` vs `pauseCount` — two names for the same concept

**Files:** `speechTypes.ts:9`, `types.ts:19-20`, `useScoring.ts:42-104`, `useSession.ts:50-51`, `ResultPanel.tsx:82`  
**Evidence:** The audio state machine produces `hesitationCount` (via `micStateMachine.ts`). This is the count used by `calculateFlowScore()`. But the `SessionResult` type declares *both*:
```ts
hesitationCount: number;
pauseCount?: number | null;
```
`useScoring.ts:103-104` sets both to the same value:
```ts
hesitationCount,
pauseCount: hesitationCount,
```
`useSession.ts:50-51` writes both to Supabase:
```ts
pauses: sessionResult.hesitationCount,
pauseCount: sessionResult.pauseCount ?? sessionResult.hesitationCount,
```
`ResultPanel.tsx:82` reads with a fallback chain: `lastResults.pauseCount ?? lastResults.hesitationCount ?? 0`.  

The two names refer to the same underlying count but create confusion about whether they could differ. The Telegram path uses "pauses" / "pause_count" exclusively.  
**Fix:** Standardize on one name. `pauseCount` aligns with the DB column `pause_count` and user-facing "Pause units" label. Keep `hesitationCount` as an internal name in the audio state machine only, and map it to `pauseCount` at the boundary.  
**What you gain:** One name for one concept. No more fallback chains.

---

### MEDIUM-1: "Fluency" label in score breakdown vs "Flow Score" everywhere else

**File:** `ResultPanel.tsx:126`  
**Evidence:** `Fluency {lastResults.baseFlowScore} + Speech Quality {lastResults.aiScore}` — the score breakdown tooltip uses "Fluency" as the label for the base Flow Score component. Every other reference in the app, Telegram bot, help page, SEO tags, and marketing copy uses "Flow Score".  
**Impact:** Users might not connect "Fluency" in the breakdown with "Flow Score" in the heading. Minor brand inconsistency.  
**Fix:** Change to `Flow Score {baseFlowScore} + Speech Quality {aiScore}` or `Base Score {baseFlowScore} + AI Bonus {aiScore}`.

---

### MEDIUM-2: `pauses` column vs `pause_count` column — two DB columns for the same thing

**File:** `useSession.ts:50-51`, `session.ts:111-112`  
**Evidence:** The session save writes to both `pauses` and `pause_count`:
```ts
pauses: sessionResult.hesitationCount,
pauseCount: sessionResult.pauseCount ?? sessionResult.hesitationCount,
```
In the DB, `pauses` is the original column and `pause_count` was added later as a cleaner name. Both store the same integer. Reads use `pause_count` where available, falling back to `pauses`.  
**Impact:** Every query must decide which column to read. The fallback chain propagates through multiple stats queries.  
**Fix:** Migrate to use `pause_count` only. Drop `pauses` column after confirming no reads depend on it.  
**What you gain:** Simpler queries, no column ambiguity.

---

## Separation of Concerns

### HIGH-5: `practiceApi.ts` is two modules in one file — HTTP API client + Supabase query layer

**File:** `src/lib/practiceApi.ts` (371 lines)  
**Evidence:** This file contains two distinct responsibilities:

1. **HTTP API client** (lines 107-186): `transcribeAudio()` and `analyzeSpeech()` build `fetch` requests to `/api/transcription` and `/api/feedback`, handle auth headers, parse responses.
2. **Supabase query layer** (lines 31-106, 190-371): `getBestSessionSummary()`, `saveSession()`, `updateSession()`, `updateStreak()`, `getPracticeStats()`, `getWeeklyActivityDays()`, `getWeeklyStatsComparison()` — direct Supabase `.from().select()` queries using the browser client.

These are different layers with different concerns, dependencies, and error modes. The file imports both `browserSupabase` (for DB queries) and uses `fetch()` (for API calls).  
**Impact:** Testing, refactoring, and debugging are harder because you can't reason about the DB layer without also loading the HTTP layer. The file is the largest non-Telegram file in `src/lib/`.  
**Fix:** Split into `practiceApi.ts` (HTTP calls to `/api/*`) and `practiceQueries.ts` (Supabase browser queries). Or keep the file but clearly delineate sections with `// --- HTTP API ---` and `// --- Database Queries ---`.  
**What you gain:** Clearer module boundaries, easier testing.

---

### MEDIUM-3: `voiceHandler.ts` is a 900+ line monolith

**File:** `src/lib/telegram/voiceHandler.ts` (~900 lines)  
**Evidence:** This file handles:
- Voice message download and transcription (lines 457-690)
- Pause detection from word timestamps (lines 275-327)
- Session saving and streak updating (lines 328-355)
- Score card message formatting and sending (lines 356-392)
- AI feedback generation and reply (lines 798-890)
- Friend challenge result handling (lines 692-755)
- Group challenge result posting (lines 756-796)
- Telegram-specific session querying (lines 393-445)
- Various utility functions (50+ lines)

**Impact:** High cognitive load for any change. A bug in score formatting requires understanding the full 900-line context. Functions are tightly interleaved (e.g., `handleVoiceMessage` is 200+ lines with inline logic).  
**Fix:** Extract into focused modules: `telegramTranscription.ts`, `telegramScoring.ts`, `telegramChallengeResults.ts`. Keep `voiceHandler.ts` as the orchestrator that calls them.  
**What you gain:** Smaller files, testable units, clearer ownership.

---

### MEDIUM-4: `SupabaseLike` and `SupabaseRpcLike` — two ad-hoc interfaces instead of proper typing

**Files:** `session.ts:28-30` (`SupabaseLike`), `queries.ts:79-84` (`SupabaseRpcLike`)  
**Evidence:** The codebase defines two minimal interfaces to abstract over the Supabase client:
- `SupabaseLike = { from(table: string): ... }` — used by `insertSession`, `updateStreak`
- `SupabaseRpcLike = { rpc(name: string, params: object): ... }` — used by `getPracticeStatsFromRpc`

Both are consumed via `as unknown as SupabaseLike` double-casts. This was originally designed to support both browser and server Supabase clients, but the double-cast means neither interface actually validates compatibility.  
**Impact:** The interfaces give a false sense of abstraction — they don't enforce anything the compiler checks. If Supabase SDK changes `.from()` signature, the cast hides the breakage.  
**Fix:** Use the actual Supabase `SupabaseClient` type (or `Pick<SupabaseClient, 'from'>`) and pass the correctly-typed client. Or generate types with `supabase gen types` and use `Database`-parameterized clients.  
**What you gain:** Real type safety instead of ceremony that looks safe but isn't.

---

## Dead Abstractions

### MEDIUM-5: Multi-mode infrastructure for a single-mode app

**Files:** `modes.ts`, `StatsPage.tsx:29-34`, `queries.ts:295-300`  
**Evidence:** The app standardized on a single mode (`"speaking"`) but retains:
- `normalizeMode()` — always returns `"speaking"`
- `normalizeSessionMode()` — always returns `"speaking"`
- `VALID_MODES = ["speaking"]`
- `PracticeMode` type alias for `"speaking"` literal
- `MODE_LABELS = { speaking: "Speaking Mode" }`
- `getModeLabel()` in StatsPage — has branching for modes that can never exist
- `groupSessionsByMode()` in queries — groups sessions by mode that's always the same

**Impact:** ~50 lines of code that processes a value that never varies. It's conceptually misleading — new developers might think multi-mode is supported or planned.  
**Fix:** Remove `normalizeMode` and `normalizeSessionMode` calls (replace with `"speaking"` literal). Remove `VALID_MODES`, `PracticeMode`, `MODE_LABELS`. Simplify `getModeLabel` to return `"Speaking Mode"`.  
**What you gain:** ~50 fewer lines, no misleading abstractions.

---

### LOW-1: `formatMMSS` wrapper adds zero value

**File:** `features/practice/pages/time.ts:6-8`  
**Evidence:** `export const formatMMSS = (seconds: number) => { return formatDuration(seconds); }` — a one-line wrapper that delegates entirely to `formatDuration`. `ResultPanel.tsx` imports `formatMMSS` when it could import `formatDuration` directly.  
**Fix:** Replace `formatMMSS` imports with `formatDuration` and delete `time.ts`.

---

### LOW-2: `renderDurationText` and `renderClockDuration` in ResultPanel

**File:** `ResultPanel.tsx:51-57`  
**Evidence:** `renderDurationText` calls `formatMMSS` (→ `formatDuration`). `renderClockDuration` reimplements MM:SS formatting inline. Both exist in the same component.  
**Fix:** Use one approach. Delete the unused one.

---

## Module Boundary Issues

### MEDIUM-6: `practiceApi.ts` directly queries Supabase from the browser

**File:** `src/lib/practiceApi.ts:25-30`  
**Evidence:** `const sessionSupabase: SupabaseLike = browserSupabase as unknown as SupabaseLike` — then uses it for `insertSession`, `updateSession`, `updateStreak`, and all stats queries. This means session writes go directly from the browser to Supabase via the anon key + RLS.  
**Contrast:** Transcription and feedback go through API routes (`POST /api/transcription`, `POST /api/feedback`), which use the service-role key.  
**Impact:** Two different write paths for session data:
- Web: browser → Supabase directly (anon key, RLS enforced)
- Telegram: webhook → server-side → Supabase (service-role key, RLS bypassed)

This works correctly because RLS is set up, but it means session-write logic isn't centralized. A change to session validation logic needs to be made in both paths.  
**Fix:** Consider routing web session saves through an API route (`POST /api/session`) for consistency. Or accept the split but document it explicitly.  
**What you gain:** Consistent write path, centralized validation.

---

### MEDIUM-7: `src/lib/core/` is half-browser, half-server

**Files:** `src/lib/core/user.ts`, `src/lib/core/session.ts`, `src/lib/core/queries.ts`  
**Evidence:** Files under `src/lib/core/` are included in `tsconfig.node.json` (server, `strict: true`). But they're also imported by `src/lib/practiceApi.ts` (browser). This works because Vite resolves them at build time, but it means:
- `user.ts` imports `supabaseServer` (server-only) — this is correctly server-only
- `session.ts` and `queries.ts` are shared between browser and server (via `SupabaseLike`)
- The same directory has both server-only and shared files with no naming convention to distinguish them

**Impact:** A developer might accidentally import `user.ts` in a browser file, which would import `supabaseServer` and leak the service-role key.  
**Fix:** Either split `src/lib/core/` into `src/lib/core/shared/` and `src/lib/core/server/`, or add a naming convention (e.g., `user.server.ts`).  
**What you gain:** Import-time safety against server-client boundary violations.

---

## Test Coverage Gaps

### LOW-3: No integration tests for API routes

**Files:** `api/feedback.ts`, `api/transcription.ts`, `api/telegram/webhook.ts`, `api/telegram/connect.ts`  
**Evidence:** Test files found: `scoring.test.ts`, `session.test.ts`, `time.test.ts`, `voiceHandler.test.ts`, `constants.test.ts`, `speechSession.test.ts`, `useRecordingController.test.ts`, `architecture.test.ts`, `utils.test.ts`. None of the API route handlers have test files.  
**Impact:** The 4 API routes — the security boundary of the app — have no automated tests. Auth header validation, body parsing, error responses, and quota enforcement are untested.  
**Fix:** Add integration tests for each API route using a test server or mocked `IncomingMessage`/`ServerResponse`.

---

### LOW-4: `architecture.test.ts` exists but scope unknown

**File:** `src/test/architecture.test.ts`  
**Evidence:** An architecture test file exists that imports `SupabaseLike`. This suggests there are some structural tests, but the scope is unclear from the filename alone.  
**Impact:** Positive signal — some architecture validation exists.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 5 | `sendJson` ×3, `readJsonBody` ×2, 4+ error patterns, hesitation/pause naming split, practiceApi dual responsibility |
| **MEDIUM** | 7 | "Fluency" vs "Flow Score", dual DB columns, voiceHandler monolith, SupabaseLike ceremony, dead mode infrastructure, browser-direct writes, core/ mixed boundaries |
| **LOW** | 4 | formatMMSS wrapper, duplicate duration renderers, no API route tests, architecture test |

**Priority fix order:** HIGH-1+HIGH-2 (extract shared API utils) → HIGH-4 (standardize pause naming) → HIGH-3 (shared error extraction) → HIGH-5 (split practiceApi) → MEDIUM-5 (remove dead mode infrastructure) → MEDIUM-3 (split voiceHandler)
