## 2026-08-16 - Accessible Custom Carousels
**Learning:** Custom div-based carousels require `tabIndex={0}`, `role="region"`, `aria-roledescription="carousel"`, and explicit `ArrowLeft`/`ArrowRight` key handlers, along with `aria-hidden={i !== activeIndex}` on slides so screen readers don't read hidden cards.
**Action:** Always add keyboard arrow listeners and slide-level `aria-hidden` attributes when creating or styling custom slider/carousel components.
