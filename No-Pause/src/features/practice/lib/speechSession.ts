import {
  applyMicStateFrame,
  finalizeMicState,
  type MicStateSnapshot,
} from './analyzer/micStateMachine';
import type { AudioCaptureFrame } from './audioCapture';
import type { AnalyzerResults, AudioDataPayload } from './speechTypes';
import {
  calculateFlowScore,
  DEFAULT_PAUSE_THRESHOLD_MS,
} from '@/lib/core/scoring';

const SPEECH_THRESHOLD = 0.01;
const SPEECH_OFF_MULTIPLIER = 0.7;
const CALIBRATION_NOISE_MULTIPLIER = 2;
const CALIBRATION_SPEECH_RESET_THRESHOLD = SPEECH_THRESHOLD * 2;
const MAX_CALIBRATED_SPEECH_THRESHOLD = 0.06;
const HESITATION_MIN_DURATION = DEFAULT_PAUSE_THRESHOLD_MS;
const MICRO_PAUSE_IGNORE = 300;
const CALIBRATION_DURATION = 1500;
const ANALYTICS_START_DELAY_MS = 400;
const FRAME_LOG_INTERVAL = 60;
const IS_DEV = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => { if (IS_DEV) console.log(...args); };
const debugWarn = (...args: unknown[]) => { if (IS_DEV) console.warn(...args); };

export interface SpeechSessionOptions {
  hesitationMinDurationMs?: number;
  onData?: (data: AudioDataPayload) => void;
  onHesitation?: (duration: number, count: number) => void;
  onCalibrated?: (ambientNoise: number, thresholdSet: number) => void;
}

export interface SpeechSessionFinalStats {
  totalSpeakingTime: number;
  totalSilenceTime: number;
  hesitationSilenceTime: number;
  hesitationCount: number;
  hesitationLog: AnalyzerResults['hesitationLog'];
  longestFlowStreak: number;
  frameCount: number;
  noiseFloor: number;
  totalTime: number;
  avgVolume: number;
}

export class SpeechSession {
  private speechOnThreshold = SPEECH_THRESHOLD;
  private speechOffThreshold = SPEECH_THRESHOLD * SPEECH_OFF_MULTIPLIER;
  private hesitationMinDuration: number;
  private microPauseFilter = MICRO_PAUSE_IGNORE;
  private recordingStartTime = 0;
  private calibrationStartTime: number | null = null;
  private calibrationSamples: number[] = [];
  private isCalibrating = true;
  private state: MicStateSnapshot = this.createInitialState();
  private frameCount = 0;
  private noiseFloor = 0;
  private lastFrameTime: number | null = null;

  constructor(private readonly options: SpeechSessionOptions = {}) {
    this.hesitationMinDuration = options.hesitationMinDurationMs ?? HESITATION_MIN_DURATION;
  }

  start(now = Date.now()) {
    this.speechOnThreshold = SPEECH_THRESHOLD;
    this.speechOffThreshold = SPEECH_THRESHOLD * SPEECH_OFF_MULTIPLIER;
    this.recordingStartTime = now;
    this.calibrationStartTime = now;
    this.calibrationSamples = [];
    this.isCalibrating = true;
    this.state = this.createInitialState();
    this.frameCount = 0;
    this.noiseFloor = 0;
    this.lastFrameTime = now;
  }

  handleFrame(frame: AudioCaptureFrame) {
    this.frameCount = frame.frameCount;
    this.lastFrameTime = frame.now;
    this.updateCalibration(frame.now, frame.rms);
    const timeSinceStart = frame.now - this.recordingStartTime;
    const result = applyMicStateFrame(this.state, {
      now: frame.now,
      delta: frame.delta,
      smoothedRms: frame.smoothedRms,
      speechOnThreshold: this.speechOnThreshold,
      speechOffThreshold: this.speechOffThreshold,
      timeSinceStart,
      inStartDelayWindow: timeSinceStart < ANALYTICS_START_DELAY_MS,
      isCalibrating: this.isCalibrating,
      microPauseFilter: this.microPauseFilter,
      hesitationMinDuration: this.hesitationMinDuration,
      startBufferMs: 0,
    });
    this.state = result.state;

    if (frame.frameCount % FRAME_LOG_INTERVAL === 1) {
      debugLog(`[NoSpeech] 📊 Frame ${frame.frameCount} | RMS: ${frame.rms.toFixed(5)} | Peak: ${frame.maxSample.toFixed(5)} | Speaking: ${this.state.isSpeaking} | Hesitations: ${this.state.hesitationCount} | HesitSilence: ${(this.state.hesitationSilenceTime / 1000).toFixed(1)}s`);
    }

    if (result.hesitationEvent) {
      const hesitationUnits = Math.floor(result.hesitationEvent.duration / this.hesitationMinDuration);
      debugLog(`[NoSpeech] Hesitation at ${Math.round(timeSinceStart)}ms (${(result.hesitationEvent.duration / 1000).toFixed(1)}s, ${hesitationUnits}u) - COUNTED (in analysis window)`);
      this.options.onHesitation?.(result.hesitationEvent.duration, result.hesitationEvent.count);
    }

    this.options.onData?.(this.toPayload(frame));
  }

  finish(now: number, avgVolume: number): SpeechSessionFinalStats {
    if (this.lastFrameTime) {
      const finalDelta = now - this.lastFrameTime;
      if (this.state.isSpeaking) {
        this.state.totalSpeakingTimeMs += finalDelta;
        if (this.state.currentFlowStreakStart) {
          const streak = now - this.state.currentFlowStreakStart;
          if (streak > this.state.longestFlowStreak) this.state.longestFlowStreak = streak;
        }
      } else {
        this.state.totalSilenceTimeMs += finalDelta;
      }
    }

    const finalized = finalizeMicState(this.state, {
      now,
      recordingStartTime: this.recordingStartTime,
      endBufferMs: 0,
      microPauseFilter: this.microPauseFilter,
      hesitationMinDuration: this.hesitationMinDuration,
      startBufferMs: 0,
    });
    this.state = finalized.state;

    const totalRecordingTime = now - this.recordingStartTime;
    const flowScore = calculateFlowScore({
      cleanSpeakingTime: Math.round((totalRecordingTime - this.state.totalSilenceTimeMs) / 1000),
      totalSessionTime: Math.round(totalRecordingTime / 1000),
      speakingTime: Math.round(this.state.totalSpeakingTimeMs / 1000),
      pauseCount: finalized.filteredHesitationCount,
    });
    debugLog('[NoSpeech] 🏁 Analysis complete:', JSON.stringify({
      totalDuration: `${Math.round(totalRecordingTime / 1000)}s (${totalRecordingTime}ms)`,
      analysisWindow: `${Math.round(finalized.analysisWindow / 1000)}s`,
      totalSpeakingTime: `${Math.round(this.state.totalSpeakingTimeMs / 1000)}s`,
      totalSilenceTime: `${Math.round(this.state.totalSilenceTimeMs / 1000)}s`,
      hasSpokeAtLeastOnce: this.state.hasSpokeAtLeastOnce,
      avgRms: avgVolume.toFixed(5),
      totalFrames: this.frameCount,
      allHesitations: this.state.hesitationLog.length,
      filteredHesitations: finalized.filteredHesitationCount,
      filteredHesitationSilenceMs: Math.round(finalized.filteredHesitationSilenceTime),
      flowScorePreview: flowScore.score,
    }));
    if (!this.state.hasSpokeAtLeastOnce) {
      debugWarn('[NoSpeech] ⚠️ NO SPEECH DETECTED during entire session! RMS never exceeded threshold', this.speechOnThreshold);
    }

    return {
      totalSpeakingTime: Math.round(this.state.totalSpeakingTimeMs / 1000),
      totalSilenceTime: Math.round(this.state.totalSilenceTimeMs / 1000),
      hesitationSilenceTime: Math.round(finalized.filteredHesitationSilenceTime),
      hesitationCount: finalized.filteredHesitationCount,
      hesitationLog: finalized.filteredHesitations,
      longestFlowStreak: this.state.longestFlowStreak,
      frameCount: this.frameCount,
      noiseFloor: this.noiseFloor,
      totalTime: totalRecordingTime,
      avgVolume: Math.round(avgVolume * 1000) / 1000,
    };
  }

  private updateCalibration(now: number, rms: number) {
    if (!this.isCalibrating || !this.calibrationStartTime) return;
    if (rms >= CALIBRATION_SPEECH_RESET_THRESHOLD) {
      this.calibrationStartTime = now;
      this.calibrationSamples = [];
      return;
    }
    this.calibrationSamples.push(rms);
    if (now - this.calibrationStartTime < CALIBRATION_DURATION) return;
    this.isCalibrating = false;
    const avgNoise = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
    this.noiseFloor = avgNoise;
    this.speechOnThreshold = Math.min(
      MAX_CALIBRATED_SPEECH_THRESHOLD,
      Math.max(SPEECH_THRESHOLD, avgNoise * CALIBRATION_NOISE_MULTIPLIER),
    );
    this.speechOffThreshold = this.speechOnThreshold * SPEECH_OFF_MULTIPLIER;
    this.options.onCalibrated?.(avgNoise, this.speechOnThreshold);
  }

  private toPayload(frame: AudioCaptureFrame): AudioDataPayload {
    let currentSilenceDuration = 0;
    if (!this.state.isSpeaking && this.state.currentSilenceStart) {
      currentSilenceDuration = frame.now - this.state.currentSilenceStart;
    }

    return {
      rms: frame.rms,
      smoothedRms: frame.smoothedRms,
      isSilent: !this.state.isSpeaking,
      isActuallySpeaking: this.state.isSpeaking,
      currentSilenceDuration,
      totalSilenceTime: Math.round(this.state.totalSilenceTimeMs / 1000),
      totalSpeakingTime: Math.round(this.state.totalSpeakingTimeMs / 1000),
      hesitationCount: this.state.hesitationCount,
      waveformData: frame.waveformData,
      frequencyData: frame.frequencyData,
      volume: frame.smoothedRms,
      speechEnergy: frame.speechEnergy,
      isCalibrating: this.isCalibrating,
    };
  }

  private createInitialState(): MicStateSnapshot {
    return {
      isSpeaking: false,
      hasSpokeAtLeastOnce: false,
      currentFlowStreakStart: null,
      longestFlowStreak: 0,
      totalSpeakingTimeMs: 0,
      totalSilenceTimeMs: 0,
      currentSilenceStart: null,
      hesitationSilenceTime: 0,
      hesitationCount: 0,
      hesitationLog: [],
    };
  }
}
