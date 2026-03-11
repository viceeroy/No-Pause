import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReadingChallengePanel } from '@/pages/practice/ReadingChallengePanel';

const actionMock = vi.hoisted(() => vi.fn().mockResolvedValue('Hello world'));

vi.mock('convex/react', () => ({
  useConvex: () => ({
    action: actionMock,
  }),
}));

vi.mock('@/lib/micService', () => ({
  micService: {
    init: vi.fn().mockResolvedValue(undefined),
    setTracksEnabled: vi.fn(),
    ensureAudioContextRunning: vi.fn().mockResolvedValue(undefined),
    getStream: vi.fn(() => null),
    getAudioContext: vi.fn(() => null),
  },
}));

const stopMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    audioBlob: {
      type: 'audio/webm',
      arrayBuffer: async () => new ArrayBuffer(1),
    },
    audioMimeType: 'audio/webm',
  })
);

const createAudioAnalyzerMock = vi.hoisted(() =>
  vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: stopMock,
    destroy: vi.fn(),
  }))
);

vi.mock('@/lib/audioRecording', () => ({
  createAudioAnalyzer: createAudioAnalyzerMock,
}));

vi.mock('@/components/VoiceVisualizer', () => ({
  VoiceVisualizer: () => <div data-testid="visualizer" />,
}));

vi.mock('@/components/VoicePlayer', () => ({
  VoicePlayer: () => <div data-testid="voice-player" />,
}));

describe('ReadingChallengePanel', () => {
  it('forces English language for transcription', async () => {
    render(<ReadingChallengePanel onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    await waitFor(() => expect(createAudioAnalyzerMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    await waitFor(() => expect(actionMock).toHaveBeenCalled());

    const payload = actionMock.mock.calls[0][1] as {
      audioBase64: string;
      mimeType: string;
      language?: string;
    };

    expect(payload).toMatchObject({ mimeType: 'audio/webm', language: 'en' });
    expect(typeof payload.audioBase64).toBe('string');
  });
});
