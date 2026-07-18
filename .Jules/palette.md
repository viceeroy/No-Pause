## 2024-07-18 - [Keyboard Accessible Carousel and Quick push-to-talk Actions]
**Learning:** For carousels displaying prompt cards, adding tabIndex={0} and horizontal arrow key listeners makes them keyboard-navigable, while a global Space key shortcut mimics push-to-talk interfaces for seamless start/stop recording. Gating shortcuts to ignore input elements is crucial to prevent broken form states.
**Action:** Always provide tabIndex={0} and focus-visible outlines on carousel containers, and pair them with visible desktop-only visual helpers like [Space] in buttons.
