import { describe, it, expect } from 'vitest';
import { AudioAnalyzer } from '../speechAnalyzer';
import { type FlowScoreOptions } from './scoring';
import {
  TOPIC_MIN_TOTAL_SECONDS,
  LEMON_MIN_TOTAL_SECONDS,
} from '../scoringConstants';

describe('Flow Score Calculation - Simplified Rules', () => {
  const calc = (hesitations: number, opts: FlowScoreOptions) =>
    AudioAnalyzer.calculateFlowScore(hesitations, opts);

  describe('Completion requirements', () => {
    it('topic fails when total session is 1 second short of minimum', () => {
      const r = calc(0, {
        mode: 'topic',
        speakingTimeSec: TOPIC_MIN_TOTAL_SECONDS / 2,
        totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS - 1,
      });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('topic passes exactly at minimum total and 50% speaking ratio', () => {
      const r = calc(0, {
        mode: 'topic',
        speakingTimeSec: TOPIC_MIN_TOTAL_SECONDS / 2,
        totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS,
      });
      expect(r.isCompleted).toBe(true);
      expect(r.score).toBe(70);
    });

    it('topic fails when total is sufficient but speaking ratio is below 50%', () => {
      const r = calc(0, {
        mode: 'topic',
        speakingTimeSec: TOPIC_MIN_TOTAL_SECONDS / 2 - 1,
        totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS,
      });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('lemon fails when total session is 1 second short of minimum', () => {
      const r = calc(0, {
        mode: 'lemon',
        speakingTimeSec: LEMON_MIN_TOTAL_SECONDS / 2,
        totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS - 1,
      });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('lemon passes exactly at minimum total and 50% speaking ratio', () => {
      const r = calc(0, {
        mode: 'lemon',
        speakingTimeSec: LEMON_MIN_TOTAL_SECONDS / 2,
        totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS,
      });
      expect(r.isCompleted).toBe(true);
      expect(r.score).toBe(70);
    });

    it('lemon fails when total is sufficient but speaking ratio is below 50%', () => {
      const r = calc(0, {
        mode: 'lemon',
        speakingTimeSec: LEMON_MIN_TOTAL_SECONDS / 2 - 1,
        totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS,
      });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('free speaking is incomplete when total session is under 60s', () => {
      const r = calc(0, { mode: 'free', speakingTimeSec: 59, totalSessionTimeSec: 59 });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('free speaking is complete with at least 60s session and 50% speaking ratio', () => {
      const r = calc(0, { mode: 'free', speakingTimeSec: 30, totalSessionTimeSec: 60 });
      expect(r.isCompleted).toBe(true);
      expect(r.score).toBe(70);
    });

    it('free speaking does not complete with transcript evidence below 50% speaking ratio', () => {
      const r = calc(0, { mode: 'free', speakingTimeSec: 20, totalSessionTimeSec: 60, hasSpeechEvidence: true });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('lemon requires 1:00 duration and at least 50% speaking ratio', () => {
      const completeByDuration = calc(0, { mode: 'lemon', speakingTimeSec: 55, totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS });
      const incompleteSpeaking = calc(0, { mode: 'lemon', speakingTimeSec: 29, totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS });
      const incompleteDuration = calc(0, { mode: 'lemon', speakingTimeSec: 40, totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS - 1 });
      const complete = calc(0, { mode: 'lemon', speakingTimeSec: 30, totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS });
      expect(completeByDuration.isCompleted).toBe(true);
      expect(completeByDuration.score).toBe(100);
      expect(incompleteSpeaking.isCompleted).toBe(false);
      expect(incompleteSpeaking.score).toBe(0);
      expect(incompleteDuration.isCompleted).toBe(false);
      expect(incompleteDuration.score).toBe(0);
      expect(complete.isCompleted).toBe(true);
      expect(complete.score).toBe(70);
    });

    it('silent sessions cannot get perfect score', () => {
      const freeSilent = calc(0, { mode: 'free', speakingTimeSec: 0, totalSessionTimeSec: 120 });
      const lemonSilent = calc(0, { mode: 'lemon', speakingTimeSec: 0, totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS });
      const topicSilent = calc(0, { mode: 'topic', speakingTimeSec: 0, totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS });
      expect(freeSilent.isCompleted).toBe(false);
      expect(freeSilent.score).toBe(0);
      expect(lemonSilent.isCompleted).toBe(false);
      expect(lemonSilent.score).toBe(0);
      expect(topicSilent.isCompleted).toBe(false);
      expect(topicSilent.score).toBe(0);
    });

    it('topic requires full 120s duration and at least 50% speaking ratio', () => {
      const durationIncomplete = calc(0, { mode: 'topic', speakingTimeSec: 90, totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS - 1 });
      const speakingIncomplete = calc(0, { mode: 'topic', speakingTimeSec: 59, totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS });
      const complete = calc(0, { mode: 'topic', speakingTimeSec: 60, totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS });
      expect(durationIncomplete.isCompleted).toBe(false);
      expect(durationIncomplete.score).toBe(0);
      expect(speakingIncomplete.isCompleted).toBe(false);
      expect(speakingIncomplete.score).toBe(0);
      expect(complete.isCompleted).toBe(true);
      expect(complete.score).toBe(70);
    });

    it('topic does not use transcript fallback under the new rules', () => {
      const r = calc(0, { mode: 'topic', speakingTimeSec: 50, totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS, hasSpeechEvidence: true });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });
  });

  describe('Scoring formula for completed sessions', () => {
    it('completed, 0 hesitations => 100', () => {
      const r = calc(0, { mode: 'free', speakingTimeSec: 60, totalSessionTimeSec: 70 });
      expect(r.score).toBe(100);
    });

    it('free mode returns a real score', () => {
      const r = calc(2, { mode: 'free', speakingTimeSec: 60, totalSessionTimeSec: 70 });
      expect(r.isCompleted).toBe(true);
      expect(r.score).toBe(90);
    });

    it('completed, 2 hesitations over 60s speaking => 90', () => {
      const r = calc(2, { mode: 'free', speakingTimeSec: 60, totalSessionTimeSec: 70 });
      expect(r.score).toBe(90);
    });

    it('completed, 3 hesitations over 40s speaking => 65', () => {
      const r = calc(3, { mode: 'lemon', speakingTimeSec: 40, totalSessionTimeSec: LEMON_MIN_TOTAL_SECONDS });
      expect(r.score).toBe(65);
    });

    it('completed, 5 hesitations over 75s speaking => 70', () => {
      const r = calc(5, { mode: 'free', speakingTimeSec: 75, totalSessionTimeSec: 90 });
      expect(r.score).toBe(70);
    });

    it('minimum score is 0', () => {
      const r = calc(20, { mode: 'topic', speakingTimeSec: 70, totalSessionTimeSec: TOPIC_MIN_TOTAL_SECONDS });
      expect(r.score).toBe(0);
    });

    it('sessions at exactly 50% speaking ratio qualify and cap at 70', () => {
      const r = calc(0, { mode: 'lemon', speakingTimeSec: 30, totalSessionTimeSec: 60 });
      expect(r.isCompleted).toBe(true);
      expect(r.score).toBe(70);
    });

    it('sessions below 50% speaking ratio return 0', () => {
      const r = calc(0, { mode: 'free', speakingTimeSec: 29, totalSessionTimeSec: 60 });
      expect(r.isCompleted).toBe(false);
      expect(r.score).toBe(0);
    });

    it('speaking ratio cap reaches 100 at 65%', () => {
      const r = calc(0, { mode: 'free', speakingTimeSec: 39, totalSessionTimeSec: 60 });
      expect(r.isCompleted).toBe(true);
      expect(r.score).toBe(100);
    });
  });
});
