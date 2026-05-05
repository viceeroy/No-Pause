# Project Instructions

## Deploy Command

When the user says exactly `deploy`, commit, push, and deploy the No-Pause app immediately.

Use this workflow:

1. Run `git add -A` from `/Users/viseeroy/Desktop/NoPause`.
2. Run `git commit -m "Deploy"` from `/Users/viseeroy/Desktop/NoPause` as quickly as possible. If there is nothing to commit, continue.
3. Run `git push` from `/Users/viseeroy/Desktop/NoPause`.
4. Run `npm run build` from `/Users/viseeroy/Desktop/NoPause/No-Pause`.
5. If the build passes, run `npx vercel deploy --prod --yes` from `/Users/viseeroy/Desktop/NoPause`.
6. Report the production alias, deployment URL, and inspect URL.

Do not ask for confirmation before deploying when the user says exactly `deploy`.
Do not ask for confirmation before committing or pushing when the user says exactly `deploy`.
Do not run the Vercel command from `/Users/viseeroy/Desktop/NoPause/No-Pause`; the Vercel project root is configured relative to `/Users/viseeroy/Desktop/NoPause`.
