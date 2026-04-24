# No Pause

No Pause is a real-time speaking analytics web application designed to help you improve your speaking fluency, reduce hesitations, and eliminate filler words. It uses the Web Audio API to track your speech patterns locally and provides a comprehensive "Flow Score" to measure your progress over time.

## 🎯 Features

- **Real-Time Speech Analysis**: Analyzes audio input purely on the client side using the Web Audio API without streaming your voice to servers.
- **Three Practice Modes**:
  - **Free Speaking**: Unrestricted practice to build stamina.
  - **Lemon Technique**: Time-pressured speaking exercises based on random words to build quick-thinking skills.
  - **Topic Score**: Structured prompts categorized by difficulty to practice critical thinking and storytelling.
- **Measurable Flow Score**: A customized algorithm evaluating hesitation rate (pauses/minute) and speaking ratio to penalize excessive silences and reward continuous flow.
- **Configurable Sensitivities**: Granular settings (Beginner, Intermediate, Advanced) adjusting how long a silence must be to constitute a "hesitation".
- **Progress Tracking**: Authentication is powered by Supabase and practice analytics are in the middle of a backend migration.
- **PWA Ready**: Installable as a progressive web app on desktop and mobile browsers for quick native-like access.

## 🛠 Technology Stack

- **Frontend**: React 18, Vite, TypeScript
- **Backend & Database**: Supabase (migration in progress)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI Primitives
- **Icons**: Lucide React
- **PWA Support**: Vite PWA plugin / custom service worker

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/viceeroy/No-Pause.git
cd No-Pause
```

2. Install dependencies:
From the `No-Pause` directory.
```bash
cd No-Pause
npm install
```

3. Set up environment variables:
Create a `.env` or `.env.local` file inside the `No-Pause` directory and add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Configure Google Auth in Supabase:
- In your Supabase project, enable the `Google` provider under `Authentication -> Providers`.
- In Google Cloud, create an OAuth client for your site and add Supabase's redirect URI from the provider setup screen.
- In Supabase `Authentication -> URL Configuration`, add your app URLs, including the callback path used by the app:
  - `http://localhost:5173/auth/callback`
  - your production domain with `/auth/callback`

5. Start the Vite development server:
From the `No-Pause` directory:
```bash
npm run dev
```

6. Open your browser and navigate to the localhost port provided.

## 📁 Project Structure

```
├── No-Pause/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React Contexts (e.g., PWA updates)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Core business logic
│   │   │   ├── analyzer/     # Audio state machine and Flow Score logic
│   │   │   ├── micService.ts # Microphone device management
│   │   │   └── storage.ts    # Preference management
│   │   ├── pages/            # Top-level route components
│   │   └── App.tsx           # Application router & layout
│   └── public/               # Static assets & PWA manifest/service worker
```

## 🔒 Privacy & Architecture

No Pause is built with privacy in mind. Voice recording and analytical calculations happen entirely inside your browser tab using the `AudioContext` and `AnalyserNode` APIs. Raw audio data is **never** sent to our servers unless you explicitly use backend-powered features that are reintroduced later in the migration.

## 📄 License

This project is licensed under the MIT License.
