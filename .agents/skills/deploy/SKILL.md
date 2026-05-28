---
name: deploy
description: Deploy NoPause to Vercel production
---

Run the following from the repo root (/Users/viseeroy/Desktop/NoPause), never from No-Pause/:

```bash
git add -A && git commit -m "Deploy" && git push
cd No-Pause && npm run build
cd .. && npx vercel deploy --prod --yes
```

If run from No-Pause/ by mistake, stop and cd to repo root first.
