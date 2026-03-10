import { useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useConvex, useMutation } from 'convex/react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '@convex/_generated/api';
import { AudioAnalyzer, type AnalyzerDiagnosticsSnapshot } from '@/lib/speechAnalyzer';
import { micService } from '@/lib/micService';
import { storage } from '@/lib/storage';
import {
  LEMON_MIN_SPEAKING_SECONDS,
  LEMON_MIN_TOTAL_SECONDS,
  PAUSE_THRESHOLD_BY_LEVEL,
  TOPIC_MIN_SPEAKING_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/lib/scoringConstants';
import type { PracticeStateStore, SessionResult } from './types';
import { formatMMSS, toMMSS } from './time';

type UseRecordingControllerOptions = {
  mode: string;
  navigate: NavigateFunction;
  state: PracticeStateStore;
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

export function useRecordingController({ mode, navigate, state }: UseRecordingControllerOptions): RecordingControllerResult {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionDataRef = useRef<{ startTime: number; sessionId: string } | null>(null);
  const soundDetectedRef = useRef(false);
  const micInitializingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const { userId } = useAuth();
  const { user } = useUser();
  const convex = useConvex();

  const saveSession = useMutation(api.sessions.saveSession);
  const updateStreak = useMutation(api.streaks.updateStreak);

  const {
    lemonPrompt,
    topicPrompt,
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
      const results = await analyzerRef.current.stop();
      const duration = Math.floor((Date.now() - (sessionDataRef.current?.startTime || Date.now())) / 1000);

      if (timerRef.current) clearInterval(timerRef.current);

      const practiceMode = mode === 'free' ? 'free-speak' : mode;
      const totalSessionTimeSec = Math.round(results.totalTime / 1000);

      const transcriptHasSpeech = Boolean(results.transcript && results.transcript !== 'No speech detected.' && results.transcript.trim().length > 0);
      const hasSpeechEvidence = transcriptHasSpeech || results.hesitationCount > 0 || results.totalSpeakingTime > 0;
      const transcriptWordCount = transcriptHasSpeech ? results.transcript.trim().split(/\s+/).length : 0;
      const estimatedWordCount = hasSpeechEvidence ? Math.max(1, Math.round(results.totalSpeakingTime * 2.2)) : 0;
      const words = transcriptWordCount > 0 ? transcriptWordCount : estimatedWordCount;

      const scoreResult = AudioAnalyzer.calculateFlowScore(results.hesitationCount, {
        mode,
        speakingTimeSec: results.totalSpeakingTime,
        totalSessionTimeSec,
        hasSpeechEvidence,
      });
      const completed = scoreResult.isCompleted;
      const flowScore = mode === 'free' ? 0 : scoreResult.score;
      const safeFlowScore = Number.isFinite(flowScore) ? flowScore : 0;

      let statusNote: string | undefined;
      if (mode === 'free') {
        statusNote = 'Free Speaking tracks stats only. Lemon and Topic give score when completed.';
      } else if (!scoreResult.isCompleted) {
        if (scoreResult.reason === 'duration') {
          if (mode === 'lemon') {
            statusNote = `Lemon requires ${toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session and ${toMMSS(LEMON_MIN_SPEAKING_SECONDS)} speaking. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
          } else {
            statusNote = `Topic requires ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session and ${toMMSS(TOPIC_MIN_SPEAKING_SECONDS)} speaking. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
          }
        } else if (mode === 'lemon') {
          statusNote = `Lemon requires ${toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session and ${toMMSS(LEMON_MIN_SPEAKING_SECONDS)} speaking. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
        } else {
          statusNote = `Topic requires ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session and ${toMMSS(TOPIC_MIN_SPEAKING_SECONDS)} speaking. You spoke for ${formatMMSS(results.totalSpeakingTime)} this session.`;
        }
      } else if (flowScore === 0 && results.hesitationCount > 2) {
        statusNote = 'Session completed, but score is 0 because hesitation units were too high.';
      }

      const sessionResult: SessionResult = {
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
        await Promise.all([
          saveSession({
            userId: userId!,
            email: user?.primaryEmailAddress?.emailAddress,
            duration,
            pauses: results.hesitationCount,
            words,
            mode: mode || 'free',
            flowScore: safeFlowScore,
            completed,
          }),
          updateStreak({
            userId: userId!,
            email: user?.primaryEmailAddress?.emailAddress,
            localDate: new Date().toLocaleDateString('en-CA'),
          }),
        ]);
      } catch (error) {
        console.error('Failed to sync session to Convex:', error);
      }

      setLastResults(sessionResult);
      setState('done');
      isRecordingRef.current = false;
      micService.setTracksEnabled(false);
      setShowMicRetry(false);
    }
  }, [mode, lemonPrompt, topicPrompt, saveSession, setLastResults, setState, setShowMicRetry, updateStreak, user, userId]);

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
      const feedback = await convex.action(api.analyze.analyzeSpeech, {
        transcript,
        flowScore: lastResults.flowScore,
        hesitationCount: lastResults.hesitationCount,
        speakingTime: lastResults.totalSpeakingTime,
        wordCount: lastResults.wordCount,
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
  }, [convex, lastResults, setLastResults]);

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
      const transcript = await convex.action(api.transcribe.transcribeAudio, {
        audioBase64: base64Audio,
        mimeType: lastResults.audioMimeType || 'audio/webm',
      });
      setLastResults((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transcript,
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
  }, [convex, lastResults, setLastResults]);

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
        micService.setTracksEnabled(false);
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
        micService.setTracksEnabled(false);
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

      const duration = mode === 'lemon' ? LEMON_MIN_TOTAL_SECONDS : (mode === 'topic' ? TOPIC_MIN_TOTAL_SECONDS : 0);
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
      setTranscriptError('Failed to start recording. Please try again.');
      setState('setup');
    }
  }, [mode, setTranscriptError, setState, setShowMicRetry, setTimeLeft, setElapsedTime, stopRecording]);

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
        forceRetryMic ? await micService.retryInit() : await micService.init();
      } catch {
        setTranscriptError('Mic not capturing audio');
        setShowMicRetry(true);
        return;
      }

      micService.setTracksEnabled(true);

      await micService.ensureAudioContextRunning();

      const prefs = storage.getPreferences();
      const hesitationMinDurationMs = Math.round(PAUSE_THRESHOLD_BY_LEVEL[prefs.pauseThresholdLevel] * 1000);

      const analyzer = new AudioAnalyzer({
        enableTranscription: true,
        hesitationMinDurationMs,
        transcribeAudio: async ({ audioBase64, mimeType }) =>
          convex.action(api.transcribe.transcribeAudio, { audioBase64, mimeType }),
        onData: (data) => {
          setAudioData(data);
          if (data.rms > 0.01) soundDetectedRef.current = true;
        },
        onHesitation: () => { },
        onCalibrated: () => { },
        onStartError: (error) => {
          setTranscriptError(`Microphone error: ${error?.name || 'unknown'}`);
        },
      });

      analyzerRef.current = analyzer;

      setState('countdown');
      let count = 3;
      setCountdown(count);

      const countdownInterval = setInterval(() => {
        count--;
        setCountdown(count);
        if (count === 0) {
          clearInterval(countdownInterval);
          void startRecording();
        }
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      setState('setup');
    } finally {
      micInitializingRef.current = false;
    }
  }, [setLastResults, setTranscriptError, setShowMicRetry, setAudioData, setState, setCountdown, startRecording]);

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
    micService.setTracksEnabled(false);
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
    (window as any).__nopauseExportLogs = exportDiagnosticsLogs;
    return () => {
      if ((window as any).__nopauseExportLogs === exportDiagnosticsLogs) {
        delete (window as any).__nopauseExportLogs;
      }
    };
  }, [exportDiagnosticsLogs]);

  useEffect(() => {
    return () => {
      if (analyzerRef.current) {
        try { analyzerRef.current.destroy(); } catch { }
        analyzerRef.current = null;
      }
      micService.setTracksEnabled(false);
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
