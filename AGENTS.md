# AGENTS.md — NoPause

Pointer file for Codex and other agents. Do not duplicate detail here.

- **Source of truth:** `memory/system.md` (stack, schema, source layout, data flow, scoring, env, routes).
- **Coding rules:** `CLAUDE.md`.

## Hard Rules

- Vercel deploys from the **repo root** (`/Users/viseeroy/Documents/GitHub/No-Pause`), never from `No-Pause/`. Full deploy command sequence: see the **Deploy Workflow** section in `memory/system.md`.
- Flow Score formula lives **only** in `src/lib/core/scoring.ts` — never fork, rename, or approximate it elsewhere.
- Provider keys (Groq, Supabase service role) are **server-only** — never `VITE_`-prefixed, never imported in frontend.
- Do **not** re-enable browser SpeechRecognition as primary without first removing the Groq-primary path.
- After any architecture / data-flow / schema / scoring / env / Telegram change: update `memory/system.md` and vault `Changes/` folder (Obsidian).
