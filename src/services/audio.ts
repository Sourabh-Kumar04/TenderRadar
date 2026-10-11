/**
 * TrailWhistle Audio Service
 * Web Audio API capture, iOS Safari webkitAudioContext fallback,
 * AudioWorklet migration with ScriptProcessor fallback,
 * 48kHz resampling for BirdNET v2.4 ONNX, 3-second chunking, and WAV blob generation.
 */

export const BIRDNET_SAMPLE_RATE = 48000;
export const BIRDNET_CHUNK_SAMPLES = 144000; // 3 seconds at 48kHz

// Safe AudioContext getter with iOS Safari webkit fallback
export function getAudioContextClass(): typeof AudioContext {
  const ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ctx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  return ctx;
}

export function createAudioContext(sampleRate?: number): AudioContext {
  const AudioCtx = getAudioContextClass();
  if (sampleRate) {
    try {
      return new AudioCtx({ sampleRate });
    } catch {
      // Fallback for browsers that don't support sampleRate option in constructor
      return new AudioCtx();
    }
  }
  return new AudioCtx();
}

/**
 * Resample a Float32Array from sourceSampleRate to targetSampleRate
 * High-quality linear interpolation.
 */
export function resampleAudio(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number = BIRDNET_SAMPLE_RATE
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const originalPos = i * ratio;
    const index1 = Math.floor(originalPos);
    const index2 = Math.min(index1 + 1, audioData.length - 1);
    const weight = originalPos - index1;

    result[i] = audioData[index1] * (1 - weight) + audioData[index2] * weight;
  }

  return result;
}

/**
 * Backwards compatibility helper for 16kHz models / tests
 */
export function resampleTo16kHz(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number = 16000
): Float32Array {
  return resampleAudio(audioData, sourceSampleRate, targetSampleRate);
}

/**
 * Resample audio specifically to 48kHz as expected by BirdNET
 */
export function resampleTo48kHz(
  audioData: Float32Array,
  sourceSampleRate: number
): Float32Array {
  return resampleAudio(audioData, sourceSampleRate, BIRDNET_SAMPLE_RATE);
}

/**
 * Splits an audio buffer into 3-second windows (144,000 samples at 48kHz)
 */
export function chunkAudio(
  audioFloat32: Float32Array,
  sampleRate: number = BIRDNET_SAMPLE_RATE,
  overlapSeconds: number = 1.5
): Float32Array[] {
  const chunkSamples = sampleRate * 3;
  const hopSamples = Math.max(1, Math.round(sampleRate * (3 - overlapSeconds)));
  const chunks: Float32Array[] = [];

  for (let start = 0; start < audioFloat32.length; start += hopSamples) {
    let chunk = audioFloat32.slice(start, start + chunkSamples);
    if (chunk.length < chunkSamples) {
      const padded = new Float32Array(chunkSamples);
      padded.set(chunk);
      chunk = padded;
    }
    chunks.push(chunk);
    if (start + chunkSamples >= audioFloat32.length) break;
  }

  if (chunks.length === 0) {
    chunks.push(new Float32Array(chunkSamples));
  }

  return chunks;
}

/**
 * Normalize float audio data to range [-1.0, 1.0] to maximize SNR for model feature extractor
 */
export function normalizeAudio(audio: Float32Array): Float32Array {
  let maxAbs = 0;
  for (let i = 0; i < audio.length; i++) {
    const abs = Math.abs(audio[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  if (maxAbs === 0 || maxAbs === 1) {
    return audio;
  }

  const factor = 0.95 / maxAbs;
  const normalized = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    normalized[i] = audio[i] * factor;
  }
  return normalized;
}

/**
 * Convert Float32Array to a playable WAV Blob
 */
export function float32ToWavBlob(
  samples: Float32Array,
  sampleRate: number = BIRDNET_SAMPLE_RATE
): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  // format chunk identifier
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // 16-bit
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

// AudioWorklet processor definition
const RECORDER_PROCESSOR_CODE = `
class TrailWhistleRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        this.port.postMessage(channelData);
      }
    }
    return true;
  }
}
registerProcessor('trailwhistle-recorder', TrailWhistleRecorderProcessor);
`;

/**
 * Records audio from user microphone for durationSeconds (default 3.0s).
 * Uses AudioWorklet if supported, with graceful fallback to ScriptProcessor.
 * Resamples to 48kHz for BirdNET v2.4.
 */
export async function recordMicAudio(
  durationSeconds: number = 3.0,
  onVolumeChange?: (volume: number) => void
): Promise<{ rawAudio: Float32Array; wavBlob: Blob }> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Microphone recording is not supported in this browser. Please use HTTPS or sample audio.');
  }

  const audioContext = createAudioContext();

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
  } catch (err: unknown) {
    await audioContext.close().catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
      throw new Error('Microphone permission denied. Enable mic access or test with built-in audio samples.');
    }
    throw new Error(`Microphone capture error: ${msg}`);
  }

  const source = audioContext.createMediaStreamSource(stream);
  const recordedChunks: Float32Array[] = [];

  const handleAudioChunk = (inputData: Float32Array) => {
    recordedChunks.push(new Float32Array(inputData));
    if (onVolumeChange) {
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      onVolumeChange(Math.min(1.0, rms * 5));
    }
  };

  let workletNode: AudioWorkletNode | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;

  // Try AudioWorklet first
  let useWorklet = false;
  if (typeof audioContext.audioWorklet !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    try {
      const blob = new Blob([RECORDER_PROCESSOR_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      workletNode = new AudioWorkletNode(audioContext, 'trailwhistle-recorder');
      workletNode.port.onmessage = (event: MessageEvent) => {
        handleAudioChunk(event.data);
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      useWorklet = true;
    } catch {
      useWorklet = false;
    }
  }

  // Graceful fallback to ScriptProcessorNode
  if (!useWorklet) {
    const bufferSize = 4096;
    scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    scriptProcessor.onaudioprocess = (e) => {
      handleAudioChunk(e.inputBuffer.getChannelData(0));
    };
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
  }

  // Wait for recording duration
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  // Disconnect & cleanup
  source.disconnect();
  if (workletNode) workletNode.disconnect();
  if (scriptProcessor) scriptProcessor.disconnect();
  stream.getTracks().forEach((track) => track.stop());

  const sourceSampleRate = audioContext.sampleRate;
  await audioContext.close().catch(() => {});

  // Merge recorded chunks
  const totalLength = recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of recordedChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Resample to 48kHz for BirdNET v2.4
  const resampled = resampleTo48kHz(combined, sourceSampleRate);
  const normalized = normalizeAudio(resampled);
  const wavBlob = float32ToWavBlob(normalized, BIRDNET_SAMPLE_RATE);

  return { rawAudio: normalized, wavBlob };
}

/**
 * Loads an audio file from URL, decodes it with Web Audio, and returns 48kHz Float32Array
 */
export async function loadAudioFromUrl(
  url: string
): Promise<{ rawAudio: Float32Array; wavBlob: Blob }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load audio sample from ${url}: status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioContext = createAudioContext();

  try {
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = decodedBuffer.getChannelData(0);
    const resampled = resampleTo48kHz(channelData, decodedBuffer.sampleRate);
    const normalized = normalizeAudio(resampled);
    const wavBlob = float32ToWavBlob(normalized, BIRDNET_SAMPLE_RATE);
    return { rawAudio: normalized, wavBlob };
  } finally {
    await audioContext.close().catch(() => {});
  }
}
