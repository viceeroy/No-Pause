import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRecordingController } from './useRecordingController';
import type { PracticeStateStore } from './types';

vi.mock('@/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user_test', email: 'test@example.com' } }),
}));

vi.mock('@/lib/practiceApi', () => ({
  analyzeSpeech: vi.fn(),
  saveSession: vi.fn(),
  transcribeAudio: vi.fn(),
  updateStreak: vi.fn(),
}));

vi.mock('../lib/micService', () => ({
  micService: {
    getStream: vi.fn(() => null),
    setTracksEnabled: vi.fn(),
    init: vi.fn(),
    retryInit: vi.fn(),
    reset: vi.fn().mockResolvedValue(undefined),
    getAudioContext: vi.fn(),
    ensureAudioContextRunning: vi.fn(),
  },
}));

const MockAuthProvider = ({ children }: { children: ReactNode }) => children;

const wrapper = ({ children }: { children: ReactNode }) =>
  MockAuthProvider({ children });

describe('useRecordingController', () => {
  it('resets setup state on retry for lemon mode', () => {
    const setState = vi.fn();
    const setAudioData = vi.fn();
    const setLastResults = vi.fn();
    const setTimeLeft = vi.fn();

    const mockState = {
      state: 'done',
      setState,
      timeLeft: 0,
      setTimeLeft,
      countdown: 3,
      setCountdown: vi.fn(),
      audioData: null,
      setAudioData,
      lastResults: null,
      setLastResults,
      transcriptError: null,
      setTranscriptError: vi.fn(),
      showMicRetry: false,
      setShowMicRetry: vi.fn(),
      promptLoading: false,
      setPromptLoading: vi.fn(),
      topicDifficultyMode: 'random',
      setTopicDifficultyMode: vi.fn(),
      elapsedTime: 0,
      setElapsedTime: vi.fn(),
      copied: false,
      setCopied: vi.fn(),
      lemonPrompt: null,
      setLemonPrompt: vi.fn(),
      topicPrompt: null,
      setTopicPrompt: vi.fn(),
      isFixedScreen: false,
      isTranscriptMissing: false,
      isSessionFailed: false,
      forceShowDebugExport: false,
      showResultsDebugExport: false,
    } satisfies PracticeStateStore;

    const { result } = renderHook(() => useRecordingController({
      mode: 'lemon',
      navigate: vi.fn(),
      state: mockState,
    }), { wrapper });

    act(() => {
      result.current.handleRetry();
    });

    expect(setState).toHaveBeenCalledWith('setup');
    expect(setAudioData).toHaveBeenCalledWith(null);
    expect(setLastResults).toHaveBeenCalledWith(null);
    expect(setTimeLeft).toHaveBeenCalledWith(60);
  });
});
