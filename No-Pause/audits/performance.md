# Audit #6: Performance

**Date:** 2026-05-24  
**Scope:** Component re-renders, Supabase query efficiency, main thread work during recording, bundle size, dependencies, and PWA asset optimization

---

## Rendering & React Performance

### HIGH-1: Confetti component triggers 80 re-renders per animation frame via `setState`

**File:** `shared/components/Confetti.tsx:54`  
**Evidence:** `setParticles(prev => prev.map(...))` inside a `requestAnimationFrame` loop. Each frame maps over 80 particle objects, creates 80 new objects, triggers a React re-render, and diffs 80 DOM nodes. This runs at ~60fps — that's 60 React re-renders per second, each diffing 80 inline-style `<div>` elements.  
**Impact:** Visible jank on low-end mobile devices when the confetti triggers (score >= 200). Each frame allocates ~80 objects for GC.  
**Fix:** Use a `<canvas>` (like VoiceVisualizer does) or a CSS-only animation. Draw particles directly to canvas without React state.

---

### HIGH-2: VoiceVisualizer creates a new `createLinearGradient` per bar per frame

**File:** `VoiceVisualizer.tsx:117`  
**Evidence:** Inside the `animate` function (running at 60fps), for each of the 32 bars: `const gradient = ctx.createLinearGradient(x, y, x, y + height)`. That's 32 gradient objects created per frame, 1920 per second. Each gradient also has 2-3 `addColorStop` calls.  
**Impact:** Measurable on low-end Android devices. `createLinearGradient` allocates a native canvas resource.  
**Fix:** Pre-create a set of gradients (e.g., one for each intensity bucket) and reuse them. Or use solid fills with opacity — the gradient is subtle and may not be perceptible.

---

### MEDIUM-1: `DashboardPage` fetches up to 1000 sessions on every mount

**File:** `DashboardPage.tsx:57`  
**Evidence:** `getPracticeStats(user?.id ?? null, 1000)`. The `limit` parameter (1000) is passed to the RPC call which fetches up to 1000 recent sessions from Supabase. The dashboard only shows aggregate stats (best score, avg score, total time, streak) — it doesn't list individual sessions.  
**Impact:** For a user with 1000 sessions, this fetches ~1000 rows with all `SESSION_SUMMARY_COLUMNS` (13 columns including `hesitation_log` which is a JSON array). This is a heavy query for a page that only needs aggregates.  
**Contrast:** `StatsPage` passes `limit=15`, which is appropriate.  
**Fix:** Pass `limit=1` (only for the RPC) since the dashboard uses aggregate stats from the RPC, not individual sessions. Or better: add a separate lightweight RPC that only returns aggregate stats.

---

### MEDIUM-2: `getPracticeStats` makes 3 parallel Supabase queries when RPC is unavailable

**File:** `practiceApi.ts:277-298`  
**Evidence:** When `getPracticeStatsFromRpc` returns null (RPC not available or missing), the fallback path fires 3 parallel queries:
1. ALL sessions for the user (`allTimeSessions`) — no limit
2. Recent sessions with limit
3. Streak data  
The ALL sessions query (no limit) fetches every session the user has ever created.  
**Impact:** O(n) in total sessions for the fallback path. For an active user with 500+ sessions, this is a significant payload.  
**Fix:** The RPC-first path is already the optimization. Ensure the RPC always exists in production. If the fallback must stay, add a reasonable limit.

---

### MEDIUM-3: `AudioCapture.analyze()` runs on main thread via `requestAnimationFrame`

**File:** `audioCapture.ts:395-427`  
**Evidence:** The `analyze()` method runs in `requestAnimationFrame`, computing RMS, max sample, and frequency energy from a 1024-element `Float32Array`. The loop at lines 410-414 iterates 1024 elements per frame. Then it calls `getByteFrequencyData` (line 424-426) and reduces 12 elements.  
**Impact:** Low — the computation is lightweight (~1024 multiplications + additions). But it shares the main thread with React rendering, which can cause frame drops if React is doing a heavy re-render simultaneously (e.g., the Confetti animation at score display).  
**Fix:** Acceptable as-is for the audio analysis. But consider using an `AudioWorklet` for production-grade audio processing if you ever need higher precision or more computation.

---

### MEDIUM-4: `volumeSamples` array grows and gets sliced every frame

**File:** `audioCapture.ts:420-421`  
**Evidence:**
```ts
this.volumeSamples.push(rms);
if (this.volumeSamples.length > SMOOTHING_WINDOW) this.volumeSamples = this.volumeSamples.slice(-SMOOTHING_WINDOW);
```
`Array.slice()` creates a new array every time the smoothing window is exceeded. At 60fps with `SMOOTHING_WINDOW` of ~5, this creates a new 5-element array every frame after the first 5 frames.  
**Impact:** Low — 5-element arrays are tiny. But it's unnecessary GC churn.  
**Fix:** Use a ring buffer (fixed-size array + write index) instead of push+slice.

---

## Bundle & Dependencies

### HIGH-3: 16 unused Radix UI packages in dependencies

**File:** `package.json`  
**Evidence:** The following `@radix-ui` packages are installed but never imported anywhere in `src/`:
- `@radix-ui/react-aspect-ratio`
- `@radix-ui/react-avatar`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-collapsible`
- `@radix-ui/react-context-menu`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-hover-card`
- `@radix-ui/react-label`
- `@radix-ui/react-menubar`
- `@radix-ui/react-navigation-menu`
- `@radix-ui/react-progress`
- `@radix-ui/react-radio-group`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-separator`
- `@radix-ui/react-toggle`
- `@radix-ui/react-toggle-group`

Only `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, and `@radix-ui/react-slot` are actually used (via `src/shared/components/ui/`).  
**Impact:** These don't affect bundle size (tree-shaking removes unused packages) but they bloat `node_modules` (~50MB+), slow down `npm install`, and create unnecessary audit surface.  
**Fix:** `npm uninstall @radix-ui/react-aspect-ratio @radix-ui/react-avatar ...` (all 16).

---

### MEDIUM-5: `telegraf` bundled as dependency but only used server-side

**File:** `package.json`  
**Evidence:** `"telegraf": "^4.16.3"` is in `dependencies` (not `devDependencies`). Telegraf is a 300KB+ Node.js library only used in `api/telegram/webhook.ts` and `src/lib/telegram/router.ts`. Vite's tree-shaking should exclude it from the browser bundle since it's only imported in files under `tsconfig.node.json`, but it depends on how Vite resolves dynamic imports.  
**Impact:** If tree-shaking fails (e.g., due to side effects), Telegraf and its transitive dependencies (which include Node.js crypto, http, https) could end up in the browser bundle. The old build artifact shows a separate `vendor` chunk but current behavior should be verified.  
**Fix:** Move to `devDependencies` or mark as external in `vite.config.ts`: `build.rollupOptions.external: ['telegraf']`.

---

### MEDIUM-6: `@sentry/react` imported unconditionally in `instrument.ts`

**File:** `src/instrument.ts:1`  
**Evidence:** `import * as Sentry from "@sentry/react"`. Sentry's React SDK is ~50-80KB gzipped. It's imported at the top level with `browserTracingIntegration()`, which means the full Sentry bundle loads on every page load, including for users who never trigger an error.  
**Impact:** Added latency on initial page load, especially on mobile.  
**Fix:** Use Sentry's lazy loading: `import("@sentry/react").then(Sentry => Sentry.init(...))`. Or use the Sentry Vite plugin which handles code splitting automatically.

---

### LOW-1: `react-markdown` imported synchronously in `ResultPanel`

**File:** `ResultPanel.tsx:4`  
**Evidence:** `import ReactMarkdown from 'react-markdown'`. react-markdown + remark ecosystem is ~30-40KB gzipped. It's imported at the top of `ResultPanel`, which is part of the `practice` chunk. Every user who goes to the practice page loads the markdown parser, even before they finish a session and see feedback.  
**Impact:** Low — the `practice` chunk includes it regardless, and Vite's code splitting already separates it from the initial page load. But it could be lazy-loaded.  
**Fix:** Use `React.lazy(() => import('react-markdown'))` with a fallback. Or just render the feedback as plain text (it's usually short prose, rarely uses markdown features).

---

### LOW-2: Stale build artifacts in `dist/` reference old Clerk/Convex dependencies

**File:** `dist/assets/clerk-C9_g8stu.js` (223KB), `dist/assets/convex-DPus2utA.js` (74KB)  
**Evidence:** The `dist/` directory contains build artifacts from an older version of the app that used Clerk and Convex. These are 300KB of dead code sitting in the repo.  
**Impact:** No production impact (Vercel builds fresh), but confusing for developers and inflates git repo size.  
**Fix:** Add `dist/` to `.gitignore` and delete the tracked `dist/` directory.

---

## Supabase Query Efficiency

### MEDIUM-7: `SESSION_SUMMARY_COLUMNS` includes `hesitation_log` for stats queries

**File:** `practiceApi.ts:27`  
**Evidence:** `SESSION_SUMMARY_COLUMNS` includes `hesitation_log` — a JSON array of pause events that can be several KB per session. This column is fetched in `getPracticeStats` (which fetches up to 1000 sessions), `getWeeklyStatsComparison`, and `getBestSessionSummary`. None of these callers use `hesitation_log`.  
**Impact:** Wasted bandwidth and Supabase response parsing time, proportional to session count. For 100 sessions with 10 pauses each, that's ~100KB of unused JSON.  
**Fix:** Create a separate `SESSION_STATS_COLUMNS` constant without `hesitation_log` for stats queries. Only include `hesitation_log` when displaying individual session details.

---

### LOW-3: `getWeeklyActivityDays` fetches full `created_at` rows instead of using count

**File:** `practiceApi.ts:358-365`  
**Evidence:** `.select("created_at")` for all completed sessions in the last week. Then client-side groups them by date. A more efficient query would use `.select("created_at::date", { count: 'exact' })` or a group-by at the DB level.  
**Impact:** Low — weekly sessions are typically <50 rows.

---

## Main Thread During Recording

### MEDIUM-8: RMS computation, diagnostics logging, and React state updates share main thread during recording

**Files:** `audioCapture.ts:395-427`, `speechSession.ts`, `useRecording.ts`  
**Evidence:** The recording pipeline runs entirely on the main thread:
1. `requestAnimationFrame` → `analyze()` computes RMS from 1024 samples
2. `onFrame` callback → `SpeechSession.handleFrame()` → `micStateMachine.applyMicStateFrame()`
3. State machine updates → callbacks to React components via `setAudioData`
4. VoiceVisualizer re-renders with new frequency data

All of this happens in the same frame budget (16.6ms at 60fps). If a heavy React update coincides with audio analysis, audio frames can be delayed.  
**Impact:** The `analyzeInterval` (line 398: throttle check) mitigates this — analysis only runs every N ms. But on underpowered devices, frame drops during recording can cause missed audio analysis windows, leading to inaccurate pause detection.  
**Fix:** For now, acceptable. If accuracy issues arise on low-end devices, move RMS computation to an AudioWorklet.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 3 | Confetti state-driven animation, per-frame gradient allocation, 16 unused Radix packages |
| **MEDIUM** | 8 | 1000-session fetch on dashboard, fallback queries, Sentry unconditional import, hesitation_log in stats queries, main thread audio processing |
| **LOW** | 3 | react-markdown eager loading, stale dist artifacts, weekly query efficiency |

**Priority fix order:** HIGH-3 (remove unused Radix — npm uninstall) → MEDIUM-1 (DashboardPage limit) → MEDIUM-7 (remove hesitation_log from stats columns) → HIGH-1 (Confetti canvas rewrite) → MEDIUM-6 (Sentry lazy loading) → HIGH-2 (VoiceVisualizer gradient caching)
