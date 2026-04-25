import { describe, expect, it } from 'vitest';
import { applyMicStateFrame, finalizeMicState, type MicStateSnapshot } from './micStateMachine';

describe('analyzer/micStateMachine boundary', () => {
  it('counts hesitation when silence exceeds threshold and speech resumes', () => {
    const initial: MicStateSnapshot = {
      isSpeaking: false,
      hasSpokeAtLeastOnce: true,
      currentFlowStreakStart: null,
      longestFlowStreak: 0,
      totalSpeakingTimeMs: 0,
      totalSilenceTimeMs: 0,
      currentSilenceStart: 1000,
      hesitationSilenceTime: 0,
      hesitationCount: 0,
      hesitationLog: [],
    };

    const result = applyMicStateFrame(initial, {
      now: 4000,
      delta: 100,
      smoothedRms: 0.05,
      speechOnThreshold: 0.01,
      speechOffThreshold: 0.007,
      timeSinceStart: 6000,
      inStartDelayWindow: false,
      isCalibrating: false,
      microPauseFilter: 300,
      hesitationMinDuration: 1800,
      startBufferMs: 5000,
    });

    expect(result.hesitationEvent).toEqual({ duration: 3000, count: 1 });
    expect(result.state.hesitationCount).toBe(1);
    expect(result.state.hesitationLog).toHaveLength(1);
  });

  it('trims trailing silence by the configured end buffer', () => {
    const initial: MicStateSnapshot = {
      isSpeaking: false,
      hasSpokeAtLeastOnce: true,
      currentFlowStreakStart: null,
      longestFlowStreak: 0,
      totalSpeakingTimeMs: 5000,
      totalSilenceTimeMs: 2500,
      currentSilenceStart: 8000,
      hesitationSilenceTime: 0,
      hesitationCount: 0,
      hesitationLog: [],
    };

    const result = finalizeMicState(initial, {
      now: 10000,
      recordingStartTime: 0,
      endBufferMs: 1000,
      microPauseFilter: 300,
      hesitationMinDuration: 1800,
      startBufferMs: 0,
    });

    expect(result.filteredHesitations).toHaveLength(0);
    expect(result.filteredHesitationCount).toBe(0);
  });

  it('keeps trailing silence before the end buffer cutoff', () => {
    const initial: MicStateSnapshot = {
      isSpeaking: false,
      hasSpokeAtLeastOnce: true,
      currentFlowStreakStart: null,
      longestFlowStreak: 0,
      totalSpeakingTimeMs: 5000,
      totalSilenceTimeMs: 4000,
      currentSilenceStart: 5000,
      hesitationSilenceTime: 0,
      hesitationCount: 0,
      hesitationLog: [],
    };

    const result = finalizeMicState(initial, {
      now: 10000,
      recordingStartTime: 0,
      endBufferMs: 1000,
      microPauseFilter: 300,
      hesitationMinDuration: 1800,
      startBufferMs: 0,
    });

    expect(result.filteredHesitations).toEqual([
      { timestamp: 9000, duration: 4000, units: 2, trailing: true },
    ]);
    expect(result.filteredHesitationCount).toBe(2);
  });
});
