# Audit #3: Error Handling & Edge Cases

**Date:** 2026-05-24  
**Scope:** Unhandled promise rejections, missing try/catch, swallowed errors, missing UI states, unchecked Supabase responses, and unhandled failure paths

---

## Findings by Severity

### HIGH-1: `saveFinishedSession` failure silently loses the session

**File:** `useSession.ts:69-71`  
**Evidence:** `catch (error) { console.error('Failed to sync session to Supabase:', error); }` — the session save failure is logged but never surfaced to the user. The session is shown in ResultPanel but never persisted. There's no retry mechanism.  
**Failure scenario:** Network blip during save → user sees their score → navigates away → session is lost forever.  
**What should happen:** Show a non-blocking toast ("Session couldn't be saved — retry?") and offer a retry button. Or queue the save for retry.  
**What you gain:** No lost practice data.

---

### HIGH-2: `updateStreak` failure silently ignored in web flow

**File:** `useSession.ts:59-63`  
**Evidence:** `saveSession` and `updateStreak` run in `Promise.all`. If `updateStreak` throws, the entire `Promise.all` rejects, and the catch at line 69 logs it — but the session was already saved successfully. The error message doesn't distinguish which operation failed. The `sessionId` is never set in `setLastResults` because the catch runs before line 65.  
**Impact:** A streak-update failure causes the sessionId to not be recorded in React state, breaking subsequent `updateSession` calls (which need `sessionId`). This means transcription and feedback won't be saved to the correct session row.  
**Fix:** Don't run `saveSession` and `updateStreak` in the same `Promise.all`. Save session first, capture the ID, then update streak separately with its own try/catch.

---

### HIGH-3: No error UI when DashboardPage stats fail to load

**File:** `DashboardPage.tsx:60-62`  
**Evidence:** On error, it silently falls back to `emptyStats` with `console.error`. The user sees zeros everywhere with no indication that something went wrong. Compare with StatsPage (line 349-353) which correctly shows `statsError`.  
**What should happen:** Show an error banner like StatsPage does.  
**What you gain:** Users know their stats aren't loading (instead of thinking they have 0 sessions).

---

### HIGH-4: Telegram voice handler doesn't handle `downloadTelegramVoice` timeout

**File:** `voiceHandler.ts:544`  
**Evidence:** `downloadTelegramVoice(voice.file_id)` has no timeout. If Telegram's file API is slow or hangs, the entire webhook handler blocks indefinitely, potentially hitting Vercel's 10s/30s serverless function timeout.  
**Impact:** Webhook returns 504 → Telegram retries the webhook → potential duplicate processing (mitigated by the dedup check, but still wastes resources).  
**Fix:** Wrap `downloadTelegramVoice` in `withTimeout()` like other async calls in the file.

---

### MEDIUM-1: `readJsonBody` in feedback API doesn't limit body size

**File:** `api/feedback.ts:11-19`  
**Evidence:** `readJsonBody` reads the entire request body with no size limit. An attacker could send a multi-GB JSON payload to exhaust memory.  
**Contrast:** `api/transcription.ts:31-43` correctly limits to `MAX_AUDIO_BYTES`.  
**Fix:** Add a max body size (e.g., 1MB) to `readJsonBody`.

---

### MEDIUM-2: `stopRecording` doesn't handle `saveFinishedSession` rejection

**File:** `useRecording.ts:185-204`  
**Evidence:** `await saveFinishedSession(sessionBuild)` at line 198 — if this throws, the promise rejects but there's no catch. The state is left at `'finishing'` forever. `setState('done')` at line 201 never runs.  
**Impact:** User sees a permanent "Finishing..." state with no way to proceed.  
**Fix:** Wrap in try/catch, set state to 'done' in finally block.

---

### MEDIUM-3: Mic permission denied shows generic error

**File:** `useRecording.ts:310-311`  
**Evidence:** `catch { setTranscriptError('Mic not capturing audio'); }` — when `getUserMedia` throws `NotAllowedError` (permission denied), the user sees a generic "Mic not capturing audio" message instead of "Please allow microphone access in your browser settings."  
**Fix:** Check `error.name === 'NotAllowedError'` and show a specific message.

---

### MEDIUM-4: Browser transcription (`SpeechRecognition`) errors silently ignored

**File:** `transcription.ts` (not fully read but referenced in `speechAnalyzer.ts:82`)  
**Evidence:** `startBrowserRecognition(() => this.isRunning)` — the TranscriptionController's browser speech recognition is fire-and-forget. If the browser's SpeechRecognition API is unavailable or errors, it fails silently. The transcript falls back to Groq Whisper later, which is correct behavior, but there's no indication to the user that live transcription isn't working.  
**Impact:** Low — the fallback works. But users might wonder why they don't see live transcription on unsupported browsers.

---

### MEDIUM-5: `aiFeedback.ts:81` returns hardcoded score 50 on parse failure

**File:** `aiFeedback.ts:81-83`  
**Evidence:** When `scoreSpeechQuality` fails to parse the LLM's JSON response, it returns `{ score: 50, feedback: raw.slice(0, 200) }`. This means a malformed LLM response silently gives every user a +50 AI score bump via `blendWithAiScore`.  
**Impact:** Inflated scores on LLM parsing failures.  
**Fix:** Return `null` or `{ score: 0 }` on parse failure, and handle the null case in callers.

---

### MEDIUM-6: `consumeApiQuota` RPC failure in web path blocks transcription silently

**File:** `api/transcription.ts:169-175`  
**Evidence:** If `consumeApiQuota` throws a non-quota error (e.g., DB connection failure), it falls through to the generic catch at line 194, returning "Transcription failed. Please try again." The user doesn't know it was a quota system failure vs. an actual transcription failure.  
**Impact:** Confusing error message.  
**Fix:** Distinguish quota-system errors from transcription errors in the response.

---

### LOW-1: No handling of expired/invalid auth session during recording

**File:** `useRecording.ts`, `useSession.ts`  
**Evidence:** If the Supabase session expires mid-recording (auth token expires after 1 hour by default), `getAuthHeaders()` returns `{}`, and the subsequent `fetch('/api/transcription')` returns 401. This is caught by `readEndpointJson` which throws, and the transcript shows "Request failed: 401". But the user has no way to re-authenticate without losing their recording results.  
**What should happen:** Detect 401 and prompt re-auth, then retry the transcription.

---

### LOW-2: `handleStart` finally block always sets `micInitializingRef.current = false`

**File:** `useRecording.ts:351`  
**Evidence:** The `finally` block at line 351 sets `micInitializingRef.current = false` even after a successful start. This is actually correct — the flag should be reset. But if `startRecording()` throws, the catch at line 348 sets state to 'setup' while `startRecording`'s own catch at line 278 also sets state to 'setup'. Double state-set is benign but noisy.

---

### LOW-3: `ConnectTelegram.tsx` doesn't handle case where user closes OAuth popup

**File:** `ConnectTelegram.tsx:54-65`  
**Evidence:** `signInWithOAuth` resolves when the OAuth flow starts, not when it completes. If the user closes the popup, the page stays at "Opening Google sign-in..." forever. There's no timeout or fallback.  
**Impact:** User stuck on a loading screen. They can refresh, but there's no guidance.  
**Fix:** Add a timeout or a "Having trouble? Try again" link after 30 seconds.

---

### LOW-4: `AuthCallbackPage` renders `decodeURIComponent(authError)` unsanitized

**File:** `AuthCallbackPage.tsx:33`  
**Evidence:** `{decodeURIComponent(authError)}` — the error is displayed directly from the URL query parameter. While React auto-escapes JSX output (preventing XSS), `decodeURIComponent` could throw on malformed percent-encoding (e.g., `%E0%A4%A`).  
**Fix:** Wrap in try/catch: `try { decodeURIComponent(authError) } catch { authError }`.

---

### LOW-5: Groq API timeout is 20s, but Telegram AI feedback timeout is 25s

**File:** `groq.ts:5` (`GROQ_TIMEOUT_MS = 20_000`) vs `voiceHandler.ts:856` (`25_000`)  
**Evidence:** The `generateAiFeedback` call uses Groq internally with a 20s timeout, but the outer `withTimeout` gives it 25s. The Groq timeout will fire first, so the outer timeout is redundant (but harmless).  
**Impact:** None — just dead code.

---

## UI State Coverage Matrix

| Component | Loading State | Empty State | Error State | Verdict |
|-----------|--------------|-------------|-------------|---------|
| DashboardPage | `...` in metrics | `emptyStats` (zeros) | Silent (console.error) | **Missing error UI** |
| StatsPage | Skeleton cards | Empty state card with CTA | Error banner | **Complete** |
| ResultPanel | N/A (data arrives sync) | Partial (short session note) | Feedback/transcript errors shown | OK |
| RecordingPanel | N/A | N/A | Mic errors shown | OK |
| ConnectTelegram | Spinner states | "Missing" state | Error state | OK (but stale loading) |
| AuthCallbackPage | "Finishing sign-in" | Redirects to /auth | Shows error | OK |

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 4 | Silent session loss, streak failure cascade, missing dashboard error UI, no download timeout |
| **MEDIUM** | 6 | No body size limit on feedback API, stuck "finishing" state, generic mic error, inflated AI score on parse failure |
| **LOW** | 5 | Expired auth mid-session, OAuth popup close, authError decode, redundant timeout |

**Priority fix order:** HIGH-2 (streak failure cascade breaking sessionId) → HIGH-1 (lost sessions) → HIGH-3 (dashboard error UI) → MEDIUM-2 (stuck finishing state) → MEDIUM-5 (inflated scores)
