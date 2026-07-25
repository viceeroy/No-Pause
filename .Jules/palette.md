# Palette's Journal — Critical UX/Accessibility Learnings Only

Only record critical UX and accessibility learnings from working on the NoPause app. Do not log routine tasks or general accessibility tips.

## 2026-06-15 - Setup Carousel and Space Shortcut Accessibility
**Learning:** Carousel components require robust tab and keyboard accessibility to be screen-reader friendly and intuitive. Users need clear visual and behavioral cues, like Arrow keys for carousel navigation, Space key for start/stop actions, focus-visible states on selection regions, and `aria-hidden` attributes to avoid announcing inactive/off-screen slides.
**Action:** Always implement `role="region"`, `aria-roledescription="carousel"`, `tabIndex={0}`, proper `aria-label`, Arrow-key navigation, and `aria-hidden` for slide items, while keeping keyboard shortcuts gated against focused input fields.
