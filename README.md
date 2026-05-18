# No Pause

No Pause is a speaking-flow practice app. It helps users train continuous speech, reduce hesitation patterns, and track progress with an open-ended Flow Score.

The deployable app lives in [`No-Pause/`](./No-Pause).

## What It Does

- Records short Speaking Mode sessions in the browser.
- Measures speaking time, silence time, pause units, and Flow Score.
- Saves sessions, transcripts, streaks, and stats with Supabase.
- Provides optional AI feedback after a transcript is available.
- Supports Telegram voice-note practice, account linking, stats, and friend or group challenges.
- Includes a public `/help` page that explains scoring, prompts, streaks, privacy, and Telegram practice.

## Main Routes

- `/` - authenticated dashboard.
- `/practice` - Speaking Mode recording flow.
- `/prompts` - prompt picker that opens selected prompts in Speaking Mode.
- `/stats` - user stats, difficulty, weekly activity, and recent sessions.
- `/help` - public help page.
- `/connect?tg=<telegram_id>` - Telegram account linking.
- `/sessions` - auth-gated stats view used from Telegram links.

## Architecture

- Frontend: React, Vite, TypeScript, Tailwind CSS.
- Auth and database: Supabase.
- Speech-to-text and AI feedback: Groq behind server routes.
- Telegram bot: Telegraf via Vercel serverless webhook.
- Deployment: Vercel, with project configuration rooted at this repository folder.

Browser code never calls Groq directly. Provider keys stay server-side, and browser transcription or feedback requests go through `/api/transcription` and `/api/feedback`.

## Core Data Flow

1. User records a Speaking Mode session.
2. Web Audio and MediaRecorder capture audio and speech/silence frames.
3. Local analyzer calculates speaking time, silence, and pause units.
4. Browser SpeechRecognition may create an initial transcript.
5. If needed, audio is sent to `/api/transcription`, which calls Groq Whisper.
6. `calculateFlowScore` scores the session from speaking time and pause units.
7. Session data is saved to Supabase `sessions`; streak data updates in `streaks`.
8. Optional AI feedback is requested through `/api/feedback` and stored on the session.

## Local Development

```bash
cd No-Pause
npm install
npm run dev
```

Required browser environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Server-side production features also require:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

## Useful Commands

Run from `No-Pause/`:

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Production deploys are run from the repository root because the Vercel project is configured there:

```bash
npx vercel deploy --prod --yes
```

## Reference Docs

- [`No-Pause/SYSTEM.md`](./No-Pause/SYSTEM.md) - compact architecture notes.
- [`No-Pause/INDEX.md`](./No-Pause/INDEX.md) - file/module index.
- [`CHANGELOG.md`](./CHANGELOG.md) - project history.
