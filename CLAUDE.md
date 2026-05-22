# CLAUDE.md — NoPause Coding Agent Instructions

You are working on **NoPause** (nopause.org) — a live speech fluency PWA.
The owner reviews all architecture and plans with Claude (chat) first. Your job is execution: implement what's been designed, map before you touch, and flag every uncertainty explicitly.

> **Full architecture reference:** [`memory/MEMORY.md`](./No-Pause/memory/MEMORY.md) — stack topology, data flows, Flow Score formula, database schema, API routes, Telegram architecture, environment variables, and coding invariants.

---

## Stack Topology

Before writing any code, orient yourself to this architecture:

```
Frontend (React + TypeScript + Vite)
  └── Feature-based architecture under /src/features/ (auth, practice, stats)
  └── Cross-feature logic in /src/lib/core/, /src/lib/telegram/, /src/services/
  └── PWA, mobile-first UI
  └── Supabase Auth (Google OAuth) — session via AuthContext

Backend / Data
  └── Supabase — primary DB, auth, RLS enforced, service-role for server paths
  └── Groq — transcription (Whisper) + LLM-based coaching

Extensions
  └── Telegram bot (@NoPauseAI_bot) — voice notes, challenges, stats

Hosting
  └── Vercel — frontend + 4 serverless API functions
```

**High-centrality files to locate before touching anything:**
- `src/lib/core/scoring.ts` — Flow Score formula (sacred, never alter)
- `src/features/practice/lib/speechAnalyzer.ts` — audio state machine, pause detection
- `src/lib/practiceApi.ts` — all Supabase session writes and stats reads
- `src/services/supabase.ts` + `src/services/supabaseServer.ts` — client init (wrong import = RLS bypass or browser crash)
- `src/providers/AuthContext.tsx` — auth state, used by almost every feature
- `src/lib/telegram/router.ts` — all bot command routing
- `src/lib/telegram/voiceHandler.ts` — Telegram voice processing and session saving
- `INDEX.md` — full import graph, check before adding dependencies

---

## Topology-First Discipline

**Before every task:**
1. Identify all files affected by the change
2. Trace the data flow end-to-end (user action → frontend → Supabase/Groq → response)
3. State your understanding of the local topology in a brief summary before writing code
4. If you can't see both sides of a boundary (frontend↔Supabase, audio↔transcription, webhook↔DB), say so explicitly

**Never:**
- Modify a file without tracing what imports it and what it imports
- Rename or refactor existing abstractions without flagging it first
- Introduce a new utility or hook if a similar one already exists (check INDEX.md first)

---

## Implementation Rules

- **Feature-based structure:** New code goes under `/src/features/<feature>/`. Don't dump into shared folders without reason.
- **Flow score is sacred:** `score = speakingTimeSec + floor(speakingTimeSec/60)*40 - hesitationCount*10`, floor 0. Never alter, rename, or approximate differently without explicit approval.
- **Supabase boundaries:** Always respect RLS. `supabaseServer` is server-only — never import it in frontend files. Browser client uses anon key + RLS only.
- **Pause threshold is fixed at 1.2s** — do not re-expose as a user setting.
- **Mode is always `'speaking'`** — normalize any legacy `free_speaking` on write; never store it.
- **Async seams:** Flag any race condition risk at audio capture boundaries, transcription callbacks, and real-time subscription handlers.
- **DRY:** `getWordCount` lives in `src/lib/core/utils.ts`, `arrayBufferToBase64` lives in `src/shared/lib/utils.ts`. Do not duplicate.

---

## Self-Review Protocol

After any code output, check:
- [ ] Did I trace both sides of every boundary I touched?
- [ ] Does this introduce any duplicate logic?
- [ ] Are there race conditions at async seams (audio, Groq callbacks, Supabase real-time)?
- [ ] Does this respect Supabase RLS? Is `supabaseServer` used only in server files?
- [ ] Is the Flow Score metric untouched or explicitly approved for change?

If any box is uncertain — flag it before finishing. Don't silently paper over gaps.

---

## Communication Rules

- Before your first tool call, state what you're about to do and why
- Prefer clarity over terseness — the goal is zero follow-up questions
- If the task spec is ambiguous, state your interpretation explicitly before proceeding
- Flag tensions (security, correctness, architecture) as `⚠️ TENSION:` inline

---

## What Claude (chat) Handles — Don't Overlap

Architecture decisions, prompt design, planning, and iteration happen in Claude chat before tasks reach you. Your role is implementation. If a task feels architecturally unclear, say so — don't invent a design.

---

## Keep MEMORY.md in Sync

After completing any task, check whether the change affects anything documented in `memory/MEMORY.md` — stack, data flows, scoring formula, database schema, API routes, Telegram architecture, env vars, high-centrality files, or invariants. If it does, update the relevant section in `memory/MEMORY.md` before closing the task.

---

## Knowledge Base

When I say "save note", create a markdown file in:
`/Users/viseeroy/Desktop/Obsidian Vault/NoPause/`

File naming: `YYYY-MM-DD-topic-slug.md`

Each note should include:
- **What we did** — short summary
- **Why** — decision or reason
- **Next** — what comes after

Never overwrite existing files. Always create new.
