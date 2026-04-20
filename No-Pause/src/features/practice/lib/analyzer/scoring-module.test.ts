import { describe, expect, it } from 'vitest';
import { calculateFlowScore, getScoreLabel } from './scoring';

describe('analyzer/scoring boundary', () => {
  it('returns completed score in free mode with transcript fallback evidence', () => {
    const result = calculateFlowScore(3, {
      mode: 'free',
      speakingTimeSec: 20,
      totalSessionTimeSec: 60,
      hasSpeechEvidence: true,
    });

    expect(result).toEqual({ score: 25, isCompleted: true });
    expect(getScoreLabel(result.score)).toBe('Keep Practicing');
  });
});
