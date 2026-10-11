import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '../components/Navbar';
import { ModelDownloadBanner } from '../components/ModelDownloadBanner';
import { PredictionCard } from '../components/PredictionCard';
import { JournalList } from '../components/JournalList';
import { AudioRecorder } from '../components/AudioRecorder';
import { AreaSurveyHeader } from '../components/AreaSurveyHeader';
import { SurveyStatsBar } from '../components/SurveyStatsBar';
import { AreaSpeciesChecklist } from '../components/AreaSpeciesChecklist';
import { TestingSection } from '../components/TestingSection';
import { SurveyOnboardingHint } from '../components/SurveyOnboardingHint';
import { OfflineDiagnosticModal } from '../components/OfflineDiagnosticModal';
import { PredictionResult, JournalEntry, SurveyChecklistItem } from '../types/journal';

describe('UI Components', () => {
  it('Navbar renders brand and switches tabs', () => {
    const onTabChange = vi.fn();
    const onToggleSunlight = vi.fn();

    render(
      <Navbar
        activeTab="identify"
        onTabChange={onTabChange}
        isSunlightMode={false}
        onToggleSunlightMode={onToggleSunlight}
        journalCount={3}
      />
    );

    expect(screen.getByText('TrailWhistle')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getAllByText('Identify')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Journal')[0]).toBeInTheDocument();
    expect(screen.queryByText('Touch Grass')).not.toBeInTheDocument();

    const journalTab = screen.getAllByText('Journal')[0];
    fireEvent.click(journalTab);
    expect(onTabChange).toHaveBeenCalledWith('journal');

    const sunlightToggle = screen.getByLabelText(/Toggle outdoor sunlight contrast mode/i);
    fireEvent.click(sunlightToggle);
    expect(onToggleSunlight).toHaveBeenCalled();
  });

  it('ModelDownloadBanner displays progress and error with retry', () => {
    const onRetry = vi.fn();

    // Loading state
    const { rerender } = render(
      <ModelDownloadBanner
        progressInfo={{ status: 'loading', progress: 42, file: 'model.onnx' }}
        onRetry={onRetry}
        isSunlightMode={false}
      />
    );
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText(/Downloading On-Device/i)).toBeInTheDocument();

    // Error state
    rerender(
      <ModelDownloadBanner
        progressInfo={{ status: 'error', progress: 0, errorMessage: 'Network timeout' }}
        onRetry={onRetry}
        isSunlightMode={false}
      />
    );
    expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
    const retryBtn = screen.getByText(/Retry Download/i);
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });

  it('PredictionCard displays top species and triggers quick confirm', () => {
    const onConfirm = vi.fn();
    const onOpenEdit = vi.fn();

    const predictions: PredictionResult[] = [
      {
        speciesId: 'american-robin',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        confidence: 0.89,
        habitat: 'Gardens and woodlands',
        matchedClass: 'Turdus migratorius_American Robin',
      },
      {
        speciesId: 'song-sparrow',
        commonName: 'Song Sparrow',
        scientificName: 'Melospiza melodia',
        confidence: 0.45,
        habitat: 'Edge thickets',
        matchedClass: 'Melospiza melodia_Song Sparrow',
      },
    ];

    render(
      <PredictionCard
        predictions={predictions}
        onConfirm={onConfirm}
        onOpenEditModal={onOpenEdit}
        isSunlightMode={false}
      />
    );

    expect(screen.getByText('American Robin')).toBeInTheDocument();
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument();
    expect(screen.getByText('89% Confidence')).toBeInTheDocument();

    const confirmBtn = screen.getByText('Quick Confirm');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith(predictions[0]);

    const editBtn = screen.getByText('Add Notes / GPS');
    fireEvent.click(editBtn);
    expect(onOpenEdit).toHaveBeenCalledWith(predictions[0]);
  });

  it('PredictionCard displays honest Unknown state when confidence is below 25%', () => {
    const onConfirm = vi.fn();
    const onOpenEdit = vi.fn();

    const unknownPredictions: PredictionResult[] = [
      {
        speciesId: 'unknown',
        commonName: 'Unknown Species',
        scientificName: 'Confidence < 25% — Inconclusive',
        confidence: 0.18,
        habitat: 'Undetermined habitat',
        matchedClass: 'Acoustic confidence below threshold (<25%)',
      },
    ];

    render(
      <PredictionCard
        predictions={unknownPredictions}
        onConfirm={onConfirm}
        onOpenEditModal={onOpenEdit}
        isSunlightMode={false}
      />
    );

    expect(screen.getByText('Unknown Species')).toBeInTheDocument();
    expect(screen.getByText('18% Confidence')).toBeInTheDocument();
    expect(screen.getByText(/Inconclusive Audio/i)).toBeInTheDocument();
    expect(screen.getByText(/never invent fake species/i)).toBeInTheDocument();
    expect(screen.getByText('Log as Unknown')).toBeInTheDocument();
  });

  it('JournalList renders empty state and active observation entries', () => {
    const onDelete = vi.fn();
    const onClear = vi.fn();
    const onGoToIdentify = vi.fn();

    // Empty list
    const { rerender } = render(
      <JournalList
        entries={[]}
        onDeleteEntry={onDelete}
        onClearJournal={onClear}
        isSunlightMode={false}
        onGoToIdentify={onGoToIdentify}
      />
    );

    expect(screen.getByText('No Observations Yet')).toBeInTheDocument();

    // Populated list
    const entries: JournalEntry[] = [
      {
        id: 'entry-1',
        timestamp: '2026-10-07T14:22:00Z',
        commonName: 'Barn Owl',
        scientificName: 'Tyto alba',
        confidence: 0.92,
        notes: 'Heard raspy screech from old barn roof',
        audioDurationSeconds: 3.0,
        source: 'live_mic',
        confirmedByUser: true,
      },
    ];

    rerender(
      <JournalList
        entries={entries}
        onDeleteEntry={onDelete}
        onClearJournal={onClear}
        isSunlightMode={false}
        onGoToIdentify={onGoToIdentify}
      />
    );

    expect(screen.getByText('Barn Owl')).toBeInTheDocument();
    expect(screen.getByText('Tyto alba')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Backup JSON')).toBeInTheDocument();
    expect(screen.getByText('Restore')).toBeInTheDocument();

    const deleteBtn = screen.getByLabelText(/Delete observation for Barn Owl/i);
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('entry-1');
  });

  it('AudioRecorder renders field recorder controls without cluttering demo clips', () => {
    const onCapture = vi.fn();
    render(
      <AudioRecorder
        onAudioCaptured={onCapture}
        isProcessing={false}
        isSunlightMode={false}
      />
    );

    expect(screen.getByLabelText(/Record 3 seconds of bird call/i)).toBeInTheDocument();
    expect(screen.getByText(/Acoustic field recorder/i)).toBeInTheDocument();
    expect(screen.getByText('48kHz Worklet')).toBeInTheDocument();
    // Demo clips are no longer in AudioRecorder prime screen space
    expect(screen.queryByText(/Desktop \/ Trailhead Demo Clips/i)).not.toBeInTheDocument();
  });

  it('TestingSection renders collapsible test clips clearly labeled for testing', () => {
    const onSelectSample = vi.fn();
    render(
      <TestingSection
        onSelectSample={onSelectSample}
        selectedSample={null}
        isProcessing={false}
        isSunlightMode={false}
      />
    );

    expect(screen.getByText(/Field Testing & Audio Simulation/i)).toBeInTheDocument();
    expect(screen.getByText(/For Testing Only/i)).toBeInTheDocument();

    // Default collapsed
    expect(screen.queryByText('American Robin')).not.toBeInTheDocument();

    // Expand
    const expandBtn = screen.getByRole('button', { name: /Field Testing & Audio Simulation/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText('American Robin')).toBeInTheDocument();
    expect(screen.getByText('Barn Owl')).toBeInTheDocument();
    expect(screen.getByText(/Offline QA & Testing/i)).toBeInTheDocument();

    // Trigger test sample
    const robinBtn = screen.getByText('American Robin');
    fireEvent.click(robinBtn);
    expect(onSelectSample).toHaveBeenCalled();
  });

  it('SurveyOnboardingHint renders 4-step survey workflow and handles dismiss', () => {
    render(<SurveyOnboardingHint isSunlightMode={false} />);

    expect(screen.getByText(/Survey Protocol • 4-Step Avian Census Workflow/i)).toBeInTheDocument();
    expect(screen.getByText('1. Arrive')).toBeInTheDocument();
    expect(screen.getByText('2. Sample')).toBeInTheDocument();
    expect(screen.getByText('3. Tally')).toBeInTheDocument();
    expect(screen.getByText('4. Export')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText(/Dismiss survey guide/i);
    fireEvent.click(dismissBtn);

    // After dismiss, shows compact re-open button
    expect(screen.getByText('Survey Workflow Guide')).toBeInTheDocument();
  });

  it('AreaSurveyHeader renders survey location, BirdNET headline, and triggers new survey', () => {
    const onNewSurvey = vi.fn();
    const onExportCsv = vi.fn();
    const onUpdateSurvey = vi.fn();

    render(
      <AreaSurveyHeader
        survey={{
          id: 's-1',
          locationName: 'Pine Ridge Trailhead',
          habitatTag: 'Mixed Woodland',
          startTime: new Date().toISOString(),
        }}
        onUpdateSurvey={onUpdateSurvey}
        onNewSurvey={onNewSurvey}
        onExportCsv={onExportCsv}
        speciesCount={3}
        totalRecordings={5}
        isSunlightMode={false}
      />
    );

    expect(screen.getByRole('heading', { name: 'Pine Ridge Trailhead' })).toBeInTheDocument();
    expect(screen.getByText(/Area biodiversity survey/i)).toBeInTheDocument();
    expect(screen.getByText(/6,522 Species Global Taxonomy/i)).toBeInTheDocument();

    const newSiteBtn = screen.getByText('New Site');
    fireEvent.click(newSiteBtn);
    expect(onNewSurvey).toHaveBeenCalled();

    const exportBtn = screen.getByText('Export Area Survey CSV');
    fireEvent.click(exportBtn);
    expect(onExportCsv).toHaveBeenCalled();
  });

  it('SurveyStatsBar renders species count, recordings, time span, and area coverage', () => {
    render(
      <SurveyStatsBar
        speciesCount={4}
        totalRecordings={9}
        startTime={new Date(Date.now() - 15 * 60000).toISOString()}
        location={{ latitude: 37.77, longitude: -122.42, accuracy: 8 }}
        locationName="Pine Ridge Trailhead"
        isSunlightMode={false}
      />
    );

    expect(screen.getByText('Species Life Count')).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText('species')).toBeInTheDocument();
    expect(screen.getByText('Acoustic Census')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('recordings')).toBeInTheDocument();
    expect(screen.getByText('Survey Elapsed')).toBeInTheDocument();
    expect(screen.getByText('Transect Coverage')).toBeInTheDocument();
    expect(screen.getByText('±8m GPS')).toBeInTheDocument();
  });

  it('AreaSpeciesChecklist renders live species tally and empty state workflow', () => {
    const checklist: SurveyChecklistItem[] = [
      {
        speciesId: 'sp-1',
        commonName: 'American Robin',
        scientificName: 'Turdus migratorius',
        habitat: 'Gardens & woodlands',
        detectionCount: 3,
        maxConfidence: 0.92,
        firstDetectedTime: '2026-10-10T10:00:00Z',
        lastDetectedTime: '2026-10-10T10:15:00Z',
      },
    ];

    const onDemo = vi.fn();
    const { rerender } = render(
      <AreaSpeciesChecklist
        checklist={[]}
        locationName="Pine Ridge Trailhead"
        isSunlightMode={false}
        onRunSampleDemo={onDemo}
      />
    );

    expect(screen.getByText('Census Station Active')).toBeInTheDocument();
    const demoBtn = screen.getByText('Simulate American Robin Call');
    fireEvent.click(demoBtn);
    expect(onDemo).toHaveBeenCalled();

    rerender(
      <AreaSpeciesChecklist
        checklist={checklist}
        locationName="Pine Ridge Trailhead"
        isSunlightMode={false}
      />
    );

    expect(screen.getByText('American Robin')).toBeInTheDocument();
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument();
    expect(screen.getByText('3x heard')).toBeInTheDocument();
    expect(screen.getByText('92% peak')).toBeInTheDocument();
  });

  it('OfflineDiagnosticModal renders readiness checks and storage info', () => {
    const onClose = vi.fn();
    render(
      <OfflineDiagnosticModal
        isOpen={true}
        onClose={onClose}
        isSunlightMode={false}
      />
    );

    expect(screen.getByText('Field Readiness & Offline Diagnostic')).toBeInTheDocument();
    expect(screen.getByText(/6,522 Species Global Taxonomy/i)).toBeInTheDocument();
    expect(screen.getByText(/48kHz AudioWorklet \+ WebAssembly SIMD/i)).toBeInTheDocument();
    expect(screen.getByText('Export Raw JSON Backup')).toBeInTheDocument();

    const closeBtn = screen.getByText('Close Diagnostic');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

