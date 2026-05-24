# Audit #8: PWA, Auth, and Service Worker

**Date:** 2026-05-24  
**Scope:** Service worker caching strategy, offline behavior, install prompt flow, OAuth session lifecycle, race conditions between auth state and protected actions

---

## Service Worker

### HIGH-1: Service worker caches stale Vite-hashed assets indefinitely

**File:** `public/sw.js:44-65`  
**Evidence:** The SW uses stale-while-revalidate for core assets (`script`, `style`, `font`, `image`, `/assets/*`):
```js
caches.match(request).then((cached) => {
  const networkFetch = fetch(request)
    .then((response) => { cache.put(request, copy); return response; })
    .catch(() => cached);
  return cached || networkFetch;
});
```
Vite produces content-hashed filenames (e.g., `assets/index-abc123.js`). On a new deploy, the old hash is never requested again — but its cache entry persists forever. Over time, the cache grows unbounded with dead assets.  
**Impact:** Cache storage bloat on user devices, especially mobile where storage is limited. No correctness issue since hashed URLs are unique.  
**Fix:** Add cache eviction: on activate, delete entries that don't match the current APP_SHELL list. Or switch to a max-age/max-entries policy for asset caching.

---

### HIGH-2: Navigation requests use network-first but don't handle partial/corrupt responses

**File:** `public/sw.js:31-41`  
**Evidence:** For navigation requests, the SW fetches from network and caches the response:
```js
fetch(request)
  .then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  })
  .catch(async () => (await caches.match(request)) || (await caches.match("/index.html")))
```
The response is cached without checking `response.ok`. If the server returns a 500 or a Vercel error page, it gets cached as the app shell — subsequent offline loads serve the error page instead of the real app.  
**Impact:** A single server error poisons the cache until the user forces a refresh or the SW version changes.  
**Fix:** Only cache if `response.ok`: `if (response.ok) { cache.put(...) }`.

---

### MEDIUM-1: No versioned asset precaching — only 3 files in APP_SHELL

**File:** `public/sw.js:2`  
**Evidence:** `const APP_SHELL = ["/", "/index.html", "/manifest.json"]`. This means only 3 files are precached. The actual app (JS bundles, CSS, fonts) isn't precached — it's loaded on first visit and cached as stale-while-revalidate.  
**Impact:** First offline load after install shows the HTML shell but can't load the JS bundles (no precache), so the app appears blank/broken. The app only works offline if the user has previously loaded it while online (runtime cache).  
**Fix:** Use a Vite PWA plugin (like `vite-plugin-pwa`) that generates a precache manifest from the build output, or manually add Vite-generated asset URLs to APP_SHELL at build time.

---

### MEDIUM-2: `self.skipWaiting()` in install event can break in-flight requests

**File:** `public/sw.js:6`  
**Evidence:** `cache.addAll(APP_SHELL)).then(() => self.skipWaiting())`. Calling `skipWaiting()` immediately after install means the new SW takes control while the old one might still be serving requests. If the new SW has a different CACHE_NAME, it deletes old caches (line 12-14) while the old SW's fetch handlers are still referencing them.  
**Impact:** Race condition window where fetch handlers return undefined from a deleted cache. Mitigated by the fact that the `controllerchange` handler in `ServiceWorkerUpdateContext.tsx:88` reloads the page.  
**Fix:** The current approach (skipWaiting on install + page reload on controllerchange) is a common pattern and works. The only risk is the brief window. Consider moving `skipWaiting()` to only trigger on the `SKIP_WAITING` message (which is already handled at line 19) and removing it from the install event.

---

### LOW-1: Service worker doesn't cache API responses for offline reading

**File:** `public/sw.js:26-29`  
**Evidence:** `if (request.method !== "GET") return;` and `if (url.origin !== self.location.origin) return;`. All API calls (which are POST) and Groq API calls (cross-origin) are not cached.  
**Impact:** Expected behavior — POST requests and API calls should always go to the server. But it means offline mode shows the cached shell with zero data. Stats show `emptyStats` (zeros), practice can't transcribe.  
**Fix:** This is a design choice. If offline experience matters, consider caching GET responses from Supabase for stats display while offline.

---

## PWA Install Flow

### HIGH-3: No iOS PWA meta tags — broken install on iOS Safari

**File:** `index.html`  
**Evidence:** The HTML has `<link rel="manifest" href="/manifest.json">` and `<meta name="theme-color">` but no iOS-specific tags:
- Missing: `<meta name="apple-mobile-web-app-capable" content="yes">`
- Missing: `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- Missing: `<link rel="apple-touch-icon" href="/icon-192.png">`  
**Impact:** On iOS Safari, the app installs but doesn't behave like a standalone app — it opens in Safari with the URL bar. The home screen icon uses a generic screenshot instead of the app icon.  
**Fix:** Add the three missing meta/link tags to `index.html`.

---

### MEDIUM-3: `manifest.json` uses single icon with `purpose: "any maskable"`

**File:** `public/manifest.json:16`  
**Evidence:** `"purpose": "any maskable"` on the 512x512 icon. The `maskable` purpose means the icon should have a "safe zone" with padding, while `any` means it should use the full canvas. These are conflicting — a maskable icon with no padding looks cropped on Android, while an icon designed for maskable with padding looks small as a regular icon.  
**Impact:** Icon appears incorrectly sized on either maskable or non-maskable contexts. Chrome DevTools Lighthouse flags this.  
**Fix:** Provide two separate 512x512 icons: one with `"purpose": "any"` (full bleed) and one with `"purpose": "maskable"` (with safe-zone padding).

---

### LOW-2: `isInstallEligible` is always `true` (Android || iOS || Desktop)

**File:** `useInstallPlatform.ts:37`  
**Evidence:** `isInstallEligible: isAndroid || isIos || isDesktop` — since every device is either Android, iOS, or desktop, this is always `true`. The actual installability depends on browser support (Safari on iOS, Chrome on Android, some Chromium browsers on desktop).  
**Impact:** The install button shows even on browsers that can't install PWAs (Firefox on Android, etc.), but `triggerInstall` gracefully handles missing `deferredPrompt`.

---

## Auth Flow

### HIGH-4: No Supabase session refresh handling during recording

**Files:** `AuthContext.tsx`, `useRecording.ts`, `useSession.ts`  
**Evidence:** Supabase JS client handles token refresh automatically via `onAuthStateChange` (which fires `TOKEN_REFRESHED` events). However, `getAuthHeaders()` in `practiceApi.ts:120-124` calls `supabase.auth.getSession()` which returns the current session — including a potentially expired access token if the refresh hasn't completed yet.  
**Scenario:** User starts a 10-minute recording session. The Supabase access token expires (default: 1 hour, but configurable). When the user taps stop and the app tries to `saveSession` → `updateSession` → `transcribeAudio`, the access token may be stale. The Supabase client refreshes it in the background, but there's a race window where `getSession()` returns the old token.  
**Impact:** Potential 401 on session save or transcription immediately after token refresh. The Supabase JS client mitigates this by proactively refreshing before expiry, but the window exists.  
**Fix:** Use `supabase.auth.getUser()` (which validates the token) instead of `getSession()`, or check for 401 responses and retry after a forced `refreshSession()`.

---

### MEDIUM-4: Auth callback `returnTo` parameter allows `//` prefix

**File:** `App.tsx:126`  
**Evidence:** `const safeReturnTo = returnTo?.startsWith("/") ? returnTo : "/"`. The `AuthCallbackPage.tsx:19` has the same pattern: `nextPath?.startsWith("/") ? nextPath : "/"`. Both allow `//evil.com` which is a protocol-relative URL.  
**Impact:** Already documented in `supabase-security.md` (HIGH-3), but it appears in TWO places — `App.tsx:126` AND `AuthCallbackPage.tsx:19`. Both need the same fix.  
**Fix:** `returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/"`.

---

### MEDIUM-5: OAuth popup close leaves ConnectTelegram in permanent "signing-in" state

**File:** `ConnectTelegram.tsx:54-64`  
**Evidence:** `signInWithOAuth` resolves when the OAuth redirect starts. If the user closes the browser tab or navigates away from the OAuth flow, the `ConnectTelegram` page stays at `"signing-in"` state with a spinning loader and "Opening Google sign-in" text. There's no timeout or fallback.  
**Impact:** User stuck on loading screen. They can refresh, but there's no guidance.  
**Fix:** Add a "Having trouble? Try again" link that appears after 30 seconds, or detect when the user returns to the page without completing OAuth.

---

### MEDIUM-6: No auth state check before protected Supabase operations

**Files:** `practiceApi.ts:190-225`  
**Evidence:** `saveSession`, `updateSession`, and `updateStreak` don't check if the user is authenticated before making Supabase calls. They accept `userId: string | null` and silently skip the operation if `userId` is null (e.g., `insertSession` returns `null` for null userId). But `updateSession` at line 210 also returns early for null userId — so a session save for an unauthenticated user silently produces no error but also no data.  
**Impact:** If auth state is lost mid-session (token expires, user signs out in another tab), the practice results are silently not saved. No error shown to the user.  
**Fix:** Check auth state at the start of the save flow and show an error if the user isn't authenticated.

---

### LOW-3: `onAuthStateChange` can fire before `getSession` resolves

**File:** `AuthContext.tsx:40-53`  
**Evidence:** `getSession()` is called first (line 40), but `onAuthStateChange` subscription is set up synchronously (line 49). If auth state changes between the `getSession` call and its resolution, the `setSession` from `onAuthStateChange` could race with the `setSession` from `getSession`. Both set `isLoading: false`, so the UI renders.  
**Impact:** Benign in practice — React batches state updates and the later setter wins. But theoretically, a user could see a brief flash of the wrong auth state.

---

### LOW-4: App auto-applies SW updates when not on `/practice`

**File:** `App.tsx:89-92`  
**Evidence:**
```ts
if (!hasPendingUpdate || isPractice) return;
void applyUpdateIfAvailable();
```
When a service worker update is available and the user is NOT on the practice page, the app immediately applies the update (which calls `skipWaiting` → `controllerchange` → `window.location.reload()`). The user gets an unexpected page reload on any non-practice page.  
**Impact:** Jarring UX — user is on stats page reviewing their data and the page reloads without warning.  
**Fix:** Show a non-intrusive toast ("Update available — tap to refresh") instead of auto-reloading. Only auto-reload on explicit user action.

---

## Offline Behavior

### HIGH-5: App shows blank/broken state when loaded offline for first time

**Evidence:** The SW only precaches 3 files (`/`, `/index.html`, `/manifest.json`). JS bundles, CSS, fonts, and images are runtime-cached (stale-while-revalidate). If a user installs the PWA via "Add to Home Screen" but has never loaded the app while online, the cached HTML shell loads but the JS bundles fail to load — the app renders a blank white page or partial HTML without interactivity.  
**Impact:** First-launch-offline is a core PWA expectation, especially on mobile. Users who install the app on spotty connections get a broken experience.  
**Fix:** Use build-time precache manifest (Workbox or `vite-plugin-pwa`) to precache all critical assets during SW install.

---

### MEDIUM-7: Recording works offline but save fails silently

**Evidence:** The audio capture, analysis, and scoring all run client-side — they work offline. But `saveFinishedSession` → `insertSession` → Supabase fails when offline. The error is caught at `useSession.ts:69-71` and logged to console, but the user isn't told their session wasn't saved.  
**Impact:** User practices offline, sees their score, navigates away, and the session is lost forever.  
**Fix:** Queue failed saves for retry (e.g., IndexedDB queue that syncs when back online), or show a prominent warning that the session couldn't be saved.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 5 | Stale asset caching, corrupt response caching, missing iOS meta tags, no auth refresh during recording, blank offline first load |
| **MEDIUM** | 7 | No precache manifest, skipWaiting race, maskable icon conflict, OAuth popup stuck state, silent auth loss, auto-reload UX, offline save loss |
| **LOW** | 4 | No API caching for offline, always-true installEligible, auth race condition, auto-update behavior |

**Priority fix order:** HIGH-3 (iOS meta tags — 3 lines added) → HIGH-2 (response.ok check — 1 line) → HIGH-5 + MEDIUM-1 (precache manifest — needs build tooling) → HIGH-4 (auth refresh handling) → MEDIUM-7 (offline save queue) → LOW-4 (update toast instead of auto-reload)
