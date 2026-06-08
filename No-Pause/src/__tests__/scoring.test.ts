import { describe, expect, it } from 'vitest';
import {
  calculateDurationBonus,
  calculateFlowScore,
  calculateTotalScore,
  getScoreLabel,
} from '@/lib/core/scoring';

describe('calculateFlowScore', () => {
  it.each([
    // perfect continuity, no pauses
    { cleanSpeakingTime: 60, totalSessionTime: 60, speakingTime: 60, pauseCount: 0, expectedScore: 100, expectedCompleted: true },
    // 90% continuity, no pauses
    { cleanSpeakingTime: 54, totalSessionTime: 60, speakingTime: 54, pauseCount: 0, expectedScore: 90, expectedCompleted: true },
    // full continuity but 3 pauses over 1 minute -> penalty 6
    { cleanSpeakingTime: 60, totalSessionTime: 60, speakingTime: 60, pauseCount: 3, expectedScore: 94, expectedCompleted: true },
    // heavy penalty clamps to 0
    { cleanSpeakingTime: 10, totalSessionTime: 60, speakingTime: 10, pauseCount: 10, expectedScore: 0, expectedCompleted: true },
    // under 5s speaking -> not completed, score still computed
    { cleanSpeakingTime: 4, totalSessionTime: 10, speakingTime: 4, pauseCount: 0, expectedScore: 40, expectedCompleted: false },
    // zero speaking -> guarded to 0/incomplete
    { cleanSpeakingTime: 0, totalSessionTime: 60, speakingTime: 0, pauseCount: 0, expectedScore: 0, expectedCompleted: false },
  ])(
    'scores $expectedScore for clean=$cleanSpeakingTime total=$totalSessionTime speaking=$speakingTime pauses=$pauseCount',
    ({ cleanSpeakingTime, totalSessionTime, speakingTime, pauseCount, expectedScore, expectedCompleted }) => {
      const result = calculateFlowScore({ cleanSpeakingTime, totalSessionTime, speakingTime, pauseCount });
      expect(result.score).toBe(expectedScore);
      expect(result.isCompleted).toBe(expectedCompleted);
    },
  );
});

describe('calculateDurationBonus', () => {
  it.each([
    { speakingTimeSec: 0, expected: 0 },
    { speakingTimeSec: 50, expected: 5 },
    { speakingTimeSec: 100, expected: 10 },
    { speakingTimeSec: 300, expected: 30 },
    { speakingTimeSec: 600, expected: 30 }, // clamped
  ])('bonus $expected for $speakingTimeSec s', ({ speakingTimeSec, expected }) => {
    expect(calculateDurationBonus(speakingTimeSec)).toBe(expected);
  });
});

describe('calculateTotalScore', () => {
  it('sums flow + ai + duration', () => {
    expect(calculateTotalScore(90, 80, 20)).toBe(190);
    expect(calculateTotalScore(50, 30, 10)).toBe(90);
  });
  it('caps at 230', () => {
    expect(calculateTotalScore(100, 100, 30)).toBe(230);
    expect(calculateTotalScore(100, 100, 30)).toBeLessThanOrEqual(230);
  });
});

describe('getScoreLabel', () => {
  it.each([
    { score: 0, label: 'Needs Practice' },
    { score: 50, label: 'Needs Practice' },
    { score: 51, label: 'Getting There' },
    { score: 100, label: 'Getting There' },
    { score: 101, label: 'Good Flow' },
    { score: 150, label: 'Good Flow' },
    { score: 151, label: 'Great Flow' },
    { score: 200, label: 'Great Flow' },
    { score: 201, label: 'Perfect Flow' },
    { score: 230, label: 'Perfect Flow' },
  ])('labels $score as $label', ({ score, label }) => {
    expect(getScoreLabel(score)).toBe(label);
  });
});
