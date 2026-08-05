# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-02-17 - Keyboard Shortcuts Discoverability & Screen Reader Off-screen Elements
**Learning:** For interactive screen elements like custom sliders and carousels, screen readers can accidentally announce or focus off-screen slide content if not explicitly hidden. Additionally, power-user shortcuts like Space to start/stop are incredibly satisfying but need subtle visual hints so desktop users can discover them naturally without cluttering mobile screens.
**Action:** Use `aria-hidden={i !== activeIndex}` on inactive slides in carousels. Apply role-based carousel setup (`role="region"`, `aria-roledescription="carousel"`, `tabIndex={0}`, and `focus-visible` states) to enable clean keyboard navigation with Arrow keys. Introduce keyboard shortcuts via global listeners and add responsive visual keys like `[Space]` that hide elegantly on mobile screens.
