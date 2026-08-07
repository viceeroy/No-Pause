# Palette's UX & Accessibility Journal

## 2025-02-02 - Keyboard Accessibility and Standardized Focus/Shortcuts
**Learning:** Custom slider/carousel components and speech-control primary buttons in speech-interactive apps lack accessible keyboard navigation and screen-reader awareness. Providing standardized focus states, arrow-key navigation, ARIA attributes, and global spacebar hotkeys with visual desktop hints significantly enhances usability.
**Action:** Apply 'role="region"', 'aria-roledescription="carousel"', 'tabIndex={0}', visual 'focus-visible' rings, 'aria-hidden={i !== activeIndex}', and global 'keydown' listeners for primary interactions alongside subtle '[Space]' desktop labels.
