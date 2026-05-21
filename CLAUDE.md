# CLAUDE.md — NoPause Coding Agent Instructions

You are working on **NoPause** (nopause.org) — a live speech fluency PWA.
The owner reviews all architecture and plans with Claude (chat) first. Your job is execution: implement what's been designed, map before you touch, and flag every uncertainty explicitly.

---

## Stack Topology

Before writing any code, orient yourself to this architecture:

```
Frontend (React + TypeScript + Vite)
  └── Feature-based architecture under /src/features/
  └── PWA, mobile-first UI
  └── Clerk — auth (webhooks → backend)

Backend / Data
  └── Supabase — primary DB, auth sync, real-time
  └── Groq — transcription + LLM-based coaching
  └── Loops.so — email onboarding (triggered via Clerk webhooks)

Extensions
  └── Telegram bot — speech session extension
```

**High-centrality files to locate before touching anything:**
- Audio pipeline entry point (recording → transcription flow)
- Flow score computation logic (`flow score` = continuous speech with fewer hesitations — this is the core metric, never rename or redefine it)
- Supabase client initialization and RLS policies
- Clerk webhook handler
- Groq API integration layer

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
- [ ] Does this respect Supabase RLS and Clerk auth flow?
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
