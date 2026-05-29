import { describe, expect, it } from 'vitest';
import {
  getGroupChallengeStatus,
  isGroupChallengeRecord,
  getGroupChallengeCreatorTelegramId,
  getGroupChallengeDeepLink,
  getChallengeDeepLink,
  getConnectUrl,
  getSpeakingResultMessage,
  getGroupShareResultMessage,
  getChallengeResultMessage,
  getTelegramStatsMessage,
  getGroupChallengeLeaderboardMessage,
  type FlowAnalysis,
} from './constants';

const sampleAnalysis: FlowAnalysis = {
  flowScore: 85,
  pauseCount: 2,
  totalSilenceSec: 5,
  speakingTimeSec: 55,
  totalSessionTimeSec: 60,
  isCompleted: true,
  pauseLog: [],
};

describe('getGroupChallengeStatus', () => {
  it('encodes the creator telegram id', () => {
    expect(getGroupChallengeStatus(12345)).toBe('group_pending:12345');
  });
});

describe('isGroupChallengeRecord', () => {
  it('returns true for exact prefix', () => {
    expect(isGroupChallengeRecord({ status: 'group_pending' })).toBe(true);
  });

  it('returns true for status with creator id', () => {
    expect(isGroupChallengeRecord({ status: 'group_pending:12345' })).toBe(true);
  });

  it('returns false for pending', () => {
    expect(isGroupChallengeRecord({ status: 'pending' })).toBe(false);
  });

  it('returns false for completed', () => {
    expect(isGroupChallengeRecord({ status: 'completed' })).toBe(false);
  });
});

describe('getGroupChallengeCreatorTelegramId', () => {
  it('extracts the creator id', () => {
    expect(getGroupChallengeCreatorTelegramId({ status: 'group_pending:99887' })).toBe(99887);
  });

  it('returns null for bare prefix without id', () => {
    expect(getGroupChallengeCreatorTelegramId({ status: 'group_pending' })).toBeNull();
  });

  it('returns null for non-group status', () => {
    expect(getGroupChallengeCreatorTelegramId({ status: 'pending' })).toBeNull();
  });

  it('returns null for non-numeric id after prefix', () => {
    expect(getGroupChallengeCreatorTelegramId({ status: 'group_pending:abc' })).toBeNull();
  });
});

describe('deep link URLs', () => {
  it('getGroupChallengeDeepLink builds correct URL', () => {
    const link = getGroupChallengeDeepLink('abc123');
    expect(link).toBe('https://t.me/NoPauseAI_bot?start=group_abc123');
  });

  it('getChallengeDeepLink builds correct URL', () => {
    const link = getChallengeDeepLink('xyz789');
    expect(link).toBe('https://t.me/NoPauseAI_bot?start=challenge_xyz789');
  });

  it('getConnectUrl builds correct URL', () => {
    const url = getConnectUrl(12345);
    expect(url).toContain('/connect?tg=12345');
  });

  it('encodes special characters in challenge IDs', () => {
    const link = getGroupChallengeDeepLink('a&b=c');
    expect(link).toContain('group_a%26b%3Dc');
  });
});

describe('getSpeakingResultMessage', () => {
  it('includes flow score and silence', () => {
    const msg = getSpeakingResultMessage({ analysis: sampleAnalysis });
    expect(msg).toContain('85');
    expect(msg).toContain('Silence:');
    expect(msg).toContain('5s');
    expect(msg).toContain('Speaking Result');
  });

  it('includes speaker name when provided', () => {
    const msg = getSpeakingResultMessage({ analysis: sampleAnalysis, speaker: 'Alice' });
    expect(msg).toContain('Alice');
    expect(msg).toContain('Speaker');
  });

  it('includes transcript when provided', () => {
    const msg = getSpeakingResultMessage({
      analysis: sampleAnalysis,
      transcript: 'hello world',
    });
    expect(msg).toContain('hello world');
    expect(msg).toContain('Transcript');
  });

  it('omits transcript section when transcript is empty', () => {
    const msg = getSpeakingResultMessage({ analysis: sampleAnalysis, transcript: '' });
    expect(msg).not.toContain('Transcript');
  });
});

describe('getGroupShareResultMessage', () => {
  it('includes participant name and score', () => {
    const msg = getGroupShareResultMessage({
      firstName: 'Bob',
      analysis: sampleAnalysis,
    });
    expect(msg).toContain('Bob');
    expect(msg).toContain('85');
    expect(msg).toContain('Group Challenge Result');
  });

  it('includes username when provided', () => {
    const msg = getGroupShareResultMessage({
      firstName: 'Bob',
      username: 'bob123',
      analysis: sampleAnalysis,
    });
    expect(msg).toContain('@bob123');
  });

  it('shows attempt count', () => {
    const msg = getGroupShareResultMessage({
      firstName: 'Bob',
      attemptCount: 3,
      analysis: sampleAnalysis,
    });
    expect(msg).toContain('#3');
  });
});

describe('getChallengeResultMessage', () => {
  it('includes topic and score', () => {
    const msg = getChallengeResultMessage({
      topic: 'Talk about music',
      analysis: sampleAnalysis,
    });
    expect(msg).toContain('Talk about music');
    expect(msg).toContain('85');
  });

  it('includes custom title', () => {
    const msg = getChallengeResultMessage({
      topic: 'test',
      analysis: sampleAnalysis,
      title: 'Friend Challenge',
    });
    expect(msg).toContain('Friend Challenge');
  });

  it('escapes HTML in topic', () => {
    const msg = getChallengeResultMessage({
      topic: '<script>alert("xss")</script>',
      analysis: sampleAnalysis,
    });
    expect(msg).toContain('&lt;script&gt;');
    expect(msg).not.toContain('<script>');
  });
});

describe('getTelegramStatsMessage', () => {
  it('includes all stat fields', () => {
    const msg = getTelegramStatsMessage({
      bestFlowScore: 200,
      avgFlowScore: 150,
      totalSessions: 42,
      totalPracticeTime: 3600,
      currentStreak: 3,
      bestStreak: 7,
      friendChallenges: 4,
      groupChallenges: 2,
    });
    expect(msg).toContain('200');
    expect(msg).toContain('150');
    expect(msg).toContain('42');
    expect(msg).toContain('3 / 7 best');
    expect(msg).toContain('1h');
  });

  it('handles zero stats', () => {
    const msg = getTelegramStatsMessage({
      bestFlowScore: 0,
      avgFlowScore: 0,
      totalSessions: 0,
      totalPracticeTime: 0,
      currentStreak: 0,
      bestStreak: 0,
      friendChallenges: 0,
      groupChallenges: 0,
    });
    expect(msg).toContain('Best: 0');
    expect(msg).toContain('Sessions: 0');
  });
});

describe('getGroupChallengeLeaderboardMessage', () => {
  it('shows empty board message when no entries', () => {
    const msg = getGroupChallengeLeaderboardMessage({
      topic: 'Test topic',
      entries: [],
      expired: false,
    });
    expect(msg).toContain('No scores yet');
    expect(msg).toContain('Test topic');
    expect(msg).toContain('Live board');
  });

  it('shows expired status', () => {
    const msg = getGroupChallengeLeaderboardMessage({
      topic: 'Test',
      entries: [],
      expired: true,
    });
    expect(msg).toContain('Final board');
    expect(msg).not.toContain('Live board');
  });

  it('renders ranked entries with medals', () => {
    const msg = getGroupChallengeLeaderboardMessage({
      topic: 'Test',
      entries: [
        { rank: 1, username: '@alice', bestFlowScore: 200, attemptCount: 3 },
        { rank: 2, username: '@bob', bestFlowScore: 150, attemptCount: 1 },
        { rank: 3, username: '@charlie', bestFlowScore: 100, attemptCount: 2 },
      ],
      expired: false,
    });
    expect(msg).toContain('🥇');
    expect(msg).toContain('🥈');
    expect(msg).toContain('🥉');
    expect(msg).toContain('@alice');
    expect(msg).toContain('200 Flow Score');
    expect(msg).toContain('3 tries');
    expect(msg).toContain('1 try');
  });

  it('uses #N for ranks beyond 3', () => {
    const msg = getGroupChallengeLeaderboardMessage({
      topic: 'Test',
      entries: [
        { rank: 4, username: '@dave', bestFlowScore: 50, attemptCount: 1 },
      ],
      expired: false,
    });
    expect(msg).toContain('#4');
  });
});
