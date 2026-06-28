## 2026-06-28 - [Keyboard Navigation & ARIA Enhancements]
**Learning:** Adding global keyboard shortcuts like 'Space' or 'Enter' must be guarded by `e.target === document.body` to avoid collisions with focused interactive elements (like buttons) which may have their own default keyboard behavior.
**Action:** Always check `e.target` before triggering a global action from a keyboard listener.
