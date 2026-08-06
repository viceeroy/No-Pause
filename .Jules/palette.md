# Palette UX Journal 🎨

## 2025-02-12 - Keyboard Accessibility and Shortcut Hints in custom sliders
**Learning:** For web applications with heavy voice interaction, keyboard accessibility is critical. When users are preparing to record, reaching for a mouse/trackpad to click "Start" disrupts the physiological flow of preparation. Global shortcut keys like `Space` to start/stop, combined with visual Hints (hidden on mobile) and fully accessible topic carousels with arrow key support, provide a seamless hand-free-to-voice transition.
**Action:** Always provide `role="region"` and `aria-roledescription="carousel"` for slide-decks, support left/right arrows, use `aria-hidden={i !== activeIndex}` on slides, gate global listeners on active input fields, and show subtle `[Space]` desktop hints next to primary action buttons.
