# Palette Journal

## 2025-02-18 - Init
**Learning:** UX improvements must respect keyboard accessibility, ARIA guidelines, and remain lightweight (under 50 lines diff) to ensure optimal focus and maintainability.
**Action:** When implementing any Micro-UX improvements, ensure ARIA attributes are placed correctly and focus outlines are visible.

## 2025-02-18 - Accessible Carousel Navigation & Hotkeys
**Learning:** For interactive region-based components like prompt selectors, adding role="region", aria-roledescription="carousel", tabIndex={0}, and Arrow navigation provides robust accessibility. Coupling this with context-gated global hotkeys (like [Space] to start/stop speaking) and visible hints immensely reduces friction for power users without interrupting screen-reader flows or standard form elements.
**Action:** Always secure global keydown hotkeys with target tagName filters (!['INPUT', 'TEXTAREA', 'BUTTON'].includes(tagName)), and accompany tabIndex={0} elements with clear focus-visible states matching the design system.
