---
name: add-telegram-command
description: Checklist for adding a new Telegram bot command or action
---

1. Register command/action in src/lib/telegram/router.ts
2. If it handles voice: add logic in src/lib/telegram/voiceHandler.ts
3. If it handles challenges: add logic in src/lib/telegram/challenges.ts
4. Add any new message templates to MESSAGES in src/lib/telegram/constants.ts
5. If new DB writes: use insertSession pattern with missing-column fallbacks
6. Run update-system-md skill after
