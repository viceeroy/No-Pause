# Audit #5: Supabase Security & RLS

**Date:** 2026-05-24  
**Scope:** All Supabase tables, RLS policies, client queries, auth flow, and sensitive data exposure  

---

## Table-by-Table RLS Summary

| Table | RLS Enabled | Policies | Verdict |
|-------|-------------|----------|---------|
| `sessions` | **UNKNOWN — no migration enables it** | None found in migrations | **CRITICAL** |
| `streaks` | **UNKNOWN — no migration enables it** | None found in migrations | **CRITICAL** |
| `telegram_connections` | Yes | Users can SELECT own rows; service role ALL | OK |
| `api_usage_daily` | Yes | Service role only | OK |
| `challenges` | Yes | Service role only | OK |
| `telegram_challenge_state` | Yes | Service role only | OK |
| `telegram_challenge_attempts` | Yes | Service role only | OK |
| `telegram_friend_result_sends` | Yes | Service role only | OK |

---

## Findings

### CRITICAL-1: `sessions` table has NO RLS policies in migrations

**File:** All migration files  
**Evidence:** Grep for `sessions` + `enable row level security` or `create policy` across all migrations returns zero hits.  
**Attack scenario:** If RLS is disabled (or enabled with no policies), the browser anon client can query ALL users' sessions. Every call in `practiceApi.ts` (lines 32-38, 283-297) filters by `.eq("user_id", userId)` — but that's **client-side filtering**, not server-enforced. A malicious user could modify the JS or use the Supabase REST API directly with the anon key to read/write/delete any user's sessions.  
**What you gain by fixing:** Complete data isolation between users. Without this, a single curl command with your public anon key can dump every user's practice history, transcripts, and AI feedback.  
**Fix:** Add a migration:
```sql
alter table public.sessions enable row level security;

create policy "Users can read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Service role manages sessions"
  on public.sessions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

---

### CRITICAL-2: `streaks` table has NO RLS policies in migrations

**File:** No migration creates the streaks table with RLS  
**Evidence:** The `streaks` table is referenced in queries (`practiceApi.ts:293-297`, `session.ts:210-237`) but no migration in `supabase/migrations/` enables RLS or creates policies for it.  
**Attack scenario:** Any authenticated user (or even unauthenticated with the anon key if RLS is off) can read/modify any other user's streak data. A user could artificially inflate their streak or reset another user's.  
**What you gain by fixing:** Streak integrity per user.  
**Fix:** Same pattern as sessions — enable RLS, add per-user SELECT/INSERT/UPDATE + service_role ALL policy.

---

### HIGH-1: `get_practice_stats` RPC is `SECURITY DEFINER` without caller-owns-data guard

**File:** `supabase/migrations/add_practice_stats_rpc_and_api_usage.sql`  
**Evidence:** The function `get_practice_stats(p_user_id uuid, p_recent_limit integer)` is `SECURITY DEFINER` (runs as the function creator, which has elevated permissions). The `p_user_id` parameter is passed from the client with no validation that it equals `auth.uid()`.  
**Attack scenario:** Any authenticated user calls `get_practice_stats('other-user-uuid', 200)` and gets that user's full practice stats, session history, and streak data.  
**What you gain by fixing:** Users can only access their own stats.  
**Fix:** Add a guard at the top of the function:
```sql
if p_user_id != auth.uid() and auth.role() != 'service_role' then
  return null;
end if;
```
Or better: remove the `p_user_id` parameter entirely and use `auth.uid()` directly inside the function.

---

### HIGH-2: `consume_api_usage_daily` RPC accepts arbitrary `p_user_id`

**File:** `supabase/migrations/add_practice_stats_rpc_and_api_usage.sql`  
**Evidence:** The function `consume_api_usage_daily(p_user_id uuid, p_kind text, p_limit integer)` is `SECURITY DEFINER`. Currently only called from server-side code (API routes), but it's callable by any authenticated user via the Supabase REST API.  
**Attack scenario:** User A calls `consume_api_usage_daily('user-B-id', 'transcription', 20)` repeatedly to exhaust User B's quota, effectively denial-of-service on their transcription/feedback features.  
**What you gain by fixing:** Users can't exhaust others' quotas.  
**Fix:** Add a guard: `if p_user_id != auth.uid() and auth.role() != 'service_role' then return false; end if;`

---

### HIGH-3: AuthCallback `next` parameter allows open redirect

**File:** `src/providers/AuthContext.tsx:68-69`, `src/features/auth/pages/AuthCallbackPage.tsx:19`  
**Evidence:** `signInWithGoogle` passes `nextPath` to `getAuthCallbackUrl`, which becomes a `?next=` query param. On callback, `AuthCallbackPage.tsx:19` does `navigate(nextPath?.startsWith("/") ? nextPath : "/")`. The `startsWith("/")` check prevents `https://evil.com` but allows `//evil.com` (protocol-relative URL) which some browsers will follow.  
**Attack scenario:** Attacker crafts a link `https://nopause.org/auth/callback?next=//evil.com` which, after OAuth, redirects the user to `evil.com` (which could phish for credentials).  
**What you gain by fixing:** No user-controllable redirect destination.  
**Fix:** Stricter validation: `nextPath?.startsWith("/") && !nextPath.startsWith("//")` or use a URL constructor to validate it's same-origin.

---

### MEDIUM-1: Service role key not leaked to client (VERIFIED CLEAN)

**File:** `src/services/supabaseServer.ts`  
**Evidence:** Uses `process.env.SUPABASE_SERVICE_ROLE_KEY` (Node-only) — not `import.meta.env.VITE_*`. The Vite build will not bundle `process.env` values. `supabaseServer` is only imported in files under `api/`, `src/lib/telegram/`, `src/lib/core/user.ts`, `src/lib/telegramAuth.ts`, and `src/services/apiQuota.ts` — all server-side paths.  
**Verdict:** Clean. No service role key exposure.

---

### MEDIUM-2: Telegram webhook secret allows empty string bypass (edge case)

**File:** `api/telegram/webhook.ts:20-21`  
**Evidence:** 
```ts
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
if (!webhookSecret || getTelegramSecretToken(req) !== webhookSecret) {
```
If `TELEGRAM_WEBHOOK_SECRET` is unset, `webhookSecret` becomes `""`, and `!webhookSecret` is `true`, so the check short-circuits to 401. This is actually safe as written. However, if the env var is accidentally set to an empty string (e.g., `TELEGRAM_WEBHOOK_SECRET=""`), `webhookSecret` is `""`, `!""` is `true`, so it still rejects. **This is OK.**  
**Verdict:** Safe, but fragile — consider an explicit length check for defense-in-depth.

---

### MEDIUM-3: Internal API token fallback to TELEGRAM_BOT_TOKEN

**File:** `api/transcription.ts:64`  
**Evidence:**
```ts
const internalToken = process.env.NOPAUSE_INTERNAL_API_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
```
If `NOPAUSE_INTERNAL_API_TOKEN` is not set, the Telegram bot token is used as the internal API auth token. This means anyone who obtains the bot token (which Telegram considers semi-public for bots) can call the transcription API as an "internal" caller, bypassing quota limits.  
**Attack scenario:** Bot token is exposed (Telegram provides it to many services during webhook setup). Attacker uses it to call `/api/transcription` with the `x-nopause-internal-token` header, getting unlimited free transcriptions.  
**What you gain by fixing:** Separation of internal auth from Telegram credentials.  
**Fix:** Always require `NOPAUSE_INTERNAL_API_TOKEN` to be explicitly set. Remove the `TELEGRAM_BOT_TOKEN` fallback.

---

### MEDIUM-4: Telegram connect endpoint trusts client-supplied `user_id`

**File:** `api/telegram/connect.ts:151-174`  
**Evidence:** The client sends `{ telegram_id, user_id }`. The server validates `data.user?.id !== userId` against the access token, which is correct — it rejects mismatches. This is actually properly validated.  
**Verdict:** Safe. The `user_id` is verified against the JWT.

---

### LOW-1: Client queries pass `userId` from memory, not derived from session

**File:** `src/lib/practiceApi.ts:31-38, 190-224, 283-297`  
**Evidence:** All browser-side Supabase queries (e.g., `getBestSessionSummary(userId)`, `saveSession`, `updateSession`) receive `userId` as a parameter from React state, not from `supabase.auth.getUser()`. While RLS should enforce data isolation regardless of what `userId` the client passes, this pattern means the app is relying entirely on RLS for security — which, per CRITICAL-1 and CRITICAL-2, may not exist for `sessions` and `streaks`.  
**What you gain by fixing:** Defense in depth. Even if RLS has a gap, the app won't be querying the wrong user's data.  
**Fix:** Consider using a wrapper that always derives `userId` from the session, or add RLS (which makes this moot).

---

### LOW-2: `ConnectTelegram.tsx` passes `telegramId` from URL query params without HMAC verification

**File:** `src/pages/ConnectTelegram.tsx:20-23`  
**Evidence:** The `tg` query parameter is taken from the URL and sent to `/api/telegram/connect`. Anyone who knows a target's Telegram ID (public info) can craft a connect link. The server-side mitigates this by requiring a valid Supabase access token, but the attack surface is: if a user is tricked into clicking a crafted `/connect?tg=ATTACKER_TG_ID` link while logged in, the attacker's Telegram gets linked to the victim's NoPause account.  
**Attack scenario:** Social engineering — attacker sends victim a link `https://nopause.org/connect?tg=999999` (attacker's TG ID). If victim is logged in, their account connects to the attacker's Telegram, giving the attacker access to their sessions via the bot.  
**What you gain by fixing:** Only the legitimate Telegram user can initiate the connection.  
**Fix:** Sign the `tg` parameter with an HMAC using a server secret. Validate the signature on the connect endpoint.

---

## Summary by Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| **CRITICAL** | 2 | `sessions` and `streaks` tables likely missing RLS |
| **HIGH** | 3 | `get_practice_stats` RPC exploitable, `consume_api_usage_daily` DoS-able, auth redirect bypassable |
| **MEDIUM** | 2 | Internal token fallback to bot token, webhook secret edge case |
| **LOW** | 2 | Client-supplied userId pattern, unsigned Telegram connect link |

**Priority fix order:** CRITICAL-1 → CRITICAL-2 → HIGH-1 → HIGH-2 → HIGH-3 → MEDIUM-3 → LOW-2
