# CLAUDE.md — NoPause Coding Agent Instructions

You are working on **NoPause** (nopause.org) — a live speech fluency PWA.
The owner reviews all architecture and plans with Claude (chat) first. Your job is execution: implement what's been designed, map before you touch, and flag every uncertainty explicitly.

---

## Stack Topology

Before writing any code, orient yourself to this architecture:

```
Frontend (React + TypeScript + Vite)
  └── Feature-based architecture under /src/features/ (auth, practice, stats)
  └── Cross-feature logic in /src/lib/core/, /src/lib/telegram/, /src/services/
  └── PWA, mobile-first UI
  └── Supabase Auth — PKCE flow (no Clerk)

Backend / Data
  └── Supabase — primary DB, auth, real-time
  └── Groq — transcription (api/transcription.ts) + LLM-based coaching (src/services/aiFeedback.ts)

Extensions
  └── Telegram bot — speech session extension (src/lib/telegram/, api/telegram/webhook.ts)
```

**High-centrality files to locate before touching anything:**
- Audio pipeline: `src/features/practice/lib/audioCapture.ts`, `audioRecording.ts`, `transcription.ts`
- Flow score computation: `src/features/practice/hooks/useScoring.ts`, `src/lib/core/scoring.ts`, `src/features/practice/lib/speechSession.ts`
- Supabase client: `src/services/supabase.ts` (client), `src/services/supabaseServer.ts` (server-side)
- Groq integration: `src/services/groq.ts`, `api/transcription.ts`
- Telegram webhook: `api/telegram/webhook.ts`

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
- Introduce a new utility or hook if a similar one already exists (check for duplicates)

---

## Implementation Rules

- **Feature-based structure:** New code goes under `/src/features/<feature>/`. Don't dump into shared folders without reason.
- **Flow score is sacred:** The metric is defined as continuous speech with fewer hesitations. Never alter its definition, rename it, or approximate it differently without explicit instruction.
- **Supabase boundaries:** Always respect RLS. Never bypass row-level security for convenience. Check if a query should go through an edge function vs. direct client call.
- **Async seams:** Flag any race condition risk at audio capture boundaries, transcription callbacks, and real-time subscription handlers.
- **DRY:** Before adding a function, search for existing ones that do the same thing. Duplicate logic in audio/transcription code is a known risk area.

---

## Self-Review Protocol

After any code output, check:
- [ ] Did I trace both sides of every boundary I touched?
- [ ] Does this introduce any duplicate logic?
- [ ] Are there race conditions at async seams (audio, Groq callbacks, Supabase real-time)?
- [ ] Does this respect Supabase RLS and Supabase Auth (PKCE) flow?
- [ ] Is the flow score metric untouched or explicitly approved for change?

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
