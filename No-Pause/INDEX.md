# Project Index

Static index for files under `src/` and `api/`. Importers are internal project files only.

## Client Audio Pipeline

| File | Exports | Imported by |
| --- | --- | --- |
| `src/features/practice/hooks/useRecording.ts` | `useRecording` | `src/features/practice/pages/useRecordingController.ts` |
| `src/features/practice/hooks/useScoring.ts` | `BuildSessionResultInput`, `BuildSessionResultOutput`, `buildSessionResult`, `useScoring` | `src/features/practice/hooks/useRecording.ts`, `src/features/practice/pages/useRecordingController.ts` |
| `src/features/practice/hooks/useSession.ts` | `useSession` | `src/features/practice/pages/useRecordingController.ts` |
| `src/features/practice/lib/analyzer/diagnostics.ts` | `AnalyzerDiagnosticsSnapshot`, `PlatformDiagnostics`, `BuildDiagnosticsSnapshotArgs`, `createDiagnosticsSessionId`, `getBrowserFromUserAgent`, `getOsVersionFromUserAgent`, `getPlatformDiagnostics`, `buildDiagnosticsSnapshot` | `src/features/practice/lib/analyzer/diagnostics.test.ts`, `src/features/practice/lib/audioCapture.ts`, `src/features/practice/lib/speechAnalyzer.ts` |
| `src/features/practice/lib/analyzer/diagnostics.test.ts` | None | None |
| `src/features/practice/lib/analyzer/micStateMachine.ts` | `HesitationLogItem`, `MicStateSnapshot`, `MicStateFrameInput`, `MicStateFrameOutput`, `FinalizeMicStateInput`, `FinalizeMicStateOutput`, `applyMicStateFrame`, `finalizeMicState` | `src/features/practice/lib/analyzer/mic-state-machine.test.ts`, `src/features/practice/lib/speechSession.ts` |
| `src/features/practice/lib/analyzer/mic-state-machine.test.ts` | None | None |
| `src/features/practice/lib/audioCapture.ts` | `AudioCaptureFrame`, `AudioCaptureStopResult`, `AudioCapture` | `src/features/practice/lib/speechAnalyzer.ts`, `src/features/practice/lib/speechSession.ts` |
| `src/features/practice/lib/audioRecording.ts` | `createAudioAnalyzer` | `src/features/practice/hooks/useRecording.ts` |
| `src/features/practice/lib/micService.ts` | `MicInitOptions`, `micService` | `src/features/practice/hooks/useRecording.ts` |
| `src/features/practice/lib/speechAnalyzer.ts` | `AnalyzerDiagnosticsSnapshot`, `AnalyzerResults`, `AudioDataPayload`, `AudioAnalyzer` | `src/features/practice/hooks/useRecording.ts`, `src/features/practice/hooks/useScoring.ts`, `src/features/practice/lib/audioRecording.ts`, `src/features/practice/lib/speechAnalyzer.test.ts`, `src/features/practice/pages/RecordingPanel.tsx`, `src/features/practice/pages/types.ts`, `src/features/practice/pages/usePracticeState.ts` |
| `src/features/practice/lib/speechAnalyzer.test.ts` | None | None |
| `src/features/practice/lib/speechSession.ts` | `SpeechSessionOptions`, `SpeechSessionFinalStats`, `SpeechSession` | `src/features/practice/lib/speechAnalyzer.ts` |
| `src/features/practice/lib/speechTypes.ts` | `AudioDataPayload`, `AnalyzerResults` | `src/features/practice/lib/speechAnalyzer.ts`, `src/features/practice/lib/speechSession.ts` |
| `src/features/practice/lib/transcription.ts` | `TranscribeAudio`, `processTranscriptForFillerWords`, `TranscriptionController` | `src/features/practice/lib/speechAnalyzer.ts` |
| `src/features/practice/pages/time.ts` | `toMMSS`, `formatTime`, `formatMMSS` | `src/features/practice/hooks/useScoring.ts`, `src/features/practice/pages/RecordingPanel.tsx`, `src/features/practice/pages/ResultPanel.tsx` |
| `src/features/practice/pages/types.ts` | `PracticeState`, `TopicPrompt`, `SessionResult`, `PracticeStateStore` | `src/features/practice/hooks/useRecording.ts`, `src/features/practice/hooks/useScoring.ts`, `src/features/practice/hooks/useSession.ts`, `src/features/practice/pages/ResultPanel.tsx`, `src/features/practice/pages/SetupCountdownPanel.tsx`, `src/features/practice/pages/usePracticeState.ts`, `src/features/practice/pages/useRecordingController.test.ts`, `src/features/practice/pages/useRecordingController.ts` |
| `src/features/practice/pages/usePracticeState.ts` | `usePracticeState` | `src/features/practice/pages/usePracticeState.test.ts`, `src/pages/PracticePage.tsx` |
| `src/features/practice/pages/usePracticeState.test.ts` | None | None |
| `src/features/practice/pages/useRecordingController.ts` | `useRecordingController` | `src/features/practice/pages/useRecordingController.test.ts`, `src/pages/PracticePage.tsx` |
| `src/features/practice/pages/useRecordingController.test.ts` | None | None |

## Shared Core

| File | Exports | Imported by |
| --- | --- | --- |
| `src/lib/core/constants.ts` | `SCORING_VERSION`, `TELEGRAM_MIN_DURATION`, `APP_URL`, scoring thresholds, scoring labels, pause threshold constants/types | `src/features/practice/hooks/useRecording.ts`, `src/features/practice/hooks/useScoring.ts`, `src/features/practice/pages/useRecordingController.ts`, `src/lib/core/scoring.ts`, `src/lib/core/session.ts`, `src/lib/telegram/constants.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/lib/core/modes.ts` | `PracticeMode`, `VALID_MODES`, `MODE_LABELS`, `normalizeMode` | `src/lib/core/queries.ts` |
| `src/lib/core/prompts.ts` | `opinionPrompts`, `getRandomPrompt` | `src/features/stats/pages/DashboardPage.tsx`, `src/lib/telegram/challenges.ts`, `src/lib/telegram/router.ts`, `src/pages/PracticePage.tsx`, `src/pages/PromptsPage.tsx` |
| `src/lib/core/queries.ts` | `SessionRecord`, `StreakRecord`, `PracticeStats`, mode/recent-session types, session/streak query helpers, stats aggregation helpers | `src/lib/practiceApi.ts`, `src/lib/telegram/router.ts` |
| `src/lib/core/scoring.ts` | scoring constants re-exported from constants, `PauseThresholdLevel`, `FlowScoreOptions`, `FlowScoreResult`, `calculateFlowScore`, `getScoreLabel` | `src/features/practice/hooks/useScoring.ts`, `src/features/practice/lib/speechAnalyzer.ts`, `src/features/practice/lib/speechSession.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/lib/core/session.ts` | `SupabaseLike`, session/streak input types, date helpers, insert builders, `calculateNextStreak`, `insertSession`, `updateStreak` | `src/lib/core/queries.ts`, `src/lib/practiceApi.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/lib/core/user.ts` | `resolveTelegramUser` | `src/lib/telegram/router.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/lib/core/utils.ts` | `escapeTelegramHtml` | `api/telegram/connect.ts`, `src/lib/telegram/challenges.ts`, `src/lib/telegram/constants.ts`, `src/lib/telegram/router.ts`, `src/lib/telegram/voiceHandler.ts` |

## Browser UI

| File | Exports | Imported by |
| --- | --- | --- |
| `src/main.tsx` | None | None |
| `src/App.tsx` | Default `App` | `src/main.tsx` |
| `src/index.css` | None | `src/main.tsx` |
| `src/vite-env.d.ts` | None | None |
| `src/features/auth/pages/AuthCallbackPage.tsx` | Default `AuthCallbackPage` | `src/App.tsx` |
| `src/features/auth/pages/AuthPage.tsx` | Default `AuthPage` | `src/App.tsx` |
| `src/features/auth/pages/SignUpPage.tsx` | Default `SignUpPage` | `src/App.tsx` |
| `src/features/practice/components/VoiceVisualizer.tsx` | `VoiceVisualizer` | `src/features/practice/pages/RecordingPanel.tsx` |
| `src/features/practice/pages/RecordingPanel.tsx` | `RecordingPanel` | `src/pages/PracticePage.tsx` |
| `src/features/practice/pages/ResultPanel.tsx` | `ResultPanel` | `src/pages/PracticePage.tsx` |
| `src/features/practice/pages/SetupCountdownPanel.tsx` | `SetupCountdownPanel` | `src/pages/PracticePage.tsx` |
| `src/features/stats/pages/DashboardPage.tsx` | Default `DashboardPage` | `src/App.tsx` |
| `src/features/stats/pages/StatsPage.tsx` | Default `StatsPage` | `src/App.tsx`, `src/pages/Sessions.tsx` |
| `src/pages/ConnectTelegram.tsx` | Default `ConnectTelegram` | `src/App.tsx` |
| `src/pages/NotFound.tsx` | Default `NotFound` | `src/App.tsx` |
| `src/pages/PracticePage.tsx` | Default `PracticePage` | `src/App.tsx` |
| `src/pages/PromptsPage.tsx` | Default `PromptsPage` | `src/App.tsx` |
| `src/pages/Sessions.tsx` | Default `Sessions` | `src/App.tsx` |
| `src/shared/components/Confetti.tsx` | Default `Confetti` | `src/features/practice/pages/ResultPanel.tsx` |
| `src/shared/components/ui/dialog.tsx` | `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | `src/features/stats/pages/DashboardPage.tsx` |
| `src/shared/components/ui/sonner.tsx` | `Toaster`, `toast` | `src/App.tsx` |
| `src/shared/components/ui/toast.tsx` | `ToastProps`, `ToastActionElement`, `ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction` | `src/shared/components/ui/toaster.tsx`, `src/shared/hooks/use-toast.ts` |
| `src/shared/components/ui/toaster.tsx` | `Toaster` | `src/App.tsx` |
| `src/shared/components/ui/tooltip.tsx` | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | `src/App.tsx` |
| `src/shared/hooks/use-toast.ts` | `reducer`, `useToast`, `toast` | `src/shared/components/ui/toaster.tsx` |
| `src/shared/hooks/useInstallPlatform.ts` | `useInstallPlatform` | `src/features/stats/pages/DashboardPage.tsx` |
| `src/shared/lib/utils.ts` | `cn` | `src/features/practice/pages/SetupCountdownPanel.tsx`, `src/pages/PracticePage.tsx`, `src/shared/components/ui/dialog.tsx`, `src/shared/components/ui/toast.tsx`, `src/shared/components/ui/tooltip.tsx` |
| `src/shared/seo/routeSeo.ts` | `RouteSeoConfig`, `getRouteSeoConfig`, `seoDefaults` | `src/App.tsx` |
| `src/test/setup.ts` | None | None |

## Server API

| File | Exports | Imported by |
| --- | --- | --- |
| `api/feedback.ts` | Default handler | None |
| `api/transcription.ts` | Default handler | None |
| `api/telegram/connect.ts` | Default handler | None |
| `api/telegram/webhook.ts` | Default handler | None |

## Telegram Service

| File | Exports | Imported by |
| --- | --- | --- |
| `src/lib/telegram/challenges.ts` | challenge record types, challenge CRUD helpers, private/group challenge reply and callback handlers | `src/lib/telegram/router.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/lib/telegram/constants.ts` | Telegram labels/actions, keyboards, share/deep-link builders, challenge/result message builders, connect/session action helpers, `MESSAGES` | `src/lib/telegram/challenges.ts`, `src/lib/telegram/router.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/lib/telegram/router.ts` | `createTelegramBot` | `api/telegram/webhook.ts`, `src/lib/telegramBot.ts` |
| `src/lib/telegram/voiceHandler.ts` | `TelegramSessionRecord`, Telegram identity helpers, connect prompt helper, session analysis helpers, `handleVoiceMessage`, challenge result/share/AI feedback handlers | `src/lib/telegram/router.ts` |
| `src/lib/telegramAuth.ts` | `upsertTelegramConnection` | `api/telegram/connect.ts` |
| `src/lib/telegramBot.ts` | `createTelegramBot` re-export | None |

## Providers And Services

| File | Exports | Imported by |
| --- | --- | --- |
| `src/providers/AuthContext.tsx` | `DifficultyLevel`, `AuthProvider`, `useAuth` | `src/App.tsx`, `src/features/auth/pages/AuthCallbackPage.tsx`, `src/features/auth/pages/AuthPage.tsx`, `src/features/auth/pages/SignUpPage.tsx`, `src/features/practice/pages/useRecordingController.ts`, `src/features/stats/pages/DashboardPage.tsx`, `src/features/stats/pages/StatsPage.tsx`, `src/main.tsx`, `src/pages/ConnectTelegram.tsx`, `src/pages/Sessions.tsx` |
| `src/providers/PWAInstallContext.tsx` | `PWAInstallProvider`, `usePWAInstall` | `src/features/stats/pages/DashboardPage.tsx`, `src/main.tsx` |
| `src/providers/ServiceWorkerUpdateContext.tsx` | `ServiceWorkerUpdateProvider`, `useServiceWorkerUpdate` | `src/App.tsx`, `src/main.tsx` |
| `src/services/groq.ts` | Groq transcript/feedback types, transcript usability helper, server-side transcription helpers, server-side filler analysis, AI feedback helpers | `api/feedback.ts`, `api/transcription.ts`, `src/lib/telegram/voiceHandler.ts` |
| `src/services/supabase.ts` | `supabase` browser client | `src/lib/practiceApi.ts`, `src/pages/ConnectTelegram.tsx`, `src/providers/AuthContext.tsx` |
| `src/services/supabaseServer.ts` | `supabaseServer` service-role client | `api/feedback.ts`, `api/telegram/connect.ts`, `api/transcription.ts`, `src/lib/core/queries.ts` (dynamic import), `src/lib/core/user.ts`, `src/lib/telegram/challenges.ts`, `src/lib/telegram/voiceHandler.ts`, `src/lib/telegramAuth.ts` |
| `src/lib/practiceApi.ts` | `PracticeStats`, `SessionRecord`, transcription/feedback input types, `transcribeAudio`, `analyzeSpeech`, `saveSession`, `updateSession`, `updateStreak`, `getPracticeStats` | `src/features/practice/hooks/useRecording.ts`, `src/features/practice/hooks/useSession.ts`, `src/features/stats/pages/DashboardPage.tsx`, `src/features/stats/pages/StatsPage.tsx` |
