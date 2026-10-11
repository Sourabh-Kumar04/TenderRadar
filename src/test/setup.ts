import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// Mock Web Audio Context in jsdom
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  sampleRate: number = 44100;
  destination = {};

  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createScriptProcessor() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
  }

  decodeAudioData = vi.fn().mockImplementation((_buffer) => {
    return Promise.resolve({
      sampleRate: 44100,
      length: 44100 * 3,
      duration: 3,
      numberOfChannels: 1,
      getChannelData: (_channel: number) => new Float32Array(44100 * 3),
    });
  });
}

// Assign to window
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: MockAudioContext,
});

// Mock Geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn().mockImplementation((success) => {
    success({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 12,
        altitude: 45,
      },
      timestamp: Date.now(),
    });
  }),
};

Object.defineProperty(navigator, 'geolocation', {
  writable: true,
  value: mockGeolocation,
});

// Mock URL.createObjectURL and revokeObjectURL
if (typeof window.URL.createObjectURL === 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
}
