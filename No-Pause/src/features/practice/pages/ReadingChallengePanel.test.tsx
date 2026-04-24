import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReadingChallengePanel } from './ReadingChallengePanel';

const saveSessionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const transcribeAudioMock = vi.hoisted(() => vi.fn().mockResolvedValue('Hello world'));

vi.mock('@/providers/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user_test', email: 'test@example.com' } }),
}));

vi.mock('@/lib/practiceApi', () => ({
  saveSession: saveSessionMock,
  transcribeAudio: transcribeAudioMock,
}));

vi.mock('../lib/micService', () => ({
  micService: {
    init: vi.fn().mockResolvedValue(undefined),
    setTracksEnabled: vi.fn(),
    reset: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../lib/audioRecording', () => ({
  createAudioAnalyzer: createAudioAnalyzerMock,
}));

vi.mock('../components/VoiceVisualizer', () => ({
  VoiceVisualizer: () => <div data-testid="visualizer" />,
}));

vi.mock('../components/VoicePlayer', () => ({
  VoicePlayer: () => <div data-testid="voice-player" />,
}));

const MockAuthProvider = ({ children }: { children: ReactNode }) => children;

const wrapper = ({ children }: { children: ReactNode }) => (
  <MockAuthProvider>
    <MemoryRouter>{children}</MemoryRouter>
  </MockAuthProvider>
);

describe('ReadingChallengePanel', () => {
  it('forces English language for transcription', async () => {
    render(<ReadingChallengePanel onExit={vi.fn()} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    await waitFor(() => expect(createAudioAnalyzerMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    await waitFor(() => expect(transcribeAudioMock).toHaveBeenCalled());

    const payload = transcribeAudioMock.mock.calls[0][0] as {
      audioBase64: string;
      mimeType: string;
      language?: string;
    };

    expect(payload).toMatchObject({ mimeType: 'audio/webm', language: 'en' });
    expect(typeof payload.audioBase64).toBe('string');
  });
});
