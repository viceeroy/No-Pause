# Palette's Journal

## 2025-05-10 - Keyboard Accessible Carousels & Spacebar Shortcuts
**Learning:** Custom touch/drag-to-slide carousel containers built using pointer events and trackpad `onWheel` tracking completely lock out keyboard users. Adding a `tabIndex={0}`, standard accessibility roles (`role="region"`, `aria-roledescription="carousel"`), a standardized focus ring, and local ArrowLeft/ArrowRight keyboard listeners makes them fully accessible. Additionally, for global action shortcuts (like `Space` to start/stop recording), gating the listener against active text inputs/buttons and wrapping callback functions in `useCallback` is vital to prevent ESLint warning cycles and unexpected form triggers.
**Action:** Always verify custom interaction areas have focus indicators and Arrow key fallbacks. Integrate hidden-on-mobile `[Space]` inline tags to aid desktop shortcut discovery without bloating mobile UI screens.
