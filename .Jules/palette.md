# Palette's Journal

## 2025-02-14 - Keyboard-Accessible Carousels & Global Interaction Gating
**Learning:** When adding keyboard navigation (ArrowLeft/ArrowRight) to custom carousels, assigning `tabIndex={0}` to the container requires explicit focus-visible state styling that respects the container's corner radius (`rounded-[28px]`). Additionally, to verify these keyboard interactions in headless Playwright environments, the carousel region must be explicitly focused using `.focus()` before dispatching arrow key presses. For global action triggers like `Space` shortcuts, listeners must be gated to ignore triggers when typing inside standard form elements or buttons (`['INPUT', 'TEXTAREA', 'BUTTON']`).
**Action:** Always pair `tabIndex={0}` with container-specific `focus-visible:ring-2` styling, gate global listeners in React `useEffect` hooks, and explicitly focus the target region during E2E browser automation.
