import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapRawPredictionsToSpecies,
  classifyBirdAudio,
  setMockClassifier,
  resetClassifierCache,
  parseBirdNetLabels,
  CONFIDENCE_THRESHOLD,
} from '../services/classifier';

describe('BirdNET v2.4 Classifier Service & Species Mapping', () => {
  beforeEach(() => {
    resetClassifierCache();
  });

  it('parses BirdNET label lines correctly', () => {
    const raw = `
      Abroscopus albogularis_Rufous-faced Warbler
      Turdus migratorius_American Robin
      Tyto alba_Barn Owl
    `;
    const parsed = parseBirdNetLabels(raw);
    expect(parsed).toHaveLength(3);
    expect(parsed[1].scientificName).toBe('Turdus migratorius');
    expect(parsed[1].commonName).toBe('American Robin');
    expect(parsed[1].speciesId).toBe('american-robin');
  });

  it('maps BirdNET species labels into detailed predictions', () => {
    const rawResults = [
      { label: 'Tyto alba_Barn Owl', score: 0.89 },
      { label: 'Turdus migratorius_American Robin', score: 0.72 },
      { label: 'Melospiza melodia_Song Sparrow', score: 0.65 },
    ];

    const mapped = mapRawPredictionsToSpecies(rawResults);

    expect(mapped).toHaveLength(3);
    expect(mapped[0].commonName).toBe('Barn Owl');
    expect(mapped[0].scientificName).toBe('Tyto alba');
    expect(mapped[0].confidence).toBe(0.89);
    expect(mapped[0].matchedClass).toBe('Tyto alba_Barn Owl');

    expect(mapped[1].commonName).toBe('American Robin');
    expect(mapped[1].confidence).toBe(0.72);
    expect(mapped[1].family).toBe('Turdidae (Thrushes)');
    expect(mapped[1].iucnStatus).toBe('LC (Least Concern)');
    expect(mapped[1].callType).toBe('Melodic Dawn Chorus Song');
    expect(mapped[1].frequencyBandHz).toBe('2.2 kHz – 4.5 kHz');

    expect(mapped[2].commonName).toBe('Song Sparrow');
    expect(mapped[2].confidence).toBe(0.65);
    expect(mapped[2].callType).toBe('Buzz & Melodic Trill');
  });

  it('handles Mourning Dove classification mapping', () => {
    const rawResults = [
      { label: 'Zenaida macroura_Mourning Dove', score: 0.91 },
    ];

    const mapped = mapRawPredictionsToSpecies(rawResults);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].commonName).toBe('Mourning Dove');
    expect(mapped[0].scientificName).toBe('Zenaida macroura');
    expect(mapped[0].confidence).toBe(0.91);
  });

  it('REMOVES fake confidence padding - never invents species when model returns fewer than 3 candidates', () => {
    const rawResults = [
      { label: 'Corvus brachyrhynchos_American Crow', score: 0.82 },
    ];

    const mapped = mapRawPredictionsToSpecies(rawResults);
    // Must return exactly 1 candidate, NOT padded to 3 fake candidates
    expect(mapped).toHaveLength(1);
    expect(mapped[0].commonName).toBe('American Crow');
    expect(mapped[0].confidence).toBe(0.82);
  });

  it('shows honest Unknown state when model confidence is below 25%', () => {
    const lowConfidenceResults = [
      { label: 'Turdus migratorius_American Robin', score: 0.18 },
      { label: 'Melospiza melodia_Song Sparrow', score: 0.12 },
    ];

    const mapped = mapRawPredictionsToSpecies(lowConfidenceResults);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].speciesId).toBe('unknown');
    expect(mapped[0].commonName).toBe('Unknown Species');
    expect(mapped[0].scientificName).toContain('< 25%');
    expect(mapped[0].confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it('shows honest Unknown state when results array is empty', () => {
    const mapped = mapRawPredictionsToSpecies([]);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].speciesId).toBe('unknown');
    expect(mapped[0].commonName).toBe('Unknown Species');
    expect(mapped[0].confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it('filters out candidates with confidence below 25% while keeping valid candidates', () => {
    const mixedResults = [
      { label: 'Turdus migratorius_American Robin', score: 0.78 },
      { label: 'Melospiza melodia_Song Sparrow', score: 0.35 },
      { label: 'Tyto alba_Barn Owl', score: 0.15 }, // below 25%
    ];

    const mapped = mapRawPredictionsToSpecies(mixedResults);
    // Barn Owl should be excluded because confidence is below 25%
    expect(mapped).toHaveLength(2);
    expect(mapped[0].commonName).toBe('American Robin');
    expect(mapped[1].commonName).toBe('Song Sparrow');
  });

  it('uses mock classifier pipeline without performing real network downloads', async () => {
    const mockPipe = async (_audio: Float32Array) => [
      { label: 'Turdus migratorius_American Robin', score: 0.93 },
      { label: 'Melospiza melodia_Song Sparrow', score: 0.82 },
    ];

    setMockClassifier(mockPipe as any);

    // 48kHz, 3-second window = 144,000 samples
    const dummyAudio = new Float32Array(144000);
    const results = await classifyBirdAudio(dummyAudio);

    expect(results).toHaveLength(2);
    expect(results[0].confidence).toBe(0.93);
    expect(results[0].commonName).toBe('American Robin');
    expect(results[1].confidence).toBe(0.82);
    expect(results[1].commonName).toBe('Song Sparrow');
  });
});
