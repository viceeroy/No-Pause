# Audit #9: Accessibility & UX Edge Cases

**Date:** 2026-05-24  
**Scope:** Missing ARIA attributes, focus management, keyboard navigation, screen reader gaps, color contrast, motion preferences, touch targets, and UX edge cases

---

## Screen Reader & ARIA

### HIGH-1: No `aria-live` region for recording state changes

**Files:** `RecordingPanel.tsx`, `ResultPanel.tsx`, `SetupCountdownPanel.tsx`  
**Evidence:** The practice flow transitions through 5 states: setup → countdown → recording → finishing → done. Each transition renders a completely different panel. Screen readers receive no announcement when the state changes. The only `aria-live` in the practice flow is on `ResultSkeletonPanel.tsx:27` (the loading placeholder).  
**Impact:** A screen reader user starting a recording gets no audible confirmation that recording began. When the countdown appears (a large visual "3... 2... 1..."), screen readers don't announce it. When results appear, there's no announcement.  
**Fix:** Add an `aria-live="assertive"` region that announces state transitions: "Recording started", "3... 2... 1...", "Recording finished. Your Flow Score is 142."  
**What you gain:** Blind users can use the practice feature.

---

### HIGH-2: VoiceVisualizer `<canvas>` has no accessible fallback

**File:** `VoiceVisualizer.tsx:151-155`  
**Evidence:** The canvas element has no `aria-label`, no `role`, and no fallback content:
```tsx
<canvas ref={canvasRef} className="w-full h-full waveform-canvas" style={{ width: '100%', height: '100%' }} />
```
The canvas renders a real-time audio waveform — purely visual information. Screen readers see nothing.  
**Fix:** Add `role="img" aria-label="Audio waveform visualization"` to the canvas. Or add fallback text inside the canvas tag.  
**What you gain:** Screen readers acknowledge the visualization exists.

---

### HIGH-3: Score progress bar has no semantic role or value

**File:** `ResultPanel.tsx:115-117`  
**Evidence:**
```tsx
<div className="h-2.5 overflow-hidden rounded-full bg-surface-elevated">
  <div className="h-full rounded-full bg-primary" style={{ width: `${scoreWidth}%` }} />
</div>
```
This is a visual progress bar showing the flow score out of 500, but it has no `role="progressbar"`, no `aria-valuenow`, `aria-valuemin`, or `aria-valuemax`. Screen readers see an empty div.  
**Fix:** Add `role="progressbar" aria-valuenow={lastResults.flowScore} aria-valuemin={0} aria-valuemax={500} aria-label="Flow Score"` to the outer div.

---

### MEDIUM-1: Dashboard metric cards have no semantic grouping

**File:** `DashboardPage.tsx:182-210`  
**Evidence:** Metric cards (Best Score, Avg Score, Total Time, Streak, Sessions, Weekly Sessions) are rendered as `<article>` elements with icon + label + value. The icon has no `aria-hidden` attribute, so screen readers might try to read the SVG. The cards are in a `grid` div with no `role` or `aria-label`.  
**Fix:** Add `aria-hidden="true"` to all metric card icons. Consider wrapping the grid in a `<section aria-label="Practice statistics">`.

---

### MEDIUM-2: Countdown number has no screen reader announcement

**File:** `SetupCountdownPanel.tsx:163-166`  
**Evidence:**
```tsx
<div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
  <div className="text-9xl font-serif font-bold text-primary animate-in zoom-in duration-300">{countdown}</div>
</div>
```
The countdown (3, 2, 1) is a giant visual number but has no ARIA attributes. It also applies `opacity-30 scale-95 blur-[2px]` to the background content during countdown, which is purely visual.  
**Fix:** Add `aria-live="assertive" role="timer"` to the countdown div.

---

### MEDIUM-3: Avatar images have empty `alt` text

**Files:** `DashboardPage.tsx:169`, `StatsPage.tsx:243`  
**Evidence:** `<img src={avatarUrl} alt="" className="h-full w-full object-cover" />` — both avatar images use `alt=""`. While empty alt is technically valid (decorative image), the avatar serves as a button to navigate to stats (DashboardPage) or is the user's profile image (StatsPage). The button has `aria-label="Open stats"` which is good, but the image itself provides no alternative.  
**Impact:** Low — the button's aria-label covers it. But `alt={displayName}` would be more descriptive.

---

### MEDIUM-4: Feedback and transcript loading states not announced

**File:** `ResultPanel.tsx:163-164, 211`  
**Evidence:** "Generating feedback..." and "Transcribing audio..." are rendered as plain `<p>` elements. When these appear (replacing the "Get Feedback" button), screen readers don't announce the state change because there's no `aria-live` region wrapping these dynamic updates.  
**Fix:** Wrap the feedback and transcript sections in `aria-live="polite"` containers.

---

## Keyboard Navigation

### HIGH-4: Timer dropdown menu has no keyboard support

**File:** `SetupCountdownPanel.tsx:84-119`  
**Evidence:** The timer selection is a custom dropdown built with plain `<button>` and `<div>`. It:
- Opens on click only (`onClick={() => setTimerMenuOpen(!timerMenuOpen)}`)
- Has no Escape key handler to close
- Has no click-outside handler to dismiss
- Option buttons have no `role="option"` or `role="menuitem"`
- Has no `aria-expanded` on the trigger button
- Has no `aria-haspopup` attribute
- No focus trap — Tab can move focus behind the dropdown

**Impact:** Keyboard users can't close the dropdown with Escape, and the dropdown doesn't follow any ARIA menu or listbox pattern. A keyboard user who opens it has no discoverable way to dismiss it without clicking elsewhere.  
**Fix:** Add `aria-expanded`, `aria-haspopup="listbox"`, Escape key handler, click-outside handler, and `role="listbox"` / `role="option"` on the container/items. Or use a Radix UI `DropdownMenu` (which is already installed).

---

### MEDIUM-5: No skip navigation link

**Files:** All pages  
**Evidence:** There is no "Skip to main content" link at the top of any page. The app uses semantic `<main>` elements on some pages (AuthPage, StatsPage, ConnectTelegram, PromptsPage, HelpPage) but not on DashboardPage or PracticePage.  
**Impact:** Keyboard users must tab through the full header/navigation on every page load before reaching main content.  
**Fix:** Add a visually hidden skip link `<a href="#main" className="sr-only focus:not-sr-only">Skip to main content</a>` and ensure all pages use `<main id="main">`.

---

### MEDIUM-6: Horizontal scroll carousel not keyboard navigable

**File:** `DashboardPage.tsx:264`  
**Evidence:** The prompt cards carousel uses `overflow-x-auto scrollbar-hidden`. The cards are buttons (keyboard accessible individually), but the scroll container itself has no keyboard scroll support. A keyboard user can Tab to each card, but the container won't scroll to reveal off-screen cards when they receive focus.  
**Fix:** Add `tabIndex={0}` and `role="region" aria-label="Prompt suggestions"` to the scroll container, and handle arrow key navigation. Or use CSS `scroll-snap` with `scroll-behavior: smooth`.

---

### LOW-1: No focus management on panel transitions

**Files:** `usePracticeState.ts`, `PracticePage.tsx`  
**Evidence:** When the practice flow transitions from setup → recording → results, focus is not programmatically moved to the new content. After clicking "Start Speaking", focus stays on the now-hidden button. The user must Tab forward to find the new "Finish & View Results" button.  
**Fix:** Use `useRef` + `ref.current?.focus()` to move focus to the heading or primary action of each new panel.

---

## Motion & Animation

### HIGH-5: Confetti animation ignores `prefers-reduced-motion`

**File:** `Confetti.tsx`  
**Evidence:** The Confetti component creates 80 particles with `requestAnimationFrame` animation. There is zero `prefers-reduced-motion` handling anywhere in the codebase — no CSS media query, no JS `matchMedia` check.  
**Impact:** Users who have enabled reduced motion (common for vestibular disorders, motion sickness) see full particle animation at 60fps. This can cause nausea or discomfort.  
**Fix:** Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` at the top of the component. If true, either skip the animation entirely or show a static "celebration" state.  
**What you gain:** Compliance with WCAG 2.1 SC 2.3.3 (Animation from Interactions) and user comfort.

---

### MEDIUM-7: Recording panel pulse animation has no reduced motion alternative

**File:** `RecordingPanel.tsx:47`  
**Evidence:** `<span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />` — the recording indicator dot pulses continuously. No `motion-reduce:` Tailwind variant.  
**Fix:** Add `motion-reduce:animate-none` to the class list.

---

### MEDIUM-8: SetupCountdownPanel blurs and scales during countdown

**File:** `SetupCountdownPanel.tsx:64`  
**Evidence:** `state === 'countdown' && 'opacity-30 scale-95 blur-[2px]'` — applies blur, opacity, and scale transforms to the background content during countdown. This is a significant visual effect that should be skipped for reduced-motion users.  
**Fix:** Wrap in `motion-reduce:` variant: `motion-reduce:opacity-30 motion-reduce:blur-none motion-reduce:scale-100`.

---

## Color & Contrast

### MEDIUM-9: `text-muted-foreground/60` may fail WCAG contrast

**Files:** `ResultPanel.tsx:122,237`, `DashboardPage.tsx:200`  
**Evidence:** `text-muted-foreground/60` applies 60% opacity to the muted foreground color. If `--muted-foreground` is a mid-gray like `hsl(215 20% 65%)`, adding 60% opacity on a dark background yields a contrast ratio well below the WCAG AA minimum of 4.5:1 for normal text and 3:1 for large text.  
**Specific uses:**
- ResultPanel line 122: "Speak for at least 5 seconds to receive a Flow Score." — small text, informational
- ResultPanel line 237: "Having issues? Export debug file" — small text, interactive link
- DashboardPage line 200: sublabels on metric cards — small text  

**Impact:** Users with low vision may not be able to read these elements.  
**Fix:** Use `text-muted-foreground` (full opacity) for any informational text. Reserve `/60` opacity for truly decorative elements.

---

### LOW-2: Score tone colors (green/amber/gray) rely on color alone

**File:** `StatsPage.tsx:89-94`  
**Evidence:** `getFlowScoreTone` returns `bg-green-500` for scores ≥80, `bg-amber-500` for ≥60, and `bg-muted-foreground/50` otherwise. These colors are used as dots/indicators next to session entries. Color is the only distinguishing factor — no shape, icon, or text label differentiates the tones.  
**Impact:** Users with red-green color blindness cannot distinguish green from amber.  
**Fix:** Add a secondary indicator: use different shapes (circle, diamond, square) or add a small text label.

---

## Touch Targets

### MEDIUM-10: Copy buttons are 36px tall (below 44px minimum)

**File:** `ResultPanel.tsx:155,199`  
**Evidence:** `min-h-9` = 36px. The "Copy" buttons for feedback and transcript have `min-h-9` (36px). Apple's Human Interface Guidelines and WCAG SC 2.5.8 recommend a minimum 44×44px touch target. The buttons also use `text-xs` (12px font).  
**Impact:** Difficult to tap accurately on mobile, especially for users with motor impairments.  
**Fix:** Increase to `min-h-11` (44px) for mobile touch targets.

---

### LOW-3: Timer dropdown options have small touch targets

**File:** `SetupCountdownPanel.tsx:101-117`  
**Evidence:** Timer dropdown option buttons use `py-2 text-xs` which renders at approximately 32-36px height.  
**Fix:** Increase padding to `py-3` for 44px touch targets.

---

## UX Edge Cases

### HIGH-6: No confirmation before navigating away from results

**File:** `ResultPanel.tsx:290-296`  
**Evidence:** The "Home" button navigates to `/` immediately (`onClick={() => navigate('/')}`). If the user hasn't copied their transcript or feedback, and the session save failed (see error-handling audit HIGH-1), their results are lost without warning.  
**Fix:** If the session wasn't saved successfully, show a confirmation dialog: "Your session wasn't saved. Are you sure you want to leave?"

---

### MEDIUM-11: "Practice Again" doesn't warn about unsaved transcript/feedback

**File:** `ResultPanel.tsx:244-248`  
**Evidence:** "Practice Again" button calls `handleRetry` which resets all state. If feedback is still loading (`analysisFeedbackLoading: true`) or transcription is in progress, the in-flight requests are abandoned and results lost.  
**Fix:** If async operations are in progress, show "Feedback is still loading. Start a new session anyway?"

---

### MEDIUM-12: Share text doesn't include the Flow Score

**File:** `ResultPanel.tsx:253`  
**Evidence:** The share text includes speaking time and pause units but not the Flow Score itself:
```
I just completed Speaking Mode on No Pause 🎤
Speaking time: {formatMMSS(...)}
Pause units: {pauseCount}
Transcript: "..."
```
The Flow Score — the primary metric displayed prominently at the top of results — is missing from the share text.  
**Fix:** Add `Flow Score: ${lastResults.flowScore}\n` to the share text.

---

### LOW-4: Back button during recording doesn't confirm abandoning session

**File:** `PracticePage.tsx:98`  
**Evidence:** The back button (`handleBack`) is visible during recording. If the user accidentally taps it mid-recording, there's no confirmation. The recording and all accumulated data are discarded.  
**Fix:** During `state === 'recording'`, show a confirmation: "Stop recording and go back?"

---

### LOW-5: Debug export button is styled as plain text link

**File:** `ResultPanel.tsx:231-240`  
**Evidence:** "Having issues? Export debug file" is styled as `text-xs text-muted-foreground/80 underline-offset-2 hover:underline` — very low visual prominence with 80% opacity on an already muted color. Users who need to export debug logs may not notice it.  
**Impact:** Intentionally low-key design, but may be too subtle for users who actually need it.

---

## Missing Semantic HTML

### MEDIUM-13: RecordingPanel and SetupCountdownPanel don't use `<main>`

**Files:** `RecordingPanel.tsx`, `SetupCountdownPanel.tsx`  
**Evidence:** These panels render as `<div>` wrappers. The PracticePage that wraps them also doesn't have a `<main>` element. DashboardPage similarly uses `<div>` at the top level (no `<main>`).  
**Contrast:** StatsPage, HelpPage, PromptsPage, AuthPage, and ConnectTelegram all use `<main>`.  
**Fix:** Ensure all top-level page components wrap content in `<main>`.

---

### LOW-6: Decorative icons missing `aria-hidden`

**Files:** `ResultPanel.tsx:111,133,138`  
**Evidence:** The `TrendingUp`, `Pause`, and `Mic` icons in the result cards have no `aria-hidden="true"`. They're purely decorative — the text labels ("Pauses", "Speaking time") already convey the meaning. Screen readers may try to announce the SVG paths.  
**Contrast:** DashboardPage and HelpPage correctly use `aria-hidden="true"` on decorative icons.  
**Fix:** Add `aria-hidden="true"` to all decorative Lucide icons in ResultPanel.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 6 | No live region for state changes, canvas has no fallback, no progress bar semantics, no keyboard on timer dropdown, no reduced motion support, no navigation guard |
| **MEDIUM** | 13 | Missing announcements, empty alt text, no skip nav, carousel not keyboard-navigable, contrast issues, small touch targets, share text missing score |
| **LOW** | 6 | No focus management on transitions, color-only indicators, small dropdown targets, no recording abandon confirmation, debug export visibility, missing aria-hidden |

**Priority fix order:** HIGH-5 (reduced motion — 5 lines) → HIGH-1 (aria-live for state changes — 10 lines) → HIGH-4 (timer dropdown keyboard — use Radix DropdownMenu) → HIGH-3 (progress bar role — 1 line) → HIGH-2 (canvas accessibility — 1 line) → HIGH-6 (navigation guard — confirmation dialog) → MEDIUM-9 (contrast fix)

**Positive findings:**
- `<html lang="en">` is set correctly
- `<main>` used on most pages
- Weekly activity dots have proper `aria-label` for completed/not completed
- DashboardPage uses `aria-labelledby` for the prompts section
- Icons on DashboardPage and HelpPage correctly use `aria-hidden="true"`
- Dialog component includes `sr-only` text for Close button
- ResultSkeletonPanel uses `aria-live="polite"` and `aria-busy="true"`
