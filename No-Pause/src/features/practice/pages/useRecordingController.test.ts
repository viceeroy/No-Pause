import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRecordingController } from './useRecordingController';
import type { PracticeStateStore } from './types';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: 'user_test' }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'test@example.com' } } }),
}));

vi.mock('convex/react', () => ({
  useConvex: () => ({ action: vi.fn() }),
  useMutation: () => vi.fn(),
}));

vi.mock('../lib/micService', () => ({
  micService: {
    getStream: vi.fn(() => null),
    setTracksEnabled: vi.fn(),
    init: vi.fn(),
    retryInit: vi.fn(),
    getAudioContext: vi.fn(),
    ensureAudioContextRunning: vi.fn(),
  },
}));

const MockClerkProvider = ({ children }: { children: ReactNode }) => children;

const wrapper = ({ children }: { children: ReactNode }) =>
  MockClerkProvider({ children });

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
