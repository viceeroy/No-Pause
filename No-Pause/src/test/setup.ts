import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Web Audio API
class MockAudioContext {
  createAnalyser = vi.fn(() => ({
    fftSize: 2048,
    smoothingTimeConstant: 0.3,
    frequencyBinCount: 1024,
    getFloatTimeDomainData: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  }));
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  state = "running";
}

Object.defineProperty(window, "AudioContext", {
  writable: true,
  value: MockAudioContext,
});

Object.defineProperty(window, "webkitAudioContext", {
  writable: true,
  value: MockAudioContext,
});

// Mock navigator.mediaDevices
Object.defineProperty(navigator, "mediaDevices", {
  writable: true,
  value: {
    getUserMedia: vi.fn(() =>
      Promise.resolve({
        active: true,
        id: "mock-stream",
        getTracks: () => [
          {
            id: "mock-track",
            kind: "audio",
            label: "mock-mic",
            enabled: true,
            readyState: "live",
            stop: vi.fn(),
            getSettings: () => ({ sampleRate: 48000 }),
            getConstraints: () => ({}),
          },
        ],
        getAudioTracks: () => [
          {
            id: "mock-track",
            kind: "audio",
            label: "mock-mic",
            enabled: true,
            readyState: "live",
            stop: vi.fn(),
            getSettings: () => ({ sampleRate: 48000 }),
            getConstraints: () => ({}),
          },
        ],
      })
    ),
  },
});

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserver,
});
