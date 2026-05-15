import { describe, expect, it } from 'vitest';
import { calculateFlowScore } from '@/lib/core/scoring';
import { processTranscriptForFillerWords } from '@/features/practice/lib/transcription';

describe('Flow Score calculation', () => {
  it.each([
    {
      durationSec: 60,
      speakingTimeSec: 60,
      pauseCount: 0,
      fillerCount: 0,
      expectedScore: 100,
      expectedCompleted: true,
    },
    {
      durationSec: 60,
      speakingTimeSec: 60,
      pauseCount: 3,
      fillerCount: 2,
      expectedScore: 70,
      expectedCompleted: true,
    },
    {
      durationSec: 120,
      speakingTimeSec: 120,
      pauseCount: 6,
      fillerCount: 4,
      expectedScore: 140,
      expectedCompleted: true,
    },
    {
      durationSec: 300,
      speakingTimeSec: 125,
      pauseCount: 2,
      fillerCount: 5,
      expectedScore: 185,
      expectedCompleted: true,
    },
    {
      durationSec: 60,
      speakingTimeSec: 4,
      pauseCount: 0,
      fillerCount: 1,
      expectedScore: 0,
      expectedCompleted: false,
    },
    {
      durationSec: 60,
      speakingTimeSec: 5,
      pauseCount: 10,
      fillerCount: 0,
      expectedScore: 0,
      expectedCompleted: true,
    },
  ])(
    'scores $expectedScore for duration=$durationSec speaking=$speakingTimeSec pauses=$pauseCount fillers=$fillerCount',
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

describe('filler word detection', () => {
  it.each([
    {
      transcript: 'Um, I was, uh, thinking that you know this is like actually useful.',
      expectedCount: 5,
      expectedMarked: ['**Um**', '**uh**', '**you know**', '**like**', '**actually**'],
    },
    {
      transcript: 'Basically, I literally had an er moment and then said ah.',
      expectedCount: 4,
      expectedMarked: ['**Basically**', '**literally**', '**er**', '**ah**'],
    },
    {
      transcript: 'The lithium theorem is unlikely, and this is a well formed answer.',
      expectedCount: 0,
      expectedMarked: [],
    },
  ])('counts fillers in "$transcript"', ({ transcript, expectedCount, expectedMarked }) => {
    const result = processTranscriptForFillerWords(transcript);

    expect(result.count).toBe(expectedCount);
    for (const markedFiller of expectedMarked) {
      expect(result.processedTranscript).toContain(markedFiller);
    }
  });
});
