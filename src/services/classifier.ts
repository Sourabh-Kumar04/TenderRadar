/**
 * TrailWhistle Classifier Service
 * On-device open-weight audio classification using BirdNET v2.4 ONNX via onnxruntime-web (WASM).
 * 6,522 real avian species, 48kHz audio, 3-second windows, zero backend, offline browser cache.
 */

import * as ort from 'onnxruntime-web';
import { PredictionResult } from '../types/journal';
import { ModelProgressInfo } from '../types/model';
import { BIRD_SPECIES_DATABASE } from '../data/birdDatabase';

export const CACHE_NAME = 'birdnet-pwa-cache-v2';
export const DEFAULT_MODEL_URL = 'https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/BirdNET_v2.4_int8_arm.onnx';
export const DEFAULT_LABELS_URL = 'https://huggingface.co/tphakala/BirdNET-v2.4/resolve/main/labels.txt';
export const LOCAL_LABELS_URL = '/models/labels.txt';
export const LOCAL_MODEL_URL = '/models/BirdNET_v2.4_int8_arm.onnx';

export const SAMPLE_RATE = 48000;
export const CHUNK_SAMPLES = 144000; // 3 seconds at 48kHz
export const CONFIDENCE_THRESHOLD = 0.25; // 25% minimum confidence

export interface ParsedSpeciesInfo {
  index: number;
  label: string;
  scientificName: string;
  commonName: string;
  speciesId: string;
}

export type MockClassifierFn = (
  audio: Float32Array,
  options?: { topk?: number }
) => Promise<Array<{ label: string; score: number }>>;

let cachedWorker: Worker | null = null;
let cachedSession: ort.InferenceSession | null = null;
let cachedLabels: ParsedSpeciesInfo[] = [];
let mockClassifier: MockClassifierFn | null = null;
let isCurrentlyLoading = false;

/**
 * Parses BirdNET labels text (6,522 lines in Scientific_Common format)
 */
export function parseBirdNetLabels(text: string): ParsedSpeciesInfo[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const underscoreIdx = line.indexOf('_');
      let scientificName = line;
      let commonName = line;

      if (underscoreIdx !== -1) {
        scientificName = line.substring(0, underscoreIdx).trim();
        commonName = line.substring(underscoreIdx + 1).trim();
      }

      const speciesId = commonName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      return {
        index,
        label: line,
        scientificName,
        commonName,
        speciesId,
      };
    });
}

/**
 * Loads labels from local asset or HuggingFace
 */
export async function loadLabels(): Promise<ParsedSpeciesInfo[]> {
  if (cachedLabels.length > 0) {
    return cachedLabels;
  }

  let text = '';
  try {
    const res = await fetch(LOCAL_LABELS_URL);
    if (res.ok) {
      text = await res.text();
    }
  } catch {
    // Fall back to remote
  }

  if (!text) {
    const res = await fetch(DEFAULT_LABELS_URL);
    if (!res.ok) {
      throw new Error(`Failed to download BirdNET labels: HTTP ${res.status}`);
    }
    text = await res.text();
  }

  cachedLabels = parseBirdNetLabels(text);
  return cachedLabels;
}

/**
 * Initializes or returns the BirdNET ONNX inference pipeline
 */
export async function getClassifier(
  onProgress?: (progress: ModelProgressInfo) => void
): Promise<boolean> {
  if (mockClassifier) {
    if (onProgress) onProgress({ status: 'ready', progress: 100 });
    return true;
  }

  if (cachedWorker || cachedSession) {
    if (onProgress) onProgress({ status: 'ready', progress: 100 });
    return true;
  }

  if (isCurrentlyLoading) {
    while (isCurrentlyLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return !!(cachedWorker || cachedSession);
  }

  isCurrentlyLoading = true;
  if (onProgress) onProgress({ status: 'loading', progress: 5 });

  try {
    // 1. Ensure labels are loaded
    const labels = await loadLabels();

    // 2. Check Cache API
    let cache: Cache | null = null;
    let cachedModelResponse: Response | null = null;

    if (typeof caches !== 'undefined') {
      try {
        cache = await caches.open(CACHE_NAME);
        cachedModelResponse = (await cache.match(DEFAULT_MODEL_URL)) || (await cache.match(LOCAL_MODEL_URL)) || null;
      } catch {
        cache = null;
      }
    }

    let modelBuffer: ArrayBuffer;

    if (cachedModelResponse) {
      if (onProgress) onProgress({ status: 'loading', progress: 90 });
      modelBuffer = await cachedModelResponse.arrayBuffer();
    } else {
      // First visit: stream download from local or remote
      let modelRes: Response;
      try {
        modelRes = await fetch(LOCAL_MODEL_URL);
        if (!modelRes.ok) throw new Error('Local model not found');
      } catch {
        modelRes = await fetch(DEFAULT_MODEL_URL);
      }

      if (!modelRes.ok) {
        throw new Error(`Failed to download BirdNET v2.4 model: HTTP ${modelRes.status}`);
      }

      const contentLength = modelRes.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 46886045; // ~47MB default
      const reader = modelRes.body?.getReader();

      if (reader) {
        let received = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (onProgress && totalBytes > 0) {
              const pct = Math.min(98, Math.round((received / totalBytes) * 100));
              onProgress({
                status: 'loading',
                progress: pct,
                loadedBytes: received,
                totalBytes,
                file: 'BirdNET_v2.4_int8_arm.onnx',
              });
            }
          }
        }
        const full = new Uint8Array(received);
        let pos = 0;
        for (const chunk of chunks) {
          full.set(chunk, pos);
          pos += chunk.length;
        }
        modelBuffer = full.buffer;
      } else {
        modelBuffer = await modelRes.arrayBuffer();
      }

      // Cache for offline PWA persistence
      if (cache) {
        try {
          await cache.put(DEFAULT_MODEL_URL, new Response(modelBuffer.slice(0)));
        } catch {
          // Ignore cache errors in private browsing
        }
      }
    }

    // 3. Initialize inference via Web Worker or direct WASM session
    const rawLabelsList = labels.map((l) => l.label);

    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      try {
        const worker = new Worker('/inference-worker.js');
        await new Promise<void>((resolve, reject) => {
          const handler = (e: MessageEvent) => {
            if (e.data.type === 'MODEL_READY') {
              worker.removeEventListener('message', handler);
              resolve();
            } else if (e.data.type === 'ERROR') {
              worker.removeEventListener('message', handler);
              reject(new Error(e.data.error));
            }
          };
          worker.addEventListener('message', handler);
          worker.postMessage(
            {
              type: 'LOAD_MODEL',
              payload: { modelBuffer, labels: rawLabelsList },
            },
            [modelBuffer]
          );
        });

        cachedWorker = worker;
      } catch {
        // Fall back to direct session
        initDirectSession(modelBuffer);
      }
    } else {
      await initDirectSession(modelBuffer);
    }

    isCurrentlyLoading = false;
    if (onProgress) onProgress({ status: 'ready', progress: 100 });
    return true;
  } catch (error: unknown) {
    isCurrentlyLoading = false;
    const msg = error instanceof Error ? error.message : String(error);
    if (onProgress) {
      onProgress({
        status: 'error',
        progress: 0,
        errorMessage: `Failed to initialize BirdNET v2.4 model: ${msg}. Check network or retry when online.`,
      });
    }
    throw error;
  }
}

async function initDirectSession(modelBuffer: ArrayBuffer) {
  if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
    ort.env.wasm.wasmPaths = '/onnx/';
    ort.env.wasm.numThreads = 1;
  }
  cachedSession = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
}

/**
 * Reset pipeline (for testing or retry)
 */
export function resetClassifierCache(): void {
  if (cachedWorker) {
    cachedWorker.terminate();
    cachedWorker = null;
  }
  cachedSession = null;
  isCurrentlyLoading = false;
  mockClassifier = null;
}

/**
 * Injects a mock classifier for vitest tests
 */
export function setMockClassifier(mock: MockClassifierFn | null): void {
  mockClassifier = mock;
}

/**
 * Maps raw model output labels/confidences into honest top-3 bird species predictions.
 * REMOVES fake confidence padding. If top confidence is below 25%, shows honest Unknown state.
 * Never invents species.
 */
export function mapRawPredictionsToSpecies(
  rawResults: Array<{ label: string; score: number }>
): PredictionResult[] {
  // Sort descending by confidence score
  const sorted = [...rawResults].sort((a, b) => b.score - a.score);
  const topCandidate = sorted[0];

  // If no candidates or top confidence is below threshold, return honest Unknown state
  if (!topCandidate || topCandidate.score < CONFIDENCE_THRESHOLD) {
    const scoreVal = topCandidate ? Math.max(0.01, Math.min(0.24, Number(topCandidate.score.toFixed(2)))) : 0.05;
    return [
      {
        speciesId: 'unknown',
        commonName: 'Unknown Species',
        scientificName: 'Confidence < 25% — Inconclusive',
        confidence: scoreVal,
        habitat: 'Undetermined habitat',
        matchedClass: 'Acoustic confidence below threshold (<25%)',
      },
    ];
  }

  // Filter only predictions with confidence >= 25%
  const validCandidates = sorted.filter((item) => item.score >= CONFIDENCE_THRESHOLD);
  const predictions: PredictionResult[] = [];
  const seenSpecies = new Set<string>();

  for (const item of validCandidates) {
    const rawLabel = item.label;
    const score = Number(Math.min(0.99, Math.max(0.01, item.score)).toFixed(2));

    // Parse scientific and common name from "Scientific_Common" label
    let scientificName = rawLabel;
    let commonName = rawLabel;

    if (rawLabel.includes('_')) {
      const idx = rawLabel.indexOf('_');
      scientificName = rawLabel.substring(0, idx).trim();
      commonName = rawLabel.substring(idx + 1).trim();
    } else {
      // Check if raw label matches a bird in database
      const dbMatch = BIRD_SPECIES_DATABASE.find(
        (b) =>
          b.commonName.toLowerCase() === rawLabel.toLowerCase() ||
          b.scientificName.toLowerCase() === rawLabel.toLowerCase() ||
          b.audiosetClasses.some((c) => c.toLowerCase() === rawLabel.toLowerCase())
      );
      if (dbMatch) {
        scientificName = dbMatch.scientificName;
        commonName = dbMatch.commonName;
      }
    }

    const speciesId = commonName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!seenSpecies.has(speciesId)) {
      seenSpecies.add(speciesId);

      // Check for enriched metadata from curated database
      const dbInfo = BIRD_SPECIES_DATABASE.find(
        (b) =>
          b.id === speciesId ||
          b.scientificName.toLowerCase() === scientificName.toLowerCase() ||
          b.commonName.toLowerCase() === commonName.toLowerCase()
      );

      predictions.push({
        speciesId: dbInfo ? dbInfo.id : speciesId,
        commonName: dbInfo ? dbInfo.commonName : commonName,
        scientificName: dbInfo ? dbInfo.scientificName : scientificName,
        confidence: score,
        habitat: dbInfo ? dbInfo.habitat : 'Wild avian habitat',
        matchedClass: rawLabel,
        family: dbInfo?.family,
        iucnStatus: dbInfo?.iucnStatus || 'LC (Least Concern)',
        callType: dbInfo?.callType || 'Avian Vocalization',
        frequencyBandHz: dbInfo?.frequencyBandHz || '1.8 kHz – 5.5 kHz',
      });
    }

    // Stop at 3 legitimate predictions
    if (predictions.length >= 3) break;
  }

  // NO FAKE PADDING: Never invent species if model returns fewer than 3 valid candidates!
  return predictions;
}

/**
 * Classifies a 48kHz Float32Array audio buffer (3-second window = 144,000 samples)
 */
export async function classifyBirdAudio(
  audioData: Float32Array,
  onProgress?: (progress: ModelProgressInfo) => void
): Promise<PredictionResult[]> {
  // 1. If mock classifier is set, execute directly
  if (mockClassifier) {
    const rawResults = await mockClassifier(audioData, { topk: 10 });
    return mapRawPredictionsToSpecies(rawResults);
  }

  // 2. Initialize classifier
  await getClassifier(onProgress);

  // 3. Ensure audio is exactly 144,000 samples (3 seconds at 48kHz)
  let windowSamples = audioData;
  if (audioData.length !== CHUNK_SAMPLES) {
    windowSamples = new Float32Array(CHUNK_SAMPLES);
    windowSamples.set(audioData.subarray(0, Math.min(audioData.length, CHUNK_SAMPLES)));
  }

  // 4. Run inference via Worker or Direct Session
  let confidences: Float32Array | number[];
  const labels = await loadLabels();

  if (cachedWorker) {
    confidences = await new Promise<Float32Array>((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'CHUNK_RESULT') {
          cachedWorker?.removeEventListener('message', handler);
          resolve(e.data.confidences);
        } else if (e.data.type === 'ERROR') {
          cachedWorker?.removeEventListener('message', handler);
          reject(new Error(e.data.error));
        }
      };
      cachedWorker?.addEventListener('message', handler);
      cachedWorker?.postMessage({
        type: 'PROCESS_AUDIO',
        payload: { chunk: windowSamples, chunkIndex: 0 },
      });
    });
  } else if (cachedSession) {
    const tensor = new ort.Tensor('float32', windowSamples, [1, CHUNK_SAMPLES]);
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = cachedSession.inputNames[0] || 'input';
    feeds[inputName] = tensor;

    const results = await cachedSession.run(feeds);
    const outputName = cachedSession.outputNames[0] || 'output';
    const logits = results[outputName].data as Float32Array;

    const confArray = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) {
      confArray[i] = 1 / (1 + Math.exp(-logits[i]));
    }
    confidences = confArray;
  } else {
    throw new Error('Inference session not initialized.');
  }

  // 5. Build raw results list and map to honest predictions
  const rawResults: Array<{ label: string; score: number }> = [];
  for (let i = 0; i < confidences.length; i++) {
    const score = confidences[i];
    if (score >= CONFIDENCE_THRESHOLD) {
      const label = labels[i] ? labels[i].label : `Species_${i}`;
      rawResults.push({ label, score });
    }
  }

  // If none passed threshold, grab the maximum single score to show honest confidence level
  if (rawResults.length === 0 && confidences.length > 0) {
    let maxIdx = 0;
    let maxScore = -1;
    for (let i = 0; i < confidences.length; i++) {
      if (confidences[i] > maxScore) {
        maxScore = confidences[i];
        maxIdx = i;
      }
    }
    const label = labels[maxIdx] ? labels[maxIdx].label : `Species_${maxIdx}`;
    rawResults.push({ label, score: maxScore });
  }

  return mapRawPredictionsToSpecies(rawResults);
}
