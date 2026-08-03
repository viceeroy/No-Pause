# Palette's UX Journal

## 2025-02-14 - Accessible Custom Carousel with Keyboard Navigation
**Learning:** Custom carousels/sliders often lack focus indicators and keyboard navigation support, making them completely inaccessible. Furthermore, off-screen inactive cards can pollute screen readers unless properly hidden.
**Action:** When building custom carousels:
1. Wrap the container in `tabIndex={0}`, standard focus-visible styles (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none`), and set appropriate ARIA roles (`role="region"` and `aria-roledescription="carousel"`).
2. Register local `onKeyDown` handlers for horizontal arrow keys (`ArrowLeft`, `ArrowRight`) to support easy keyboard navigation.
3. Hide off-screen slides from screen readers by applying `aria-hidden={i !== activeIndex}` dynamically to individual slides.
