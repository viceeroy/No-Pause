import { useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { AudioAnalyzer, type AnalyzerDiagnosticsSnapshot } from '@/features/practice/lib/speechAnalyzer';
import { micService } from '@/features/practice/lib/micService';
import { createAudioAnalyzer } from '@/features/practice/lib/audioRecording';
import { analyzeSpeech, saveSession, transcribeAudio, updateSession, updateStreak } from '@/lib/practiceApi';
import { useAuth } from '@/providers/AuthContext';
import {
  LEMON_MIN_TOTAL_SECONDS,
  PAUSE_THRESHOLD_BY_LEVEL,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/features/practice/lib/scoringConstants';
import type { PracticeStateStore, SessionResult } from './types';
import { formatMMSS, toMMSS } from './time';

type UseRecordingControllerOptions = {
  mode: string;
  navigate: NavigateFunction;
  state: PracticeStateStore;
  selectedTimerSeconds?: number;
};

type RecordingControllerResult = {
  handleStart: (forceRetryMic?: boolean) => Promise<void>;
  handleRetryMicrophone: () => void;
  handleRetry: () => void;
  handleBack: () => void;
  stopRecording: () => Promise<void>;
  requestFeedback: () => Promise<void>;
  requestTranscription: () => Promise<void>;
  soundDetectedRef: React.MutableRefObject<boolean>;
};

interface CustomWindow extends Window {
  __nopauseExportLogs?: () => void;
}

export function useRecordingController({ mode, navigate, state, selectedTimerSeconds = 0 }: UseRecordingControllerOptions): RecordingControllerResult {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionDataRef = useRef<{ startTime: number; sessionId: string } | null>(null);
  const soundDetectedRef = useRef(false);
  const micInitializingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const { user, difficultyLevel } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email;

  const {
    setState,
    setTimeLeft,
    setCountdown,
    setAudioData,
    setLastResults,
    lastResults,
    setTranscriptError,
    setShowMicRetry,
    setElapsedTime,
  } = state;

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const stopRecording = useCallback(async () => {
    if (analyzerRef.current && analyzerRef.current.isRunning) {
      const results = await analyzerRef.current.stop().finally(() => micService.reset());
      const duration = Math.floor((Date.now() - (sessionDataRef.current?.startTime || Date.now())) / 1000);

      if (timerRef.current) clearInterval(timerRef.current);

      const normalizedMode = (mode || 'free').toLowerCase();
      const practiceMode = normalizedMode === 'free' ? 'free-speak' : normalizedMode;
      const recordedSeconds = Math.floor((Date.now() - (sessionDataRef.current?.startTime || Date.now())) / 1000);
      const analyzerSeconds = Math.round(results.totalTime / 1000);
      const totalSessionTimeSec = Math.max(analyzerSeconds, recordedSeconds);

      const transcriptHasSpeech = Boolean(results.transcript && results.transcript !== 'No speech detected.' && results.transcript.trim().length > 0);
      const hasSpeechEvidence = transcriptHasSpeech || results.hesitationCount > 0 || results.totalSpeakingTime > 0;
      const words = results.transcript && results.transcript.trim().length > 0
        ? results.transcript.trim().split(/\s+/).filter(Boolean).length
        : null;

      const scoreResult = AudioAnalyzer.calculateFlowScore(results.hesitationCount, {
        mode: normalizedMode,
        speakingTimeSec: results.totalSpeakingTime,
        totalSessionTimeSec,
        hasSpeechEvidence,
      });
      const completed = scoreResult.isCompleted;
      const flowScore = scoreResult.score;
      const safeFlowScore = Number.isFinite(flowScore) ? flowScore : 0;

      let statusNote: string | undefined;
      if (!scoreResult.isCompleted) {
        if (scoreResult.reason === 'duration') {
          if (normalizedMode === 'lemon') {
            statusNote = `Lemon requires ${toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session and at least 50% speaking time. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
          } else if (normalizedMode === 'topic') {
            statusNote = `Topic requires ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session and at least 50% speaking time. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
          } else {
            statusNote = `Free Speaking requires at least 1:00 total session and 50% speaking time. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
          }
        } else if (normalizedMode === 'lemon') {
          statusNote = `Lemon requires ${toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session and at least 50% speaking time. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
        } else if (normalizedMode === 'topic') {
          statusNote = `Topic requires ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session and at least 50% speaking time. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
        } else {
          statusNote = `Free Speaking requires at least 1:00 total session and 50% speaking time. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
        }
      } else if (flowScore === 0 && results.hesitationCount > 2) {
        statusNote = 'Session completed, but score is 0 because hesitation units were too high.';
      }

      const sessionResult: SessionResult = {
        sessionId: null,
        flowScore: safeFlowScore,
        totalSpeakingTime: results.totalSpeakingTime,
        totalSessionTime: totalSessionTimeSec,
        isCompleted: scoreResult.isCompleted,
        hesitationCount: results.hesitationCount,
        hesitationLog: results.hesitationLog,
        mode: practiceMode,
        audioBlob: results.audioBlob,
        audioMimeType: results.audioMimeType,
        transcript: results.transcript,
        analysisFeedback: undefined,
        analysisFeedbackLoading: false,
        analysisFeedbackError: undefined,
        transcriptionLoading: false,
        transcriptionError: undefined,
        wordCount: words,
        statusNote,
      };
      try {
        const [sessionId] = await Promise.all([
          saveSession({
            userId,
            email: userEmail,
            duration,
            speakingTime: results.totalSpeakingTime,
            pauses: results.hesitationCount,
            words,
            mode: normalizedMode,
            flowScore: safeFlowScore,
            completed,
            hesitationLog: results.hesitationLog,
            transcript: results.transcript,
          }),
          updateStreak({
            userId,
            email: userEmail,
            localDate: new Date().toLocaleDateString('en-CA'),
          }),
        ]);
        sessionResult.sessionId = sessionId;
      } catch (error) {
        console.error('Failed to sync session to Supabase:', error);
      }

      setLastResults(sessionResult);
      setState('done');
      isRecordingRef.current = false;
      setShowMicRetry(false);
    }
  }, [mode, setLastResults, setState, setShowMicRetry, userEmail, userId]);

  const requestFeedback = useCallback(async () => {
    if (!lastResults) return;
    if (lastResults.analysisFeedbackLoading) return;
    if (lastResults.analysisFeedback) return;

    const transcript = lastResults.transcript.trim();
    const shouldAnalyze =
      transcript.length > 0 &&
      transcript !== 'No speech detected.' &&
      !transcript.startsWith('Transcription failed');
    if (!shouldAnalyze) return;

    setLastResults((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        analysisFeedbackLoading: true,
        analysisFeedbackError: undefined,
      };
    });

    try {
      const feedback = await analyzeSpeech({
        transcript,
        flowScore: lastResults.flowScore,
        hesitationCount: lastResults.hesitationCount,
        speakingTime: lastResults.totalSpeakingTime,
        wordCount: lastResults.wordCount ?? undefined,
        mode: lastResults.mode,
      });
      await updateSession({
        sessionId: lastResults.sessionId,
        userId,
        analysisFeedback: feedback,
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          analysisFeedback: feedback,
          analysisFeedbackLoading: false,
        };
      });
    } catch (error) {
      console.error('Failed to analyze transcript:', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Unknown error';
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          analysisFeedbackError: message,
          analysisFeedbackLoading: false,
        };
      });
    }
  }, [lastResults, setLastResults]);

  const requestTranscription = useCallback(async () => {
    if (!lastResults) return;
    if (lastResults.transcriptionLoading) return;
    if (!lastResults.audioBlob) return;

    setLastResults((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transcriptionLoading: true,
        transcriptionError: undefined,
      };
    });

    try {
      const base64Audio = arrayBufferToBase64(await lastResults.audioBlob.arrayBuffer());
      const transcript = await transcribeAudio({
        audioBase64: base64Audio,
        mimeType: lastResults.audioMimeType || 'audio/webm',
        durationSec: lastResults.totalSessionTime,
      });
      const words = transcript.trim().length > 0
        ? transcript.trim().split(/\s+/).filter(Boolean).length
        : null;
      await updateSession({
        sessionId: lastResults.sessionId,
        userId,
        transcript,
        words,
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transcript,
          wordCount: words,
          transcriptionLoading: false,
          transcriptionError: undefined,
          analysisFeedback: undefined,
          analysisFeedbackLoading: false,
          analysisFeedbackError: undefined,
        };
      });
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Unknown error';
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transcriptionError: message,
          transcriptionLoading: false,
        };
      });
    }
  }, [lastResults, setLastResults, userId]);

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

  const handleRetry = useCallback(() => {
    setState('setup');
    setAudioData(null);
    setLastResults(null);
    if (mode === 'lemon') setTimeLeft(LEMON_MIN_TOTAL_SECONDS);
    else if (mode === 'topic') setTimeLeft(TOPIC_MIN_TOTAL_SECONDS);
    else setTimeLeft(0);
  }, [mode, setState, setAudioData, setLastResults, setTimeLeft]);

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
    handleStart,
    handleRetryMicrophone,
    handleRetry,
    handleBack,
    stopRecording,
    requestFeedback,
    requestTranscription,
    soundDetectedRef,
  };
}
