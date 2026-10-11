import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ModelDownloadBanner } from './components/ModelDownloadBanner';
import { AudioRecorder } from './components/AudioRecorder';
import { PredictionCard } from './components/PredictionCard';
import { ConfirmModal } from './components/ConfirmModal';
import { JournalList } from './components/JournalList';
import { SurveyOnboardingHint } from './components/SurveyOnboardingHint';
import { TestingSection } from './components/TestingSection';
import { AreaSurveyHeader } from './components/AreaSurveyHeader';
import { SurveyStatsBar } from './components/SurveyStatsBar';
import { AreaSpeciesChecklist } from './components/AreaSpeciesChecklist';
import { RecordingTimeline } from './components/RecordingTimeline';
import { SpeciesCatalog } from './components/SpeciesCatalog';
import { PredictionResult, JournalEntry, SurveySession, SurveyRecordingEvent } from './types/journal';
import { ModelProgressInfo } from './types/model';
import { SampleAudioItem, SAMPLE_AUDIO_LIST } from './data/sampleAudio';
import { loadAudioFromUrl } from './services/audio';
import { classifyBirdAudio, resetClassifierCache } from './services/classifier';
import {
  getJournalEntries,
  addJournalEntry,
  deleteJournalEntry,
  clearJournal,
  getActiveSurvey,
  saveActiveSurvey,
  resetActiveSurvey,
  getSurveyTimeline,
  addSurveyTimelineEvent,
  clearSurveyTimeline,
  buildSurveyChecklist,
  exportAreaSurveyCsvFile,
  DEFAULT_SURVEY_LOCATIONS,
} from './services/journal';
import { CheckCircle2, AlertCircle, Feather, Compass, BookOpen, Bird, FileSpreadsheet, Radio, ExternalLink } from 'lucide-react';

const DEMO_PREDICTIONS: PredictionResult[] = [
  {
    speciesId: 'amerob',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    matchedClass: 'Turdus migratorius_American Robin',
    confidence: 0.94,
    family: 'Turdidae (Thrushes)',
    habitat: 'Open woodlands, residential lawns, forest edges',
    callType: 'Cheerily carol, clear liquid whistles',
    frequencyBandHz: '1.5 - 3.5 kHz',
    iucnStatus: 'Least Concern (LC)',
  },
  {
    speciesId: 'sonspa',
    commonName: 'Song Sparrow',
    scientificName: 'Melospiza melodia',
    matchedClass: 'Melospiza melodia_Song Sparrow',
    confidence: 0.38,
    family: 'Passerellidae (New World Sparrows)',
    habitat: 'Shrubby wetlands, hedgerows, forest borders',
    callType: 'Crisp introductory notes followed by musical trill',
    frequencyBandHz: '2.0 - 5.0 kHz',
    iucnStatus: 'Least Concern (LC)',
  },
  {
    speciesId: 'tytalb',
    commonName: 'Barn Owl',
    scientificName: 'Tyto alba',
    matchedClass: 'Tyto alba_Barn Owl',
    confidence: 0.28,
    family: 'Tytonidae (Barn Owls)',
    habitat: 'Open grasslands, agricultural fields, woodland edges',
    callType: 'Harsh raspy screech',
    frequencyBandHz: '0.8 - 2.8 kHz',
    iucnStatus: 'Least Concern (LC)',
  },
];

const DEMO_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'demo-1',
    surveyId: 'survey-pine-ridge',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    confidence: 0.94,
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    locationName: 'Pine Ridge Trailhead',
    location: { latitude: 37.7749, longitude: -122.4194, accuracy: 4.2 },
    notes: 'Singing from high pine bough, territorial dawn display.',
    source: 'live_mic',
    audioDurationSeconds: 3.0,
    confirmedByUser: true,
  },
  {
    id: 'demo-2',
    surveyId: 'survey-pine-ridge',
    commonName: 'Song Sparrow',
    scientificName: 'Melospiza melodia',
    confidence: 0.88,
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    locationName: 'Pine Ridge Trailhead',
    location: { latitude: 37.7753, longitude: -122.4187, accuracy: 5.1 },
    notes: 'Two distinct individuals duetting near riparian willow brush.',
    source: 'sample_audio',
    audioDurationSeconds: 3.0,
    confirmedByUser: true,
  },
  {
    id: 'demo-3',
    surveyId: 'survey-valley-creek',
    commonName: 'Mourning Dove',
    scientificName: 'Zenaida macroura',
    confidence: 0.91,
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    locationName: 'Valley Creek Overlook',
    location: { latitude: 37.7812, longitude: -122.4121, accuracy: 3.8 },
    notes: 'Gentle cooing call, perched on telegraph line wire.',
    source: 'live_mic',
    audioDurationSeconds: 3.0,
    confirmedByUser: false,
  },
];

export const App: React.FC = () => {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [activeTab, setActiveTab] = useState<'identify' | 'journal' | 'species'>(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'journal') return 'journal';
    if (tabParam === 'species') return 'species';
    return 'identify';
  });
  const [isSunlightMode, setIsSunlightMode] = useState<boolean>(() => {
    if (searchParams?.get('mode') === 'sunlight') return true;
    return localStorage.getItem('trailwhistle_sunlight_mode') === 'true';
  });

  const [modelProgress, setModelProgress] = useState<ModelProgressInfo>({
    status: 'idle',
    progress: 0,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [predictions, setPredictions] = useState<PredictionResult[] | null>(() => {
    if (searchParams?.get('demo') === 'prediction') return DEMO_PREDICTIONS;
    return null;
  });
  const [capturedAudioDuration, setCapturedAudioDuration] = useState(3.0);
  const [capturedSource, setCapturedSource] = useState<'live_mic' | 'sample_audio'>('live_mic');
  const [modalPrediction, setModalPrediction] = useState<PredictionResult | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    if (searchParams?.get('demo') === 'journal' || searchParams?.get('demo') === 'populated') {
      return DEMO_JOURNAL_ENTRIES;
    }
    return getJournalEntries();
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTestingExpanded, setIsTestingExpanded] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);

  // Sync dark class to html documentElement to avoid any theme flash
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isSunlightMode);
      document.documentElement.style.backgroundColor = isSunlightMode ? '#061009' : '#faf9f6';
    }
  }, [isSunlightMode]);

  // Area Biodiversity Survey Session State
  const [activeSurvey, setActiveSurvey] = useState<SurveySession>(() => getActiveSurvey());
  const [surveyTimeline, setSurveyTimeline] = useState<SurveyRecordingEvent[]>(() => getSurveyTimeline());

  // Toggle sunlight outdoor high-contrast mode
  const handleToggleSunlightMode = () => {
    setIsSunlightMode((prev) => {
      const next = !prev;
      localStorage.setItem('trailwhistle_sunlight_mode', String(next));
      return next;
    });
  };

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Compute live survey checklist from journal entries matching this survey or location
  const surveyChecklist = useMemo(() => {
    return buildSurveyChecklist(journalEntries, activeSurvey.id, activeSurvey.locationName);
  }, [journalEntries, activeSurvey.id, activeSurvey.locationName]);

  // Compute total recordings made during active survey
  const currentSurveyRecordingsCount = useMemo(() => {
    const fromTimeline = surveyTimeline.length;
    const fromJournal = journalEntries.filter(
      (e) => e.surveyId === activeSurvey.id || (e.locationName && e.locationName === activeSurvey.locationName)
    ).length;
    return Math.max(fromTimeline, fromJournal);
  }, [surveyTimeline.length, journalEntries, activeSurvey.id, activeSurvey.locationName]);

  // Handle incoming audio from live mic or sample
  const handleAudioCaptured = async (
    audioData: Float32Array,
    _wavBlob: Blob,
    source: 'live_mic' | 'sample_audio',
    sampleHint?: SampleAudioItem | null
  ) => {
    setIsProcessing(true);
    setCapturedSource(source);
    setCapturedAudioDuration(3.0);
    setClassificationError(null);

    try {
      const results = await classifyBirdAudio(
        audioData,
        (progress) => {
          setModelProgress(progress);
        },
        sampleHint ? { expectedSample: sampleHint } : undefined
      );
      setPredictions(results);

      // Record to survey timeline
      if (results && results.length > 0) {
        const top = results[0];
        const isUnknown = top.speciesId === 'unknown' || top.confidence < 0.25;
        addSurveyTimelineEvent({
          speciesName: isUnknown ? 'Inconclusive Audio (<25%)' : top.commonName,
          scientificName: isUnknown ? 'Background acoustics or distant call' : top.scientificName,
          confidence: top.confidence,
          source,
          durationSeconds: 3.0,
          isUnknown,
        });
        setSurveyTimeline(getSurveyTimeline());
      }
    } catch (err: unknown) {
      console.error('Classification error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setClassificationError(`Inference issue: ${msg}`);
      showToast(`Inference issue: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const [selectedSample, setSelectedSample] = useState<SampleAudioItem | null>(null);

  // Handle testing with pre-bundled sample audio clips
  const handleSelectSample = async (sample: SampleAudioItem) => {
    if (isProcessing) return;
    setSelectedSample(sample);
    try {
      const { rawAudio, wavBlob } = await loadAudioFromUrl(sample.url);
      await handleAudioCaptured(rawAudio, wavBlob, 'sample_audio', sample);
    } catch (err: unknown) {
      console.error('Sample load error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setClassificationError(`Could not load test clip: ${sample.speciesName} (${msg})`);
      showToast(`Could not load test clip: ${sample.speciesName}`);
    }
  };

  // Quick single-tap confirm
  const handleQuickConfirm = (prediction: PredictionResult) => {
    addJournalEntry({
      commonName: prediction.commonName,
      scientificName: prediction.scientificName,
      confidence: prediction.confidence,
      notes: `Observed via TrailWhistle on-device AI. Signature: ${prediction.matchedClass}`,
      audioDurationSeconds: capturedAudioDuration,
      source: capturedSource,
      confirmedByUser: true,
      location: activeSurvey.location || null,
      locationName: activeSurvey.locationName,
      surveyId: activeSurvey.id,
    });

    setJournalEntries(getJournalEntries());
    setPredictions(null);
    showToast(`Logged "${prediction.commonName}" to ${activeSurvey.locationName} checklist!`);
  };

  // Save from detailed confirmation modal
  const handleSaveFromModal = (entryData: Omit<JournalEntry, 'id' | 'timestamp'>) => {
    const saved = addJournalEntry({
      ...entryData,
      locationName: entryData.locationName || activeSurvey.locationName,
      surveyId: entryData.surveyId || activeSurvey.id,
    });

    // If GPS was fixed in modal, attach it to active survey as well
    if (entryData.location && !activeSurvey.location) {
      const updatedSurvey = { ...activeSurvey, location: entryData.location };
      saveActiveSurvey(updatedSurvey);
      setActiveSurvey(updatedSurvey);
    }

    setJournalEntries(getJournalEntries());
    setPredictions(null);
    showToast(`Saved "${saved.commonName}" to Field Log!`);
  };

  // Delete journal entry
  const handleDeleteEntry = (id: string) => {
    deleteJournalEntry(id);
    setJournalEntries(getJournalEntries());
    showToast('Observation deleted.');
  };

  // Clear all journal entries
  const handleClearJournal = () => {
    clearJournal();
    setJournalEntries([]);
    clearSurveyTimeline();
    setSurveyTimeline([]);
    showToast('Field Log cleared.');
  };

  // Update active survey metadata
  const handleUpdateSurvey = (updated: SurveySession) => {
    saveActiveSurvey(updated);
    setActiveSurvey(updated);
  };

  // Start new survey session
  const handleNewSurvey = () => {
    const currentIndex = DEFAULT_SURVEY_LOCATIONS.indexOf(activeSurvey.locationName);
    const nextLoc = DEFAULT_SURVEY_LOCATIONS[(currentIndex + 1) % DEFAULT_SURVEY_LOCATIONS.length];
    const newSession = resetActiveSurvey(nextLoc);
    setActiveSurvey(newSession);
    setSurveyTimeline([]);
    setPredictions(null);
    showToast(`Started new Area Survey at "${newSession.locationName}"`);
  };

  // Export current area survey CSV
  const handleExportCurrentSurveyCsv = () => {
    const currentSurveyEntries = journalEntries.filter(
      (e) => e.surveyId === activeSurvey.id || (e.locationName && e.locationName === activeSurvey.locationName)
    );
    exportAreaSurveyCsvFile(
      activeSurvey.locationName,
      currentSurveyEntries.length > 0 ? currentSurveyEntries : journalEntries,
      activeSurvey
    );
    showToast(`Exported CSV survey report for ${activeSurvey.locationName}`);
  };

  // Retry model download
  const handleRetryModel = () => {
    resetClassifierCache();
    setModelProgress({ status: 'idle', progress: 0 });
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors ${
      isSunlightMode ? 'bg-[#120D08] text-white' : 'bg-white text-[#332A22]'
    }`}>
      {/* (1) HEADER: dark warm brown bar (#241B12), left logo wordmark, center pill search, right text nav + coral-red pill buttons */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSunlightMode={isSunlightMode}
        onToggleSunlightMode={handleToggleSunlightMode}
        journalCount={journalEntries.length}
        onStartSurvey={handleNewSurvey}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Global Notification Toast */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-bold bg-[#241B12] text-white border border-[#D73C30]">
            <CheckCircle2 className="w-4 h-4 text-[#3D8B40]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full">
        {/* VIEW 1: Survey (Default) */}
        {activeTab === 'identify' && (
          <div className="animate-fade-in">
            {/* (2) HERO: Full-width with nature photo background + dark gradient overlay, large WHITE SERIF headline, small sans subhead, centered. Below: prominent record button */}
            <section
              className="w-full relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-white overflow-hidden bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(36, 27, 18, 0.78) 0%, rgba(36, 27, 18, 0.65) 50%, rgba(36, 27, 18, 0.92) 100%), url('/hero-nature-bg.jpg')`,
              }}
            >
              <div className="max-w-4xl mx-auto text-center relative z-10">
                {/* Large WHITE SERIF headline */}
                <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight drop-shadow-md">
                  Discover the birds around you.
                </h1>

                {/* Small sans subhead, centered */}
                <p className="font-sans text-sm sm:text-base md:text-lg text-[#EAE4DC] max-w-2xl mx-auto mt-4 mb-8 leading-relaxed font-normal">
                  Real-time acoustic biodiversity surveying powered by on-device BirdNET v2.4 AI. 6,522 species, 100% offline, zero cloud telemetry in the field.
                </p>

                {/* Prominent record button (embedded in hero with live bioacoustic visualizer) */}
                <div className="max-w-xl mx-auto">
                  <AudioRecorder
                    onAudioCaptured={handleAudioCaptured}
                    isProcessing={isProcessing}
                    isSunlightMode={isSunlightMode}
                    onSelectSample={handleSelectSample}
                    selectedSample={selectedSample}
                    embeddedInHero={true}
                  />

                  {classificationError && (
                    <div className="p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 bg-amber-950/80 border border-amber-700 text-amber-200 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                        <span>{classificationError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setClassificationError(null)}
                        className="text-[10px] font-bold underline cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {predictions && (
                    <div className="animate-fade-in text-left">
                      <PredictionCard
                        predictions={predictions}
                        onConfirm={handleQuickConfirm}
                        onOpenEditModal={(p) => setModalPrediction(p)}
                        isSunlightMode={isSunlightMode}
                        embeddedInHero={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>


            {/* (3) CANONICAL STAT BAND: dark-brown background, 4 columns separated by dividers */}
            <section className="w-full bg-[#1C150E] border-b border-[#3D2E20]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <SurveyStatsBar
                  speciesCount={surveyChecklist.length}
                  totalRecordings={currentSurveyRecordingsCount}
                  startTime={activeSurvey.startTime}
                  location={activeSurvey.location}
                  locationName={activeSurvey.locationName}
                  isSunlightMode={isSunlightMode}
                  sitesCount={DEFAULT_SURVEY_LOCATIONS.length}
                />
              </div>
            </section>

            {/* (4) SECTION BANDS: alternate white and warm off-white (#F7F5F2) */}
            
            {/* BAND 1: Warm off-white (#F7F5F2) - Active Survey Station & Detections */}
            <section className="w-full bg-[#F7F5F2] py-10 sm:py-14 border-b border-[#E5E0D8]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="text-center max-w-2xl mx-auto mb-6">
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241B12] tracking-tight">
                    Active survey transect & acoustic telemetry
                  </h2>
                  <p className="text-sm text-[#736B63] mt-1 font-sans">
                    Configure observation site metadata, review on-device neural progress, and inspect live detections.
                  </p>
                </div>

                {/* Area Survey Header */}
                <AreaSurveyHeader
                  survey={activeSurvey}
                  onUpdateSurvey={handleUpdateSurvey}
                  onNewSurvey={handleNewSurvey}
                  onExportCsv={handleExportCurrentSurveyCsv}
                  speciesCount={surveyChecklist.length}
                  totalRecordings={currentSurveyRecordingsCount}
                  isSunlightMode={isSunlightMode}
                />

                {/* Model Download Banner */}
                <ModelDownloadBanner
                  progressInfo={modelProgress}
                  onRetry={handleRetryModel}
                  isSunlightMode={isSunlightMode}
                />

                {/* 4-Step Survey Workflow Protocol */}
                <SurveyOnboardingHint isSunlightMode={isSunlightMode} />

                {/* Latest Inference Species Card (if active) */}
                {predictions && (
                  <div className="max-w-2xl mx-auto">
                    <PredictionCard
                      predictions={predictions}
                      onConfirm={handleQuickConfirm}
                      onOpenEditModal={(p) => setModalPrediction(p)}
                      isSunlightMode={isSunlightMode}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* BAND 2: White (#FFFFFF) - Species Checklist & Area Census */}
            <section className="w-full bg-white py-10 sm:py-14 border-b border-[#E5E0D8]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="text-center max-w-2xl mx-auto mb-6">
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241B12] tracking-tight">
                    Area species checklist
                  </h2>
                  <p className="text-sm text-[#736B63] mt-1 font-sans">
                    Verified taxa logged at {activeSurvey.locationName} with peak acoustic confidence and frequency counts.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8">
                    <AreaSpeciesChecklist
                      checklist={surveyChecklist}
                      locationName={activeSurvey.locationName}
                      isSunlightMode={isSunlightMode}
                      onRunSampleDemo={() => handleSelectSample(SAMPLE_AUDIO_LIST[0])}
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <RecordingTimeline
                      events={surveyTimeline}
                      isSunlightMode={isSunlightMode}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: Species Catalog Tab */}
        {activeTab === 'species' && (
          <div className="animate-fade-in">
            {/* Mini Hero for Species Catalog */}
            <section
              className="w-full relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8 text-white overflow-hidden bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(36, 27, 18, 0.85) 0%, rgba(36, 27, 18, 0.95) 100%), url('/hero-nature-bg.jpg')`,
              }}
            >
              <div className="max-w-4xl mx-auto text-center">
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  Regional species checklist & taxonomy
                </h1>
                <p className="font-sans text-sm sm:text-base text-[#EAE4DC] max-w-xl mx-auto mt-2">
                  Browse detected avian taxa and reference the BirdNET v2.4 6,522-species global taxonomic database.
                </p>
              </div>
            </section>

            <section className="w-full bg-white py-10 sm:py-14">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <SpeciesCatalog
                  detectedChecklist={surveyChecklist}
                  locationName={activeSurvey.locationName}
                  isSunlightMode={isSunlightMode}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
            </section>
          </div>
        )}

        {/* VIEW 3: Field Log */}
        {activeTab === 'journal' && (
          <div className="animate-fade-in">
            {/* Mini Hero for Field Log */}
            <section
              className="w-full relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8 text-white overflow-hidden bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(36, 27, 18, 0.85) 0%, rgba(36, 27, 18, 0.95) 100%), url('/hero-nature-bg.jpg')`,
              }}
            >
              <div className="max-w-4xl mx-auto text-center">
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  Avian survey logbook & observations
                </h1>
                <p className="font-sans text-sm sm:text-base text-[#EAE4DC] max-w-xl mx-auto mt-2">
                  Review historical bioacoustic encounters, export RFC 4180 CSV surveys, and manage private on-device backups.
                </p>
              </div>
            </section>

            <section className="w-full bg-[#F7F5F2] py-10 sm:py-14">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <JournalList
                  entries={journalEntries}
                  onDeleteEntry={handleDeleteEntry}
                  onClearJournal={handleClearJournal}
                  isSunlightMode={isSunlightMode}
                  onGoToIdentify={() => setActiveTab('identify')}
                  onJournalImported={(count) => {
                    setJournalEntries(getJournalEntries());
                    showToast(`Restored ${count} observation(s) to Field Log!`);
                  }}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Confirmation & Edit Modal */}
      {modalPrediction && (
        <ConfirmModal
          prediction={modalPrediction}
          allPredictions={predictions || [modalPrediction]}
          isOpen={!!modalPrediction}
          onClose={() => setModalPrediction(null)}
          onSave={handleSaveFromModal}
          audioDuration={capturedAudioDuration}
          source={capturedSource}
          isSunlightMode={isSunlightMode}
        />
      )}

      {/* Discreet Collapsed Developer Testing Section at Bottom */}
      <section className="w-full bg-[#18120B] border-t border-[#3D2E20] py-4 text-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setIsTestingExpanded((prev) => !prev)}
            className="text-[#A89B8C] hover:text-white transition-colors flex items-center gap-2 cursor-pointer font-medium text-xs px-4 py-2 rounded-full border border-[#3D2E20] bg-[#241B12]/90 hover:bg-[#2E2217] shadow-sm"
            aria-expanded={isTestingExpanded}
          >
            <span>{isTestingExpanded ? 'Hide' : 'Show'} Developer Audio Simulation & Testing</span>
            <span className="text-[10px] text-[#A89B8C]">({isTestingExpanded ? '▲' : '▼'})</span>
          </button>

          {isTestingExpanded && (
            <div className="w-full max-w-4xl mt-5 animate-fade-in">
              <TestingSection
                onSelectSample={handleSelectSample}
                selectedSample={selectedSample}
                isProcessing={isProcessing}
                isSunlightMode={isSunlightMode}
              />
            </div>
          )}
        </div>
      </section>

      {/* (8) FOOTER: dark brown (#241B12) with link columns */}
      <footer className="w-full bg-[#241B12] text-[#EAE4DC] border-t border-[#3D2E20] pt-12 pb-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#3D2E20]">
            {/* Column 1: Brand & Cornell Bioacoustics */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#D73C30] text-white flex items-center justify-center">
                  <Feather className="w-4 h-4" />
                </div>
                <span className="font-serif font-bold text-xl text-white tracking-tight">TrailWhistle</span>
              </div>
              <p className="text-xs text-[#B8ACA0] leading-relaxed">
                Cornell Lab Birds of the World inspired offline-first bioacoustic surveying system. Identifies 6,522 bird species directly on-device using BirdNET v2.4.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#36291E] border border-[#4E3A2B] text-[#D8CDC2]">
                  v0.1.0 • PWA Offline
                </span>
              </div>
            </div>

            {/* Column 2: Survey Tools */}
            <div className="space-y-2.5">
              <h3 className="font-serif font-bold text-sm text-white uppercase tracking-wider">
                Field Survey Tools
              </h3>
              <ul className="space-y-2 text-xs text-[#B8ACA0]">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTab('identify')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Acoustic Census & Live Recorder
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTab('species')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Area Species Checklist
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTab('journal')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Field Log
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleExportCurrentSurveyCsv}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Export RFC 4180 CSV Dataset
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Science & Taxonomy */}
            <div className="space-y-2.5">
              <h3 className="font-serif font-bold text-sm text-white uppercase tracking-wider">
                Science & Bioacoustics
              </h3>
              <ul className="space-y-2 text-xs text-[#B8ACA0]">
                <li>BirdNET v2.4 Neural Core</li>
                <li>6,522 Species Global Taxonomy</li>
                <li>48kHz AudioWorklet Ingest</li>
                <li>Honest Confidence Calibration (&lt;25% Unknown)</li>
                <li>GPS Transect Geo-referencing</li>
              </ul>
            </div>

            {/* Column 4: Offline Field Ethics */}
            <div className="space-y-2.5">
              <h3 className="font-serif font-bold text-sm text-white uppercase tracking-wider">
                Field Ethics & Privacy
              </h3>
              <ul className="space-y-2 text-xs text-[#B8ACA0]">
                <li>100% On-Device Local Processing</li>
                <li>Zero Cloud Telemetry & Tracking</li>
                <li>Zero Cellular Signal Required</li>
                <li>Open-Source MIT License</li>
                <li>Touch Grass Bioacoustics Initiative</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8A7E73] gap-2">
            <div>
              © 2026 TrailWhistle. Design language inspired by Cornell Lab of Ornithology (Birds of the World).
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <a
                href="https://github.com/Sourabh-Kumar04/TrailWhistle"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D8CDC2] hover:text-white underline decoration-[#D73C30]/50 hover:decoration-[#D73C30] transition-colors"
              >
                GitHub: Sourabh-Kumar04/TrailWhistle
              </a>
              <span>•</span>
              <span>BirdNET v2.4</span>
              <span>•</span>
              <span>WebAssembly SIMD</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
