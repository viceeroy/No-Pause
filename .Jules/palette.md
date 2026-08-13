# Palette's UX Journal — No Pause

This journal records critical UX/accessibility learnings and reusable design system patterns discovered in No Pause.

## 2025-02-21 - Standardized Focus Styling & Carousel Accessibility
**Learning:** Custom slider components (like the practice topic carousel) lack native keyboard navigation and proper accessibility markers, meaning keyboard-only and screen-reader users are completely locked out of selecting topics. Standard focus styling must also be cohesive and high-contrast.
**Action:** Always provide `role="region"`, `aria-roledescription="carousel"`, `tabIndex={0}`, an explicit `aria-label`, arrow key handlers, and `aria-hidden` attributes for inactive slides. Standardize focus-visible rings globally in the base layer of index.css to ensure universal visual affordances.
