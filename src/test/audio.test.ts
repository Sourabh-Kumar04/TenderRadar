import { describe, it, expect } from 'vitest';
import {
  resampleTo16kHz,
  resampleTo48kHz,
  resampleAudio,
  chunkAudio,
  normalizeAudio,
  float32ToWavBlob,
  getAudioContextClass,
  BIRDNET_SAMPLE_RATE,
  BIRDNET_CHUNK_SAMPLES,
} from '../services/audio';

describe('Audio Processing Service', () => {
  it('resampleTo16kHz correctly resamples 48kHz audio to 16kHz', () => {
    const inputLength = 48000; // 1 second at 48kHz
    const input = new Float32Array(inputLength);
    // Fill with a 440Hz test sine wave
    for (let i = 0; i < inputLength; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const resampled = resampleTo16kHz(input, 48000, 16000);
    expect(resampled.length).toBe(16000);
    expect(resampled).toBeInstanceOf(Float32Array);
    // Peak value check
    let max = 0;
    for (let i = 0; i < resampled.length; i++) {
      if (Math.abs(resampled[i]) > max) max = Math.abs(resampled[i]);
    }
    expect(max).toBeGreaterThan(0.9);
  });

  it('resampleTo48kHz correctly resamples 16kHz audio to 48kHz for BirdNET', () => {
    const inputLength = 16000; // 1 second at 16kHz
    const input = new Float32Array(inputLength);
    for (let i = 0; i < inputLength; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
    }

    const resampled = resampleTo48kHz(input, 16000);
    expect(resampled.length).toBe(BIRDNET_SAMPLE_RATE);
    expect(resampled).toBeInstanceOf(Float32Array);
  });

  it('resampleTo16kHz returns the exact same buffer when sample rate matches', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const resampled = resampleTo16kHz(input, 16000, 16000);
    expect(resampled).toBe(input);
  });

  it('chunkAudio splits audio into 3-second windows with padding', () => {
    // 2 seconds of 48kHz audio (96,000 samples)
    const shortAudio = new Float32Array(96000);
    const chunks = chunkAudio(shortAudio, 48000);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].length).toBe(BIRDNET_CHUNK_SAMPLES); // exactly 144,000
  });

  it('normalizeAudio scales signals to 0.95 peak amplitude', () => {
    const input = new Float32Array([0.1, -0.5, 0.2, -0.25]);
    const normalized = normalizeAudio(input);

    let maxAbs = 0;
    for (let i = 0; i < normalized.length; i++) {
      if (Math.abs(normalized[i]) > maxAbs) maxAbs = Math.abs(normalized[i]);
    }

    expect(Number(maxAbs.toFixed(2))).toBe(0.95);
  });

  it('normalizeAudio handles completely silent buffer without NaN', () => {
    const silent = new Float32Array([0, 0, 0, 0]);
    const normalized = normalizeAudio(silent);
    expect(normalized.every((v) => v === 0)).toBe(true);
  });

  it('float32ToWavBlob creates a valid WAV container with correct RIFF headers', async () => {
    const samples = new Float32Array(16000); // 1 sec at 16kHz
    const blob = float32ToWavBlob(samples, 16000);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/wav');
    // Header (44 bytes) + 16000 * 2 bytes = 32044 bytes
    expect(blob.size).toBe(44 + 16000 * 2);

    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Read 'RIFF'
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe('RIFF');

    // Read 'WAVE'
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    expect(wave).toBe('WAVE');

    // Sample rate at offset 24
    expect(view.getUint32(24, true)).toBe(16000);
  });

  it('getAudioContextClass returns AudioContext or fallback', () => {
    const ctxClass = getAudioContextClass();
    expect(ctxClass).toBeDefined();
  });
});
