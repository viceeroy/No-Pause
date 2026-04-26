import { describe, expect, it } from 'vitest';
import { calculateFlowScore, getScoreLabel } from './scoring';

describe('analyzer/scoring boundary', () => {
  it('returns completed score in free mode at exactly 50% speaking ratio', () => {
    const result = calculateFlowScore(3, {
      mode: 'free',
      speakingTimeSec: 30,
      totalSessionTimeSec: 60,
    });

    expect(result).toEqual({ score: 50, isCompleted: true });
    expect(getScoreLabel(result.score)).toBe('Getting There');
  });
});
