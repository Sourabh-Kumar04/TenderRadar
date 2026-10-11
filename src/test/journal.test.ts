import { describe, it, expect, beforeEach } from 'vitest';
import {
  addJournalEntry,
  getJournalEntries,
  deleteJournalEntry,
  clearJournal,
  filterJournalEntries,
  generateJournalCsv,
  escapeCsvField,
  buildSurveyChecklist,
  groupEntriesByLocation,
  generateAreaSurveyCsv,
  importJournalFromJson,
} from '../services/journal';
import { JournalEntry } from '../types/journal';

describe('Field Journal Service', () => {
  beforeEach(() => {
    clearJournal();
  });

  it('adds and retrieves entries in descending chronological order', () => {
    const entry1 = addJournalEntry({
      commonName: 'American Robin',
      scientificName: 'Turdus migratorius',
      confidence: 0.88,
      notes: 'Morning chorus near cedar grove',
      audioDurationSeconds: 3.0,
      source: 'live_mic',
      confirmedByUser: true,
      timestamp: '2026-10-07T08:00:00Z',
    });

    const entry2 = addJournalEntry({
      commonName: 'Barn Owl',
      scientificName: 'Tyto alba',
      confidence: 0.94,
      notes: 'Hissing call at twilight edge',
      audioDurationSeconds: 3.0,
      source: 'live_mic',
      confirmedByUser: true,
      timestamp: '2026-10-07T20:30:00Z',
    });

    const entries = getJournalEntries();
    expect(entries).toHaveLength(2);
    // Descending timestamp: entry2 (20:30) should come before entry1 (08:00)
    expect(entries[0].id).toBe(entry2.id);
    expect(entries[1].id).toBe(entry1.id);
  });

  it('deletes an entry by id', () => {
    const entry = addJournalEntry({
      commonName: 'Song Sparrow',
      scientificName: 'Melospiza melodia',
      confidence: 0.75,
      notes: 'Wet meadow trill',
      audioDurationSeconds: 3.0,
      source: 'sample_audio',
      confirmedByUser: true,
    });

    expect(getJournalEntries()).toHaveLength(1);
    const deleted = deleteJournalEntry(entry.id);
    expect(deleted).toBe(true);
    expect(getJournalEntries()).toHaveLength(0);
  });

  it('filters entries by query, dates, and confirmed status', () => {
    const entries: JournalEntry[] = [
      {
        id: '1',
        timestamp: '2026-10-01T10:00:00Z',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.9,
        notes: 'Singing in garden oak',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
      {
        id: '2',
        timestamp: '2026-10-05T14:00:00Z',
        commonName: 'Blue Jay',
        scientificName: 'Cyanocitta cristata',
        confidence: 0.82,
        notes: 'Feeder warning call',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: false,
      },
      {
        id: '3',
        timestamp: '2026-10-06T18:00:00Z',
        commonName: 'Mourning Dove',
        scientificName: 'Zenaida macroura',
        confidence: 0.77,
        notes: 'Suburban coo',
        audioDurationSeconds: 3,
        source: 'sample_audio',
        confirmedByUser: true,
      },
    ];

    // Filter query
    const searchMatch = filterJournalEntries(entries, { query: 'robin' });
    expect(searchMatch).toHaveLength(1);
    expect(searchMatch[0].commonName).toBe('American Robin');

    // Filter confirmed only
    const confirmedMatch = filterJournalEntries(entries, { confirmedOnly: true });
    expect(confirmedMatch).toHaveLength(2);

    // Filter date range
    const dateMatch = filterJournalEntries(entries, {
      startDate: '2026-10-04T00:00:00Z',
      endDate: '2026-10-05T23:59:59Z',
    });
    expect(dateMatch).toHaveLength(1);
    expect(dateMatch[0].commonName).toBe('Blue Jay');
  });

  it('escapeCsvField escapes quotes and commas per RFC 4180', () => {
    expect(escapeCsvField('normal')).toBe('normal');
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
    expect(escapeCsvField('say "quote"')).toBe('"say ""quote"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvField(null)).toBe('');
  });

  it('generateJournalCsv creates proper CSV structure with GPS coordinates', () => {
    const entries: JournalEntry[] = [
      {
        id: 'e1',
        timestamp: '2026-10-07T12:00:00Z',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.885,
        notes: 'High in tree, loud song',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
        },
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
    ];

    const csv = generateJournalCsv(entries);
    expect(csv).toContain('species_common_name');
    expect(csv).toContain('American Robin');
    expect(csv).toContain('Turdus migratorius');
    expect(csv).toContain('88.5%');
    expect(csv).toContain('37.7749');
    expect(csv).toContain('-122.4194');
    expect(csv).toContain('live_mic');
  });

  it('buildSurveyChecklist aggregates species tallies and tracks peak confidence', () => {
    const entries: JournalEntry[] = [
      {
        id: '1',
        timestamp: '2026-10-10T10:00:00Z',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.85,
        notes: '',
        locationName: 'Pine Ridge Trail',
        surveyId: 'survey-1',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
      {
        id: '2',
        timestamp: '2026-10-10T10:05:00Z',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.94,
        notes: '',
        locationName: 'Pine Ridge Trail',
        surveyId: 'survey-1',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
      {
        id: '3',
        timestamp: '2026-10-10T10:10:00Z',
        commonName: 'Song Sparrow',
        scientificName: 'Melospiza melodia',
        confidence: 0.78,
        notes: '',
        locationName: 'Pine Ridge Trail',
        surveyId: 'survey-1',
        audioDurationSeconds: 3,
        source: 'sample_audio',
        confirmedByUser: true,
      },
    ];

    const checklist = buildSurveyChecklist(entries, 'survey-1');
    expect(checklist).toHaveLength(2);

    // American Robin should have 2 detections and 94% peak confidence
    const robin = checklist.find((c) => c.commonName === 'American Robin');
    expect(robin).toBeDefined();
    expect(robin?.detectionCount).toBe(2);
    expect(robin?.maxConfidence).toBe(0.94);

    // Song Sparrow should have 1 detection
    const sparrow = checklist.find((c) => c.commonName === 'Song Sparrow');
    expect(sparrow).toBeDefined();
    expect(sparrow?.detectionCount).toBe(1);
    expect(sparrow?.maxConfidence).toBe(0.78);
  });

  it('groupEntriesByLocation groups observations into field survey logs', () => {
    const entries: JournalEntry[] = [
      {
        id: '1',
        timestamp: '2026-10-10T11:00:00Z',
        commonName: 'Barn Owl',
        scientificName: 'Tyto alba',
        confidence: 0.91,
        notes: '',
        locationName: 'Redwood Creek Basin',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
      {
        id: '2',
        timestamp: '2026-10-10T09:00:00Z',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.88,
        notes: '',
        locationName: 'Pine Ridge Trail',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
      {
        id: '3',
        timestamp: '2026-10-10T09:15:00Z',
        commonName: 'Song Sparrow',
        scientificName: 'Melospiza melodia',
        confidence: 0.82,
        notes: '',
        locationName: 'Pine Ridge Trail',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
    ];

    const groups = groupEntriesByLocation(entries);
    expect(groups).toHaveLength(2);

    const pineRidge = groups.find((g) => g.locationName === 'Pine Ridge Trail');
    expect(pineRidge).toBeDefined();
    expect(pineRidge?.entries).toHaveLength(2);
    expect(pineRidge?.speciesCount).toBe(2);

    const redwood = groups.find((g) => g.locationName === 'Redwood Creek Basin');
    expect(redwood).toBeDefined();
    expect(redwood?.entries).toHaveLength(1);
    expect(redwood?.speciesCount).toBe(1);
  });

  it('generateAreaSurveyCsv generates complete area survey report with checklist summary', () => {
    const entries: JournalEntry[] = [
      {
        id: 's1',
        timestamp: '2026-10-10T14:00:00Z',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.89,
        notes: 'Singing in fir tree',
        locationName: 'Highland Ridge',
        audioDurationSeconds: 3,
        source: 'live_mic',
        confirmedByUser: true,
      },
    ];

    const csv = generateAreaSurveyCsv('Highland Ridge', entries);
    expect(csv).toContain('TRAILWHISTLE AREA BIODIVERSITY SURVEY REPORT');
    expect(csv).toContain('Survey Location: Highland Ridge');
    expect(csv).toContain('SPECIES CHECKLIST SUMMARY');
    expect(csv).toContain('American Robin');
    expect(csv).toContain('Turdus migratorius');
    expect(csv).toContain('89.0%');
    expect(csv).toContain('DETAILED ACOUSTIC OBSERVATIONS');
  });

  it('imports journal entries from valid JSON backup string', () => {
    const backupJson = JSON.stringify({
      app: 'TrailWhistle',
      entries: [
        {
          id: 'imported-1',
          timestamp: '2026-10-10T12:00:00Z',
          commonName: 'Barn Owl',
          scientificName: 'Tyto alba',
          confidence: 0.95,
          notes: 'Restored from expedition archive',
          audioDurationSeconds: 3,
          source: 'live_mic',
          confirmedByUser: true,
        },
      ],
    });

    const result = importJournalFromJson(backupJson);
    expect(result.importedCount).toBe(1);

    const stored = getJournalEntries();
    expect(stored).toHaveLength(1);
    expect(stored[0].commonName).toBe('Barn Owl');

    // Duplicate import should be idempotent
    const rerun = importJournalFromJson(backupJson);
    expect(rerun.importedCount).toBe(0);
  });
});

