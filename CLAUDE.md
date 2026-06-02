# CLAUDE.md — NoPause

**NoPause** (nopause.org) — live speech fluency PWA. Solo founder. Implementation only. Architecture is pre-decided in Claude chat. If unclear, ask — don't invent.

> Full reference: `memory/system.md` (stack, schema, data flows, invariants, decision log)
> Failure patterns: `memory/ERRORS.md` (check before similar tasks)
> Import graph: `INDEX.md` (check before adding dependencies)

---

## Who You're Working With

Solo founder, time-constrained, working between factory shifts. Every wasted cycle costs real money. Be concise. No filler. Match response length to task complexity.

---

## Locked Stack

Do not suggest alternatives. Flag mismatches before proceeding.

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite |
| Auth | Supabase Auth — Google OAuth, PKCE (no Clerk) |
| DB | Supabase (Postgres + RLS + real-time) |
| Transcription | Groq Whisper (`api/transcription.ts`) |
| AI Coaching | Groq LLM (`src/services/aiFeedback.ts`) |
| Hosting | Vercel (frontend + serverless API routes) |
| Bot | Telegram (`@NoPauseAI_bot`) |
| Package manager | npm |
| Styling | Tailwind CSS |

---

## High-Centrality Files

Locate these before touching anything. Wrong import = RLS bypass or browser crash.

- `src/lib/core/scoring.ts` — Flow Score formula (sacred)
- `src/features/practice/lib/speechAnalyzer.ts` — audio state machine, pause detection
- `src/lib/practiceApi.ts` — all Supabase session writes and stats reads
- `src/services/supabase.ts` — browser client (anon key + RLS only)
- `src/services/supabaseServer.ts` — server-only (never import in frontend)
- `src/providers/AuthContext.tsx` — auth state, used by almost every feature
- `src/lib/telegram/router.ts` — bot command routing
- `src/lib/telegram/voiceHandler.ts` — Telegram voice processing and session saving

---

## Before Every Task

1. Identify all files affected
2. Trace data flow end-to-end
3. State your topology understanding in one paragraph before writing code
4. If you can't see both sides of a boundary — say so

---

## Hard Rules

- **Flow Score is frozen:** `score = max(0, speakingTimeSec + floor(speakingTimeSec/60)*20 - round(totalSilenceSeconds))`, requires ≥5s speaking (else score 0, not completed). Subtracts total silence **seconds**, not a pause count. Source of truth: `src/lib/core/scoring.ts` (`calculateFlowScore`). AI content bonus added separately via `applyBandBonus` (`+band*10` when score > 0). Never alter, rename, or approximate differently.
- **Silence threshold is fixed at 1.5s** (`DEFAULT_PAUSE_THRESHOLD`). Word-timestamp gaps ≥1.5s count as silence; shorter gaps ignored. Not a user setting.
- **Mode is always `'speaking'`.** Normalize legacy `free_speaking` on write, never store it.
- **RLS always.** `supabaseServer` is server-only — never import in frontend files.
- **Stay in scope.** Only modify lines related to the task. Flag other issues, don't fix them silently.
- **Simplest solution first.** No unrequested abstractions or refactors.
- **No duplicates.** `getWordCount` → `src/lib/core/utils.ts`. `arrayBufferToBase64` → `src/shared/lib/utils.ts`. Check INDEX.md before adding anything.
- **Confirm before:** deletes, overwrites, schema migrations, irreversible commands.
- **Hard stop for:** production deploys, schema changes, external API calls with side effects. Need explicit "yes" in current message.

---

## Self-Review (Before Submitting)

- [ ] Traced both sides of every boundary touched?
- [ ] No duplicate logic introduced?
- [ ] Race conditions checked at audio, Groq callbacks, Supabase real-time?
- [ ] `supabaseServer` only in server files?
- [ ] Flow Score untouched or explicitly approved?
- [ ] Stayed in scope — no unrequested changes?

---

## Session-End Summary (Required)

```
Files changed: [list]
What changed per file: [one line each]
Intentionally not touched: [list]
Follow-up needed: [list or "none"]
system.md needs update: [yes/no — which section]
```

---

## Communication

- State what you're about to do before first tool call
- Ambiguous spec → state your interpretation before proceeding
- Flag tensions as `⚠️ TENSION:` inline
- Use `/clear` between unrelated tasks

---

## Obsidian Vault Logging

Vault: `/Users/viseeroy/Desktop/viseeroy/No Pause/`. Source only from codebase + `memory/system.md` — no invented facts. No theme/styling content. Link notes with `[[wikilinks]]`. Never touch the founder's `Thoughts/` folder.

After completing any significant task or feature:

1. Update the vault `Changes/` folder — descriptive file names (≤5 words), includes **Agent Reference** section with file paths and technical details.

For new/changed features or architecture:
- `About/` — one note per feature group, named with the actual codebase name (≤4 words), human + technical.
- `Architecture/` — mermaid diagrams (System Overview, Web/Telegram flows, Scoring Pipeline, Data Model, Source Layout).
- `Rules/` — strict invariants only.
- Skip vault updates for small fixes and minor tweaks.

For system/architecture updates (stack changes, major refactors), also append to `memory/system.md` — new entries at top with date.
