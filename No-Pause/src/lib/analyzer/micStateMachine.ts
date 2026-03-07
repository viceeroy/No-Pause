export interface HesitationLogItem {
  timestamp: number;
  duration: number;
  units: number;
  trailing?: boolean;
}

export interface MicStateSnapshot {
  isSpeaking: boolean;
  hasSpokeAtLeastOnce: boolean;
  currentFlowStreakStart: number | null;
  longestFlowStreak: number;
  totalSpeakingTimeMs: number;
  totalSilenceTimeMs: number;
  currentSilenceStart: number | null;
  hesitationSilenceTime: number;
  hesitationCount: number;
  hesitationLog: HesitationLogItem[];
}

export interface MicStateFrameInput {
  now: number;
  delta: number;
  smoothedRms: number;
  speechOnThreshold: number;
  speechOffThreshold: number;
  timeSinceStart: number;
  inStartDelayWindow: boolean;
  isCalibrating: boolean;
  microPauseFilter: number;
  hesitationMinDuration: number;
  startBufferMs: number;
}

export interface MicStateFrameOutput {
  state: MicStateSnapshot;
  hesitationEvent: { duration: number; count: number } | null;
}

export interface FinalizeMicStateInput {
  now: number;
  recordingStartTime: number;
  endBufferMs: number;
  microPauseFilter: number;
  hesitationMinDuration: number;
  startBufferMs: number;
}

export interface FinalizeMicStateOutput {
  state: MicStateSnapshot;
  filteredHesitations: HesitationLogItem[];
  filteredHesitationSilenceTime: number;
  filteredHesitationCount: number;
  analysisWindow: number;
}

export const applyMicStateFrame = (
  inputState: MicStateSnapshot,
  input: MicStateFrameInput,
): MicStateFrameOutput => {
  const state: MicStateSnapshot = {
    ...inputState,
    hesitationLog: [...inputState.hesitationLog],
  };

  const wasSpeaking = state.isSpeaking;
  const isSpeaking = wasSpeaking
    ? input.smoothedRms > input.speechOffThreshold
    : input.smoothedRms > input.speechOnThreshold;
  state.isSpeaking = isSpeaking;

  if (!input.inStartDelayWindow) {
    if (isSpeaking) {
      state.totalSpeakingTimeMs += input.delta;
      state.hasSpokeAtLeastOnce = true;
      if (!wasSpeaking) state.currentFlowStreakStart = input.now;
    } else {
      state.totalSilenceTimeMs += input.delta;
      if (wasSpeaking && state.currentFlowStreakStart) {
        const streak = input.now - state.currentFlowStreakStart;
        if (streak > state.longestFlowStreak) state.longestFlowStreak = streak;
        state.currentFlowStreakStart = null;
      }
    }
  }

  let hesitationEvent: { duration: number; count: number } | null = null;

  if (!input.isCalibrating && state.hasSpokeAtLeastOnce) {
    if (!isSpeaking) {
      if (wasSpeaking) state.currentSilenceStart = input.now;
    } else if (!wasSpeaking && state.currentSilenceStart) {
      const silenceDuration = input.now - state.currentSilenceStart;
      if (silenceDuration >= input.microPauseFilter && silenceDuration >= input.hesitationMinDuration) {
        const hesitationUnits = Math.floor(silenceDuration / input.hesitationMinDuration);
        if (input.timeSinceStart >= input.startBufferMs) {
          state.hesitationSilenceTime += silenceDuration;
          state.hesitationCount += hesitationUnits;
          state.hesitationLog.push({
            timestamp: input.timeSinceStart,
            duration: silenceDuration,
            units: hesitationUnits,
          });
          hesitationEvent = {
            duration: silenceDuration,
            count: state.hesitationCount,
          };
        }
      }
      state.currentSilenceStart = null;
    }
  }

  return { state, hesitationEvent };
};

export const finalizeMicState = (
  inputState: MicStateSnapshot,
  input: FinalizeMicStateInput,
): FinalizeMicStateOutput => {
  const state: MicStateSnapshot = {
    ...inputState,
    hesitationLog: [...inputState.hesitationLog],
  };

  const totalRecordingTime = input.now - input.recordingStartTime;
  const endBufferCutoff = totalRecordingTime - input.endBufferMs;

  if (!state.isSpeaking && state.currentSilenceStart) {
    const trailingSilenceDuration = input.now - state.currentSilenceStart;
    if (trailingSilenceDuration >= input.microPauseFilter && trailingSilenceDuration >= input.hesitationMinDuration) {
      const trailingUnits = Math.floor(trailingSilenceDuration / input.hesitationMinDuration);
      state.hesitationLog.push({
        timestamp: input.now - input.recordingStartTime,
        duration: trailingSilenceDuration,
        units: trailingUnits,
        trailing: true,
      });
    }
    state.currentSilenceStart = null;
  }

  const filteredHesitations = state.hesitationLog.filter(
    (h) => h.trailing || (h.timestamp >= input.startBufferMs && h.timestamp <= endBufferCutoff),
  );
  const filteredHesitationSilenceTime = filteredHesitations.reduce((sum, h) => sum + h.duration, 0);
  const filteredHesitationCount = filteredHesitations.reduce((sum, h) => sum + h.units, 0);
  const analysisWindow = Math.max(0, totalRecordingTime - input.startBufferMs - input.endBufferMs);

  return {
    state,
    filteredHesitations,
    filteredHesitationSilenceTime,
    filteredHesitationCount,
    analysisWindow,
  };
};
