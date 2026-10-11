export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
}

export interface BirdSpecies {
  id: string;
  commonName: string;
  scientificName: string;
  family: string;
  habitat: string;
  description: string;
  audiosetClasses: string[];
  iucnStatus?: string;
  callType?: string;
  frequencyBandHz?: string;
}

export interface PredictionResult {
  speciesId: string;
  commonName: string;
  scientificName: string;
  confidence: number; // 0.0 - 1.0
  habitat: string;
  matchedClass: string;
  family?: string;
  iucnStatus?: string;
  callType?: string;
  frequencyBandHz?: string;
}

export interface JournalEntry {
  id: string;
  timestamp: string; // ISO string
  commonName: string;
  scientificName: string;
  confidence: number;
  notes: string;
  location?: GeoLocation | null;
  locationName?: string; // e.g. "Pine Ridge Trail", "Redwood Creek Basin"
  surveyId?: string; // id of survey session
  audioDurationSeconds: number;
  source: 'live_mic' | 'sample_audio';
  confirmedByUser: boolean;
}

export interface SurveyChecklistItem {
  speciesId: string;
  commonName: string;
  scientificName: string;
  habitat: string;
  detectionCount: number;
  maxConfidence: number;
  firstDetectedTime: string;
  lastDetectedTime: string;
  iucnStatus?: string;
  family?: string;
}

export interface SurveyRecordingEvent {
  id: string;
  timestamp: string;
  speciesName: string;
  scientificName: string;
  confidence: number;
  source: 'live_mic' | 'sample_audio';
  durationSeconds: number;
  isUnknown?: boolean;
}

export interface SurveySession {
  id: string;
  locationName: string;
  habitatTag?: string;
  startTime: string; // ISO string
  endTime?: string;
  location?: GeoLocation | null;
}
