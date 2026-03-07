import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePracticeState } from '@/pages/practice/usePracticeState';

describe('usePracticeState', () => {
  it('updates derived result flags from lastResults', () => {
    const { result } = renderHook(() => usePracticeState());

    expect(result.current.showResultsDebugExport).toBe(false);

    act(() => {
      result.current.setLastResults({
        flowScore: 0,
        totalSpeakingTime: 0,
        totalSessionTime: 60,
        hesitationCount: 3,
        mode: 'lemon',
        audioBlob: null,
        transcript: '',
        isCompleted: false,
      });
    });

    expect(result.current.isTranscriptMissing).toBe(true);
    expect(result.current.isSessionFailed).toBe(true);
    expect(result.current.showResultsDebugExport).toBe(true);
  });
});
