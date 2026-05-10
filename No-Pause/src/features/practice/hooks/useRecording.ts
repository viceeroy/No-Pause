import { useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { createAudioAnalyzer } from '@/features/practice/lib/audioRecording';
import { micService } from '@/features/practice/lib/micService';
import {
  AudioAnalyzer,
  type AnalyzerDiagnosticsSnapshot,
} from '@/features/practice/lib/speechAnalyzer';
import { transcribeAudio } from '@/lib/practiceApi';
import {
  PAUSE_THRESHOLD_BY_LEVEL,
} from '@/lib/core/constants';
import type { PracticeStateStore } from '@/features/practice/pages/types';
import type { BuildSessionResultOutput } from './useScoring';

type SessionData = {
  startTime: number;
  sessionId: string;
};

const DEFAULT_MAX_RECORDING_SECONDS = 300;

type UseRecordingOptions = {
  buildSessionResult: (input: {
    results: Awaited<ReturnType<AudioAnalyzer['stop']>>;
    startTime: number;
  }) => BuildSessionResultOutput;
  difficultyLevel: keyof typeof PAUSE_THRESHOLD_BY_LEVEL;
  navigate: NavigateFunction;
  saveFinishedSession: (input: BuildSessionResultOutput) => Promise<void>;
  selectedTimerSeconds?: number;
  state: PracticeStateStore;
};

interface CustomWindow extends Window {
  __nopauseExportLogs?: () => void;
}

const DIAGNOSTICS_SPEECH_RMS_THRESHOLD = 0.01;
const DIAGNOSTICS_PAUSE_THRESHOLD_SEC = 1.8;
const DIAGNOSTICS_GOOD_DROP_RATE = 0.1;
const DIAGNOSTICS_WARNING_DROP_RATE = 0.2;
const DIAGNOSTICS_WARNING_AVG_RMS = 0.008;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getFiniteNumbers(values: number[]): number[] {
  return values.filter((value) => Number.isFinite(value) && value >= 0);
}

function buildChunkDurationsMs(chunkCount: number, intervalsMs: number[]): number[] {
  const safeIntervals = getFiniteNumbers(intervalsMs);
  const fallbackMs = safeIntervals.length > 0 ? average(safeIntervals) : 100;

  return Array.from({ length: chunkCount }, (_, index) => (
    index > 0 && safeIntervals[index - 1] !== undefined
      ? safeIntervals[index - 1]
      : fallbackMs
  ));
}

function buildDiagnosticsSummary(snapshot: AnalyzerDiagnosticsSnapshot) {
  const avgRmsPerChunk = getFiniteNumbers(snapshot.voiceDiagnostics.avgRmsPerChunk);
  const peakRmsPerChunk = getFiniteNumbers(snapshot.voiceDiagnostics.peakRmsPerChunk);
  const chunkDurationsMs = buildChunkDurationsMs(
    avgRmsPerChunk.length,
    snapshot.recorder.chunkIntervalMs,
  );
  const dropCount = snapshot.voiceDiagnostics.dropFlags.filter(Boolean).length;
  const lowAmplitudeCount = snapshot.voiceDiagnostics.lowAmplitudeFlags.filter(Boolean).length;
  const totalDurationSec = chunkDurationsMs.reduce((sum, duration) => sum + duration, 0) / 1000;
  const speakingTimeSec = avgRmsPerChunk.reduce((sum, rms, index) => (
    rms > DIAGNOSTICS_SPEECH_RMS_THRESHOLD
      ? sum + ((chunkDurationsMs[index] ?? 0) / 1000)
      : sum
  ), 0);
  const silenceTimeSec = Math.max(0, totalDurationSec - speakingTimeSec);
  const silenceGapsSec: number[] = [];
  let currentSilenceGapSec = 0;
  avgRmsPerChunk.forEach((rms, index) => {
    const durationSec = (chunkDurationsMs[index] ?? 0) / 1000;
    if (rms <= DIAGNOSTICS_SPEECH_RMS_THRESHOLD) {
      currentSilenceGapSec += durationSec;
      return;
    }

    if (currentSilenceGapSec > 0) silenceGapsSec.push(currentSilenceGapSec);
    currentSilenceGapSec = 0;
  });
  if (currentSilenceGapSec > 0) silenceGapsSec.push(currentSilenceGapSec);
  const pauseGapsSec = silenceGapsSec.filter((gapSec) => gapSec > DIAGNOSTICS_PAUSE_THRESHOLD_SEC);
  const expectedPauseUnits = pauseGapsSec.reduce(
    (sum, gapSec) => sum + Math.floor(gapSec / DIAGNOSTICS_PAUSE_THRESHOLD_SEC),
    0,
  );
  const expectedScore = Math.max(
    0,
    Math.floor(
      speakingTimeSec +
      Math.floor(speakingTimeSec / 60) * 40 -
      expectedPauseUnits * 10,
    ),
  );
  const avgRms = average(avgRmsPerChunk);
  const peakRms = peakRmsPerChunk.length > 0 ? Math.max(...peakRmsPerChunk) : 0;
  const dropRate = avgRmsPerChunk.length > 0 ? dropCount / avgRmsPerChunk.length : 0;
  const healthVerdict =
    dropRate < DIAGNOSTICS_GOOD_DROP_RATE && avgRms > DIAGNOSTICS_SPEECH_RMS_THRESHOLD
      ? 'Good'
      : dropRate < DIAGNOSTICS_WARNING_DROP_RATE && avgRms > DIAGNOSTICS_WARNING_AVG_RMS
        ? 'Warning'
        : 'Poor';

  return {
    totalDurationSec,
    speakingTimeSec,
    silenceTimeSec,
    pauseCount: pauseGapsSec.length,
    dropCount,
    lowAmplitudeCount,
    avgRms,
    peakRms,
    expectedPauseUnits,
    expectedScore,
    healthVerdict,
  };
}

export function useRecording({
  buildSessionResult,
  difficultyLevel,
  navigate,
  saveFinishedSession,
  selectedTimerSeconds = 0,
  state,
}: UseRecordingOptions) {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRunIdRef = useRef(0);
  const sessionDataRef = useRef<SessionData | null>(null);
  const soundDetectedRef = useRef(false);
  const micInitializingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const {
    setState,
    setTimeLeft,
    setCountdown,
    setAudioData,
    setLastResults,
    setTranscriptError,
    setShowMicRetry,
    setElapsedTime,
  } = state;

  const clearCountdownTimer = useCallback(() => {
    countdownRunIdRef.current += 1;
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const runStartCountdown = useCallback(async () => {
    clearCountdownTimer();
    const runId = countdownRunIdRef.current;
    setState('countdown');
    setCountdown(3);

    for (let nextCount = 2; nextCount >= 0; nextCount -= 1) {
      await new Promise<void>((resolve) => {
        countdownTimerRef.current = setTimeout(resolve, 1000);
      });
      countdownTimerRef.current = null;
      if (countdownRunIdRef.current !== runId) return false;
      setCountdown(nextCount);
    }

    return true;
  }, [clearCountdownTimer, setCountdown, setState]);

  const stopRecording = useCallback(async () => {
    if (analyzerRef.current && analyzerRef.current.isRunning) {
      setState('finishing');
      const results = await analyzerRef.current.stop().finally(() => micService.reset());

      if (timerRef.current) clearInterval(timerRef.current);

      const startTime = sessionDataRef.current?.startTime || Date.now();
      const sessionBuild = buildSessionResult({
        results,
        startTime,
      });

      await saveFinishedSession(sessionBuild);

      setLastResults(sessionBuild.sessionResult);
      setState('done');
      isRecordingRef.current = false;
      setShowMicRetry(false);
    }
  }, [buildSessionResult, saveFinishedSession, setLastResults, setState, setShowMicRetry]);

  const startRecording = useCallback(async () => {
    try {
      if (isRecordingRef.current || micInitializingRef.current) return;
      if (!analyzerRef.current) {
        setTranscriptError('Audio analyzer not initialized. Please try again.');
        setState('setup');
        return;
      }

      const stream = micService.getStream();
      const audioCtx = micService.getAudioContext();
      const started = await analyzerRef.current.start(
        stream || undefined,
        audioCtx || undefined,
      );
      if (!started) {
        await micService.reset();
        setTranscriptError('Mic not capturing audio');
        setShowMicRetry(true);
        setState('setup');
        return;
      }

      const captureState = analyzerRef.current.getCaptureState();
      const recorderOk = captureState.mediaRecorderState === 'recording';
      const trackOk = captureState.trackReadyState === 'live';
      const streamOk = captureState.hasStream && captureState.streamActive;
      if (!streamOk || !trackOk || !recorderOk) {
        console.error('[MicDiag] Capture validation failed', captureState);
        await micService.reset();
        setTranscriptError('Mic not capturing audio');
        setShowMicRetry(true);
        setState('setup');
        return;
      }

      isRecordingRef.current = true;

      const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      setState('recording');
      soundDetectedRef.current = false;

      sessionDataRef.current = { startTime: Date.now(), sessionId };

      const duration = selectedTimerSeconds > 0 ? selectedTimerSeconds : DEFAULT_MAX_RECORDING_SECONDS;
      setTimeLeft(duration);
      setElapsedTime(0);
      setShowMicRetry(false);

      const timerStartTime = Date.now();
      if (selectedTimerSeconds > 0) {
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
          const remaining = Math.max(0, duration - elapsed);
          setTimeLeft(remaining);
          if (remaining <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            void stopRecording();
          }
        }, 250);
      } else {
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
          setElapsedTime(Math.min(elapsed, duration));
          if (elapsed >= duration) {
            if (timerRef.current) clearInterval(timerRef.current);
            void stopRecording();
          }
        }, 250);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      await micService.reset();
      setTranscriptError('Failed to start recording. Please try again.');
      setState('setup');
    }
  }, [selectedTimerSeconds, setTranscriptError, setState, setShowMicRetry, setTimeLeft, setElapsedTime, stopRecording]);

  const handleStart = useCallback(async (forceRetryMic = false) => {
    try {
      if (isRecordingRef.current || micInitializingRef.current) return;
      setLastResults(null);
      setTranscriptError(null);
      setShowMicRetry(false);

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setTranscriptError('Microphone access requires HTTPS.');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setTranscriptError('This browser does not support microphone APIs. Try Chrome or Safari.');
        return;
      }

      micInitializingRef.current = true;

      try {
        if (forceRetryMic) {
          await micService.retryInit();
        } else {
          await micService.init();
        }
      } catch {
        setTranscriptError('Mic not capturing audio');
        setShowMicRetry(true);
        await micService.reset();
        return;
      }

      micService.setTracksEnabled(true);

      await micService.ensureAudioContextRunning();

      const hesitationMinDurationMs = Math.round(PAUSE_THRESHOLD_BY_LEVEL[difficultyLevel] * 1000);

      const analyzer = createAudioAnalyzer({
        enableTranscription: true,
        hesitationMinDurationMs,
        transcribeAudio,
        onData: (data) => {
          setAudioData(data);
          if (data.rms > 0.01) soundDetectedRef.current = true;
        },
        onHesitation: () => { },
        onCalibrated: () => { },
        onStartError: (error) => {
          const errorName =
            error && typeof error === 'object' && 'name' in error
              ? String((error as { name?: unknown }).name ?? 'unknown')
              : 'unknown';
          setTranscriptError(`Microphone error: ${errorName}`);
        },
      });

      analyzerRef.current = analyzer;

      const countdownCompleted = await runStartCountdown();
      if (!countdownCompleted) return;

      micInitializingRef.current = false;
      await startRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
      setState('setup');
    } finally {
      micInitializingRef.current = false;
    }
  }, [difficultyLevel, setLastResults, setTranscriptError, setShowMicRetry, setAudioData, setState, runStartCountdown, startRecording]);

  const handleRetryMicrophone = useCallback(() => {
    void handleStart(true);
  }, [handleStart]);

  const handleBack = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    void micService.reset();
    clearCountdownTimer();
    if (timerRef.current) clearInterval(timerRef.current);
    navigate('/');
  }, [clearCountdownTimer, navigate]);

  const exportDiagnosticsLogs = useCallback(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) {
      setTranscriptError('No diagnostics available yet.');
      return;
    }

    const snapshot: AnalyzerDiagnosticsSnapshot = analyzer.getDiagnosticsSnapshot();
    const now = Date.now();
    const ua = snapshot.platform.userAgent || navigator.userAgent || '';
    const platformTag = /android/i.test(ua)
      ? 'android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'ios'
        : 'desktop';

    const diagnostics = {
      summary: buildDiagnosticsSummary(snapshot),
      sessionId: sessionDataRef.current?.sessionId || snapshot.sessionId || `session-${now}`,
      timestamp: now,
      platform: snapshot.platform,
      audio: {
        ...snapshot.audio,
        audioMimeType: state.lastResults?.audioMimeType || snapshot.audio.audioMimeType,
      },
      recorderDiagnostics: snapshot.recorder,
      streamHealth: snapshot.streamHealth,
      voiceDiagnostics: snapshot.voiceDiagnostics,
    };

    const json = JSON.stringify(diagnostics, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nopause-diagnostics-${platformTag}-${Math.floor(now / 1000)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [setTranscriptError, state.lastResults?.audioMimeType]);

  useEffect(() => {
    (window as CustomWindow).__nopauseExportLogs = exportDiagnosticsLogs;
    return () => {
      if ((window as CustomWindow).__nopauseExportLogs === exportDiagnosticsLogs) {
        delete (window as CustomWindow).__nopauseExportLogs;
      }
    };
  }, [exportDiagnosticsLogs]);

  useEffect(() => {
    return () => {
      if (analyzerRef.current) {
        try {
          analyzerRef.current.destroy();
        } catch (e) {
          console.warn('Failed to destroy analyzer on unmount:', e);
        }
        analyzerRef.current = null;
      }
      void micService.reset();
      clearCountdownTimer();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clearCountdownTimer]);

  return {
    handleBack,
    handleRetryMicrophone,
    handleStart,
    soundDetectedRef,
    stopRecording,
  };
}
