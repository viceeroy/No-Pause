# Audit #1: Dead Code & Unused Exports

**Date:** 2026-05-24  
**Scope:** Unused exports, unused imports, unreachable code, commented-out code, always-one-value flags, files unreached from entry points

---

## Unused Exports

### HIGH — Unused exported functions and types (never imported anywhere)

| Export | File | Evidence | Confidence |
|--------|------|----------|------------|
| `getScoreLabel()` | `scoring.ts:72` | Defines 5 score labels ("Perfect Flow", "Great Flow", etc.) but is never called in any file. The web UI and Telegram bot both display the raw numeric score, never the label. | **High** |
| `analyzePracticeSpeech()` | `aiFeedback.ts:87` | Exported but never imported. The feedback endpoint (`api/feedback.ts`) calls `scoreSpeechQuality()` instead. This function builds a detailed prompt with flow score, hesitation count, speaking time, and word count — it's likely a predecessor of the current feedback flow. | **High** |
| `AiScoreResult` type | `aiFeedback.ts:4` | Type exported but never imported externally. Only used within `aiFeedback.ts` itself. | **High** |
| `VALID_MODES` | `modes.ts:3` | Exported array `["speaking"]` but never imported. | **High** |
| `PracticeMode` type | `modes.ts:1` | Exported type alias for `"speaking"` literal — never imported outside `modes.ts`. `MODE_LABELS` key type uses it implicitly via the `Record` but external code never references `PracticeMode`. | **High** |
| `ModeBreakdown` type | `queries.ts:57` | Exported type alias never imported. | **High** |
| `Base64TranscriptionInput` type | `practiceApi.ts:64` | Exported type never imported externally — only used as parameter type for `transcribeAudio()` within the same file. | **Medium** |
| `TranscriptionResult` type | `practiceApi.ts:71` | Exported type never imported — only used as return type of `transcribeAudio()`. | **Medium** |
| `FeedbackResult` type | `practiceApi.ts:144` | Exported type never imported — only used as return type of `analyzeSpeech()`. | **Medium** |

---

### MEDIUM — Unused re-exports

| Re-export | File | Evidence | Confidence |
|-----------|------|----------|------------|
| `SessionRecord` | `practiceApi.ts:23` | Re-exported from `core/queries` via practiceApi, but consumers import directly from `@/lib/practiceApi`. Only `StatsPage.tsx` actually uses types from practiceApi. | **Medium** — may be used dynamically or intended for future consumers |
| `WeeklyActivityDay` | `practiceApi.ts:23` | Re-exported but `StatsPage.tsx` imports it from `@/lib/practiceApi` (line 9). So it IS used. | Not dead |
| `WeeklyStatsComparison` | `practiceApi.ts:23` | Same — imported by `StatsPage.tsx` (line 10). | Not dead |

---

## Dead Parameters

### MEDIUM-1: `FlowScoreOptions.hasSpeechEvidence` never read

**File:** `scoring.ts:9`  
**Evidence:** Declared in the `FlowScoreOptions` interface, passed by `voiceHandler.ts:242`, but `calculateFlowScore` never reads it. Pure dead interface member.  
**Fix:** Remove from interface and call sites.

---

## Always-One-Value Code

### MEDIUM-2: `normalizeMode()` always returns `"speaking"` — the branching is dead

**File:** `modes.ts:9-11`  
**Evidence:** `export function normalizeMode(mode: string): PracticeMode { void mode; return "speaking"; }`. The function ignores its input entirely. Similarly, `session.ts:68-71` has `normalizeSessionMode` which does the same: `void mode; return "speaking"`.  
**Impact:** Every call to `normalizeMode()` or `normalizeSessionMode()` is a no-op. The `mode` parameter is accepted, validated, and then discarded. All mode-related branching in `StatsPage.tsx:29-34` (`getModeLabel`) and `queries.ts:295-300` (`groupSessionsByMode`) processes a value that's always `"speaking"`.  
**Note:** This is by design — the owner has standardized on a single mode. But the code still carries the multi-mode infrastructure (mode breakdown stats, mode labels, mode grouping) which is all dead.

---

### MEDIUM-3: `MODE_LABELS` has exactly one entry

**File:** `modes.ts:5-7`  
**Evidence:** `MODE_LABELS = { speaking: "Speaking Mode" }`. Used by `StatsPage.tsx:34`: `MODE_LABELS[normalizeMode(normalizedMode)]` — but `normalizeMode` always returns `"speaking"`, so this is equivalent to the string literal `"Speaking Mode"`.

---

## Wrapper Functions That Add No Value

### LOW-1: `formatMMSS` is a pass-through wrapper for `formatDuration`

**File:** `features/practice/pages/time.ts:6-8`  
**Evidence:** `export const formatMMSS = (seconds: number) => { return formatDuration(seconds); }`. The entire file is a one-line wrapper. `ResultPanel.tsx` imports `formatMMSS` when it could import `formatDuration` directly.

---

### LOW-2: `renderDurationText` and `renderClockDuration` duplicate in ResultPanel

**File:** `ResultPanel.tsx:51-57`  
**Evidence:** `renderDurationText` delegates to `formatMMSS` which delegates to `formatDuration`. `renderClockDuration` reimplements the same MM:SS logic inline with zero-padded format. Two functions in the same component doing the same thing with different formatting.  
**Impact:** Confusion about which to use. Both are defined inside the component on every render.

---

## Unused Dependencies (package.json)

### HIGH-1: 16 Radix UI packages installed but never imported

**File:** `package.json`  
**Evidence:** (Detailed in performance audit) — `@radix-ui/react-aspect-ratio`, `react-avatar`, `react-checkbox`, `react-collapsible`, `react-context-menu`, `react-dropdown-menu`, `react-hover-card`, `react-label`, `react-menubar`, `react-navigation-menu`, `react-progress`, `react-radio-group`, `react-scroll-area`, `react-separator`, `react-toggle`, `react-toggle-group`. Zero imports in `src/`.  
**Confidence:** **High** — verified by grepping all `.ts`/`.tsx` files.

---

## Unreachable Code

### LOW-3: `StatsPage.getModeLabel` multi-mode branching is dead

**File:** `StatsPage.tsx:29-34`  
**Evidence:**
```ts
if (normalizedMode === 'speaking' || normalizedMode === 'free' || normalizedMode === 'free_speaking') {
  return 'Speaking Mode';
}
return MODE_LABELS[normalizeMode(normalizedMode)];
```
Since `normalizedMode` can only ever be `"speaking"` (that's the only value stored in the DB after normalization), the `if` branch always matches. The `return MODE_LABELS[...]` line is unreachable.

---

### LOW-4: `buildLegacySessionInsertValues` — legacy fallback path

**File:** `session.ts:125-136`  
**Evidence:** Builds a session insert object without newer columns (`pause_count`, `total_silence_time`, etc.) for databases that haven't been migrated. This is a migration compatibility shim. Once all environments have the new columns, this function and its call path (lines 179-192 of `insertSession`) are dead.  
**Confidence:** **Low** — may still be needed if there are un-migrated environments.

---

### LOW-5: Legacy session column fallback chains throughout practiceApi.ts

**File:** `practiceApi.ts:43-56, 306-327`, `queries.ts:104-117`  
**Evidence:** The codebase has a pattern of trying modern columns first, catching `isMissingSessionAnalysisColumnError`, then retrying with legacy columns. This exists in `getBestSessionSummary`, `getPracticeStats`, `getWeeklyStatsComparison`, and `getTelegramSessions`. Once all environments are migrated, ~60 lines of fallback code across these files become dead.  
**Confidence:** **Low** — depends on migration status.

---

## Commented-Out Code

**Finding:** No significant commented-out code blocks found. The codebase is clean of legacy commented code.

---

## Summary

| Category | Count | Confidence |
|----------|-------|------------|
| **Unused exports (functions/types)** | 9 | High: 6, Medium: 3 |
| **Dead parameters** | 1 | High |
| **Always-one-value code** | 2 | High (by design) |
| **Wrapper functions** | 2 | High |
| **Unused npm dependencies** | 16 | High |
| **Unreachable code** | 3 | Low-Medium |

**Priority fix order:** HIGH-1 (remove 16 unused Radix packages) → `getScoreLabel` removal → `analyzePracticeSpeech` removal → `hasSpeechEvidence` cleanup → `formatMMSS` wrapper removal → legacy fallback cleanup (when migration confirmed)
