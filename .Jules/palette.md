## 2026-06-21 - [Focus States for Interactive Elements]
**Learning:** The application uses a custom `btn-press` utility for active states, but many interactive elements lack visible focus indicators. Standardizing on `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none` (with appropriate ring-offset colors) ensures accessibility for keyboard users while maintaining the design aesthetic.
**Action:** Always check for `focus-visible` states when adding or modifying buttons and interactive cards.
