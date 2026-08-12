## 2025-02-23 - Keyboard-Accessible Carousel & Contextual Action Shortcuts
**Learning:** Standard slider/carousel decks built for touch and wheel gestures ignore screen-reader users and desktop keyboard-only navigation. Creating a keyboard-accessible carousel requires explicitly declaring standard roles and focus rings, handling Arrow keys locally, and hiding off-screen items with `aria-hidden`. Furthermore, binding primary page actions (like Start and Finish) to universal triggers like `Space` with clear desktop-only visual hints (`[Space]`) significantly lowers cognitive friction while maintaining a clean, clutter-free mobile UI.
**Action:** When implementing interactive slides or carousels:
1. Wrap container with `role="region"`, `aria-roledescription="carousel"`, `aria-label="..."`, and `tabIndex={0}`.
2. Apply high-contrast theme-cohesive outline rings via `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none`.
3. Add Arrow navigation listeners and set `aria-hidden={i !== activeIndex}` on each slide card.
4. Gate global `Space` / keyboard listeners to ignore inputs, textareas, and buttons.
5. Provide subtle `[Space]` desktop-only visual hints (`hidden md:inline`) within trigger button labels.
