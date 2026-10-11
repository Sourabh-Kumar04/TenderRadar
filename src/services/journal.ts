/**
 * TrailWhistle Field Journal & Area Biodiversity Survey Service
 * LocalStorage persistence, area checklist aggregation, location grouping, and CSV export.
 * Zero cloud dependency.
 */

import {
  JournalEntry,
  SurveySession,
  SurveyRecordingEvent,
  SurveyChecklistItem,
} from '../types/journal';
import { BIRD_SPECIES_DATABASE } from '../data/birdDatabase';

export const JOURNAL_STORAGE_KEY = 'trailwhistle_field_journal_v1';
export const ACTIVE_SURVEY_STORAGE_KEY = 'trailwhistle_active_survey_v1';
export const SURVEY_TIMELINE_STORAGE_KEY = 'trailwhistle_survey_timeline_v1';

export const DEFAULT_SURVEY_LOCATIONS = [
  'Pine Ridge Trailhead',
  'Redwood Creek Basin',
  'Oak Canopy Transect',
  'Meadowbrook Wetlands',
  'Highland Ridge Sector',
  'Backyard Bio-Station',
];

export const HABITAT_TAGS = [
  'Mixed Woodland',
  'Riparian / Wetland',
  'Conifer Forest',
  'Open Meadow',
  'Suburban Canopy',
  'Chaparral / Scrub',
];

// --- JOURNAL ENTRIES ---

export function getJournalEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    console.error('Failed to parse journal entries from localStorage', e);
    return [];
  }
}

export function saveJournalEntries(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save journal entries to localStorage', e);
  }
}

export function addJournalEntry(
  entry: Omit<JournalEntry, 'id' | 'timestamp'> & { timestamp?: string }
): JournalEntry {
  const entries = getJournalEntries();
  const newEntry: JournalEntry = {
    ...entry,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  entries.unshift(newEntry);
  saveJournalEntries(entries);
  return newEntry;
}

export function deleteJournalEntry(id: string): boolean {
  const entries = getJournalEntries();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length !== entries.length) {
    saveJournalEntries(filtered);
    return true;
  }
  return false;
}

export function clearJournal(): void {
  localStorage.removeItem(JOURNAL_STORAGE_KEY);
}

// --- ACTIVE SURVEY SESSION ---

export function getActiveSurvey(): SurveySession {
  try {
    const raw = localStorage.getItem(ACTIVE_SURVEY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.locationName) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse active survey session', e);
  }

  // Default initial session
  const defaultSession: SurveySession = {
    id: `survey-${Date.now()}`,
    locationName: 'Pine Ridge Trailhead',
    habitatTag: 'Mixed Woodland',
    startTime: new Date().toISOString(),
    location: null,
  };
  saveActiveSurvey(defaultSession);
  return defaultSession;
}

export function saveActiveSurvey(survey: SurveySession): void {
  try {
    localStorage.setItem(ACTIVE_SURVEY_STORAGE_KEY, JSON.stringify(survey));
  } catch (e) {
    console.error('Failed to save active survey session', e);
  }
}

export function resetActiveSurvey(locationName?: string, habitatTag?: string): SurveySession {
  const newSession: SurveySession = {
    id: `survey-${Date.now()}`,
    locationName: locationName || 'Pine Ridge Trailhead',
    habitatTag: habitatTag || 'Mixed Woodland',
    startTime: new Date().toISOString(),
    location: null,
  };
  saveActiveSurvey(newSession);
  clearSurveyTimeline();
  return newSession;
}

// --- SURVEY RECORDING TIMELINE ---

export function getSurveyTimeline(): SurveyRecordingEvent[] {
  try {
    const raw = localStorage.getItem(SURVEY_TIMELINE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    console.error('Failed to parse survey timeline', e);
    return [];
  }
}

export function addSurveyTimelineEvent(
  event: Omit<SurveyRecordingEvent, 'id' | 'timestamp'> & { timestamp?: string }
): SurveyRecordingEvent {
  const events = getSurveyTimeline();
  const newEvent: SurveyRecordingEvent = {
    ...event,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  events.unshift(newEvent);
  // Keep up to 50 recent events
  const trimmed = events.slice(0, 50);
  try {
    localStorage.setItem(SURVEY_TIMELINE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save survey timeline event', e);
  }
  return newEvent;
}

export function clearSurveyTimeline(): void {
  localStorage.removeItem(SURVEY_TIMELINE_STORAGE_KEY);
}

// --- LIVE SPECIES CHECKLIST AGGREGATION ---

/**
 * Computes a live species checklist for a given survey session or location.
 * Aggregates detection counts, peak confidence, and timestamps.
 */
export function buildSurveyChecklist(
  entries: JournalEntry[],
  surveyId?: string,
  locationName?: string
): SurveyChecklistItem[] {
  // Filter entries belonging to this survey or location
  const relevantEntries = entries.filter((e) => {
    if (surveyId && e.surveyId === surveyId) return true;
    if (locationName && e.locationName && e.locationName.toLowerCase() === locationName.toLowerCase()) return true;
    return false;
  });

  const map = new Map<string, SurveyChecklistItem>();

  for (const entry of relevantEntries) {
    const key = entry.commonName.toLowerCase().trim();
    const existing = map.get(key);

    const dbMatch = BIRD_SPECIES_DATABASE.find(
      (b) => b.commonName.toLowerCase() === key || b.scientificName.toLowerCase() === entry.scientificName.toLowerCase()
    );
    const habitat = dbMatch?.habitat || 'Mixed forest & canopy';

    if (!existing) {
      map.set(key, {
        speciesId: dbMatch?.id || `species-${key.replace(/\s+/g, '-')}`,
        commonName: entry.commonName,
        scientificName: entry.scientificName,
        habitat,
        detectionCount: 1,
        maxConfidence: entry.confidence,
        firstDetectedTime: entry.timestamp,
        lastDetectedTime: entry.timestamp,
        iucnStatus: dbMatch?.iucnStatus,
        family: dbMatch?.family,
      });
    } else {
      existing.detectionCount += 1;
      if (entry.confidence > existing.maxConfidence) {
        existing.maxConfidence = entry.confidence;
      }
      if (new Date(entry.timestamp) < new Date(existing.firstDetectedTime)) {
        existing.firstDetectedTime = entry.timestamp;
      }
      if (new Date(entry.timestamp) > new Date(existing.lastDetectedTime)) {
        existing.lastDetectedTime = entry.timestamp;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.detectionCount - a.detectionCount || b.maxConfidence - a.maxConfidence);
}

// --- LOCATION GROUPING FOR JOURNAL LOG ---

export interface SurveyLocationGroup {
  locationName: string;
  entries: JournalEntry[];
  speciesCount: number;
  totalDetections: number;
  latestTimestamp: string;
  earliestTimestamp: string;
  distinctSpecies: Array<{
    commonName: string;
    scientificName: string;
    count: number;
    maxConfidence: number;
  }>;
  hasGps: boolean;
  representativeGps?: { latitude: number; longitude: number; accuracy?: number } | null;
}

export function groupEntriesByLocation(entries: JournalEntry[]): SurveyLocationGroup[] {
  const groupsMap = new Map<string, JournalEntry[]>();

  for (const entry of entries) {
    const loc = entry.locationName?.trim() || 'General Field Observations';
    const list = groupsMap.get(loc) || [];
    list.push(entry);
    groupsMap.set(loc, list);
  }

  const result: SurveyLocationGroup[] = [];

  for (const [locationName, groupEntries] of groupsMap.entries()) {
    // Sort entries descending by timestamp
    const sorted = [...groupEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Compute distinct species
    const speciesMap = new Map<string, { commonName: string; scientificName: string; count: number; maxConfidence: number }>();
    let representativeGps: { latitude: number; longitude: number; accuracy?: number } | null = null;

    for (const e of sorted) {
      const key = e.commonName.toLowerCase().trim();
      const existing = speciesMap.get(key);
      if (!existing) {
        speciesMap.set(key, {
          commonName: e.commonName,
          scientificName: e.scientificName,
          count: 1,
          maxConfidence: e.confidence,
        });
      } else {
        existing.count += 1;
        if (e.confidence > existing.maxConfidence) {
          existing.maxConfidence = e.confidence;
        }
      }

      if (e.location && !representativeGps) {
        representativeGps = {
          latitude: e.location.latitude,
          longitude: e.location.longitude,
          accuracy: e.location.accuracy,
        };
      }
    }

    const distinctSpecies = Array.from(speciesMap.values()).sort((a, b) => b.count - a.count);

    result.push({
      locationName,
      entries: sorted,
      speciesCount: distinctSpecies.length,
      totalDetections: sorted.length,
      latestTimestamp: sorted[0]?.timestamp || new Date().toISOString(),
      earliestTimestamp: sorted[sorted.length - 1]?.timestamp || new Date().toISOString(),
      distinctSpecies,
      hasGps: representativeGps !== null,
      representativeGps,
    });
  }

  // Sort groups by latest activity descending
  return result.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
}

// --- FILTERING ---

export interface JournalFilterOptions {
  query?: string;
  startDate?: string;
  endDate?: string;
  confirmedOnly?: boolean;
  locationFilter?: string;
}

export function filterJournalEntries(
  entries: JournalEntry[],
  filters: JournalFilterOptions
): JournalEntry[] {
  return entries.filter((entry) => {
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      const matchCommon = entry.commonName.toLowerCase().includes(q);
      const matchScientific = entry.scientificName.toLowerCase().includes(q);
      const matchNotes = entry.notes.toLowerCase().includes(q);
      const matchLoc = entry.locationName ? entry.locationName.toLowerCase().includes(q) : false;
      if (!matchCommon && !matchScientific && !matchNotes && !matchLoc) {
        return false;
      }
    }

    if (filters.locationFilter && filters.locationFilter !== 'all') {
      const currentLoc = (entry.locationName || 'General Field Observations').toLowerCase();
      if (currentLoc !== filters.locationFilter.toLowerCase()) {
        return false;
      }
    }

    if (filters.confirmedOnly && !entry.confirmedByUser) {
      return false;
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate).getTime();
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime < start) return false;
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate).getTime();
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime > end) return false;
    }

    return true;
  });
}

// --- CSV EXPORT (RFC 4180) ---

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateJournalCsv(entries: JournalEntry[]): string {
  const headers = [
    'id',
    'timestamp_utc',
    'survey_location',
    'species_common_name',
    'species_scientific_name',
    'confidence_pct',
    'notes',
    'latitude',
    'longitude',
    'gps_accuracy_m',
    'audio_duration_sec',
    'source',
    'confirmed_by_user',
  ];

  const rows = entries.map((e) => [
    escapeCsvField(e.id),
    escapeCsvField(e.timestamp),
    escapeCsvField(e.locationName ?? 'General Observation'),
    escapeCsvField(e.commonName),
    escapeCsvField(e.scientificName),
    escapeCsvField((e.confidence * 100).toFixed(1) + '%'),
    escapeCsvField(e.notes),
    escapeCsvField(e.location?.latitude ?? ''),
    escapeCsvField(e.location?.longitude ?? ''),
    escapeCsvField(e.location?.accuracy ?? ''),
    escapeCsvField(e.audioDurationSeconds),
    escapeCsvField(e.source),
    escapeCsvField(e.confirmedByUser ? 'yes' : 'no'),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Generates an Area Biodiversity Survey report CSV with summary checklist and individual records
 */
export function generateAreaSurveyCsv(
  locationName: string,
  entries: JournalEntry[],
  session?: SurveySession
): string {
  const checklist = buildSurveyChecklist(entries, session?.id, locationName);
  const now = new Date().toISOString();

  const lines: string[] = [];
  lines.push('# TRAILWHISTLE AREA BIODIVERSITY SURVEY REPORT');
  lines.push(`# Survey Location: ${locationName}`);
  lines.push(`# Habitat Tag: ${session?.habitatTag || 'Mixed Woodland'}`);
  lines.push(`# Export Timestamp: ${now}`);
  lines.push(`# Species Richness Count: ${checklist.length}`);
  lines.push(`# Total Detections: ${entries.length}`);
  lines.push('');
  lines.push('--- SPECIES CHECKLIST SUMMARY ---');
  lines.push('common_name,scientific_name,habitat,detection_count,peak_confidence_pct,first_heard,last_heard');

  for (const item of checklist) {
    lines.push([
      escapeCsvField(item.commonName),
      escapeCsvField(item.scientificName),
      escapeCsvField(item.habitat),
      escapeCsvField(item.detectionCount),
      escapeCsvField((item.maxConfidence * 100).toFixed(1) + '%'),
      escapeCsvField(item.firstDetectedTime),
      escapeCsvField(item.lastDetectedTime),
    ].join(','));
  }

  lines.push('');
  lines.push('--- DETAILED ACOUSTIC OBSERVATIONS ---');
  lines.push(generateJournalCsv(entries));

  return lines.join('\r\n');
}

export function exportJournalToCsvFile(entries: JournalEntry[]): void {
  const csvContent = generateJournalCsv(entries);
  downloadBlobAsFile(csvContent, `trailwhistle_field_journal_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportAreaSurveyCsvFile(
  locationName: string,
  entries: JournalEntry[],
  session?: SurveySession
): void {
  const csvContent = generateAreaSurveyCsv(locationName, entries, session);
  const cleanLoc = locationName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlobAsFile(csvContent, `trailwhistle_survey_${cleanLoc}_${dateStr}.csv`);
}

export function exportJournalToJsonFile(entries: JournalEntry[], session?: SurveySession): void {
  const data = {
    app: 'TrailWhistle',
    version: '0.1.0',
    exportedAt: new Date().toISOString(),
    session,
    entries,
  };
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `trailwhistle_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importJournalFromJson(jsonString: string): { importedCount: number } {
  const parsed = JSON.parse(jsonString);
  const rawList = Array.isArray(parsed) ? parsed : parsed.entries || parsed.journalEntries;
  if (!Array.isArray(rawList)) {
    throw new Error('Invalid backup file: no entries array found');
  }

  const existing = getJournalEntries();
  const existingIds = new Set(existing.map((e) => e.id));
  let importedCount = 0;

  for (const item of rawList) {
    if (item.commonName && item.scientificName) {
      if (!existingIds.has(item.id)) {
        existing.push(item);
        existingIds.add(item.id);
        importedCount++;
      }
    }
  }

  saveJournalEntries(existing);
  return { importedCount };
}

function downloadBlobAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

