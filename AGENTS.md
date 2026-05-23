# AGENTS.md — NoPause

> Coding rules live in `CLAUDE.md`. This file adds Codex-specific behavior and the deploy workflow.

---

## Deploy Command

When the user says exactly `deploy`:

1. `git add -A` from `/Users/viseeroy/Desktop/NoPause`
2. `git commit -m "Deploy"` — if nothing to commit, continue
3. `git push` from `/Users/viseeroy/Desktop/NoPause`
4. `npm run build` from `/Users/viseeroy/Desktop/NoPause/No-Pause`
5. If build passes: `npx vercel deploy --prod --yes` from `/Users/viseeroy/Desktop/NoPause`
6. Report: production alias, deployment URL, inspect URL

No confirmation needed when the user says exactly `deploy`.
Do not run the Vercel command from the `No-Pause` subdirectory — Vercel project root is `/Users/viseeroy/Desktop/NoPause`.

---

## Task Scoping Rules

- Read only files needed for the task. Before reading extra files, explain why they're needed.
- Prefer a small targeted change over a broad refactor.
- Summarize long outputs instead of repeating them in full.
- Compact diffs only — no wall-of-code explanations.

---

## What Counts as Done

- Task spec is met
- Tests pass (if applicable)
- No unrelated files modified
- Session-end summary output (see CLAUDE.md)
- MEMORY.md updated if stack/schema/invariants changed

---

## Avoid

- Scanning the whole repo unless you can explain why
- Carrying old session context into new tasks — use `/clear` between tasks
- Fixing things not in scope — flag them instead
- Re-suggesting rejected stack choices (see MEMORY.md)
