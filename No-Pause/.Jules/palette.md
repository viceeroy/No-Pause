# Palette's Journal

## 2026-06-15 - [Keyboard Accessible Carousel Prompt Selector]
**Learning:** Custom swipe/pointer-based carousel components often leave keyboard and screen-reader users completely locked out of content discovery. Adding standard ARIA landmarks, explicit slide structures with `aria-hidden` gating, and native key listeners is crucial for accessible web design.
**Action:** Always wrap interactive swipable regions in `role="region"`, `aria-roledescription="carousel"`, `tabIndex={0}`, provide `focus-visible` styling, handle arrow keys, and dynamically hide offscreen slides with `aria-hidden`.
