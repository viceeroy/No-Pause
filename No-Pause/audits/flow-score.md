# Audit #4: Flow Score Accuracy

**Date:** 2026-05-24  
**Scope:** End-to-end trace of the Flow Score pipeline and consistency analysis across Web and Telegram paths

---

## Pipeline Trace

### Web path
```
1. User taps record → useRecording.ts acquires mic via micService.ts
2. AudioAnalyzer.start() → AudioCapture wires AudioContext + AnalyserNode
3. Per-frame RMS → SpeechSession.handleFrame() → micStateMachine.applyMicStateFrame()
   - Calibration: ~1.5s of ambient noise sampling, sets speechOnThreshold
   - Speaking/silence hysteresis: speechOnThreshold / speechOffThreshold (0.7x)
   - Hesitations counted as units: floor(silenceDuration / 1200ms)
   - Start buffer: 2000ms, analytics start delay: 400ms
4. User taps stop → SpeechSession.finish()
   - Finalizes trailing silence, applies endBuffer (1000ms) filtering
   - filteredHesitationCount = sum of units from hesitations in analysis window
   - Calls calculateFlowScore(filteredHesitationCount, { speakingTimeSec })
5. Score displayed in ResultPanel
6. Parallel: transcribeAudio → POST /api/transcription → Groq Whisper
7. Parallel: saveSession → Supabase sessions table
8. On-demand: analyzeSpeech → POST /api/feedback → scoreSpeechQuality
   - If AI score returned: blendWithAiScore(baseFlowScore, aiScore)
```

### Telegram path
```
1. Voice note received via webhook
2. downloadTelegramVoice() → fetches audio from Telegram API
3. transcribeAudioWithGroq() → Groq Whisper (verbose_json + word timestamps)
4. detectPausesFromWordTimestamps() → counts gaps ≥ 1200ms between words
5. getSpeakingTimeSec() → sum of word durations from timestamps
6. calculateFlowScore(pauseCount, { speakingTimeSec })
7. scoreSpeechQuality() in parallel → blendWithAiScore() if successful
8. insertTelegramSession() → Supabase with source='telegram'
```

---

## Issues Ranked by Impact on Accuracy

### HIGH-1: Web vs Telegram pause detection divergence

**Files:** `speechSession.ts:93-109` (web) vs `voiceHandler.ts:190-220` (telegram)  
**Issue:** The two paths use fundamentally different pause detection:
- **Web:** RMS-based real-time silence tracking with hysteresis thresholds, calibrated per-session ambient noise. Hesitation = silence duration after speech, within the analysis window (excluding start/end buffers).
- **Telegram:** Word-timestamp-based gap detection. Hesitation = gap between word.end and next word.start ≥ 1.2s.

These are measuring different things. The web path detects when the mic RMS drops below threshold — it catches hesitant "umm" sounds that are above noise floor but below speech threshold. The Telegram path only sees gaps between recognized words — Whisper might transcribe "umm" as a word, not a gap.

**Impact:** A user recording the same speech on web vs. Telegram will get different pause counts and different Flow Scores. This undermines trust in the metric.
**What you gain by fixing:** Score consistency across platforms.
**Fix:** Consider using word-timestamp pause detection for both paths (when transcription is available), or clearly document the methodological difference to users.

---

### HIGH-2: `blendWithAiScore` can dramatically change score post-display

**Files:** `scoring.ts:68-70`, `useSession.ts:110-121`  
**Issue:** `blendWithAiScore(base, aiScore) = max(0, base + round(aiScore))`. The AI score is 0-100, so the final score can jump by up to +100 after the user already sees their base score. The score visually changes after the fact when feedback loads.

On Telegram (`voiceHandler.ts:567-569`), blending happens before display — the user sees one final score. On web, the user sees baseFlowScore first, then it changes to baseFlowScore + aiScore when feedback arrives.

**Impact:** Confusing UX — the score the user first sees isn't the final score. Also, the blended score is **not saved back** to the database in the web flow (the initial `saveSession` at line 43-64 uses the pre-blend score; the later `updateSession` at line 103-107 only saves `analysisFeedback`, not the blended `flowScore`).
**What you gain by fixing:** Score integrity — what's stored matches what's displayed.
**Fix:** Either (a) save the blended score to the DB after AI scoring, or (b) always show the base score and display AI score separately (which the UI already partially does at line 124-128).

---

### HIGH-3: `speakingTimeSec` calculated differently between web and Telegram

**Files:** `speechSession.ts:138-139` (web) vs `voiceHandler.ts:177-188` (telegram)  
**Issue:**
- **Web:** `speakingTimeSec = round(totalSpeakingTimeMs / 1000)` — accumulated from real-time RMS frames, counting every frame where RMS > threshold.
- **Telegram:** `getSpeakingTimeSec(words, fallback)` — sums `word.end - word.start` for each transcribed word. This typically yields **much less** speaking time than the web path because it excludes pauses between words and any sounds Whisper doesn't recognize as words.

Example: A 60-second recording with 45 seconds of speech and 15 seconds of pauses:
- Web: `speakingTimeSec ≈ 45` (includes "umm" as speech)
- Telegram: `speakingTimeSec ≈ 35` (only word-level durations, excluding "umm" gaps)

Since the Flow Score formula gives 1 point per second of speaking time, this can cause a ~10-point difference.

**Impact:** Systematic scoring bias — Telegram users get lower scores for equivalent speech.
**Fix:** Use the voice.duration as the total session time and consider using a more generous speaking time estimate for Telegram (e.g., total duration minus detected pause durations).

---

### MEDIUM-1: No NaN/Infinity guard in `blendWithAiScore`

**File:** `scoring.ts:68-70`  
**Evidence:** `blendWithAiScore(base, aiScore)` does `base + Math.round(aiScore)`. If `aiScore` is NaN (e.g., failed parse in `scoreSpeechQuality`), the result is NaN.
**Mitigated by:** `scoreSpeechQuality` (`aiFeedback.ts:76`) validates `Number.isFinite(score)` and falls back to 50. But if the JSON parse throws for an unexpected reason and returns `{ score: undefined }`, `Number(undefined)` is NaN, which passes through the else branch.
**Actually:** The code at line 76 checks `!Number.isFinite(score)` and throws, so the catch at line 81 returns `{ score: 50, feedback: raw.slice(0, 200) }`. **This path is safe.**

But in `voiceHandler.ts:246`: `analysis.flowScore = Number.isFinite(scoreResult.score) ? scoreResult.score : 0` — this is an extra guard. The web path in `useSession.ts:111-112` does NOT have this guard: `blendedScore = result.aiScore != null ? blendWithAiScore(baseScore, result.aiScore) : prev.flowScore`. If `result.aiScore` is somehow `Infinity`, the blend produces `Infinity`.

**Impact:** Low probability but could produce a nonsensical score.
**What you gain by fixing:** Defensive scoring.
**Fix:** Add `Number.isFinite()` guard in `blendWithAiScore` itself.

---

### MEDIUM-2: Score bar visualization caps at 500 but score is unbounded

**File:** `ResultPanel.tsx:71`  
**Evidence:** `const scoreWidth = Math.max(0, Math.min(100, (lastResults.flowScore / 500) * 100))`. The score bar maxes out at score=500. But the Flow Score is unbounded — a 10-minute session with 0 pauses scores 600+40*10 = 1000. Users who speak for long sessions will always see a full bar.
**Impact:** Bar becomes meaningless for advanced users.
**Fix:** Use a log scale or dynamic max based on session duration, or just accept this as a design choice.

---

### MEDIUM-3: Magic number `TELEGRAM_MIN_DURATION = 1` second

**File:** `constants.ts:2`, used in `voiceHandler.ts:155-161`  
**Evidence:** `estimateDurationSec()` falls back to 1 second if `voice.duration` is missing or less than 1. If Telegram sends a voice note with no duration metadata, the session gets `speakingTimeSec=1` (from the fallback), which means `calculateFlowScore` returns `{ score: 0, isCompleted: false }` (since 1 < 5).
**Impact:** Edge case — should be harmless since the score is 0 anyway. But the DB stores `duration=1` which is misleading.
**Fix:** Consider using the Whisper word timestamps to derive actual duration when voice.duration is missing.

---

### MEDIUM-4: `hesitationCount` vs `pauseCount` inconsistency

**Files:** `types.ts:19-20`, `ResultPanel.tsx:82`, `useSession.ts:51`  
**Evidence:** `SessionResult` has both `hesitationCount` and `pauseCount` (optional). The result panel shows `pauseCount ?? hesitationCount`. When saving to Supabase, `pauseCount: sessionResult.pauseCount ?? sessionResult.hesitationCount`. The DB has both `pauses` and `pause_count` columns. This creates confusion — which is the "real" count?
**Impact:** Data clarity issue. `hesitationCount` is the raw state machine count; `pauseCount` is the filtered count from `finalizeMicState`. They can differ because of start/end buffer filtering.
**What you gain by fixing:** Clear semantics for what "pauses" means everywhere.
**Fix:** Standardize on one name. `pauseCount` (filtered, analysis-window-only) should be the canonical stored value.

---

### LOW-1: `hasSpeechEvidence` parameter passed but never used

**File:** `scoring.ts:31-66`  
**Evidence:** `calculateFlowScore(rawHesitationCount, options)` accepts `options.hasSpeechEvidence` in the `FlowScoreOptions` interface but never reads it. The Telegram path passes it at `voiceHandler.ts:242` but it's ignored.
**Impact:** Dead parameter — no accuracy impact, just confusing.
**Fix:** Remove from interface and call sites, or use it (e.g., to return `isCompleted: false` when no speech was detected even if `speakingTimeSec >= 5`).

---

### LOW-2: Calibration can be defeated by ambient noise

**File:** `speechSession.ts:173-191`  
**Evidence:** If calibration samples have high RMS (e.g., noisy room), `speechOnThreshold` is pushed up to `MAX_CALIBRATED_SPEECH_THRESHOLD = 0.06`. This means quiet speech won't be detected, leading to inflated silence time and more hesitations counted.
**Impact:** Environmental accuracy issue.
**Fix:** Consider a "calibration failed" state if noise floor is too high, with user notification.

---

### LOW-3: Web score doesn't account for trailing silence the same way as filtered hesitations

**File:** `micStateMachine.ts:129-142`  
**Evidence:** `finalizeMicState` adds trailing silence as a hesitation log entry with `trailing: true`, but the filtering at line 144-145 may exclude it if its timestamp exceeds `endBufferCutoff`. This means if a user stops speaking 2 seconds before hitting stop, that 2-second pause is NOT counted. But the `totalSilenceTimeMs` still includes it. This is correct behavior (it's a design choice), but worth documenting since the Telegram path has no equivalent concept of start/end buffers.
**Impact:** Another source of web-vs-Telegram score divergence.

---

## Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| **HIGH** | 3 | Web vs Telegram scoring divergence (pause detection, speaking time, score blending timing) |
| **MEDIUM** | 4 | Missing NaN guard, UI bar cap, duration fallback, naming inconsistency |
| **LOW** | 3 | Dead parameter, calibration edge case, trailing silence design |

**Most impactful fix:** Align pause detection methodology between web and Telegram, or prominently display that scores from different sources use different methods.
