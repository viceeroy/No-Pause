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
  LEMON_MIN_TOTAL_SECONDS,
  PAUSE_THRESHOLD_BY_LEVEL,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/lib/core/constants';
import type { PracticeStateStore } from '@/features/practice/pages/types';
import type { BuildSessionResultOutput } from './useScoring';

type SessionData = {
  startTime: number;
  sessionId: string;
};

type UseRecordingOptions = {
  buildSessionResult: (input: {
    mode: string;
    results: Awaited<ReturnType<AudioAnalyzer['stop']>>;
    startTime: number;
  }) => BuildSessionResultOutput;
  difficultyLevel: keyof typeof PAUSE_THRESHOLD_BY_LEVEL;
  mode: string;
  navigate: NavigateFunction;
  saveFinishedSession: (input: BuildSessionResultOutput) => Promise<void>;
  selectedTimerSeconds?: number;
  state: PracticeStateStore;
};

interface CustomWindow extends Window {
  __nopauseExportLogs?: () => void;
}

export function useRecording({
  buildSessionResult,
  difficultyLevel,
  mode,
  navigate,
  saveFinishedSession,
  selectedTimerSeconds = 0,
  state,
}: UseRecordingOptions) {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const stopRecording = useCallback(async () => {
    if (analyzerRef.current && analyzerRef.current.isRunning) {
      const results = await analyzerRef.current.stop().finally(() => micService.reset());

      if (timerRef.current) clearInterval(timerRef.current);

      const startTime = sessionDataRef.current?.startTime || Date.now();
      const sessionBuild = buildSessionResult({
        mode,
        results,
        startTime,
      });

      await saveFinishedSession(sessionBuild);

      setLastResults(sessionBuild.sessionResult);
      setState('done');
      isRecordingRef.current = false;
      setShowMicRetry(false);
    }
  }, [buildSessionResult, mode, saveFinishedSession, setLastResults, setState, setShowMicRetry]);

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

      const duration = mode === 'lemon' ? LEMON_MIN_TOTAL_SECONDS : (mode === 'topic' ? TOPIC_MIN_TOTAL_SECONDS : selectedTimerSeconds);
      setTimeLeft(duration);
      setElapsedTime(0);
      setShowMicRetry(false);

      const timerStartTime = Date.now();
      if (duration > 0) {
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
          setElapsedTime(elapsed);
        }, 250);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      await micService.reset();
      setTranscriptError('Failed to start recording. Please try again.');
      setState('setup');
    }
  }, [mode, selectedTimerSeconds, setTranscriptError, setState, setShowMicRetry, setTimeLeft, setElapsedTime, stopRecording]);

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

      setCountdown(0);
      micInitializingRef.current = false;
      await startRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
      setState('setup');
    } finally {
      micInitializingRef.current = false;
    }
  }, [difficultyLevel, setLastResults, setTranscriptError, setShowMicRetry, setAudioData, setState, setCountdown, startRecording]);

  const handleRetryMicrophone = useCallback(() => {
    void handleStart(true);
  }, [handleStart]);

  const handleBack = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.destroy();
      analyzerRef.current = null;
    }
    void micService.reset();
    if (timerRef.current) clearInterval(timerRef.current);
    navigate('/');
  }, [navigate]);

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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    handleBack,
    handleRetryMicrophone,
    handleStart,
    soundDetectedRef,
    stopRecording,
  };
}
