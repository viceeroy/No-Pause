# No Pause

No Pause is a real-time speaking analytics web app that helps you improve fluency and reduce hesitations. It tracks your speech patterns using the Web Audio API and gives you a **Flow Score** to measure progress over time.

## Features

- **Real-Time Speech Analysis**: Audio is analyzed entirely in-browser using the Web Audio API — nothing streamed to servers during live sessions.
- **Speaking Mode**: Unrestricted open-ended practice to build speaking stamina.
- **Flow Score**: A scoring algorithm that rewards continuous speech and penalizes hesitation pauses.
- **Progress Tracking**: Sessions, streaks, transcripts, hesitation logs, and AI feedback stored in Supabase.
- **Telegram Bot**: Practice via voice notes in Telegram without opening the web app — scored with the same algorithm.
- **PWA Ready**: Installable on desktop and mobile for quick native-like access.

## Technology Stack

- **Frontend**: React 18, Vite, TypeScript
- **Backend & Database**: Supabase (primary DB, auth, RLS)
- **Authentication**: Supabase Auth (Google OAuth)
- **AI Services**: Groq Whisper (transcription) + Groq LLM (coaching feedback)
- **Telegram Extension**: Telegraf bot — voice notes, challenges, leaderboards
- **Hosting**: Vercel (frontend + serverless API functions)
- **Styling**: Tailwind CSS, shadcn/ui, Radix UI Primitives
- **Icons**: Lucide React
- **PWA**: Vite PWA plugin / custom service worker

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- Supabase project
- Groq API key
- Telegram bot token (optional, for bot features)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/viceeroy/No-Pause.git
cd No-Pause
```

2. Install dependencies:

```bash
cd No-Pause
npm install
```

3. Set up environment variables — create `.env.local` inside the `No-Pause` directory:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

4. Configure Google Auth in Supabase:
   * Enable the `Google` provider under `Authentication > Providers`.
   * In Google Cloud, create an OAuth client and add Supabase's redirect URI.
   * In Supabase `Authentication > URL Configuration`, add:
      * `http://localhost:5173/auth/callback`
      * your production domain with `/auth/callback`

5. Start the dev server:

```bash
npm run dev
```

6. Open your browser at the localhost port shown.

## Project Structure

```
No-Pause/
├── api/                         # Vercel serverless functions
│   ├── feedback.ts              # AI coaching feedback (Groq LLM)
│   ├── transcription.ts         # Audio transcription (Groq Whisper)
│   └── telegram/
│       ├── connect.ts           # Links Supabase user <-> Telegram ID
│       └── webhook.ts           # Telegram bot update handler
├── src/
│   ├── features/                # Feature-based modules
│   │   ├── auth/                # Auth pages and OAuth callback
│   │   ├── practice/            # Recording, scoring, results
│   │   └── stats/               # Dashboard, stats, session history
│   ├── lib/
│   │   ├── core/                # scoring.ts, session.ts, queries, utils
│   │   ├── telegram/            # Bot router, voiceHandler, challenges
│   │   ├── practiceApi.ts       # Supabase session read/write API
│   │   └── telegramAuth.ts      # upsertTelegramConnection
│   ├── services/                # groq.ts, supabase.ts, supabaseServer.ts, apiQuota.ts
│   ├── providers/               # AuthContext, PWAInstallContext, ServiceWorkerUpdateContext
│   ├── shared/                  # Reusable UI components, hooks, utils
│   ├── pages/                   # Top-level route pages
│   └── App.tsx                  # Router and layout
├── supabase/migrations/         # SQL migration files
├── CLAUDE.md                    # Coding agent instructions
└── public/                      # Static assets, PWA manifest, service worker
```

## Architecture

Full system reference — stack topology, data flows, Flow Score formula, database schema, API routes, Telegram architecture, environment variables, and coding invariants — lives in [`memory/MEMORY.md`](./No-Pause/memory/MEMORY.md).

- [`No-Pause/INDEX.md`](./No-Pause/INDEX.md) - file/module index.
- [`CHANGELOG.md`](./CHANGELOG.md) - project history.

## Privacy & Architecture

No Pause is built with privacy in mind. Real-time speech analysis runs entirely inside your browser tab using the `AudioContext` and `AnalyserNode` APIs — raw audio is never streamed to servers during a live session. Backend features (transcription, AI feedback, Telegram voice notes) process audio only when you explicitly trigger them, via secured API routes with per-user daily quotas.

## License

This project is licensed under the MIT License.
