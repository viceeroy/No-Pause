## 2025-08-01 - Playwright Carousel Focus Verification
**Learning:** Target elements with `tabIndex={0}` (like accessible custom carousels) must be explicitly focused using `.focus()` in Playwright scripts before simulating Arrow key presses to ensure event handlers trigger reliably in headless Chromium.
**Action:** Always call `.focus()` on custom slider/carousel container elements with `tabIndex={0}` when writing Playwright tests or verification scripts.
