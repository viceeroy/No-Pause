## 2025-05-14 - [Avoid aria-live on fast timers]
**Learning:** Adding `aria-live="polite"` or `assertive` to a timer that updates every second (like a recording progress timer) creates excessive "chatter" for screen reader users, making it impossible for them to focus on other tasks (like speaking).
**Action:** Only use `aria-live` for low-frequency updates or critical countdowns (e.g., 3-2-1 start). Avoid it for second-by-second progress timers.
