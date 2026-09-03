## 2025-09-03 - Accessible Custom Carousel Navigation
**Learning:** Custom interactive swipe/wheel carousels (like topic cards) require explicit `tabIndex={0}`, `role="region"`, `aria-roledescription="carousel"`, and keyboard arrow event listeners (`ArrowLeft`/`ArrowRight`), along with `aria-hidden={i !== activeIndex}` on individual slides to ensure screen reader and keyboard accessibility.
**Action:** When building or enhancing card carousels or custom slider components, include keyboard navigation and ARIA carousel roles directly on the focusable container.
