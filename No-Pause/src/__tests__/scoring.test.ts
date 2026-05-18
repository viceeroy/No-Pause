import { describe, expect, it } from 'vitest';
import { calculateFlowScore } from '@/lib/core/scoring';

describe('Flow Score calculation', () => {
  it.each([
    {
      durationSec: 60,
      speakingTimeSec: 60,
      pauseCount: 0,
      expectedScore: 100,
      expectedCompleted: true,
    },
    {
      durationSec: 60,
      speakingTimeSec: 60,
      pauseCount: 3,
      expectedScore: 70,
      expectedCompleted: true,
    },
    {
      durationSec: 120,
      speakingTimeSec: 120,
      pauseCount: 6,
      expectedScore: 140,
      expectedCompleted: true,
    },
    {
      durationSec: 300,
      speakingTimeSec: 125,
      pauseCount: 2,
      expectedScore: 185,
      expectedCompleted: true,
    },
    {
      durationSec: 60,
      speakingTimeSec: 4,
      pauseCount: 0,
      expectedScore: 0,
      expectedCompleted: false,
    },
    {
      durationSec: 60,
      speakingTimeSec: 5,
      pauseCount: 10,
      expectedScore: 0,
      expectedCompleted: true,
    },
  ])(
    'scores $expectedScore for duration=$durationSec speaking=$speakingTimeSec pauses=$pauseCount',
    ({ durationSec, speakingTimeSec, pauseCount, expectedScore, expectedCompleted }) => {
      const result = calculateFlowScore(pauseCount, {
        speakingTimeSec,
        totalSessionTimeSec: durationSec,
      });

      expect(result.score).toBe(expectedScore);
      expect(result.isCompleted).toBe(expectedCompleted);
    },
  );

  it('returns the short-session note when speaking time is below five seconds', () => {
    expect(calculateFlowScore(0, { speakingTimeSec: 4, totalSessionTimeSec: 60 })).toEqual({
      score: 0,
      isCompleted: false,
      note: 'Session was too short to score. Speak for at least 5 seconds.',
    });
  });
});
