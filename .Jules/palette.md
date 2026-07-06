## 2025-05-15 - Keyboard Accessibility and Shortcut Hints
**Learning:** For voice-driven applications, global keyboard shortcuts (Enter/Space) significantly improve UX, but must be gated against active input focus. Visual hints (e.g., [Enter]) help discoverability but should be hidden on small screens to maintain a clean UI.
**Action:** Implement global shortcuts with focus gating and responsive visual hints.

## 2025-05-15 - Accessible Carousel Interaction
**Learning:** Carousels require explicit ARIA roles (region, carousel) and tabIndex={0} for keyboard focus. When testing with Playwright, focused elements must be explicitly called with .focus() before sending key events.
**Action:** Use role="region", aria-roledescription="carousel", and tabIndex={0} for selection regions.
