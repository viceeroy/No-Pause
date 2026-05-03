import { describe, expect, it, vi } from 'vitest';
import { SpeechSession } from './speechSession';
import type { AudioCaptureFrame } from './audioCapture';

function frame(input: Partial<AudioCaptureFrame> & Pick<AudioCaptureFrame, 'now' | 'rms'>): AudioCaptureFrame {
  return {
    now: input.now,
    delta: input.delta ?? 33,
    rms: input.rms,
    smoothedRms: input.smoothedRms ?? input.rms,
    maxSample: input.maxSample ?? input.rms,
    frameCount: input.frameCount ?? 1,
    waveformData: input.waveformData ?? [],
    frequencyData: input.frequencyData ?? [],
    speechEnergy: input.speechEnergy ?? 0,
  };
}

describe('SpeechSession calibration', () => {
  it('uses a less aggressive calibrated threshold multiplier', () => {
    const onCalibrated = vi.fn();
    const session = new SpeechSession({ onCalibrated });

    session.start(1_000);
    session.handleFrame(frame({ now: 1_100, rms: 0.015 }));
    session.handleFrame(frame({ now: 2_500, rms: 0.015 }));

    expect(onCalibrated).toHaveBeenCalledWith(0.015, 0.03);
  });

  it('resets calibration when speech-like audio appears in the calibration window', () => {
    const onCalibrated = vi.fn();
    const session = new SpeechSession({ onCalibrated });

    session.start(1_000);
    session.handleFrame(frame({ now: 1_200, rms: 0.03 }));
    session.handleFrame(frame({ now: 2_600, rms: 0.006 }));

    expect(onCalibrated).not.toHaveBeenCalled();

    session.handleFrame(frame({ now: 2_800, rms: 0.006 }));

    expect(onCalibrated).toHaveBeenCalledWith(0.006, 0.012);
  });
});
