import { describe, expect, it } from 'vitest';
import { buildDiagnosticsSnapshot, getPlatformDiagnostics } from './diagnostics';

describe('analyzer/diagnostics boundary', () => {
  it('builds snapshot with copied arrays and detected platform fields', () => {
    const platform = getPlatformDiagnostics(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit Safari',
      'iPhone',
    );

    const chunkSizes = [100, 200];
    const snapshot = buildDiagnosticsSnapshot({
      sessionId: 'abc',
      mediaRecorderMimeType: 'audio/webm',
      fallbackMimeType: '',
      diagnosticsUserAgent: platform.userAgent,
      diagnosticsPlatform: platform.platform,
      diagnosticsBrowser: platform.browser,
      diagnosticsOsVersion: platform.osVersion,
      diagnosticsAudioSampleRate: 48000,
      diagnosticsChannelCount: 1,
      diagnosticsEchoCancellation: true,
      diagnosticsNoiseSuppression: true,
      diagnosticsAutoGainControl: true,
      diagnosticsLatency: 0,
      firstChunkDelayMs: 10,
      chunkIntervalsMs: [100],
      chunkSizes,
      pauseResumeEvents: [{ type: 'pause', atMs: 25 }],
      streamHealthLogs: [{ atMs: 5, streamActive: true, trackReadyState: 'live', trackMuted: false }],
      chunkAvgRmsPerChunk: [0.1],
      chunkPeakRmsPerChunk: [0.2],
      chunkLowAmplitudeFlags: [false],
      chunkDropFlags: [false],
      timestamp: 123,
    });

    chunkSizes.push(300);

    expect(platform.browser).toBe('Safari');
    expect(snapshot.platform.osVersion).toBe('17.2');
    expect(snapshot.recorder.chunkSizes).toEqual([100, 200]);
  });
});
