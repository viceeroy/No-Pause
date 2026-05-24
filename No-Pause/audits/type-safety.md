# Audit #2: Type Safety & Null Safety

**Date:** 2026-05-24  
**Scope:** Explicit and implicit `any`, unsafe `as` casts, `@ts-ignore`/`@ts-expect-error`, missing null/undefined checks, Supabase type coverage, return type mismatches, and tsconfig strictness

---

## Compiler Configuration Issues

### HIGH-1: `strict: false` and `noImplicitAny: false` in frontend tsconfig

**File:** `tsconfig.app.json:17-18`  
**Evidence:** `"strict": false` and `"noImplicitAny": false`. This means TypeScript won't flag implicit `any` in function parameters, untyped destructuring, or missing type annotations. The compiler silently permits patterns that would fail in a strict codebase.  
**Contrast:** `tsconfig.node.json` correctly sets `"strict": true` for API routes and server-side code.  
**Impact:** The entire frontend (`src/`) can harbor implicit `any` types without any compiler warning. Bugs can hide in event handlers, callback parameters, and reducer logic where types are inferred as `any`.  
**What you gain by fixing:** Compiler catches null dereferences, missing properties, and type mismatches at build time instead of at runtime.  
**Fix:** Set `"strict": true` in `tsconfig.app.json`. Then fix the resulting errors incrementally. At minimum, enable `"noImplicitAny": true` in the root `tsconfig.json` (which currently sets it to `false`).

---

## Unsafe `as` Casts

### HIGH-2: `as unknown as SupabaseLike` double-cast bypasses type checking entirely

**Files:** `practiceApi.ts:25`, `voiceHandler.ts:52`, `queries.ts:236`  
**Evidence:**
```
browserSupabase as unknown as SupabaseLike     // practiceApi.ts:25
supabaseServer as unknown as SupabaseLike      // voiceHandler.ts:52
supabase as unknown as SupabaseRpcLike         // queries.ts:236
```
The `as unknown as X` pattern is the TypeScript equivalent of a C-style cast — it tells the compiler "trust me, this is fine" with zero structural validation. The `SupabaseLike` interface (`session.ts:28-30`) only declares `.from(table)`, but the real Supabase client has `.auth`, `.rpc`, `.storage`, etc. If `SupabaseLike` ever drifts from the actual Supabase client API (e.g., a Supabase SDK upgrade changes `.from()` return shape), the compiler won't catch it.  
**Impact:** Medium — works today, but is a silent breakage vector on SDK upgrades.  
**Fix:** Use proper type narrowing or generic wrappers. Alternatively, define `SupabaseLike` as `Pick<SupabaseClient, 'from'>` using the actual Supabase type so structural compatibility is enforced.

---

### HIGH-3: `readJsonBody` returns implicit `any`

**Files:** `api/feedback.ts:11-19`, `api/telegram/connect.ts:15-22`  
**Evidence:** `readJsonBody` has no return type annotation. `JSON.parse(raw)` returns `any`. Callers use the result without type narrowing:
- `feedback.ts:72`: `const input = getFeedbackInput(body as Record<string, unknown>)` — casts the `any` to `Record<string, unknown>`, but this is a trust cast.
- `connect.ts:150`: `const telegramId = Number(body.telegram_id)` — accesses `.telegram_id` on an untyped object.  
**Impact:** If an attacker sends `{"toString": {"__proto__": ...}}`, the code won't flag it. More practically, any typo in property names (`body.telegramId` vs `body.telegram_id`) won't be caught.  
**Fix:** Add explicit return type `Promise<Record<string, unknown>>` and cast `JSON.parse(raw) as Record<string, unknown>`. Or better: use a schema validation library (zod) to parse the body into a typed shape.

---

### MEDIUM-1: Supabase `.data` cast to `SessionRecord[]` without structural validation

**Files:** `practiceApi.ts:55,61,299,301,323,325,334,335,340,341,368,398,404` and `queries.ts:116,122,264`  
**Evidence:** Throughout the codebase, Supabase query results are cast with `as SessionRecord[]` or `as SessionRecord | null`:
```
return data as SessionRecord | null;         // practiceApi.ts:61
let allTimeSessions = ...data as SessionRecord[] | null;  // practiceApi.ts:299
return data as StreakRecord | null;           // queries.ts:264
```
Supabase's `.select()` returns `{ data: unknown; error: unknown }` when no generated types are used. These casts assume the DB schema matches `SessionRecord` exactly. If a column is renamed, added, or has a different type in the DB, the cast hides the mismatch.  
**Impact:** Data shape mismatches are silent at compile time. For example, `SessionRecord.source` is typed `"web" | "telegram" | string | null` but the DB might return other values.  
**What you gain by fixing:** Compile-time guarantees that your types match the database.  
**Fix:** Generate Supabase types with `supabase gen types typescript` and use `Database['public']['Tables']['sessions']['Row']` instead of manual `SessionRecord`. The Supabase CLI generates types from the actual schema.

---

### MEDIUM-2: Telegram `ctx.message` cast to ad-hoc object shapes

**Files:** `router.ts:56,67`, `challenges.ts:416`  
**Evidence:**
```ts
const message = ctx.message as { text?: unknown } | undefined;     // router.ts:56
const message = ctx.message as { new_chat_members?: Array<...> };  // router.ts:67
const chat = await ctx.telegram.getChat(id) as { username?; ... }; // challenges.ts:416
```
These casts define inline types that may not match the actual Telegraf/Telegram Bot API types. If Telegraf updates its `Context` type, these ad-hoc casts won't flag the change.  
**Impact:** Low — Telegraf types are well-tested, and the casts are conservative (optional properties). But it's fragile.  
**Fix:** Use Telegraf's built-in `message('text')` filter or `Context.message.text` with proper type narrowing.

---

### MEDIUM-3: `VerboseTranscriptionResponse` cast in voiceHandler

**File:** `voiceHandler.ts:223`  
**Evidence:** `const data = await transcribeAudioWithGroq(audioBuffer) as VerboseTranscriptionResponse`. But `transcribeAudioWithGroq` already returns `Promise<GroqTranscription>` (a well-typed object). The cast to `VerboseTranscriptionResponse` (a local type with `transcript?`, `text?`, `words?`) widens the type — the caller then accesses `data.transcript ?? data.text` which wouldn't be needed if it used the actual return type directly.  
**Impact:** The `transcript` field access is a no-op — `GroqTranscription` returns `text`, not `transcript`. The `data.transcript` expression always evaluates to `undefined`, so it falls through to `data.text`. This works by accident.  
**Fix:** Remove the cast and use the return type directly: `const { text, words } = await transcribeAudioWithGroq(audioBuffer)`.

---

### MEDIUM-4: `error as { code?; message? }` pattern used without type guard

**Files:** `session.ts:90`, `queries.ts:126`, `voiceHandler.ts:164,174`, `challenges.ts:72`  
**Evidence:** Five functions check Supabase/Telegram errors using `const maybeError = error as { code?: string; message?: string } | null`. This works but silently succeeds even if `error` is a string, number, or completely different object shape.  
**Impact:** Low — the optional chaining (`maybeError?.code`) prevents crashes. But a non-object `error` (e.g., `throw "some string"`) would silently not match any condition, falling through to "unknown error" handling.  
**Fix:** Add a type guard: `if (error && typeof error === 'object' && 'code' in error)`.

---

### LOW-1: `process.env` non-null assertions in supabaseServer.ts

**File:** `supabaseServer.ts:3-4`  
**Evidence:** `process.env.SUPABASE_URL!` and `process.env.SUPABASE_SERVICE_ROLE_KEY!` use non-null assertion. The runtime check on lines 6-8 catches the missing case, but the `!` assertion happens before the check — `createClient` is called with possibly-undefined arguments at line 10.  
**Actually:** Lines 3-4 assign the values with `!`, then lines 6-8 throw if they're missing, then line 10 uses them. Since the throw happens before line 10 executes, this is safe at runtime. But the `!` is still misleading — it tells the compiler the values are always defined when they might not be.  
**Fix:** Remove `!`, check at assignment, and narrow the type:
```ts
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!supabaseUrl || !supabaseServiceKey) throw ...;
```

---

### LOW-2: `process.env as Record<string, string | undefined>` in groq.ts

**File:** `groq.ts:39`  
**Evidence:** `(process.env as Record<string, string | undefined>)`. This is actually safer than a non-null assertion — it correctly types `process.env` values as possibly-undefined. But the `typeof process !== "undefined"` guard on line 37 is unusual — this file is server-only (included in `tsconfig.node.json`), so `process` is always defined.  
**Impact:** None — just unnecessary defensive code.

---

## Missing Null/Undefined Checks

### HIGH-4: `lastResults.transcript.trim()` without null guard in useSession

**File:** `useSession.ts:79`  
**Evidence:** `const transcript = lastResults.transcript.trim()`. `SessionResult.transcript` is typed as `string` (not optional), so this is type-safe. But earlier in the flow (`useScoring.ts` → `buildSessionResult`), `transcript` is set from `analyzer.getTranscript()` which could return `''`. If `transcript` were ever set to `undefined` at runtime (e.g., from a Supabase row with null transcript), `.trim()` would throw.  
**Impact:** Low — the type says it's always a string, but the runtime reality depends on the data flow. A defensive `(lastResults.transcript || '').trim()` costs nothing.  
**Fix:** Optional: add `|| ''` for defense. More important: ensure `SessionResult.transcript` is never assigned `undefined` anywhere.

---

### MEDIUM-5: `user?.user_metadata?.avatar_url as string | undefined`

**Files:** `StatsPage.tsx:214`, `DashboardPage.tsx:93`  
**Evidence:** Both files cast `user?.user_metadata?.avatar_url as string | undefined`. The Supabase `User.user_metadata` type is `Record<string, unknown>` (or `UserMetadata`), so `avatar_url` is `unknown`. The cast is necessary but skips validation — if Google OAuth returns `null` or a number for `avatar_url`, the app would pass a non-string to an `<img src>`.  
**Impact:** Low — Google OAuth reliably returns a string URL. But it's not validated.  
**Fix:** Use `typeof user?.user_metadata?.avatar_url === 'string' ? ... : undefined`.

---

### MEDIUM-6: `displayName` falls back to `'User'` but `part[0]` could be undefined

**Files:** `StatsPage.tsx:212-219`, `DashboardPage.tsx:92-99`  
**Evidence:**
```ts
const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2)
  .map((part) => part[0]?.toUpperCase() ?? '')
```
`displayName` is `unknown || unknown || 'User'`. The `||` chain falls back to `'User'` which is always a string, so `.split()` is safe. The `part[0]?.toUpperCase()` optional chain handles empty strings. This is actually safe — but `displayName` is `unknown` from `user_metadata`, not `string`. With `strict: false` this compiles, but with `strict: true` it would error because you can't call `.split()` on `unknown`.  
**Impact:** Blocked by HIGH-1 (strict mode is off). If you enable strict mode, this breaks.

---

### LOW-3: `decodeURIComponent(authError)` can throw

**File:** `AuthCallbackPage.tsx:33`  
**Evidence:** `{decodeURIComponent(authError)}` — if `authError` contains a malformed percent-encoding (e.g., `%E0%A4%A`), `decodeURIComponent` throws `URIError`. React will catch it in an error boundary if one exists, but the component will crash.  
**Impact:** Edge case — an attacker would need to craft a specific URL. But it's a guaranteed crash for that URL.  
**Fix:** `try { decodeURIComponent(authError) } catch { authError }`.

---

## Return Type Mismatches

### MEDIUM-7: `readJsonBody` implicit return type differs between files

**Files:** `api/feedback.ts:18` vs `api/telegram/connect.ts:22`  
**Evidence:** Both return `raw ? JSON.parse(raw) : {}`. The return type is implicitly `any`. In `feedback.ts:72`, the caller casts to `Record<string, unknown>`. In `connect.ts:150`, properties are accessed directly on the `any` return.  
**Impact:** The two implementations are identical but independent — a fix to one doesn't fix the other. Both should be a shared utility with a proper return type.  
**Fix:** Extract to a shared `readJsonBody` with explicit `Promise<Record<string, unknown>>` return type, or add body size limit (see error-handling audit MEDIUM-1).

---

### LOW-4: `FlowScoreOptions.hasSpeechEvidence` declared but never read

**File:** `scoring.ts:9`  
**Evidence:** `hasSpeechEvidence?: boolean` in `FlowScoreOptions`, but `calculateFlowScore` never reads it. The Telegram path passes it (`voiceHandler.ts:242`) but it's ignored. This is a dead interface member.  
**Impact:** Confusing API surface — callers pass a value that does nothing.  
**Fix:** Remove from the interface, or implement the check.

---

## `@ts-ignore` / `@ts-expect-error` Usage

**Finding:** Zero instances across the entire codebase. This is clean.

---

## Explicit `any` Usage

**Finding:** Zero instances of explicit `any` type annotations in production code (`src/`, `api/`). The codebase avoids explicit `any` entirely, which is excellent. However, implicit `any` is allowed because `noImplicitAny: false` (HIGH-1).

---

## Supabase Generated Types

### MEDIUM-8: No Supabase generated types used anywhere

**Evidence:** The codebase defines its own `SessionRecord`, `StreakRecord`, `SupabaseLike`, and `SupabaseRpcLike` types manually. There is no `supabase/types.ts` or generated type file from `supabase gen types`. Every Supabase query result is cast from `unknown` to these manual types.  
**Impact:** The TypeScript types and the actual database schema can drift apart silently. Column renames, type changes, or new columns won't be caught at compile time.  
**What you gain by fixing:** Type-safe database queries where the compiler validates that your select columns exist and have the right types.  
**Fix:** Run `supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts` and use the generated types in your Supabase client instantiation: `createClient<Database>(url, key)`.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 4 | `strict: false` in frontend, double-cast `as unknown as`, untyped JSON.parse, null-chain on transcript |
| **MEDIUM** | 8 | Supabase data casts without validation, no generated types, ad-hoc Telegram casts, dead interface members |
| **LOW** | 4 | Non-null assertions on env vars, decode throw, defensive guards |

**Priority fix order:** HIGH-1 (enable strict mode) → MEDIUM-8 (generate Supabase types) → HIGH-3 (type `readJsonBody`) → HIGH-2 (replace double-casts with proper types) → MEDIUM-1 (use generated types for query results)

**Positive findings:**
- Zero `@ts-ignore` or `@ts-expect-error` directives
- Zero explicit `any` annotations in production code
- `strictNullChecks: true` is enabled (the most important strict flag)
- Server-side code (`tsconfig.node.json`) has `strict: true`
- Error handling uses safe patterns (`error instanceof Error`, optional chaining)
