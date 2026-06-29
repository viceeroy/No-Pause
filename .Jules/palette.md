## 2025-05-15 - [Accessible Carousel & Countdown]
**Learning:** Carousel components need explicit keyboard navigation (Arrows, Home, End) and focus indicators to be accessible. Real-time countdowns require 'aria-live' and 'aria-atomic' for screen reader users to be notified of changes.
**Action:** Always add 'tabIndex={0}', 'role="region"', 'onKeyDown' with 'e.preventDefault()', and 'aria-live' attributes to interactive/changing components.
