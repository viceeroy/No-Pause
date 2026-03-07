export interface AnalyzerDiagnosticsSnapshot {
  sessionId: string;
  timestamp: number;
  platform: {
    userAgent: string;
    platform: string;
    browser: string;
    osVersion: string;
  };
  audio: {
    audioMimeType: string;
    sampleRate: number | null;
    channelCount: number | null;
    echoCancellation: boolean | null;
    noiseSuppression: boolean | null;
    autoGainControl: boolean | null;
    latency: number | null;
  };
  recorder: {
    timeToFirstChunkMs: number | null;
    chunkIntervalMs: number[];
    chunkSizes: number[];
    pauseResumeEvents: { type: 'pause' | 'resume'; atMs: number }[];
  };
  streamHealth: {
    logs: { atMs: number; streamActive: boolean; trackReadyState: string; trackMuted: boolean | null }[];
  };
  voiceDiagnostics: {
    avgRmsPerChunk: number[];
    peakRmsPerChunk: number[];
    lowAmplitudeFlags: boolean[];
    dropFlags: boolean[];
  };
}

export interface PlatformDiagnostics {
  userAgent: string;
  platform: string;
  browser: string;
  osVersion: string;
}

export interface BuildDiagnosticsSnapshotArgs {
  sessionId: string;
  mediaRecorderMimeType: string;
  fallbackMimeType: string;
  diagnosticsUserAgent: string;
  diagnosticsPlatform: string;
  diagnosticsBrowser: string;
  diagnosticsOsVersion: string;
  diagnosticsAudioSampleRate: number | null;
  diagnosticsChannelCount: number | null;
  diagnosticsEchoCancellation: boolean | null;
  diagnosticsNoiseSuppression: boolean | null;
  diagnosticsAutoGainControl: boolean | null;
  diagnosticsLatency: number | null;
  firstChunkDelayMs: number | null;
  chunkIntervalsMs: number[];
  chunkSizes: number[];
  pauseResumeEvents: { type: 'pause' | 'resume'; atMs: number }[];
  streamHealthLogs: { atMs: number; streamActive: boolean; trackReadyState: string; trackMuted: boolean | null }[];
  chunkAvgRmsPerChunk: number[];
  chunkPeakRmsPerChunk: number[];
  chunkLowAmplitudeFlags: boolean[];
  chunkDropFlags: boolean[];
  timestamp?: number;
}

export const createDiagnosticsSessionId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getBrowserFromUserAgent = (userAgent: string) => {
  if (/CriOS|Chrome/i.test(userAgent)) return 'Chrome';
  if (/Safari/i.test(userAgent) && !/Chrome|CriOS/i.test(userAgent)) return 'Safari';
  return 'Other';
};

export const getOsVersionFromUserAgent = (userAgent: string) =>
  /Android\s+([\d.]+)/i.exec(userAgent)?.[1]
  || /OS\s([\d_]+)/i.exec(userAgent)?.[1]?.replace(/_/g, '.')
  || 'unknown';

export const getPlatformDiagnostics = (userAgent: string, platform: string): PlatformDiagnostics => ({
  userAgent,
  platform,
  browser: getBrowserFromUserAgent(userAgent),
  osVersion: getOsVersionFromUserAgent(userAgent),
});

export const buildDiagnosticsSnapshot = (
  args: BuildDiagnosticsSnapshotArgs,
): AnalyzerDiagnosticsSnapshot => ({
  sessionId: args.sessionId,
  timestamp: args.timestamp ?? Date.now(),
  platform: {
    userAgent: args.diagnosticsUserAgent,
    platform: args.diagnosticsPlatform,
    browser: args.diagnosticsBrowser,
    osVersion: args.diagnosticsOsVersion,
  },
  audio: {
    audioMimeType: args.mediaRecorderMimeType || args.fallbackMimeType,
    sampleRate: args.diagnosticsAudioSampleRate,
    channelCount: args.diagnosticsChannelCount,
    echoCancellation: args.diagnosticsEchoCancellation,
    noiseSuppression: args.diagnosticsNoiseSuppression,
    autoGainControl: args.diagnosticsAutoGainControl,
    latency: args.diagnosticsLatency,
  },
  recorder: {
    timeToFirstChunkMs: args.firstChunkDelayMs,
    chunkIntervalMs: [...args.chunkIntervalsMs],
    chunkSizes: [...args.chunkSizes],
    pauseResumeEvents: [...args.pauseResumeEvents],
  },
  streamHealth: {
    logs: [...args.streamHealthLogs],
  },
  voiceDiagnostics: {
    avgRmsPerChunk: [...args.chunkAvgRmsPerChunk],
    peakRmsPerChunk: [...args.chunkPeakRmsPerChunk],
    lowAmplitudeFlags: [...args.chunkLowAmplitudeFlags],
    dropFlags: [...args.chunkDropFlags],
  },
});
