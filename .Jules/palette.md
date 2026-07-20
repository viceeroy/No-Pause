# Palette's Critical UX & Accessibility Journal

## 2025-07-20 - Custom Swipe Carousel Keyboard Navigation & Visual Dot Pagination
**Learning:** Swipe-based carousels (using custom pointer & wheel handlers) often lack screen reader discovery and keyboard/pointer navigation affordances for desktop or motor-impaired users. Adding accessible tab-focused key handlers (ArrowLeft/ArrowRight), explicit ARIA hidden fields for inactive slides, and keyboard-navigable pagination dot buttons bridges the gap completely, fitting perfectly with standard CSS-transitioned carousel offsets.
**Action:** Always make sure custom slider and swipe components are keyboard-focusable with 'tabIndex={0}', handle default key event scrolling with 'preventDefault()', hide off-screen slides from screen readers using 'aria-hidden', and pair them with distinct responsive indicator buttons.
