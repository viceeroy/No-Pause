---
name: update-system-md
description: Update system.md after any architecture, data flow, schema, scoring, env, or Telegram bot change
---

After completing any change that affects architecture, file responsibilities, function signatures, data flow, scoring formula, DB schema, env vars, or Telegram bot behavior:

1. Open memory/system.md
2. Locate the relevant current-state section and update it to reflect the current state
3. Append new refactoring entries to memory/CHANGELOG.md — append-only, never delete or edit old entries
