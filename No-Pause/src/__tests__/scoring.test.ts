import { describe, expect, it } from 'vitest';
import { calculateFlowScore } from '@/lib/core/scoring';

describe('Flow Score calculation', () => {
  it.each([
    {
      durationSec: 60,
      speakingTimeSec: 60,
      totalSilenceSec: 0,
      expectedScore: 100,
      expectedCompleted: true,
    },
    {
      durationSec: 60,
      speakingTimeSec: 60,
      totalSilenceSec: 3,
      expectedScore: 97,
      expectedCompleted: true,
    },
    {
      durationSec: 120,
      speakingTimeSec: 120,
      totalSilenceSec: 6,
      expectedScore: 194,
      expectedCompleted: true,
    },
    {
      durationSec: 300,
      speakingTimeSec: 125,
      totalSilenceSec: 2,
      expectedScore: 203,
      expectedCompleted: true,
    },
    {
      durationSec: 60,
      speakingTimeSec: 4,
      totalSilenceSec: 0,
      expectedScore: 0,
      expectedCompleted: false,
    },
    {
      durationSec: 60,
      speakingTimeSec: 5,
      totalSilenceSec: 10,
      expectedScore: 0,
      expectedCompleted: true,
    },
  ])(
    'scores $expectedScore for duration=$durationSec speaking=$speakingTimeSec silence=$totalSilenceSec',
    ({ durationSec, speakingTimeSec, totalSilenceSec, expectedScore, expectedCompleted }) => {
      const result = calculateFlowScore(totalSilenceSec, {
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
