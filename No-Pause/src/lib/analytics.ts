// Analytics stub — no-op for development build
// The original app has a complex IndexedDB analytics system; this is a simplified stub.

export const analytics = {
  runDailyRollup: () => {},
  modeSelected: (_mode: string) => {},
  sessionSetupViewed: (_mode: string) => {},
  recordingStarted: (_mode: string, _sessionId: string) => {},
  recordingStopped: (_mode: string, _sessionId: string) => {},
  hesitationDetected: (_duration: number, _count: number, _timeSinceStart: number, _sessionId?: string) => {},
  calibrationCompleted: (_ambientNoise: number, _thresholdSet: number) => {},
  flowScoreCalculated: (_score: number, _mode: string) => {},
  micDenied: () => {},
  statsViewed: () => {},
  processSessionEnd: (_results: any, _meta: any) => {},
};
