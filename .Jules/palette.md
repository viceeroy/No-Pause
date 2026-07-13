## 2026-07-13 - Keyboard Shortcut discovered
**Learning:** Global 'Space' shortcuts for primary actions can conflict with standard button activation if not gated correctly.
**Action:** Always include 'BUTTON' in the exclusion list for global keyboard listeners: '!['INPUT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement).tagName)'.
