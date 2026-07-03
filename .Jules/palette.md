# Palette's Journal - Critical UX/Accessibility Learnings

## 2025-05-14 - Keyboard-Accessible Carousels
**Learning:** Interactive carousels require explicit keyboard navigation (ArrowKeys) and focus-visible states to be truly accessible. Global shortcuts (like Space to start) must be gated by checking `e.target` to avoid triggering during normal interaction with other buttons or inputs.
**Action:** Always add `tabIndex={0}`, `role="region"`, and keyboard listeners to custom carousel-like selection UI. Gate global shortcuts using `!['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)`.
