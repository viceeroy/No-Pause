# Changelog

## May 19, 2026

Simplified the Results screen around Flow Score, pauses, and speaking time. The old standalone silence and session-length cards were removed, session duration now appears inside the Flow Score card in clock format, and the short-session message was tightened.

Standardized pause detection on one fixed 1.2-second threshold. The web app no longer exposes difficulty controls for pause strictness, Auth no longer stores difficulty metadata, and Telegram voice analysis uses the same fixed threshold.

## May 18, 2026

Moved all speech-to-text transcription onto Groq Whisper. The web transcription endpoint and Telegram voice-note flow now use the same Groq provider as AI feedback, while preserving word-level timestamps for pause detection and removing the old transcription provider configuration.

Removed filler-word counting from the practice and Telegram analysis path. Transcription now returns transcript text and word timestamps only, saved sessions no longer write `filler_count`, Telegram voice scoring uses pause units instead of filler counts, and the results screen focuses on speaking time and pauses.

Hardened Telegram voice and challenge preflight handling. The bot now catches account lookup failures with a friendly retry message, checks pending challenge state before acknowledging a voice note, clears stale or expired challenge state without transcribing or saving a session, and asks unconnected users to link their account before challenge retries continue.

Clarified Telegram account linking on the web connect page. The page now explains that the browser links whichever NoPause account is already signed in, so switching accounts should happen in the web app before opening the Telegram connect link again.

## May 13, 2026

Made the help page easier for crawlers to read. The app now prerenders the help page into a static HTML entry during the build, keeps the Vite fallback behavior working for the live SPA route, and points the sitemap and robots metadata at the canonical `/help` URL.

## May 12, 2026

Reworked the help page around NoPause as a speech-flow training product, then tightened the page back down after the heavier redesign pass. The final version keeps the product explanation deeper without exposing scoring internals, removes offline-first wording, and keeps the help route focused for search indexing.

Cleaned up small web UI details around the dashboard and practice entrypoints while keeping the visible product centered on Free Speaking. The dashboard metric card layout was simplified, and the help-page SEO metadata and sitemap route were brought in line with the crawlable help page.

## May 11, 2026

Expanded the help experience with a dedicated speaking-improvement section and collapsed article cards by default. The dashboard help entry now routes into the fuller help page instead of carrying the old inline help section.

Cleaned up the prompt and stats surfaces. Prompt loading and prompt-page behavior were simplified, old toast and monthly refresh code was removed, setup and recording UI copy was tightened, and the dashboard and stats pages were pared back around the current Free Speaking flow.

## May 10, 2026

Added the first full help page and route metadata, then started shaping it into a public product-support page. The page now has its own route, SEO title and description, and app navigation entry from the dashboard help area.

Plumbed total silence time through saved sessions and results. The session schema, Supabase migration, shared session types, practice API, scoring hook, stats display, and architecture tests now use the analyzer's `totalSilenceTime` field instead of recalculating it in the UI.

Improved the practice finish flow so ending a session can move immediately into a result-loading skeleton while transcription and scoring continue. Result transcript cleanup also hides raw marker formatting, and the countdown/finish states were adjusted to feel more responsive.

Tightened Telegram behavior and copy around private commands, group handling, and voice feedback. The bot gained stronger guards for duplicate voice processing and friend-result sending, `/register` account-linking support, cleaner private command registration, and simpler status/action wording while keeping group-only interactions quiet where intended.

## May 9, 2026

Tightened the Telegram group behavior so private reply-keyboard actions stay private. If someone types the private keyboard labels in a group, Speak, Challenge, My Stats, and About now silently do nothing instead of posting private-flow messages into the group.

Removed old unreachable Telegram callback helpers and refreshed bot copy so Speak owns the prompt entrypoint. The connect welcome and About message now describe Get Prompt as an inline option under Speak, and the system notes now describe group challenge results as Send to Group / Try Again.

## May 8, 2026

Finished the group challenge leaderboard and owner controls in Telegram. The leaderboard button now shows the top scores for a challenge, including each person's best Flow Score and how many times they tried. Challenges now close after 24 hours, and only the person who started the group challenge can change the prompt.

Fixed friend challenge accept links so tapping the same challenge again does not create duplicate pending state. If someone already accepted or submitted that challenge, the bot now reminds them that it is already accepted and tells them to send their voice note if they have not yet.

Changed the Telegram private reply keyboard so the old Get Prompt button is now Speak. Tapping Speak now explains that users can send any voice note to be scored, with an inline Get Prompt button available when they want a topic first.

## May 7, 2026

Built out the Telegram group challenge flow. The bot now adds a welcome message in groups, shows a styled challenge card from `/nopause`, and quietly ignores `/start` and `/about` in group chats. The Speak path now sends people from the group into a private chat with the bot, lets them send a voice note there, keeps track of how many times they have tried that challenge, and adds buttons to send the result back to the group or approve it with a simple green check message.

## May 7, 2026

Cleaned up the repository so local setup files, deployment metadata, environment files, and generated artifacts are not tracked as app changes. The ignore rules were tightened, example environment values were kept for reference, and older scoring notes were removed from the active tracked files.

## May 6, 2026

Reworked the app's Supabase and AI service setup. Practice stats moved toward a database-backed summary path, daily usage tracking was added, and the transcription and feedback routes were brought into the shared quota and service structure. Telegram voice handling, connection behavior, architecture tests, and system docs were updated to match the new setup. A small deploy follow-up adjusted the Telegram connect endpoint.

## May 5, 2026

Improved the Telegram bot connection and challenge flow. The bot now handles welcome messages more reliably, avoids duplicate reconnect welcomes, and has updated routing, challenge text, and connect-page behavior. The same round also synced current app changes around recording, scoring, transcription, Gemini and Groq feedback services, and Telegram voice handling.

## May 3, 2026

Made a broad launch-readiness pass across scoring, transcription, Telegram voice notes, and AI feedback. Session scoring and speech timing were recalibrated, stats and result screens were adjusted, and Telegram voice notes gained automatic AI feedback with clearer timeout and error handling. The AI provider setup was revised for server-side transcription and fast feedback, with docs and tests updated around those decisions. Several Telegram launch blockers were fixed in routing, challenge handling, stats queries, and the practice page.

## May 2, 2026

Simplified the product around open-ended speaking practice. Old practice modes and dead code were removed, the main mode was renamed to speaking, and architecture tests were added to protect the shape of the app. A new scoring model was introduced, recording gained a countdown and warm-up buffer, stats got monthly and all-time views, and Telegram challenge messages became clearer with difficulty syncing, group safeguards, and better retry behavior.

## May 1, 2026

Redesigned the web app around a darker free-speaking experience and restored the prompt flow. The practice screens, results, dashboard, auth pages, visualizer, prompts, and shared styling were polished together. The audio and Telegram code was also split into smaller pieces, server-side AI boundaries were tightened, build problems were fixed, and internal transcription calls were made safer.

## April 28, 2026

Focused heavily on the visible practice experience. The homepage, stats, prompt previews, recording panel, setup screen, mic-first interaction, start and finish buttons, and responsive prompt grid all received layout and usability polish. Blog content and reading challenge pages were also refreshed, and navigation was simplified around free speaking.

## April 27, 2026

Expanded and cleaned up the Telegram experience. Web and Telegram sessions were brought into one stats model, session source tracking was added, bot stats were filtered by source, challenges started saving their state, and Telegram result messages became clearer. Shared speech analysis, scoring, query, session, storage, and Telegram helper code was cleaned up so both the website and bot could use the same core behavior.

## April 26, 2026

Built out the first larger Telegram wave. The bot gained welcome messages, group challenges, friend challenges, shared stats, scoring, and session saving. The short-lived Telegram Mini App work was added and then removed as the bot flow became the main direction. Shared user and query logic was centralized, the Telegram welcome banner was updated, and several server and typing issues were fixed.

## April 25, 2026

Stabilized the recording and Telegram voice message path. The microphone was released more reliably after recording, prompts were cleaned up, pause scoring was adjusted, server environment handling was fixed, and tracked dependency clutter was removed from the repo.

## April 20, 2026

Moved the app into a feature-based structure and cleaned up the code organization. This included type-safety work, better error handling, and a clearer layout for the main app areas.

## April 7, 2026

Updated scoring documentation and blog content so the explanation of flow score matched the shared scoring constants. Also added ignore rules for macOS `.DS_Store` files.

## March 19, 2026

Fixed the practice transcription callback so it receives the session duration, then restored typechecking and tests after the change.

## March 15, 2026

Tightened transcript handling by dropping very short transcripts that looked like hallucinations, and hid word count when the app did not have a real value to show.

## March 13, 2026

Iterated on onboarding, authentication, stats, and reading challenge polish. The onboarding flow was added, adjusted, reverted in places, and then refined around button placement and layout. Stats gained pagination and clearer practice breakdowns, result buttons and numeric labels were aligned, blog cards and headers were simplified, and Vercel metadata was ignored.

## March 12, 2026

Made stats more reliable and responsive. Stats queries now wait for auth, react to fresh data, include all practice modes and zero scores, and show flow score more consistently. The voice acting mode was renamed to reading challenge, transcription was forced to English, silence hallucinations were reduced, and the home and result screens got smoother UI touches.

## March 11, 2026

Added new practice experiences and navigation polish. Reading challenge and voice acting modes were introduced, voice acting results were simplified and aligned with the main results screen, swipe navigation was added and refined, prompt screens were kept from scrolling awkwardly, and dashboard social cards were replaced with compact icon buttons.

## March 10, 2026

Added manual transcription and AI feedback flows. Users gained a manual feedback button, loading states, and richer results around speech analysis. The app also introduced Groq transcription through Convex, OpenRouter-based speech analysis, model and logging tweaks, safer transcription error handling, pause-count fixes, and a refreshed dashboard card layout.

## March 9, 2026

Cleaned up the early app and scoring foundation. The microphone pipeline was stabilized, Android audio issues were worked through, flow score and streak calculations were corrected, a scoring blog post was added, old unused files and local storage leftovers were removed, and the README was rewritten to describe the web audio scoring product more accurately.

## March 8, 2026

Moved the app's saved stats and recent activity toward Convex and Clerk-backed accounts. The day included a lot of auth, sync, and stats fixes: profile cards, Google sign-in styling, production environment updates, safer query behavior, remote-first stats, session saving, best streak tracking, mobile auth polish, and blog layout improvements. Several Android and iOS recording fixes were also made while stabilizing microphone behavior.

## March 7, 2026

Converted the app into the current single-repository structure and added the Vercel build setup. Follow-up fixes made generated Convex imports work during Vite builds and triggered a redeploy.

## February 21, 2026

Cleaned up the root project files by removing an old root package setup and tracked dependencies. A stats export/import backup was also added.

## February 16, 2026

Added early logging around free-speech completion so recording sessions could be debugged more easily.
